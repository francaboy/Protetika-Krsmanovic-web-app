/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { boardApi } from "../lib/api";
import { connectSocket } from "../lib/socket";

const BoardsContext = createContext(null);

export const BoardsProvider = ({ children }) => {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await boardApi.list();
      setBoards(Array.isArray(res) ? res : res?.boards || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Podešavanje task_count vrijednosti tačno za delta (+1 ili -1)
  const adjustTaskCount = useCallback((boardId, delta) => {
    setBoards((prev) =>
      prev.map((b) => {
        if (String(b.id) === String(boardId)) {
          const current = parseInt(b.task_count, 10) || 0;
          return { ...b, task_count: Math.max(0, current + delta) };
        }
        return b;
      })
    );
  }, []);

  // Osluškivanje izmjena u realnom vremenu
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    // Kada je drugi korisnik pozvan na pacijenta
    const onBoardCreated = (newBoard) => {
      if (!newBoard || !newBoard.id) return;
      setBoards((prev) => {
        // Stroga provjera da pacijent već ne postoji
        if (prev.some((b) => String(b.id) === String(newBoard.id))) return prev;
        return [newBoard, ...prev];
      });
    };

    const onTaskCreated = (task) => {
      const bId = task?.board_id || task?.boardId;
      if (bId) {
        adjustTaskCount(bId, 1);
      }
    };

    const onTaskDeleted = (data) => {
      const bId = data?.boardId || data?.board_id;
      if (bId) {
        adjustTaskCount(bId, -1);
      }
    };

    const onBoardUpdated = (updated) => {
      if (!updated || !updated.id) return;
      setBoards((prev) =>
        prev.map((b) => (String(b.id) === String(updated.id) ? { ...b, ...updated } : b))
      );
    };

    const onBoardDeleted = (payload) => {
      const targetId = payload?.id || payload?.boardId;
      if (!targetId) return;
      setBoards((prev) => prev.filter((b) => String(b.id) !== String(targetId)));
    };

    socket.on("board:created", onBoardCreated);
    socket.on("task:created", onTaskCreated);
    socket.on("task:deleted", onTaskDeleted);
    socket.on("board:updated", onBoardUpdated);
    socket.on("board:deleted", onBoardDeleted);

    return () => {
      socket.off("board:created", onBoardCreated);
      socket.off("task:created", onTaskCreated);
      socket.off("task:deleted", onTaskDeleted);
      socket.off("board:updated", onBoardUpdated);
      socket.off("board:deleted", onBoardDeleted);
    };
  }, [adjustTaskCount]);

  const create = useCallback(async (data) => {
    const res = await boardApi.create(data);
    const newBoard = res.board || res;
    setBoards((prev) => {
      if (prev.some((b) => String(b.id) === String(newBoard.id))) return prev;
      return [{ ...newBoard, task_count: 0 }, ...prev];
    });
    return newBoard;
  }, []);

  const update = useCallback(async (id, data) => {
    const res = await boardApi.update(id, data);
    const updatedBoard = res.board || res;
    setBoards((prev) =>
      prev.map((b) => (String(b.id) === String(id) ? { ...b, ...updatedBoard } : b))
    );
    return updatedBoard;
  }, []);

  const remove = useCallback(async (id) => {
    await boardApi.remove(id);
    setBoards((prev) => prev.filter((b) => String(b.id) !== String(id)));
  }, []);

  return (
    <BoardsContext.Provider
      value={{
        boards,
        setBoards,
        loading,
        refresh,
        create,
        update,
        remove,
        adjustTaskCount,
      }}
    >
      {children}
    </BoardsContext.Provider>
  );
};

export const useBoards = () => {
  const ctx = useContext(BoardsContext);
  if (!ctx) throw new Error("useBoards mora se koristiti unutar BoardsProvider");
  return ctx;
};