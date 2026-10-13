import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Plus,
  LayoutGrid,
  LayoutDashboard,
  CornerDownLeft,
  CheckSquare,
  Calendar,
  Users,
  Settings,
  User,
  Loader2,
} from "lucide-react";
import { useBoards } from "../context/BoardsContext";
import { boardApi } from "../lib/api";
import { cn } from "../lib/utils";

const PHASE_ORDER = [
  "priprema",
  "print",
  "izrada",
  "frezovanj",
  "slojevanj",
  "završen",
  "završetak",
  "isporuk",
];

const CommandMenu = ({ open, onClose, onCreateBoard }) => {
  const { boards } = useBoards();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [allTasks, setAllTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      if (boards && boards.length > 0) {
        setLoadingTasks(true);
        Promise.all(
          boards.map(async (b) => {
            try {
              const data = await boardApi.get(b.id);
              const columnsMap = new Map((data?.columns || []).map((c) => [c.id, c.title]));
              return (data?.tasks || []).map((t) => ({
                ...t,
                boardId: b.id,
                boardTitle: b.title,
                boardColor: b.color,
                columnTitle: columnsMap.get(t.column_id) || "Faza",
              }));
            } catch {
              return [];
            }
          })
        )
          .then((nested) => {
            setAllTasks(nested.flat());
          })
          .catch(console.error)
          .finally(() => setLoadingTasks(false));
      }
    }
  }, [open, boards]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();

    const actions = [
      { id: "create", label: "Dodajte novog pacijenta", icon: Plus, onSelect: onCreateBoard },
      { id: "dashboard", label: "Idite na početnu stranu", icon: LayoutDashboard, onSelect: () => navigate("/pocetna") },
      { id: "my-tasks", label: "Idite na Pacijente", icon: CheckSquare, onSelect: () => navigate("/pacijenti") },
      { id: "calendar", label: "Idite na Kalendar", icon: Calendar, onSelect: () => navigate("/kalendar") },
      { id: "team", label: "Idite na Zaposlene", icon: Users, onSelect: () => navigate("/zaposleni") },
      { id: "settings", label: "Idite na Podešavanja", icon: Settings, onSelect: () => navigate("/podesavanja") },
    ];

    // Faze rada sortirane po tačnom redoslijedu
    const sortedBoards = [...(boards || [])].sort((a, b) => {
      const titleA = (a.title || "").toLowerCase();
      const titleB = (b.title || "").toLowerCase();

      const indexA = PHASE_ORDER.findIndex((p) => titleA.includes(p));
      const indexB = PHASE_ORDER.findIndex((p) => titleB.includes(p));

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return (a.position || 0) - (b.position || 0);
    });

    const boardItems = sortedBoards.map((b) => ({
      id: `board-${b.id}`,
      label: b.title,
      sub: "Faza rada",
      icon: LayoutGrid,
      color: b.color,
      onSelect: () => navigate(`/rad/${b.id}`),
    }));

    const taskItems = allTasks.map((t) => ({
      id: `task-${t.id}`,
      label: t.title,
      sub: `${t.boardTitle} · ${t.columnTitle}`,
      icon: User,
      color: t.boardColor || "#2f8159",
      description: t.description || "",
      assignee: t.assignee_name || "",
      onSelect: () => navigate(`/rad/${t.boardId}?task=${t.id}`),
    }));

    if (!q) {
      return [...actions, ...boardItems];
    }

    const matchedTasks = taskItems.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q)
    );

    const matchedBoards = boardItems.filter((b) => b.label.toLowerCase().includes(q));
    const matchedActions = actions.filter((a) => a.label.toLowerCase().includes(q));

    return [...matchedTasks, ...matchedBoards, ...matchedActions];
  }, [boards, allTasks, query, navigate, onCreateBoard]);

  const run = (item) => {
    onClose();
    item?.onSelect?.();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) run(items[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="fixed inset-0 bg-ink/35 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="card relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-lift)]"
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="h-4 w-4 text-faint shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Pretraži pacijente, radove ili prečice…"
                className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
              />
              {loadingTasks && (
                <Loader2 className="h-4 w-4 animate-spin text-faint shrink-0" />
              )}
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-faint">
                  Nema pronađenih pacijenata ili radnji
                </p>
              ) : (
                items.map((item, i) => (
                  <button
                    key={item.id}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      active === i
                        ? "bg-brand-50 text-brand-700 font-medium"
                        : "text-ink hover:bg-surface-2"
                    )}
                  >
                    {item.color ? (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full shadow-sm"
                        style={{ backgroundColor: item.color }}
                      />
                    ) : (
                      <item.icon className="h-4 w-4 shrink-0 text-muted" />
                    )}

                    <span className="flex-1 truncate">{item.label}</span>

                    {item.sub && (
                      <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] tabular text-faint">
                        {item.sub}
                      </span>
                    )}

                    {active === i && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CommandMenu;