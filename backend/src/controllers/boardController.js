const { query, withTransaction } = require("../config/db");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { emitToBoard, emitToUser, emitGlobal, logActivity } = require("../realtime");
const { notifyUsers } = require("../utils/notifier");

// Podrazumijevane faze rada za svakog novog pacijenta
const DEFAULT_COLUMNS = [
  "Priprema i modelovanje",
  "Printanje modela zuba",
  "Laboratorijska izrada",
  "Završeni dentalni radovi",
];

// GET /api/boards — kartoni pacijenata kojima korisnik ima pristup
const listBoards = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT b.*,
            (b.owner_id = $1) AS is_owner,
            (SELECT COUNT(*) 
               FROM tasks t 
              WHERE t.board_id = b.id 
                AND (t.is_archived IS FALSE OR t.is_archived IS NULL)
            ) AS task_count,
            (SELECT COUNT(*) FROM board_members m WHERE m.board_id = b.id) AS member_count
       FROM boards b
       LEFT JOIN board_members mm ON mm.board_id = b.id AND mm.user_id = $1
      WHERE b.owner_id = $1 OR mm.user_id = $1
      ORDER BY b.updated_at DESC`,
    [req.user.id]
  );
  res.json({ boards: rows });
});

// POST /api/boards — kreiranje novog kartona pacijenta
const createBoard = asyncHandler(async (req, res) => {
  const title = (req.body.title || "").trim();
  const description = (req.body.description || "").trim() || null;
  const color = req.body.color || "#2f8159";
  if (!title) throw ApiError.badRequest("Ime i prezime pacijenta je obavezno");

  const board = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO boards (title, description, color, owner_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description, color, req.user.id]
    );
    const b = rows[0];

    await client.query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [b.id, req.user.id]
    );

    for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
      await client.query(
        `INSERT INTO columns (board_id, title, position) VALUES ($1, $2, $3)`,
        [b.id, DEFAULT_COLUMNS[i], (i + 1) * 1000]
      );
    }
    return b;
  });

  const fullBoard = {
    ...board,
    is_owner: true,
    task_count: 0,
    member_count: 1,
  };

  res.status(201).json({ board: fullBoard });
});

// GET /api/boards/:boardId — kompletan karton pacijenta
const getBoard = asyncHandler(async (req, res) => {
  const boardId = req.board.id;

  const [boardRes, columnsRes, tasksRes, membersRes] = await Promise.all([
    query("SELECT * FROM boards WHERE id = $1", [boardId]),
    query("SELECT * FROM columns WHERE board_id = $1 ORDER BY position ASC", [boardId]),
    query(
      `SELECT t.*,
              a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
         FROM tasks t
         LEFT JOIN users a ON a.id = t.assignee_id
        WHERE t.board_id = $1
          AND (t.is_archived IS FALSE OR t.is_archived IS NULL)
        ORDER BY t.position ASC`,
      [boardId]
    ),
    query(
      `SELECT u.id, u.name, u.email, u.avatar_url, m.role, m.joined_at
         FROM board_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.board_id = $1
        ORDER BY m.joined_at ASC`,
      [boardId]
    ),
  ]);

  res.json({
    board: boardRes.rows[0],
    columns: columnsRes.rows,
    tasks: tasksRes.rows,
    members: membersRes.rows,
    role: req.board.role,
  });
});

// PATCH /api/boards/:boardId — izmjena podataka o pacijentu
const updateBoard = asyncHandler(async (req, res) => {
  const { title, description, color } = req.body;
  const { rows } = await query(
    `UPDATE boards
        SET title = COALESCE($2, title),
            description = COALESCE($3, description),
            color = COALESCE($4, color),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [req.board.id, title ?? null, description ?? null, color ?? null]
  );

  emitToBoard(req.board.id, "board:updated", rows[0]);
  res.json({ board: rows[0] });
});

