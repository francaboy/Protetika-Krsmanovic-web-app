import { useEffect, useRef, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";

const CARDS = {
  1: { title: "Snimanje zuba", color: "#0284c7" },
  2: { title: "Modelovanje zuba", color: "#d97706" },
  3: { title: "Polimerizacija krunica", color: "#0284c7" },
  4: { title: "Sinterovanje modela", color: "#16a34a" },
  5: { title: "Keramika i estetika", color: "#16a34a" },
  6: { title: "3D štampanje modela", color: "#d97706" },
};

const COLUMNS = [
  {
    id: "Priprema",
    bg: "bg-gradient-to-b from-sky-50 to-sky-100/40 border-sky-200",
    dot: "bg-sky-500",
    badge: "border-sky-200 bg-white text-sky-900",
  },
  {
    id: "U izradi",
    bg: "bg-gradient-to-b from-amber-50 to-amber-100/40 border-amber-200",
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-white text-amber-900",
  },
  {
    id: "Završeno",
    bg: "bg-gradient-to-b from-emerald-50 to-emerald-100/40 border-emerald-200",
    dot: "bg-emerald-500",
    badge: "border-emerald-200 bg-white text-emerald-900",
  },
];

const initialBoard = {
  Priprema: [3, 1],
  "U izradi": [2, 6],
  Završeno: [4, 5],
};

const spring = { type: "spring", stiffness: 420, damping: 34 };

const KanbanDemo = ({ className = "" }) => {
  const [board, setBoard] = useState(initialBoard);
  const [movingId, setMovingId] = useState(null);
  const boardRef = useRef(initialBoard);
  const sourceRef = useRef(0);

  const columnKeys = COLUMNS.map((c) => c.id);

  useEffect(() => {
    const id = setInterval(() => {
      const prev = boardRef.current;
      let s = sourceRef.current;
      let guard = 0;
      while (prev[columnKeys[s]].length === 0 && guard < columnKeys.length) {
        s = (s + 1) % columnKeys.length;
        guard += 1;
      }
      const src = columnKeys[s];
      if (prev[src].length === 0) return;
      const dst = columnKeys[(s + 1) % columnKeys.length];
      const moving = prev[src][0];
      sourceRef.current = (s + 1) % columnKeys.length;
      const next = {
        ...prev,
        [src]: prev[src].slice(1),
        [dst]: [...prev[dst], moving],
      };
      boardRef.current = next;
      setBoard(next);
      setMovingId(moving);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (movingId == null) return undefined;
    const t = setTimeout(() => setMovingId(null), 700);
    return () => clearTimeout(t);
  }, [movingId]);

  return (
    <LayoutGroup>
      <div className={`grid grid-cols-3 gap-3.5 ${className}`}>
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className={`rounded-2xl border p-3 shadow-xs transition-all ${col.bg}`}
          >
            {/* Header kolone */}
            <div className="mb-3 flex items-center justify-between px-1 pt-0.5">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                <span className="text-xs font-bold tracking-tight text-slate-950">
                  {col.id}
                </span>
              </div>
              <span
                className={`grid h-5 min-w-[20px] place-items-center rounded-full border px-1.5 text-[11px] font-bold tabular shadow-xs ${col.badge}`}
              >
                {board[col.id].length}
              </span>
            </div>

            {/* Kartice */}
            <div className="flex h-[376px] flex-col gap-2.5">
              {board[col.id].map((id) => {
                const card = CARDS[id];
                const isMoving = id === movingId;
                return (
                  <motion.div layout layoutId={`card-${id}`} key={id} transition={spring}>
                    <motion.div
                      animate={isMoving ? { scale: 1.05, rotate: -2 } : { scale: 1, rotate: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className={`rounded-xl border border-slate-200/90 bg-white p-3 text-left ${
                        isMoving
                          ? "relative z-10 shadow-lg ring-2 ring-slate-400"
                          : "shadow-xs"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: card.color }}
                        />
                        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">
                          {card.title}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="h-1.5 w-10 rounded-full bg-slate-100" />
                        <span className="brand-gradient h-5 w-5 rounded-full ring-2 ring-white shadow-xs" />
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
};

export default KanbanDemo;