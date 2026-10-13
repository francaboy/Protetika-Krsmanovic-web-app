const { query } = require("../config/db");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { emitToBoard, emitToUser, emitGlobal, logActivity } = require("../realtime");
const { notifyUsers, getBoardMemberIds } = require("../utils/notifier");

const PRIORITIES = ["low", "medium", "high", "urgent"];

const fetchTask = async (taskId) => {
  const { rows } = await query(
    `SELECT t.*,
            b.title AS board_title, b.color AS board_color,
            a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
       FROM tasks t
       JOIN boards b ON b.id = t.board_id
       LEFT JOIN users a ON a.id = t.assignee_id
      WHERE t.id = $1`,
    [taskId]
  );
  return rows[0];
};

const ensureColumnInBoard = async (columnId, boardId) => {
  const { rows } = await query(
    "SELECT id FROM columns WHERE id = $1 AND board_id = $2",
    [columnId, boardId]
  );
  if (!rows.length) throw ApiError.badRequest("Faza rada ne pripada izabranoj tabeli");
};

// GET /api/boards/:boardId/tasks
const listTasks = asyncHandler(async (req, res) => {
  const filters = ["t.board_id = $1", "(t.is_archived IS FALSE OR t.is_archived IS NULL)"];
  const params = [req.board.id];

  if (req.query.priority) {
    params.push(req.query.priority);
    filters.push(`t.priority = $${params.length}`);
  }
  if (req.query.assignee) {
    params.push(req.query.assignee);
    filters.push(`t.assignee_id = $${params.length}`);
  }
  if (req.query.column) {
    params.push(req.query.column);
    filters.push(`t.column_id = $${params.length}`);
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    filters.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
  }

  const { rows } = await query(
    `SELECT t.*,
            a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
       FROM tasks t
       LEFT JOIN users a ON a.id = t.assignee_id
      WHERE ${filters.join(" AND ")}
      ORDER BY t.position ASC`,
    params
  );
  res.json({ tasks: rows });
});

