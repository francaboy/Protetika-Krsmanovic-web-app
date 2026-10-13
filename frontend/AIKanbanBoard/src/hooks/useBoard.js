import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { boardApi, taskApi, columnApi } from "../lib/api";
import { connectSocket } from "../lib/socket";

/**
 * Učitava karton pacijenta i održava sinhronizaciju putem Socket.IO protokola.
 * Vraća stanje kartona uz pomoćne funkcije sa optimističkim ažuriranjem i trajnim čuvanjem preko API-ja.
 */
export const useBoard = (boardId) => {
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [presence, setPresence] = useState([]);

  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  // Sprečava dupliranje kolona (i sa API-ja i sa Socket-a)
  const upsertColumn = useCallback((col) => {
    if (!col || !col.id) return;
    setColumns((prev) => {
      const idx = prev.findIndex((c) => c.id === col.id);
      let next;
      if (idx === -1) {
        next = [...prev, col];
      } else {
        next = [...prev];
        next[idx] = { ...next[idx], ...col };
      }
      return next.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    });
  }, []);

  // Stavlja novi task na sami početak liste da se odmah pojavi na vrhu bez duplikata
  const upsertTask = useCallback((task) => {
    if (!task || !task.id) return;
    setTasks((prev) => {
      const idx = prev.findIndex((t) => String(t.id) === String(task.id));
      if (idx === -1) return [task, ...prev];
      const next = [...prev];
      next[idx] = { ...next[idx], ...task };
      return next;
    });
  }, []);

  const removeTaskLocal = useCallback((id) => {
    if (!id) return;
    setTasks((prev) => prev.filter((t) => String(t.id) !== String(id)));
  }, []);

  // Početno učitavanje podataka o kartonu pacijenta
  useEffect(() => {
    if (!boardId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    boardApi
      .get(boardId)
      .then((data) => {
        if (!alive) return;
        setBoard(data.board || data);
        setColumns(data.columns || []);
        setTasks((data.tasks || []).filter((t) => t && t.id && !t.is_archived));
        setMembers(data.members || []);
        setRole(data.role || "member");
      })
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [boardId]);

  // Sinhronizacija u realnom vremenu
  useEffect(() => {
    if (!boardId) return;
    const socket = connectSocket();
    socket.emit("board:join", boardId);

    // 1. Zadatak kreiran ili vraćen
    const onCreated = (t) => {
      if (!t || !t.id) return;
      if (String(t.board_id) === String(boardIdRef.current)) {
        upsertTask(t);
      }
    };

    // 2. Zadatak ažuriran
    const onUpdated = (t) => {
      if (!t || !t.id) return;
      if (t.board_id && String(t.board_id) !== String(boardIdRef.current)) {
        removeTaskLocal(t.id);
        return;
      }
      upsertTask(t);
    };

    // 3. Zadatak premješten (unutar istog boarda ili cross-board)
    const onMoved = (data) => {
      if (!data || !data.id) return;

      // Ako je otišao na drugi board
      if (data.toBoardId && String(data.toBoardId) !== String(boardIdRef.current)) {
        removeTaskLocal(data.id);
        return;
      }

      // Ako je došao na ovaj board sa punim task objektom
      if (data.toBoardId && String(data.toBoardId) === String(boardIdRef.current) && data.task) {
        upsertTask(data.task);
        return;
      }

      // Standardni lokalni move
      upsertTask(data);
    };

    // 4. Zadatak obrisan ili arhiviran
    const onDeleted = (payload) => {
      const id = payload?.id || payload?.taskId;
      if (id) removeTaskLocal(id);
    };

    const onColCreated = (c) => upsertColumn(c);
    const onColUpdated = (c) => upsertColumn(c);
    const onColDeleted = ({ id }) => setColumns((p) => p.filter((x) => x.id !== id));
    const onBoardUpdated = (b) => setBoard(b);
    const onPresenceSync = ({ users }) => setPresence(users || []);
    const onPresenceJoin = ({ user }) =>
      setPresence((p) => (p.find((u) => u.id === user.id) ? p : [...p, user]));
    const onPresenceLeave = ({ user }) => setPresence((p) => p.filter((u) => u.id !== user.id));

    socket.on("task:created", onCreated);
    socket.on("task:updated", onUpdated);
    socket.on("task:moved", onMoved);
    socket.on("task:deleted", onDeleted);
    socket.on("task:archived", onDeleted);
    socket.on("column:created", onColCreated);
    socket.on("column:updated", onColUpdated);
    socket.on("column:deleted", onColDeleted);
    socket.on("board:updated", onBoardUpdated);
    socket.on("presence:sync", onPresenceSync);
    socket.on("presence:join", onPresenceJoin);
    socket.on("presence:leave", onPresenceLeave);

    return () => {
      socket.emit("board:leave", boardId);
      socket.off("task:created", onCreated);
      socket.off("task:updated", onUpdated);
      socket.off("task:moved", onMoved);
      socket.off("task:deleted", onDeleted);
      socket.off("task:archived", onDeleted);
      socket.off("column:created", onColCreated);
      socket.off("column:updated", onColUpdated);
      socket.off("column:deleted", onColDeleted);
      socket.off("board:updated", onBoardUpdated);
      socket.off("presence:sync", onPresenceSync);
      socket.off("presence:join", onPresenceJoin);
      socket.off("presence:leave", onPresenceLeave);
      setPresence([]);
    };
  }, [boardId, upsertTask, removeTaskLocal, upsertColumn]);

  /* ----------------------------- akcije / mutacije ----------------------------- */

  const createTask = useCallback(
    async (data) => {
      const columnTasks = tasks.filter((t) => t.column_id === data.column_id && !t.is_archived);
      let topPosition = 1000;
      if (columnTasks.length > 0) {
        const minPos = Math.min(...columnTasks.map((t) => (t.position != null ? t.position : 1000)));
        topPosition = minPos > 0 ? minPos / 2 : minPos - 1000;
      }

      const payload = {
        ...data,
        position: topPosition,
      };

      try {
        const res = await taskApi.create(boardId, payload);
        const taskObj = res?.task || res;
        const taskWithTopPos = { ...taskObj, position: taskObj.position ?? topPosition, column_id: data.column_id };
        upsertTask(taskWithTopPos);

        if (taskObj.id && taskApi.move) {
          taskApi.move(boardId, taskObj.id, { column_id: data.column_id, position: topPosition }).catch(() => {});
        }

        return taskWithTopPos;
      } catch (err) {
        toast.error(err.message);
        throw err;
      }
    },
    [boardId, tasks, upsertTask]
  );

  const updateTask = useCallback(
    async (taskId, data) => {
      const prev = tasks.find((t) => t.id === taskId);
      upsertTask({ ...prev, ...data });
      try {
        const res = await taskApi.update(boardId, taskId, data);
        const taskObj = res?.task || res;
        if (data.target_board_id && String(data.target_board_id) !== String(boardId)) {
          removeTaskLocal(taskId);
        } else if (taskObj) {
          upsertTask(taskObj);
        }
        return taskObj;
      } catch (err) {
        if (prev) upsertTask(prev);
        toast.error(err.message);
        throw err;
      }
    },
    [boardId, tasks, upsertTask, removeTaskLocal]
  );

  const deleteTask = useCallback(
    async (taskId) => {
      const prev = tasks.find((t) => t.id === taskId);
      removeTaskLocal(taskId);
      try {
        await taskApi.remove(boardId, taskId);
      } catch (err) {
        if (prev) upsertTask(prev);
        toast.error(err.message);
        throw err;
      }
    },
    [boardId, tasks, removeTaskLocal, upsertTask]
  );

  const moveTask = useCallback(
    async (taskId, columnId, position) => {
      const prev = tasks.find((t) => t.id === taskId);
      if (!prev) return;
      upsertTask({ ...prev, column_id: columnId, position });
      try {
        await taskApi.move(boardId, taskId, { column_id: columnId, position });
      } catch (err) {
        upsertTask(prev);
        toast.error(err.message);
      }
    },
    [boardId, tasks, upsertTask]
  );

  const addColumn = useCallback(
    async (title) => {
      try {
        const col = await columnApi.create(boardId, { title });
        upsertColumn(col);
        return col;
      } catch (err) {
        toast.error(err.message);
        throw err;
      }
    },
    [boardId, upsertColumn]
  );

  const renameColumn = useCallback(
    async (columnId, title) => {
      setColumns((p) => p.map((c) => (c.id === columnId ? { ...c, title } : c)));
      try {
        await columnApi.update(boardId, columnId, { title });
      } catch (err) {
        toast.error(err.message);
      }
    },
    [boardId]
  );

  const deleteColumn = useCallback(
    async (columnId) => {
      try {
        await columnApi.remove(boardId, columnId);
        setColumns((p) => p.filter((c) => c.id !== columnId));
        setTasks((p) => p.filter((t) => t.column_id !== columnId));
        toast.success("Faza rada je obrisana");
      } catch (err) {
        toast.error(err.message);
      }
    },
    [boardId]
  );

  return {
    board, columns, tasks, members, role, loading, error, presence,
    setBoard, setMembers, setTasks,
    createTask, updateTask, deleteTask, moveTask, upsertTask,
    addColumn, renameColumn, deleteColumn, upsertColumn,
  };
};