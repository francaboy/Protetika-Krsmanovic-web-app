import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  CheckSquare,
  AlertTriangle,
  Calendar,
  ArrowUpRight,
  ListTodo,
  ChevronDown,
  Check,
  X,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  User,
  Archive,
  Clock,
  Sparkles,
  Layers,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBoards } from "../context/BoardsContext";
import { useLayout } from "../components/layout/AppLayout";
import { getSocket } from "../lib/socket";
import { boardApi, taskApi } from "../lib/api";
import Topbar from "../components/layout/Topbar";
import { PriorityTag } from "../components/ui/Badge";
import Avatar from "../components/ui/Avatar";
import TaskModal from "../components/board/TaskModal";
import { PRIORITIES, formatDueDate, cn } from "../lib/utils";

const SORT_OPTIONS = [
  { value: "date-desc", label: "Najnovije prvo", icon: CalendarArrowDown },
  { value: "date-asc", label: "Najstarije prvo", icon: CalendarArrowUp },
  { value: "name-asc", label: "Naziv (A → Z)", icon: ArrowDownAZ },
  { value: "name-desc", label: "Naziv (Z → A)", icon: ArrowUpAZ },
];

const PHASE_ORDER = [
  "priprema",
  "print",
  "izrada",
  "frezovanj",
  "slojevanj",
  "završ",
  "isporuk",
];

const EXACT_STAGES = [
  {
    key: "priprema",
    label: "Priprema i modelovanje",
    badge: "bg-[#fff1f2] text-[#e11d48] border-[#fecdd3] hover:bg-[#ffe4e6]",
    dot: "#ef4444",
  },
  {
    key: "print",
    label: "Printanje modela zuba",
    badge: "bg-[#fffbeb] text-[#b45309] border-[#fde68a] hover:bg-[#fef3c7]",
    dot: "#f59e0b",
  },
  {
    key: "izrada",
    label: "Laboratorijska izrada",
    badge: "bg-[#f0f9ff] text-[#0369a1] border-[#bae6fd] hover:bg-[#e0f2fe]",
    dot: "#0ea5e9",
  },
  {
    key: "zavrseno",
    label: "Završeni dentalni radovi",
    badge: "bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe] hover:bg-[#ede9fe]",
    dot: "#a855f7",
  },
];

const getStageTheme = (colTitle = "", index = 0) => {
  const t = (colTitle || "").toLowerCase().trim();

  if (t.includes("print") || t.includes("3d")) return EXACT_STAGES[1];
  if (t.includes("priprem")) return EXACT_STAGES[0];
  if (t.includes("laboratorij") || t.includes("izrad") || t.includes("frez") || t.includes("sloj")) {
    return EXACT_STAGES[2];
  }
  if (t.includes("zavr") || t.includes("gotov") || t.includes("isporuk")) return EXACT_STAGES[3];

  return EXACT_STAGES[Math.min(index, EXACT_STAGES.length - 1)] || EXACT_STAGES[0];
};

const isTaskDone = (task) => {
  const t = (task.board_title || task.column_title || "").toLowerCase();
  return t.includes("zavr") || t.includes("isporuk") || t.includes("gotov");
};

const extractTeethCount = (task) => {
  if (!task?.description) return null;
  const match = task.description.match(/(?:zubi|članova|clanovi|krunice):\s*([^\n\r]+)/i);
  return match ? match[1].trim() : null;
};