// POST /api/boards/:boardId/tasks
const createTask = asyncHandler(async (req, res) => {
  const { column_id, title: rawTitle, description, due_date, assignee_id } = req.body;
  const title = (rawTitle || "").trim();
  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : "medium";

  if (!title) throw ApiError.badRequest("Naziv pacijenta je obavezno polje");

  let targetColumnId = column_id;
  if (!targetColumnId) {
    const defaultColRes = await query(
      "SELECT id FROM columns WHERE board_id = $1 ORDER BY position ASC LIMIT 1",
      [req.board.id]
    );
    if (!defaultColRes.rows.length) throw ApiError.badRequest("Faza rada nema definisane kolone");
    targetColumnId = defaultColRes.rows[0].id;
  } else {
    await ensureColumnInBoard(targetColumnId, req.board.id);
  }

  const cleanAssigneeId =
    assignee_id && typeof assignee_id === "string" && assignee_id.trim() !== ""
      ? assignee_id.trim()
      : null;

  const posRes = await query(
    "SELECT COALESCE(MAX(position), 0) + 1000 AS pos FROM tasks WHERE column_id = $1",
    [targetColumnId]
  );

  const { rows } = await query(
    `INSERT INTO tasks (board_id, column_id, title, description, priority, due_date, assignee_id, position, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      req.board.id,
      targetColumnId,
      title,
      description || null,
      priority,
      due_date || null,
      cleanAssigneeId,
      posRes.rows[0].pos,
      req.user.id,
    ]
  );

  const task = await fetchTask(rows[0].id);

  emitToBoard(req.board.id, "task:created", task);
  emitGlobal("task:created", task);

  if (task.assignee_id) {
    emitToUser(task.assignee_id, "mytasks:task_added", task);
  }

  await logActivity({
    boardId: req.board.id,
    userId: req.user.id,
    action: "task.created",
    message: `${req.user.name} je kreirao/la pacijenta "${task.title}"`,
    metadata: { taskId: task.id },
  });

  const memberIds = await getBoardMemberIds(req.board.id);
  const notifyList = task.assignee_id ? [task.assignee_id, ...memberIds] : memberIds;

  await notifyUsers({
    userIds: notifyList,
    actorId: req.user.id,
    boardId: req.board.id,
    taskId: task.id,
    title: "Novi pacijent evidentiran",
    message: `${req.user.name} je dodao/la pacijenta "${task.title}" u fazu rada "${task.board_title}".`,
    type: "task_created",
  });

  if (priority === "urgent") {
    await notifyUsers({
      userIds: notifyList,
      actorId: req.user.id,
      boardId: req.board.id,
      taskId: task.id,
      title: "⚡ Hitno: Novi pacijent",
      message: `Rad za pacijenta "${task.title}" je označen kao HITAN rad!`,
      type: "priority_urgent",
    });
  }

  res.status(201).json({ task });
});

// PATCH /api/boards/:boardId/tasks/:taskId
const updateTask = asyncHandler(async (req, res) => {
  const { title, description, priority, due_date, assignee_id, target_board_id } = req.body;
  if (priority !== undefined && !PRIORITIES.includes(priority))
    throw ApiError.badRequest("Izabrani nivo prioriteta nije validan");

  const oldTaskRes = await query(
    `SELECT t.id, t.title, t.priority, t.due_date, t.assignee_id, t.board_id, t.column_id, b.title AS board_title 
       FROM tasks t 
       JOIN boards b ON b.id = t.board_id 
      WHERE t.id = $1`,
    [req.params.taskId]
  );
  if (!oldTaskRes.rows.length) throw ApiError.notFound("Traženi pacijent nije pronađen");

  const oldTask = oldTaskRes.rows[0];
  const oldAssigneeId = oldTask.assignee_id;
  const currentBoardId = oldTask.board_id;

  const updates = [];
  const params = [req.params.taskId, currentBoardId];

  if (title !== undefined) {
    params.push(title);
    updates.push(`title = $${params.length}`);
  }
  if (description !== undefined) {
    params.push(description);
    updates.push(`description = $${params.length}`);
  }
  if (priority !== undefined) {
    params.push(priority);
    updates.push(`priority = $${params.length}`);
  }
  if (due_date !== undefined) {
    params.push(due_date || null);
    updates.push(`due_date = $${params.length}`);
  }
  if (assignee_id !== undefined) {
    const cleanAssignee =
      assignee_id && typeof assignee_id === "string" && assignee_id.trim() !== ""
        ? assignee_id.trim()
        : null;
    params.push(cleanAssignee);
    updates.push(`assignee_id = $${params.length}`);
  }

  // PREBACIVANJE U DRUGI BOARD / DRUGU FAZU RADA
  let isCrossBoardMove = false;
  let newBoardTitle = "";

  if (target_board_id && String(target_board_id) !== String(currentBoardId)) {
    const targetBoardRes = await query("SELECT id, title FROM boards WHERE id = $1", [target_board_id]);
    if (!targetBoardRes.rows.length) throw ApiError.badRequest("Ciljna faza rada ne postoji");

    const targetColRes = await query(
      "SELECT id FROM columns WHERE board_id = $1 ORDER BY position ASC LIMIT 1",
      [target_board_id]
    );
    if (!targetColRes.rows.length) throw ApiError.badRequest("Ciljna faza rada nema kolonu");

    const newColumnId = targetColRes.rows[0].id;
    newBoardTitle = targetBoardRes.rows[0].title;
    isCrossBoardMove = true;

    params.push(target_board_id);
    updates.push(`board_id = $${params.length}`);

    params.push(newColumnId);
    updates.push(`column_id = $${params.length}`);

    const minPosRes = await query(
      "SELECT MIN(position) AS min_pos FROM tasks WHERE column_id = $1 AND (is_archived IS FALSE OR is_archived IS NULL)",
      [newColumnId]
    );
    const currentMin = minPosRes.rows[0].min_pos != null ? Number(minPosRes.rows[0].min_pos) : null;
    let newPos;
    if (currentMin === null) {
      newPos = 1000;
    } else if (currentMin > 0) {
      newPos = currentMin / 2;
    } else {
      newPos = currentMin - 1000;
    }

    params.push(newPos);
    updates.push(`position = $${params.length}`);
  }

  updates.push("updated_at = now()");

  const { rows } = await query(
    `UPDATE tasks
        SET ${updates.join(", ")}
      WHERE id = $1 AND board_id = $2
      RETURNING id`,
    params
  );
  if (!rows.length) throw ApiError.notFound("Traženi pacijent nije pronađen");

  const task = await fetchTask(rows[0].id);

  // 1. OBRADA PREBACIVANJA U DRUGI BOARD
  if (isCrossBoardMove) {
    emitToBoard(currentBoardId, "task:deleted", { id: task.id, boardId: currentBoardId, board_id: currentBoardId });
    emitGlobal("task:deleted", { id: task.id, boardId: currentBoardId, board_id: currentBoardId });

    emitToBoard(target_board_id, "task:created", task);
    emitGlobal("task:created", task);
    emitGlobal("task:moved", {
      id: task.id,
      fromBoardId: currentBoardId,
      toBoardId: target_board_id,
      column_id: task.column_id,
      task,
    });

    await logActivity({
      boardId: target_board_id,
      userId: req.user.id,
      action: "task.moved",
      message: `${req.user.name} je premjestio/la pacijenta "${task.title}" iz faze "${oldTask.board_title}" u "${newBoardTitle}"`,
      metadata: { taskId: task.id, fromBoardId: currentBoardId, toBoardId: target_board_id },
    });

    const targetMembers = await getBoardMemberIds(target_board_id);
    const sourceMembers = await getBoardMemberIds(currentBoardId);
    const combinedRecipients = Array.from(new Set([...targetMembers, ...sourceMembers, task.assignee_id].filter(Boolean)));

    const isFinalStage =
      newBoardTitle.toLowerCase().includes("zavr") ||
      newBoardTitle.toLowerCase().includes("gotov") ||
      newBoardTitle.toLowerCase().includes("isporuk");

    if (isFinalStage) {
      await notifyUsers({
        userIds: combinedRecipients,
        actorId: req.user.id,
        boardId: target_board_id,
        taskId: task.id,
        title: "✅ Rad je završen",
        message: `Rad za pacijenta "${task.title}" je završen i spreman za isporuku ordinaciji.`,
        type: "patient_completed",
      });
    } else {
      await notifyUsers({
        userIds: combinedRecipients,
        actorId: req.user.id,
        boardId: target_board_id,
        taskId: task.id,
        title: "Promjena faze rada",
        message: `${req.user.name} je prebacio/la pacijenta "${task.title}" u fazu "${newBoardTitle}".`,
        type: "task_moved",
      });
    }
  } else {
    emitToBoard(currentBoardId, "task:updated", task);
    emitGlobal("task:updated", task);
  }

  // 2. OBRADA PROMJENE PRIORITETA NA HITNO
  if (priority === "urgent" && oldTask.priority !== "urgent") {
    const memberIds = await getBoardMemberIds(task.board_id);
    const urgentRecipients = Array.from(new Set([...memberIds, task.assignee_id].filter(Boolean)));

    await notifyUsers({
      userIds: urgentRecipients,
      actorId: req.user.id,
      boardId: task.board_id,
      taskId: task.id,
      title: "⚡ Označeno kao HITNO",
      message: `${req.user.name} je označio/la rad za pacijenta "${task.title}" kao HITAN!`,
      type: "priority_urgent",
    });
  }

  // 3. OBRADA DODJELE RADNIKU
  if (oldAssigneeId && oldAssigneeId !== task.assignee_id) {
    emitToUser(oldAssigneeId, "mytasks:task_removed", { id: task.id });
  }
  if (task.assignee_id) {
    emitToUser(task.assignee_id, "mytasks:task_added", task);
    emitToUser(task.assignee_id, "mytasks:task_updated", task);

    if (oldAssigneeId !== task.assignee_id) {
      await notifyUsers({
        userIds: [task.assignee_id],
        actorId: req.user.id,
        boardId: task.board_id,
        taskId: task.id,
        title: "Dodijeljen vam je pacijent",
        message: `${req.user.name} vam je dodijelio/la pacijenta "${task.title}" u fazi "${task.board_title}".`,
        type: "task_assigned",
      });
    }
  }

  res.json({ task });
});

// PATCH /api/boards/:boardId/tasks/:taskId/move
const moveTask = asyncHandler(async (req, res) => {
  const { column_id, position } = req.body;
  if (!column_id || position === undefined)
    throw ApiError.badRequest("ID faze (column_id) i pozicija su obavezna polja");
  await ensureColumnInBoard(column_id, req.board.id);

  const prevRes = await query(
    "SELECT t.column_id, c.title FROM tasks t JOIN columns c ON c.id = t.column_id WHERE t.id = $1 AND t.board_id = $2",
    [req.params.taskId, req.board.id]
  );
  if (!prevRes.rows.length) throw ApiError.notFound("Traženi pacijent nije pronađen");
  const movedColumns = prevRes.rows[0].column_id !== column_id;

  const { rows } = await query(
    `UPDATE tasks
        SET column_id = $3, position = $4, updated_at = now()
      WHERE id = $1 AND board_id = $2
      RETURNING id`,
    [req.params.taskId, req.board.id, column_id, position]
  );

  const task = await fetchTask(rows[0].id);
  emitToBoard(req.board.id, "task:moved", task);
  emitGlobal("task:moved", task);

  if (task.assignee_id) {
    emitToUser(task.assignee_id, "mytasks:task_updated", task);
  }

  if (movedColumns) {
    const colRes = await query("SELECT title FROM columns WHERE id = $1", [column_id]);
    const colTitle = colRes.rows[0]?.title || "sljedeću fazu";

    await logActivity({
      boardId: req.board.id,
      userId: req.user.id,
      action: "task.moved",
      message: `${req.user.name} je premjestio/la pacijenta "${task.title}" u fazu "${colTitle}"`,
      metadata: { taskId: task.id, columnId: column_id },
    });

    const memberIds = await getBoardMemberIds(req.board.id);
    const recipients = Array.from(new Set([...memberIds, task.assignee_id].filter(Boolean)));

    const isDone =
      colTitle.toLowerCase().includes("zavr") ||
      colTitle.toLowerCase().includes("gotov") ||
      colTitle.toLowerCase().includes("isporuk");

    if (isDone) {
      await notifyUsers({
        userIds: recipients,
        actorId: req.user.id,
        boardId: req.board.id,
        taskId: task.id,
        title: "✅ Rad je završen",
        message: `Rad za pacijenta "${task.title}" je završen i spreman za isporuku ordinaciji.`,
        type: "patient_completed",
      });
    } else {
      await notifyUsers({
        userIds: recipients,
        actorId: req.user.id,
        boardId: req.board.id,
        taskId: task.id,
        title: "Promjena faze rada",
        message: `${req.user.name} je premjestio/la pacijenta "${task.title}" u fazu "${colTitle}".`,
        type: "task_moved",
      });
    }
  }
  res.json({ task });
});

// PATCH /api/boards/:boardId/tasks/:taskId/archive
const archiveTask = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE tasks
        SET is_archived = TRUE, archived_at = NOW()
      WHERE id = $1 AND board_id = $2
      RETURNING *`,
    [req.params.taskId, req.board.id]
  );
  if (!rows.length) throw ApiError.notFound("Pacijent nije pronađen");

  const task = await fetchTask(rows[0].id);

  emitToBoard(req.board.id, "task:deleted", { id: task.id, board_id: task.board_id });
  emitGlobal("task:archived", task);

  if (task.assignee_id) {
    emitToUser(task.assignee_id, "mytasks:task_removed", { id: task.id });
  }

  await logActivity({
    boardId: req.board.id,
    userId: req.user.id,
    action: "task.archived",
    message: `${req.user.name} je arhivirao/la pacijenta "${task.title}"`,
    metadata: { taskId: task.id },
  });

  res.json({ task });
});