// DELETE /api/boards/:boardId — brisanje kartona pacijenta
const deleteBoard = asyncHandler(async (req, res) => {
  const boardId = req.params.boardId || req.board?.id;

  const boardRes = await query("SELECT title FROM boards WHERE id = $1", [boardId]);
  if (!boardRes.rows.length) {
    throw ApiError.notFound("Pacijent nije pronađen");
  }
  const boardTitle = boardRes.rows[0].title;

  const { getBoardMemberIds } = require("../utils/notifier");
  const memberIds = await getBoardMemberIds(boardId);

  await notifyUsers({
    userId: memberIds,
    actorId: req.user.id,
    title: "Pacijent obrisan",
    message: `${req.user.name} je obrisao/la pacijenta "${boardTitle}".`,
    type: "board_deleted",
  });

  await query("DELETE FROM boards WHERE id = $1", [boardId]);
  emitToBoard(boardId, "board:deleted", { id: boardId });

  res.json({ success: true });
});

// GET /api/boards/:boardId/activity
const getActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const { rows } = await query(
    `SELECT act.*, u.name AS user_name, u.avatar_url AS user_avatar
       FROM activities act
       LEFT JOIN users u ON u.id = act.user_id
      WHERE act.board_id = $1
      ORDER BY act.created_at DESC
      LIMIT $2`,
    [req.board.id, limit]
  );
  res.json({ activities: rows });
});

// DELETE /api/boards/:boardId/activity
const clearActivity = asyncHandler(async (req, res) => {
  const boardId = req.board.id;
  await query("DELETE FROM activities WHERE board_id = $1", [boardId]);
  emitToBoard(boardId, "activity:cleared", { boardId });
  res.json({ success: true, message: "Dnevnik aktivnosti je uspješno očišćen" });
});

// POST /api/boards/:boardId/members
const addMember = asyncHandler(async (req, res) => {
  if (req.board.role !== "owner" && req.board.role !== "admin")
    throw ApiError.forbidden("Samo administrator može dodavati zaposlene");

  const email = (req.body.email || "").trim().toLowerCase();
  const role = req.body.role === "admin" ? "admin" : "member";
  if (!email) throw ApiError.badRequest("E-mail adresa zaposlenog je obavezna");

  const userRes = await query("SELECT id, name, email, avatar_url FROM users WHERE email = $1", [email]);
  const user = userRes.rows[0];
  if (!user) throw ApiError.notFound("Korisnik sa ovom e-mail adresom nije pronađen");

  await query(
    `INSERT INTO board_members (board_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.board.id, user.id, role]
  );

  const boardInfoRes = await query(
    `SELECT b.*,
            (SELECT COUNT(*) 
               FROM tasks t 
              WHERE t.board_id = b.id 
                AND (t.is_archived IS FALSE OR t.is_archived IS NULL)
            ) AS task_count
       FROM boards b
      WHERE b.id = $1`,
    [req.board.id]
  );

  const currentBoard = boardInfoRes.rows[0] || req.board;

  await notifyUsers({
    userId: [user.id],
    actorId: req.user.id,
    boardId: req.board.id,
    title: "Dodijeljen vam je pacijent",
    message: `${req.user.name} vas je dodao/la u tim za pacijenta "${currentBoard.title}".`,
    type: "board_assigned",
  });

  if (boardInfoRes.rows.length) {
    emitToUser(user.id, "board:created", {
      ...currentBoard,
      is_owner: false,
    });
  }

  emitToBoard(req.board.id, "member:added", { ...user, role });

  await logActivity({
    boardId: req.board.id,
    userId: req.user.id,
    action: "member.added",
    message: `${req.user.name} je dodao/la zaposlenog ${user.name} na karton pacijenta`,
    metadata: { memberId: user.id },
  });

  res.status(201).json({ member: { ...user, role } });
});

// DELETE /api/boards/:boardId/members/:userId
const removeMember = asyncHandler(async (req, res) => {
  if (req.board.role !== "owner" && req.board.role !== "admin")
    throw ApiError.forbidden("Samo administrator može uklanjati zaposlene");
  const { userId } = req.params;
  if (userId === req.board.owner_id) {
    throw ApiError.badRequest("Ne možete ukloniti administratora sa rada pacijenta");
  }

  await query("DELETE FROM board_members WHERE board_id = $1 AND user_id = $2", [
    req.board.id,
    userId,
  ]);

  emitToUser(userId, "board:deleted", { id: req.board.id });
  emitToBoard(req.board.id, "member:removed", { userId });

  res.json({ success: true });
});

module.exports = {
  listBoards,
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
  getActivity,
  clearActivity,
  addMember,
  removeMember,
};