const CustomFilterSelect = ({ value, onChange, placeholder, options, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, []);

  const selectedOption = options.find((o) => String(o.value) === String(value));

  return (
    <div className={cn("relative w-full md:w-auto", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full md:w-auto md:min-w-[140px] items-center justify-between gap-2 rounded-full border border-line bg-surface px-3.5 text-xs text-ink shadow-[var(--shadow-card)] transition-all duration-200 active:scale-95",
          "hover:border-brand-500/40 hover:shadow-[var(--shadow-soft)]",
          open && "border-brand-500 ring-2 ring-brand-500/15"
        )}
      >
        <span className={cn("truncate font-medium", !selectedOption && "text-muted")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selectedOption && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="grid h-4 w-4 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-ink"
              title="Poništi"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 text-faint transition-transform duration-200", open && "rotate-180 text-brand-600")} />
        </div>
      </button>

      {open && (
        <div className="card animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150 absolute left-0 right-0 md:right-auto z-[130] mt-1.5 min-w-[170px] max-w-[260px] overflow-hidden rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow-lift)]">
          <div
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors",
              !value ? "bg-brand-50 font-semibold text-brand-700" : "text-muted hover:bg-surface-2 hover:text-ink"
            )}
          >
            <span>{placeholder}</span>
            {!value && <Check className="h-3.5 w-3.5 text-brand-600" />}
          </div>

          <div className="my-1 h-px bg-line/60" />

          <div className="max-h-56 overflow-y-auto no-scrollbar">
            {options.map((opt) => {
              const active = String(opt.value) === String(value);
              const Icon = opt.icon;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition-colors active:scale-[0.98]",
                    active ? "bg-brand-50 font-semibold text-brand-700" : "text-ink hover:bg-surface-2"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {Icon && <Icon className="h-3.5 w-3.5 text-muted shrink-0" />}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const StageQuickSelect = ({ task, boards = [], onStageChange, onOpenChange }) => {
  const [open, setOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);

  const toggleOpen = (nextOpen) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) toggleOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 280);
    }
    toggleOpen(!open);
  };

  const currentTitle = task.board_title || task.column_title || "Faza rada";
  const stageTheme = getStageTheme(currentTitle);

  return (
    <div className="relative inline-block" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        title={currentTitle}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1 text-[11px] font-semibold tracking-wide transition-all shadow-sm max-w-[160px] xs:max-w-[190px] sm:max-w-[220px] active:scale-95",
          stageTheme.badge
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: stageTheme.dot }} />
        <span className="truncate whitespace-nowrap">{currentTitle}</span>
        <ChevronDown className="h-3 w-3 opacity-60 shrink-0 ml-0.5" />
      </button>

      {open && (
        <div
          className={cn(
            "card animate-in fade-in-0 zoom-in-95 duration-150 absolute z-[9999] w-60 sm:w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]",
            "right-0 md:right-auto md:left-0",
            openUpwards ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          <div className="max-h-64 overflow-y-auto no-scrollbar space-y-1">
            {boards.map((b, idx) => {
              const theme = getStageTheme(b.title, idx);
              const isSelected = String(b.id) === String(task.board_id);

              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStageChange(task, b.id, b.title);
                    toggleOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors active:scale-[0.98]",
                    isSelected ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink hover:bg-surface-2"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="h-2 w-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: theme.dot }} />
                    <span className="truncate">{b.title}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-brand-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const MyTasks = () => {
  const { user } = useAuth();
  const { openCreateBoard } = useLayout();
  const { boards = [] } = useBoards();

  const [loading, setLoading] = useState(true);
  const [localTasks, setLocalTasks] = useState([]);
  const [priority, setPriority] = useState("");
  const [boardId, setBoardId] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");
  const [now] = useState(() => Date.now());

  // Id zadatka čiji je meni faze rada trenutno otvoren
  const [openStageTaskId, setOpenStageTaskId] = useState(null);

  const [boardDetailsCache, setBoardDetailsCache] = useState({});

  const [taskModal, setTaskModal] = useState({
    open: false,
    task: null,
    columns: [],
    members: [],
  });

  const sortedBoards = useMemo(() => {
    return [...(boards || [])].sort((a, b) => {
      const titleA = (a.title || "").toLowerCase();
      const titleB = (b.title || "").toLowerCase();

      const indexA = PHASE_ORDER.findIndex((p) => titleA.includes(p));
      const indexB = PHASE_ORDER.findIndex((p) => titleB.includes(p));

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return (a.position || 0) - (b.position || 0);
    });
  }, [boards]);

  const fetchAllTasks = useCallback(async () => {
    if (!sortedBoards.length) {
      setLocalTasks([]);
      setLoading(false);
      return;
    }

    try {
      const newCache = {};
      const results = await Promise.all(
        sortedBoards.map(async (b) => {
          try {
            const data = await boardApi.get(b.id);
            const columns = data?.columns || [];
            const members = data?.members || [];

            newCache[b.id] = { columns, members };

            return (data?.tasks || [])
              .filter((t) => !t.is_archived)
              .map((t) => {
                const col = columns.find((c) => c.id === t.column_id);
                return {
                  ...t,
                  board_id: b.id,
                  board_title: b.title,
                  board_color: b.color,
                  column_title: col?.title || b.title,
                  teeth: extractTeethCount(t),
                };
              });
          } catch {
            return [];
          }
        })
      );

      setBoardDetailsCache(newCache);
      setLocalTasks(results.flat());
    } catch (err) {
      console.error(err);
      toast.error("Greška pri učitavanju pacijenata");
    } finally {
      setLoading(false);
    }
  }, [sortedBoards]);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleSync = () => fetchAllTasks();

    socket.on("task:created", handleSync);
    socket.on("task:updated", handleSync);
    socket.on("task:moved", handleSync);
    socket.on("task:deleted", handleSync);
    socket.on("task:archived", handleSync);
    socket.on("board:updated", handleSync);

    return () => {
      socket.off("task:created", handleSync);
      socket.off("task:updated", handleSync);
      socket.off("task:moved", handleSync);
      socket.off("task:deleted", handleSync);
      socket.off("task:archived", handleSync);
      socket.off("board:updated", handleSync);
    };
  }, [fetchAllTasks]);

  const mine = useMemo(() => {
    if (!user?.id) return [];
    return localTasks.filter((t) => String(t.assignee_id) === String(user.id));
  }, [localTasks, user]);

  const boardsInPlay = useMemo(() => {
    return sortedBoards.map((b) => ({
      value: String(b.id),
      label: b.title,
    }));
  }, [sortedBoards]);

  const stats = useMemo(() => {
    let overdue = 0;
    let urgentCount = 0;
    let done = 0;

    mine.forEach((t) => {
      const taskDone = isTaskDone(t);
      if (taskDone) {
        done += 1;
      } else {
        if (t.due_date && new Date(t.due_date).getTime() < now) overdue += 1;
        if (t.priority === "urgent") urgentCount += 1;
      }
    });

    const active = mine.length - done;
    const completionPct = mine.length > 0 ? Math.round((done / mine.length) * 100) : 0;

    return {
      total: mine.length,
      active,
      overdue,
      done,
      urgentCount,
      completionPct,
    };
  }, [mine, now]);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = mine.filter((t) => {
      const taskDone = isTaskDone(t);

      if (priority && t.priority !== priority) return false;
      if (boardId && String(t.board_id) !== String(boardId)) return false;

      if (statusTab === "active" && taskDone) return false;
      if (statusTab === "done" && !taskDone) return false;
      if (statusTab === "overdue") {
        if (taskDone || !t.due_date) return false;
        if (new Date(t.due_date).getTime() >= now) return false;
      }

      if (q) {
        const titleMatch = t.title?.toLowerCase().includes(q);
        const descMatch = (t.description || "").toLowerCase().includes(q);
        const assigneeMatch = (t.assignee_name || "").toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !assigneeMatch) return false;
      }
      return true;
    });

    return result.sort((a, b) => {
      if (sortBy === "name-asc") return (a.title || "").localeCompare(b.title || "", "sr");
      if (sortBy === "name-desc") return (b.title || "").localeCompare(a.title || "", "sr");

      const getTimestamp = (task) => {
        if (task.created_at) {
          const t = new Date(task.created_at).getTime();
          if (!Number.isNaN(t) && t > 0) return t;
        }
        if (task.due_date) {
          const t = new Date(task.due_date).getTime();
          if (!Number.isNaN(t) && t > 0) return t;
        }
        const numId = Number(task.id);
        return !Number.isNaN(numId) ? numId : 0;
      };

      if (sortBy === "date-desc") return getTimestamp(b) - getTimestamp(a);
      if (sortBy === "date-asc") return getTimestamp(a) - getTimestamp(b);
      return 0;
    });
  }, [mine, priority, boardId, statusTab, search, sortBy, now]);

  const handleOpenTask = async (task) => {
    let columns = boardDetailsCache[task.board_id]?.columns || [];
    let members = boardDetailsCache[task.board_id]?.members || [];

    if (!members.length || !columns.length) {
      try {
        const data = await boardApi.get(task.board_id);
        if (data) {
          columns = data.columns || [];
          members = data.members || [];
          setBoardDetailsCache((prev) => ({
            ...prev,
            [task.board_id]: { columns, members },
          }));
        }
      } catch (err) {
        console.error("Greška pri učitavanju članova faze rada:", err);
      }
    }

    setTaskModal({
      open: true,
      task,
      columns,
      members,
    });
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const targetBoardId = updates.target_board_id || taskModal.task?.board_id;
      const res = await taskApi.update(targetBoardId, taskId, updates);

      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...res.task, board_id: targetBoardId } : t))
      );
    } catch (err) {
      toast.error(err.message || "Greška pri ažuriranju pacijenta");
    }
  };

  const handleStageChange = async (task, targetBoardId, targetBoardTitle) => {
    if (String(task.board_id) === String(targetBoardId)) return;

    try {
      await taskApi.update(task.board_id, task.id, {
        target_board_id: targetBoardId,
      });

      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, board_id: targetBoardId, board_title: targetBoardTitle, column_title: targetBoardTitle }
            : t
        )
      );

      toast.success(`Pacijent „${task.title}“ prebačen u: ${targetBoardTitle}`);
    } catch (err) {
      toast.error(err.message || "Greška pri promjeni faze rada");
    }
  };

  const handleArchiveTask = async (task) => {
    try {
      await taskApi.archive(task.board_id, task.id);
      setLocalTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.success(`Pacijent „${task.title}“ je arhiviran`);
    } catch (err) {
      toast.error(err.message || "Greška pri arhiviranju");
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const targetBoardId = taskModal.task?.board_id;
      await taskApi.remove(targetBoardId, taskId);
      setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
      setTaskModal((prev) => ({ ...prev, open: false, task: null }));
      toast.success("Pacijent je obrisan");
    } catch (err) {
      toast.error(err.message || "Greška pri brisanju pacijenta");
    }
  };

  const hasFilters = priority || boardId || search || statusTab !== "all";

  return (
    <>
      <Topbar
        title="Pacijenti i radovi"
        subtitle="Sve faze rada i zadaci dodijeljeni vama."
        onCreateBoard={openCreateBoard}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-5 sm:py-8 pb-32 md:px-8">
          {/* STATS KARTICE */}
          <div className="mb-5 sm:mb-6 grid gap-3.5 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div
              onClick={() => setStatusTab("all")}
              className={cn(
                "group relative overflow-hidden rounded-3xl border bg-surface p-5 sm:p-6 shadow-[var(--shadow-card)] transition-all duration-300 cursor-pointer select-none active:scale-[0.985]",
                "hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5",
                statusTab === "all" ? "border-brand-500 ring-2 ring-brand-500/15" : "border-line"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <ListTodo className="h-3.5 w-3.5 text-brand-600" /> Ukupno zaduženih pacijenata
                  </span>
                  <div className="mt-2 flex items-baseline gap-3">
                    <p className="font-display text-3xl sm:text-4xl font-bold tracking-tight tabular text-ink">
                      {stats.total}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                      {stats.active} u izradi
                    </span>
                  </div>
                </div>

                <div className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 border border-brand-500/20 shadow-sm transition-transform group-hover:scale-105">
                  <Layers className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 sm:mt-5 border-t border-line/60 pt-3 flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                  </span>
                  Dentalna laboratorija
                </span>
              </div>
            </div>

            <div
              onClick={() => setStatusTab("overdue")}
              className={cn(
                "group relative overflow-hidden rounded-3xl border bg-surface p-5 sm:p-6 shadow-[var(--shadow-card)] transition-all duration-300 cursor-pointer select-none active:scale-[0.985]",
                "hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5",
                statusTab === "overdue" ? "border-rose-500 ring-2 ring-rose-500/15" : "border-line"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> Probijeni rokovi
                  </span>
                  <div className="mt-2 flex items-baseline gap-3">
                    <p className="font-display text-3xl sm:text-4xl font-bold tracking-tight tabular text-rose-600">
                      {stats.overdue}
                    </p>
                    <span className="text-xs text-muted">
                      {stats.overdue === 1 ? "pacijent kasni" : "pacijenata kasne"}
                    </span>
                  </div>
                </div>

                <div className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-500/20 shadow-sm transition-transform group-hover:scale-105">
                  <Clock className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 sm:mt-5 border-t border-line/60 pt-3 flex items-center justify-between text-xs">
                <span className="text-muted">Status prioriteta:</span>
                <span className={cn("font-bold tabular text-xs", stats.overdue > 0 ? "text-rose-600" : "text-emerald-600")}>
                  {stats.overdue > 0 ? "Zahtijeva pažnju odmah" : "Svi rokovi ispoštovani"}
                </span>
              </div>
            </div>

            <div
              onClick={() => setStatusTab("done")}
              className={cn(
                "group relative overflow-hidden rounded-3xl border bg-surface p-5 sm:p-6 shadow-[var(--shadow-card)] transition-all duration-300 cursor-pointer select-none active:scale-[0.985]",
                "hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1",
                statusTab === "done" ? "border-purple-500 ring-2 ring-purple-500/15" : "border-line"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5 text-purple-600" /> Završeni dentalni radovi
                  </span>
                  <div className="mt-2 flex items-baseline gap-3">
                    <p className="font-display text-3xl sm:text-4xl font-bold tracking-tight tabular text-ink">
                      {stats.done}
                    </p>
                    <span className="text-xs font-bold text-purple-600">
                      {stats.completionPct}% realizovano
                    </span>
                  </div>
                </div>

                <div className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-500/20 shadow-sm transition-transform group-hover:scale-105">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3.5 sm:mt-4 flex flex-col gap-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${stats.completionPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-faint">
                  <span>{stats.done} od {stats.total} pacijenata</span>
                  <span>Spremno za preuzimanje</span>
                </div>
              </div>
            </div>
          </div>

          {/* DESKTOP FILTERI */}
          <div className="mb-6 hidden md:flex flex-wrap items-center gap-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraga pacijenata..."
              className="h-9 w-60 rounded-full border border-line bg-surface px-4 text-xs shadow-[var(--shadow-card)] outline-none transition-all duration-200 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/15"
            />

            <CustomFilterSelect
              value={priority}
              onChange={setPriority}
              placeholder="Svi prioriteti"
              options={PRIORITIES}
            />

            <CustomFilterSelect
              value={boardId}
              onChange={setBoardId}
              placeholder="Sve faze radova"
              options={boardsInPlay}
            />

            <CustomFilterSelect
              value={sortBy}
              onChange={setSortBy}
              placeholder="Sortiranje"
              options={SORT_OPTIONS}
            />

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setPriority("");
                  setBoardId("");
                  setSearch("");
                  setStatusTab("all");
                  setSortBy("date-desc");
                }}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-faint transition-colors hover:bg-surface-2 hover:text-ink"
              >
                Poništi filtere
              </button>
            )}

            <span
              className={cn(
                "ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tabular transition-all duration-300",
                filteredAndSorted.length > 0
                  ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "bg-surface-2 text-muted"
              )}
            >
              {filteredAndSorted.length > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                </span>
              )}
              <span>
                {filteredAndSorted.length}{" "}
                {filteredAndSorted.length === 1
                  ? "pacijent"
                  : filteredAndSorted.length >= 2 && filteredAndSorted.length <= 4
                  ? "pacijenta"
                  : "pacijenata"}
              </span>
            </span>
          </div>

          {/* MOBILNI FILTERI */}
          <div className="mb-5 flex flex-col gap-2.5 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraga pacijenata..."
                  className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-8 text-xs shadow-[var(--shadow-card)] outline-none transition-all duration-200 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/15"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="w-[125px] shrink-0">
                <CustomFilterSelect
                  value={sortBy}
                  onChange={setSortBy}
                  placeholder="Sortiranje"
                  options={SORT_OPTIONS}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <CustomFilterSelect
                value={priority}
                onChange={setPriority}
                placeholder="Prioritet"
                options={PRIORITIES}
                className="w-full"
              />
              <CustomFilterSelect
                value={boardId}
                onChange={setBoardId}
                placeholder="Faza rada"
                options={boardsInPlay}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setPriority("");
                      setBoardId("");
                      setSearch("");
                      setStatusTab("all");
                      setSortBy("date-desc");
                    }}
                    className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-faint hover:text-ink transition-colors active:scale-95 border border-line/60"
                  >
                    Poništi filtere
                  </button>
                )}
              </div>

              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tabular transition-all duration-300",
                  filteredAndSorted.length > 0
                    ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                    : "bg-surface-2 text-muted"
                )}
              >
                {filteredAndSorted.length > 0 && (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                )}
                <span>
                  {filteredAndSorted.length}{" "}
                  {filteredAndSorted.length === 1
                    ? "pacijent"
                    : filteredAndSorted.length >= 2 && filteredAndSorted.length <= 4
                    ? "pacijenta"
                    : "pacijenata"}
                </span>
              </span>
            </div>
          </div>

          {/* PRIKAZ PACIJENATA */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-2xl animate-pulse bg-line/60" />
              ))}
            </div>
          ) : mine.length === 0 ? (
            <EmptyState
              title="Nemate zaduženih pacijenata"
              body="Pacijenti i radovi koji vam budu dodijeljeni u laboratoriji prikazaće se ovdje."
            />
          ) : filteredAndSorted.length === 0 ? (
            <EmptyState
              title="Nema pronađenih pacijenata"
              body="Pokušajte promijeniti ili poništiti filtere pretrage."
            />
          ) : (
            <>
              {/* DESKTOP VIEW: Tabela */}
              <div className="hidden md:block rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)] overflow-visible">
                <table className="w-full text-left text-xs border-collapse table-fixed">
                  <thead>
                    <tr className="border-b border-line/70 bg-surface-2/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint select-none">
                      <th className="py-3.5 pl-6 pr-2 w-[110px]">Prioritet</th>
                      <th className="py-3.5 px-3 w-[22%]">Pacijent</th>
                      <th className="py-3.5 px-3 w-[18%]">Zaduženi radnik</th>
                      <th className="py-3.5 px-3 w-[140px]">Rok završetka</th>
                      <th className="py-3.5 px-3 w-[240px]">Faza rada</th>
                      <th className="py-3.5 pr-6 pl-2 text-right w-[130px]">Pregled pacijenta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60 font-medium">
                    {filteredAndSorted.map((t) => {
                      const due = formatDueDate(t.due_date);
                      const done = isTaskDone(t);

                      return (
                        <tr
                          key={t.id}
                          className={cn(
                            "group transition-colors duration-150 hover:bg-surface-2/40",
                            openStageTaskId === t.id ? "relative z-40" : ""
                          )}
                        >
                          <td className="py-3.5 pl-6 pr-2 whitespace-nowrap">
                            <PriorityTag priority={t.priority} />
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5 max-w-[220px]">
                              <button
                                type="button"
                                onClick={() => handleOpenTask(t)}
                                title={t.title}
                                className={cn(
                                  "font-medium text-sm transition-colors hover:text-brand-600 truncate text-left cursor-pointer",
                                  done ? "text-faint line-through" : "text-ink"
                                )}
                              >
                                {t.title}
                              </button>
                              {t.teeth && (
                                <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted border border-line/50">
                                  {t.teeth}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {t.assignee_name ? (
                              <span className="inline-flex items-center gap-2 text-ink truncate max-w-full" title={t.assignee_name}>
                                <Avatar name={t.assignee_name} src={t.assignee_avatar} size="xs" className="h-5 w-5 shrink-0" />
                                <span className="truncate">{t.assignee_name}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-faint">
                                <User className="h-3.5 w-3.5 shrink-0" />
                                <span>Nedodijeljeno</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {due ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular",
                                  due.overdue && !done
                                    ? "bg-priority-urgent/10 text-priority-urgent border border-priority-urgent/20"
                                    : "bg-surface-2 text-muted border border-line/50"
                                )}
                              >
                                <Calendar className="h-3 w-3" /> {due.label}
                              </span>
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap overflow-visible">
                            <StageQuickSelect
                              task={t}
                              boards={sortedBoards}
                              onStageChange={handleStageChange}
                              onOpenChange={(isOpen) => setOpenStageTaskId(isOpen ? t.id : null)}
                            />
                          </td>
                          <td className="py-3.5 pr-6 pl-2 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {done && (
                                <button
                                  type="button"
                                  onClick={() => handleArchiveTask(t)}
                                  title="Arhiviraj završenog pacijenta"
                                  className="grid h-7 w-7 place-items-center rounded-lg text-faint opacity-60 transition-all hover:bg-brand-50 hover:text-brand-600 hover:opacity-100 active:scale-90"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenTask(t)}
                                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-[var(--shadow-card)] transition-all duration-200 hover:border-brand-500/40 hover:text-brand-600 hover:shadow-[var(--shadow-soft)] active:scale-95"
                              >
                                <span>Otvori</span>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE VIEW sa osiguranim z-indexom protiv preklapanja */}
              <div className="md:hidden space-y-2.5 overflow-visible">
                {filteredAndSorted.map((t, index) => {
                  const isThisOpen = openStageTaskId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "transition-all duration-300 animate-in fade-in-50 slide-in-from-bottom-1 overflow-visible",
                        isThisOpen ? "relative z-50" : "relative"
                      )}
                      style={{
                        animationDelay: `${index * 30}ms`,
                        zIndex: isThisOpen ? 100 : filteredAndSorted.length - index,
                      }}
                    >
                      <TaskCardMobile
                        task={t}
                        boards={sortedBoards}
                        onStageChange={handleStageChange}
                        onClick={() => handleOpenTask(t)}
                        isOpen={isThisOpen}
                        onOpenChange={(isOpen) => setOpenStageTaskId(isOpen ? t.id : null)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {taskModal.open && (
        <TaskModal
          open={taskModal.open}
          onClose={() => setTaskModal((prev) => ({ ...prev, open: false, task: null }))}
          task={taskModal.task}
          defaultColumnId={taskModal.task?.column_id}
          columns={taskModal.columns}
          members={taskModal.members}
          actions={{
            updateTask: handleUpdateTask,
            deleteTask: handleDeleteTask,
          }}
        />
      )}
    </>
  );
};

const TaskCardMobile = ({ task, boards, onStageChange, onClick, isOpen, onOpenChange }) => {
  const due = formatDueDate(task.due_date);
  const done = isTaskDone(task);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group block rounded-2xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-soft)] active:scale-[0.985] cursor-pointer",
        isOpen ? "relative z-50 overflow-visible" : "relative z-0"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <PriorityTag priority={task.priority} className="shrink-0" />
        <StageQuickSelect
          task={task}
          boards={boards}
          onStageChange={onStageChange}
          onOpenChange={onOpenChange}
        />
      </div>

      <div className="flex items-center gap-2">
        <p className={cn("text-sm font-semibold tracking-tight truncate flex-1", done ? "text-faint line-through" : "text-ink")}>
          {task.title}
        </p>
        {task.teeth && (
          <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted border border-line/50">
            {task.teeth}
          </span>
        )}
      </div>

      {task.assignee_name && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <Avatar name={task.assignee_name} src={task.assignee_avatar} size="xs" className="h-4 w-4 shrink-0" />
          <span>{task.assignee_name}</span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5 text-xs">
        {due ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular",
              due.overdue && !done ? "bg-priority-urgent/10 text-priority-urgent font-semibold" : "bg-surface-2 text-muted"
            )}
          >
            <Calendar className="h-3 w-3" /> {due.label}
          </span>
        ) : (
          <span className="text-[11px] text-faint">Nema roka</span>
        )}

        <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:translate-x-0.5 transition-transform">
          Otvori <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
};

const EmptyState = ({ title, body }) => (
  <div className="card flex flex-col items-center justify-center gap-3 rounded-3xl py-16 sm:py-20 text-center border border-line bg-surface">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 border border-brand-500/20">
      <CheckSquare className="h-7 w-7" />
    </div>
    <div>
      <h3 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted px-4">{body}</p>
    </div>
  </div>
);

export default MyTasks;