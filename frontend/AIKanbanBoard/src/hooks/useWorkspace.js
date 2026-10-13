import { useState, useEffect } from "react";
import { boardApi, userApi } from "../lib/api";
import { useBoards } from "../context/BoardsContext";

/**
 * Objedinjuje sve kartone pacijenata kojima korisnik ima pristup u jedinstvenu listu radova
 * (svaki označen pripadajućim kartonom i trenutnim statusom/fazom) i adresar članova tima bez duplikata.
 * Koristi postojeće rute — po jedan boardApi.get() poziv za svaki karton pacijenta.
 */
export const useWorkspace = () => {
  const { boards, loading: boardsLoading } = useBoards();
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (boardsLoading) return;

    let cancelled = false;
    setLoading(true);

    // Paralelno dohvata sve registrovane korisnike i detalje kartona
    const fetchAllData = async () => {
      try {
        // 1. Uvijek dobavi sve registrovane korisnike iz ordinacije
        const allUsers = (await userApi.search("").catch(() => [])) || [];

        // Inicijalizujemo mapu sa svim korisnicima (tako da se vide i oni bez kartona)
        const memberMap = new Map();
        allUsers.forEach((u) => {
          memberMap.set(u.id, {
            ...u,
            role: u.role || (u.id === 1 ? "owner" : "member"),
            boards: [],
          });
        });

        const allTasks = [];

        // 2. Ako ima kartona, obradi njihove zadatke i poveži pacijente sa radnicima
        if (boards.length > 0) {
          const results = await Promise.all(
            boards.map((b) => boardApi.get(b.id).catch(() => null))
          );

          if (cancelled) return;

          results.forEach((res, i) => {
            if (!res) return;
            const board = res.board || boards[i];
            const colTitle = {};
            (res.columns || []).forEach((c) => {
              colTitle[c.id] = c.title;
            });

            (res.tasks || []).forEach((t) =>
              allTasks.push({
                ...t,
                board_id: board.id,
                board_title: board.title,
                board_color: board.color,
                status: colTitle[t.column_id] || "",
              })
            );

            (res.members || []).forEach((m) => {
              const existing = memberMap.get(m.id);
              if (existing) {
                if (!existing.boards.includes(board.title)) {
                  existing.boards.push(board.title);
                }
              } else {
                memberMap.set(m.id, {
                  ...m,
                  role: m.role || "member",
                  boards: [board.title],
                });
              }
            });
          });
        }

        if (!cancelled) {
          setTasks(allTasks);
          setMembers([...memberMap.values()]);
          setLoading(false);
        }
      } catch (err) {
        console.error("Greška u useWorkspace:", err);
        if (!cancelled) setLoading(false);
      }
    };

    fetchAllData();

    return () => {
      cancelled = true;
    };
  }, [boards, boardsLoading]);

  return { tasks, members, boards, loading: loading || boardsLoading };
};