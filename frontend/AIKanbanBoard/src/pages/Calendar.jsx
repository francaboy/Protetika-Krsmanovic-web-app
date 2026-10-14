import { useMemo, useState, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";
import { srLatn } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from "lucide-react";
import { useLayout } from "../components/layout/AppLayout";
import { useWorkspace } from "../hooks/useWorkspace";
import Topbar from "../components/layout/Topbar";
import TaskModal from "../components/board/TaskModal";
import { boardApi, taskApi } from "../lib/api";
import { getSocket } from "../lib/socket";
import { cn, priorityMeta } from "../lib/utils";
import toast from "react-hot-toast";

const WEEKDAYS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

// Izvlači ISKLJUČIVO validan datum roka u YYYY-MM-DD formatu
const getDateKey = (t) => {
  if (!t) return null;
  const raw = t.due_date || t.dueDate || t.rok || null;
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (trimmed.length < 10) return null;

  const datePart = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
};

// Gramatička funkcija za radove
const formatRadoviGramatika = (count, tip = "ukupno") => {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (tip === "kasni") {
    if (mod10 === 1 && mod100 !== 11) return `${count} rad kasni`;
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${count} rada kasne`;
    return `${count} radova kasni`;
  }

  if (tip === "planiran") {
    if (mod10 === 1 && mod100 !== 11) return `${count} planiran rad`;
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${count} planirana rada`;
    return `${count} planiranih radova`;
  }

  if (mod10 === 1 && mod100 !== 11) return `${count} rad`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${count} rada`;
  return `${count} radova`;
};

const isTaskDone = (t) => {
  const status = (t?.status || "").toLowerCase();
  const board = (t?.board_title || "").toLowerCase();
  const col = (t?.column_title || "").toLowerCase();
  return (
    status.includes("završen") ||
    status.includes("gotov") ||
    board.includes("završen") ||
    col.includes("završen") ||
    Boolean(t?.is_archived)
  );
};

const Calendar = () => {
  const { openCreateBoard } = useLayout();
  const { tasks: workspaceTasks = [], loading, mutate } = useWorkspace();

  // Lokalno stanje zadataka za trenutan optimistički update bez čekanja i refresha
  const [localTasks, setLocalTasks] = useState([]);

  useEffect(() => {
    setLocalTasks(workspaceTasks || []);
  }, [workspaceTasks]);

  // Sinhronizacija u realnom vremenu preko socket-a ako neko drugi napravi izmjenu
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTaskUpdated = (updatedTask) => {
      if (!updatedTask?.id) return;
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
      );
      if (typeof mutate === "function") mutate();
    };

    const handleTaskDeleted = ({ id }) => {
      if (!id) return;
      setLocalTasks((prev) => prev.filter((t) => t.id !== id));
      if (typeof mutate === "function") mutate();
    };

    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:deleted", handleTaskDeleted);
    socket.on("task:archived", handleTaskDeleted);

    return () => {
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:deleted", handleTaskDeleted);
      socket.off("task:archived", handleTaskDeleted);
    };
  }, [mutate]);

  const [cursor, setCursor] = useState(() => new Date());
  const [expandedDays, setExpandedDays] = useState({});

  const [taskModal, setTaskModal] = useState({
    open: false,
    task: null,
    columns: [],
    members: [],
  });

  const toggleDayExpanded = (key) => {
    setExpandedDays((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Filtriramo samo aktivne pacijente sa zadanim rokom
  const validTasks = useMemo(() => {
    return (localTasks || []).filter((t) => !t.is_archived && Boolean(getDateKey(t)));
  }, [localTasks]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const mobileDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = {};
    validTasks.forEach((t) => {
      const key = getDateKey(t);
      if (!key) return;
      (map[key] ||= []).push(t);
    });
    return map;
  }, [validTasks]);

  const currentMonthKey = useMemo(() => format(cursor, "yyyy-MM"), [cursor]);

  const monthTasks = useMemo(() => {
    return validTasks.filter((t) => {
      const key = getDateKey(t);
      return key && key.startsWith(currentMonthKey);
    });
  }, [validTasks, currentMonthKey]);

  const overdueMonthTasksCount = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return monthTasks.filter((t) => {
      const key = getDateKey(t);
      return key && key < todayStr && !isTaskDone(t);
    }).length;
  }, [monthTasks]);

  const monthCount = monthTasks.length;

  const handlePrevMonth = () => setCursor((c) => subMonths(c, 1));
  const handleNextMonth = () => setCursor((c) => addMonths(c, 1));
  const handleToday = () => setCursor(new Date());

  const handleOpenTaskModal = async (task, e) => {
    if (e) e.preventDefault();
    const boardId = task.board_id || task.boardId;
    try {
      const data = await boardApi.get(boardId);
      setTaskModal({
        open: true,
        task,
        columns: data?.columns || [],
        members: data?.members || [],
      });
    } catch {
      setTaskModal({
        open: true,
        task,
        columns: [],
        members: [],
      });
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      // 1. TRENUTNI OPTIMISTIČKI UPDATE NA KALENDARU (bez čekanja na network ili refresh)
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
      );

      const targetBoardId = updates.target_board_id || taskModal.task?.board_id || taskModal.task?.boardId;
      await taskApi.update(targetBoardId, taskId, updates);

      // UKLONJEN toast.success OVDJE DA SE NE DUPLA, JER GA VEĆ PUŠTA TaskModal
      setTaskModal((prev) => ({ ...prev, open: false, task: null }));
      if (typeof mutate === "function") mutate();
    } catch (err) {
      toast.error(err.message || "Greška pri ažuriranju pacijenta");
      if (typeof mutate === "function") mutate();
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      // Trenutno uklanjanje sa kalendara
      setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));

      const targetBoardId = taskModal.task?.board_id || taskModal.task?.boardId;
      await taskApi.remove(targetBoardId, taskId);

      // Takođe uklonjen dupli toast jer ga TaskModal već javlja
      setTaskModal((prev) => ({ ...prev, open: false, task: null }));
      if (typeof mutate === "function") mutate();
    } catch (err) {
      toast.error(err.message || "Greška pri brisanju pacijenta");
      if (typeof mutate === "function") mutate();
    }
  };

  return (
    <>
      <Topbar
        title="Kalendar"
        subtitle="Pregled radova po rokovima završetka u realnom vremenu."
        onCreateBoard={openCreateBoard}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-5 sm:py-8 pb-32 md:px-8">
          {/* ZAGLAVLJE SA PORAVNATIM BEDŽEVIMA */}
          <div className="mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              {/* Naslov mjeseca */}
              <h2 className="font-display text-xl sm:text-2xl font-semibold capitalize tracking-tight text-ink">
                {format(cursor, "LLLL yyyy.", { locale: srLatn })}
              </h2>

              {/* Bedževi: na mobilnom su u redu JEDAN PORED DRUGOG ispod naslova, na desktopu u produžetku */}
              <div className="flex flex-row items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-xs font-semibold tabular transition-all duration-300",
                    monthCount > 0
                      ? "border border-brand-500/25 bg-brand-50 text-brand-700 shadow-sm"
                      : "bg-surface-2 text-muted border border-line"
                  )}
                >
                  <span>{formatRadoviGramatika(monthCount, "planiran")}</span>
                </span>

                {overdueMonthTasksCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-600 animate-pulse shadow-sm">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatRadoviGramatika(overdueMonthTasksCount, "kasni")}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Navigacijska dugmad */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handleToday}
                className="h-9 rounded-full border border-line bg-surface px-3.5 sm:px-4 text-xs font-semibold text-ink shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-soft)] active:scale-95"
              >
                Danas
              </button>
              <button
                onClick={handlePrevMonth}
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted shadow-[var(--shadow-card)] transition-all duration-200 hover:text-ink hover:shadow-[var(--shadow-soft)] active:scale-95"
                title="Prethodni mjesec"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted shadow-[var(--shadow-card)] transition-all duration-200 hover:text-ink hover:shadow-[var(--shadow-soft)] active:scale-95"
                title="Sljedeći mjesec"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="skeleton h-[540px] sm:h-[640px] rounded-3xl" />
          ) : (
            <>
              {/* DESKTOP VIEW */}
              <div className="hidden lg:block overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)]">
                <div className="grid grid-cols-7 border-b bg-surface-2/50">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {days.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const items = byDay[key] || [];
                    const inMonth = isSameMonth(day, cursor);
                    const today = isToday(day);
                    const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
                    const hasOverdueTasks = isPast && items.some((t) => !isTaskDone(t));
                    const isExpanded = Boolean(expandedDays[key]);
                    const visibleItems = isExpanded ? items : items.slice(0, 3);

                    return (
                      <div
                        key={key}
                        className={cn(
                          "min-h-[116px] border-b border-r p-2 last:border-r-0 [&:nth-child(7n)]:border-r-0 transition-colors duration-200",
                          !inMonth && "bg-surface-2/30",
                          hasOverdueTasks && "bg-red-500/[0.04]",
                          isExpanded && "bg-surface-2/10"
                        )}
                      >
                        <div className="mb-1.5 flex justify-end">
                          <span
                            className={cn(
                              "grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold tabular",
                              today ? "bg-brand-500 text-white shadow-sm" : inMonth ? "text-ink" : "text-faint"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {visibleItems.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={(e) => handleOpenTaskModal(t, e)}
                              title={`${t.title} · ${t.board_title || ""}`}
                              className="w-full text-left flex items-center gap-1.5 rounded-md bg-surface-2 px-1.5 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-elevated truncate cursor-pointer"
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: priorityMeta(t.priority).color }}
                              />
                              <span className="truncate">{t.title}</span>
                            </button>
                          ))}
                          {items.length > 3 && (
                            <button
                              type="button"
                              onClick={() => toggleDayExpanded(key)}
                              className="w-full text-left rounded px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                            >
                              {isExpanded ? "Prikaži manje" : `+${items.length - 3} još`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MOBILE VIEW */}
              <div className="lg:hidden space-y-3">
                {mobileDays
                  .filter((day) => isSameMonth(day, cursor))
                  .map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const items = byDay[key] || [];
                    const today = isToday(day);
                    const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
                    const hasOverdueTasks = isPast && items.some((t) => !isTaskDone(t));

                    if (items.length === 0 && !today) {
                      return null;
                    }

                    return (
                      <div
                        key={key}
                        className={cn(
                          "rounded-2xl border p-3.5 shadow-sm transition-all bg-surface",
                          today ? "border-brand-500 ring-1 ring-brand-500/20" : "border-line",
                          hasOverdueTasks && "border-red-500/40 bg-red-500/[0.03]"
                        )}
                      >
                        <div className="flex items-center justify-between border-b border-line/60 pb-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "grid h-7 w-7 place-items-center rounded-full text-xs font-bold tabular",
                                today ? "bg-brand-500 text-white shadow-sm" : "bg-surface-2 text-ink border border-line/60"
                              )}
                            >
                              {format(day, "d")}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-ink">
                              {format(day, "EEEE, d. MMMM", { locale: srLatn })}
                            </span>
                          </div>
                          {items.length > 0 && (
                            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold tabular text-muted border border-line/60">
                              {formatRadoviGramatika(items.length, "obicno")}
                            </span>
                          )}
                        </div>

                        {items.length === 0 ? (
                          <p className="text-[11px] text-faint py-1">Danas nema planiranih radova.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {items.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={(e) => handleOpenTaskModal(t, e)}
                                className="w-full flex items-center justify-between gap-2 rounded-xl bg-surface-2/70 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-3 border border-line/40 active:scale-[0.99] cursor-pointer"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: priorityMeta(t.priority).color }}
                                  />
                                  <span className="truncate font-semibold">{t.title}</span>
                                </div>
                                {t.board_title && (
                                  <span className="text-[10px] text-muted shrink-0 bg-surface px-2 py-0.5 rounded-md border border-line/60">
                                    {t.board_title}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {monthCount === 0 && (
                  <div className="rounded-2xl border border-line border-dashed bg-surface/50 p-6 text-center">
                    <p className="text-sm font-semibold text-ink">Nema planiranih radova</p>
                    <p className="text-xs text-faint mt-1">U ovom mjesecu nema pacijenata sa zadanim rokom.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* LEGENDA */}
          <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-4 text-xs text-muted text-center sm:text-left">
            <span className="flex items-center justify-center gap-1.5 font-medium">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>Boja tačke = prioritet</span>
            </span>

            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              {["low", "medium", "high", "urgent"].map((p) => {
                const m = priorityMeta(p);
                return (
                  <span key={p} className="flex items-center gap-1 text-[11px] sm:text-xs text-muted">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: m.color }}
                    />
                    <span>{m.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
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

export default Calendar;