import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  format,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";
import { srLatn } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useLayout } from "../components/layout/AppLayout";
import { useWorkspace } from "../hooks/useWorkspace";
import Topbar from "../components/layout/Topbar";
import TaskModal from "../components/board/TaskModal";
import { boardApi, taskApi } from "../lib/api";
import { cn, priorityMeta } from "../lib/utils";
import toast from "react-hot-toast";

const WEEKDAYS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

const getDateKey = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal === "string" && dateVal.length >= 10) {
    return dateVal.slice(0, 10);
  }
  const d = new Date(dateVal);
  return Number.isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
};

const Calendar = () => {
  const { openCreateBoard } = useLayout();
  const { tasks = [], loading, mutate } = useWorkspace();
  const [cursor, setCursor] = useState(() => new Date());
  const [mobileWeekCursor, setMobileWeekCursor] = useState(() => new Date());
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

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const mobileDays = useMemo(() => {
    const weekStart = startOfWeek(mobileWeekCursor, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(mobileWeekCursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [mobileWeekCursor]);

  const byDay = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const key = getDateKey(t.due_date);
      if (!key) return;
      (map[key] ||= []).push(t);
    });
    return map;
  }, [tasks]);

  const monthCount = useMemo(
    () =>
      tasks.filter((t) => {
        const key = getDateKey(t.due_date);
        if (!key) return false;
        return isSameMonth(new Date(key), cursor);
      }).length,
    [tasks, cursor]
  );

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
      const targetBoardId = updates.target_board_id || taskModal.task?.board_id || taskModal.task?.boardId;
      await taskApi.update(targetBoardId, taskId, updates);
      toast.success("Podaci o pacijentu su ažurirani");
      setTaskModal((prev) => ({ ...prev, open: false, task: null }));
      if (typeof mutate === "function") mutate();
    } catch (err) {
      toast.error(err.message || "Greška pri ažuriranju pacijenta");
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const targetBoardId = taskModal.task?.board_id || taskModal.task?.boardId;
      await taskApi.remove(targetBoardId, taskId);
      toast.success("Pacijent je obrisan");
      setTaskModal((prev) => ({ ...prev, open: false, task: null }));
      if (typeof mutate === "function") mutate();
    } catch (err) {
      toast.error(err.message || "Greška pri brisanju pacijenta");
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
          <div className="mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h2 className="font-display text-xl sm:text-2xl font-semibold capitalize tracking-tight text-ink">
                {format(cursor, "LLLL yyyy", { locale: srLatn })}
              </h2>

              <span
                className={cn(
                  "inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3 py-1 text-xs font-semibold tabular transition-all duration-300",
                  monthCount > 0
                    ? "border border-red-500/20 bg-red-500/10 text-red-600 shadow-[0_0_12px_rgba(239,68,68,0.2)] animate-pulse"
                    : "bg-surface-2 text-muted"
                )}
              >
                {monthCount > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                )}
                <span>
                  {monthCount}{" "}
                  {monthCount === 1
                    ? "rad kasni"
                    : monthCount >= 2 && monthCount <= 4
                    ? "rada kasne"
                    : "radova kasni"}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => {
                  setCursor(new Date());
                  setMobileWeekCursor(new Date());
                }}
                className="h-9 rounded-full border border-line bg-surface px-3.5 sm:px-4 text-xs font-semibold text-ink shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-soft)] active:scale-95"
              >
                Danas
              </button>
              <button
                onClick={() => {
                  setCursor((c) => subMonths(c, 1));
                  setMobileWeekCursor((c) => subWeeks(c, 1));
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted shadow-[var(--shadow-card)] transition-all duration-200 hover:text-ink hover:shadow-[var(--shadow-soft)] active:scale-95"
                title="Prethodni period"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setCursor((c) => addMonths(c, 1));
                  setMobileWeekCursor((c) => addWeeks(c, 1));
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted shadow-[var(--shadow-card)] transition-all duration-200 hover:text-ink hover:shadow-[var(--shadow-soft)] active:scale-95"
                title="Sljedeći period"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="skeleton h-[540px] sm:h-[640px] rounded-3xl" />
          ) : (
            <>
              {/* DESKTOP & TABLET VIEW (od velikih ekrana nagore): Standardni mjesečni kalendar */}
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
                    const hasOverdueTasks = isPast && items.length > 0;

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
                              title={`${t.title} · ${t.board_title}`}
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

              {/* MOBILE & TABLET PORTRAIT VIEW (do lg ekrana): Prošireni nedjeljni vertikalni prikaz */}
              <div className="lg:hidden space-y-3">
                <div className="text-xs font-semibold text-muted px-1">
                  Prikaz za nedjelju: {format(mobileDays[0], "d. MMM", { locale: srLatn })} - {format(mobileDays[6], "d. MMM yyyy", { locale: srLatn })}
                </div>

                {mobileDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const items = byDay[key] || [];
                  const today = isToday(day);
                  const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
                  const hasOverdueTasks = isPast && items.length > 0;

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
                            {items.length} {items.length === 1 ? "rad" : "radova"}
                          </span>
                        )}
                      </div>

                      {items.length === 0 ? (
                        <p className="text-[11px] text-faint py-1">Nema zaduženih radova za ovaj dan.</p>
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
                              <span className="text-[10px] text-muted shrink-0 bg-surface px-2 py-0.5 rounded-md border border-line/60">
                                {t.board_title}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Legenda prioriteta */}
          <div className="mt-5 flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Boja tačke = prioritet
            </span>
            {["low", "medium", "high", "urgent"].map((p) => {
              const m = priorityMeta(p);
              return (
                <span key={p} className="flex items-center gap-1 text-[11px] sm:text-xs text-muted">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} /> {m.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* TaskModal za direktan pregled i izmjenu pacijenta u kalendaru */}
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