// PATCH /api/boards/:boardId/tasks/:taskId/restore
const restoreTask = asyncHandler(async (req, res) => {
  const taskId = req.params.taskId;
  const boardId = req.board?.id || req.params.boardId;

  const { rows } = await query(
    `UPDATE tasks
        SET is_archived = FALSE, archived_at = NULL, updated_at = NOW()
      WHERE id = $1 AND board_id = $2
      RETURNING *`,
    [taskId, boardId]
  );
  if (!rows.length) throw ApiError.notFound("Pacijent nije pronađen za vraćanje");

  const task = await fetchTask(rows[0].id);

  emitToBoard(task.board_id, "task:created", task);
  emitGlobal("task:restored", { id: task.id, board_id: task.board_id });

  if (task.assignee_id) {
    emitToUser(task.assignee_id, "mytasks:task_added", task);
  }

  res.json({ task });
});

// GET /api/boards/archived-tasks/all
const listAllArchived = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT t.*,
            b.title AS board_title, b.color AS board_color,
            c.title AS column_title,
            a.name AS assignee_name, a.avatar_url AS assignee_avatar
       FROM tasks t
       JOIN boards b ON b.id = t.board_id
       LEFT JOIN columns c ON c.id = t.column_id
       LEFT JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $1
       LEFT JOIN users a ON a.id = t.assignee_id
      WHERE (b.owner_id = $1 OR bm.user_id = $1)
        AND t.is_archived = TRUE
      ORDER BY t.archived_at DESC NULLS LAST, t.updated_at DESC`,
    [req.user.id]
  );
  res.json({ tasks: rows });
});

// DELETE /api/boards/:boardId/tasks/:taskId
const deleteTask = asyncHandler(async (req, res) => {
  const taskRes = await query(
    `SELECT t.title, t.assignee_id, b.title AS board_title 
       FROM tasks t 
       JOIN boards b ON b.id = t.board_id 
      WHERE t.id = $1 AND t.board_id = $2`,
    [req.params.taskId, req.board.id]
  );
  if (!taskRes.rows.length) throw ApiError.notFound("Traženi pacijent nije pronađen");

  const taskData = taskRes.rows[0];
  const memberIds = await getBoardMemberIds(req.board.id);

  await query(
    "DELETE FROM tasks WHERE id = $1 AND board_id = $2",
    [req.params.taskId, req.board.id]
  );

  const deletePayload = {
    id: req.params.taskId,
    boardId: req.board.id,
    board_id: req.board.id,
  };

  emitToBoard(req.board.id, "task:deleted", deletePayload);

  if (taskData.assignee_id) {
    emitToUser(taskData.assignee_id, "mytasks:task_removed", { id: req.params.taskId });
  }

  await notifyUsers({
    userIds: memberIds,
    actorId: req.user.id,
    boardId: req.board.id,
    title: "Pacijent obrisan",
    message: `${req.user.name} je obrisao/la pacijenta "${taskData.title}" kod faze rada "${taskData.board_title}".`,
    type: "task_deleted",
  });

  await logActivity({
    boardId: req.board.id,
    userId: req.user.id,
    action: "task.deleted",
    message: `${req.user.name} je obrisao/la pacijenta "${taskData.title}"`,
    metadata: { taskId: req.params.taskId },
  });

  res.json({ success: true });
});

module.exports = {
  listTasks,
  createTask,
  updateTask,
  moveTask,
  archiveTask,
  restoreTask,
  listAllArchived,
  deleteTask,
};