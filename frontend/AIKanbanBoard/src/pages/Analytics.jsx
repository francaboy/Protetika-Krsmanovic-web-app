import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CheckSquare,
  ArrowUpRight,
  BarChart3,
  PieChart,
  FolderKanban,
  Layers,
  Activity,
  Zap,
} from "lucide-react";
import { useBoards } from "../context/BoardsContext";
import { useAuth } from "../context/AuthContext";
import { useLayout } from "../components/layout/AppLayout";
import { boardApi, taskApi } from "../lib/api";
import { getSocket } from "../lib/socket";
import Topbar from "../components/layout/Topbar";
import TaskModal from "../components/board/TaskModal";
import { cn } from "../lib/utils";

const PHASE_ORDER = [
  "priprema",
  "print",
  "izrada",
  "frezovanj",
  "slojevanj",
  "završ",
  "isporuk",
];

const ToothWatermark = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M7 3C4.23858 3 2 5.23858 2 8C2 10.5 3.5 12.8 4.2 15C5 17.5 6 21 8.5 21C10.5 21 11 18.5 12 18.5C13 18.5 13.5 21 15.5 21C18 21 19 17.5 19.8 15C20.5 12.8 22 10.5 22 8C22 5.23858 19.7614 3 17 3C14.5 3 13.2 4.5 12 4.5C10.8 4.5 9.5 3 7 3Z" />
    <path d="M10 9C10.5 10 11.2 10.5 12 10.5C12.8 10.5 13.5 10 14 9" opacity="0.6" />
  </svg>
);

const Analytics = () => {
  const { boards = [], loading } = useBoards();
  const { user } = useAuth();
  const { openCreateBoard } = useLayout();

  const currentYear = new Date().getFullYear();

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [targetColumns, setTargetColumns] = useState([]);
  const [targetMembers, setTargetMembers] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);

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

  const [allTasksData, setAllTasksData] = useState({
    stage0: 0,
    stage1: 0,
    stage2: 0,
    stage3: 0,
    urgent: 0,
    ready: 0,
    completionPct: 0,
  });

  const [priorityBreakdown, setPriorityBreakdown] = useState({
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  });

  const syncTimeoutRef = useRef(null);

  useEffect(() => {
    if (sortedBoards && sortedBoards.length > 0) {
      const bId = sortedBoards[0].id;
      setActiveBoardId(bId);
      boardApi
        .get(bId)
        .then((data) => {
          if (data) {
            setTargetColumns(data.columns || []);
            setTargetMembers(data.members || []);
          }
        })
        .catch(console.error);
    }
  }, [sortedBoards]);

  const fetchRealtimeTaskStats = useCallback(async () => {
    if (!sortedBoards || sortedBoards.length === 0) {
      setAllTasksData({
        stage0: 0,
        stage1: 0,
        stage2: 0,
        stage3: 0,
        urgent: 0,
        ready: 0,
        completionPct: 0,
      });
      setPriorityBreakdown({ urgent: 0, high: 0, medium: 0, low: 0, total: 0 });
      return;
    }

    try {
      const detailedBoards = await Promise.all(
        sortedBoards.map(async (b) => {
          try {
            const res = await boardApi.get(b.id);
            return {
              ...b,
              tasks: (res?.tasks || []).filter((t) => !t.is_archived),
            };
          } catch {
            return { ...b, tasks: [] };
          }
        })
      );

      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;
      let urgentActive = 0;

      let pUrgent = 0;
      let pHigh = 0;
      let pMedium = 0;
      let pLow = 0;

      detailedBoards.forEach((board) => {
        const title = (board.title || "").toLowerCase();
        let phaseIdx = 0;

        if (title.includes("priprem")) phaseIdx = 0;
        else if (title.includes("print")) phaseIdx = 1;
        else if (title.includes("izrad") || title.includes("frez") || title.includes("sloj")) phaseIdx = 2;
        else if (title.includes("zavr") || title.includes("isporuk")) phaseIdx = 3;

        board.tasks.forEach((t) => {
          if (phaseIdx === 0) s0++;
          else if (phaseIdx === 1) s1++;
          else if (phaseIdx === 2) s2++;
          else if (phaseIdx === 3) s3++;

          if (t.priority === "urgent" && phaseIdx < 3) {
            urgentActive++;
          }

          const p = (t.priority || "medium").toLowerCase();
          if (p === "urgent") pUrgent++;
          else if (p === "high") pHigh++;
          else if (p === "low") pLow++;
          else pMedium++;
        });
      });

      const totalActive = s0 + s1 + s2 + s3;
      const pct = totalActive > 0 ? Math.round((s3 / totalActive) * 100) : 0;

      setAllTasksData({
        stage0: s0,
        stage1: s1,
        stage2: s2,
        stage3: s3,
        urgent: urgentActive,
        ready: s3,
        completionPct: pct,
      });

      setPriorityBreakdown({
        urgent: pUrgent,
        high: pHigh,
        medium: pMedium,
        low: pLow,
        total: totalActive,
      });
    } catch (err) {
      console.error("Greška pri računanju real-time statistike:", err);
    }
  }, [sortedBoards]);

  useEffect(() => {
    fetchRealtimeTaskStats();

    const socket = getSocket();
    if (!socket) return;

    const debouncedSync = () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        fetchRealtimeTaskStats();
      }, 250);
    };

    socket.on("task:created", debouncedSync);
    socket.on("task:updated", debouncedSync);
    socket.on("task:moved", debouncedSync);
    socket.on("task:deleted", debouncedSync);
    socket.on("task:archived", debouncedSync);
    socket.on("task:restored", debouncedSync);
    socket.on("board:updated", debouncedSync);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      socket.off("task:created", debouncedSync);
      socket.off("task:updated", debouncedSync);
      socket.off("task:moved", debouncedSync);
      socket.off("task:deleted", debouncedSync);
      socket.off("task:archived", debouncedSync);
      socket.off("task:restored", debouncedSync);
      socket.off("board:updated", debouncedSync);
    };
  }, [fetchRealtimeTaskStats]);

  const stats = useMemo(() => {
    const totalTasks = sortedBoards.reduce(
      (sum, b) => sum + Number(b.task_count || 0),
      0
    );
    return { total: sortedBoards.length, totalTasks };
  }, [sortedBoards]);

  const avgPerBoard = stats.total
    ? Math.round(stats.totalTasks / stats.total)
    : 0;

  const trends = useMemo(() => {
    const sizes = sortedBoards.map((b) => Number(b.task_count || 0));
    return {
      boards: sizes,
      tasks: sizes,
    };
  }, [sortedBoards]);

  const handleOpenNewPatientModal = async () => {
    if (sortedBoards.length === 0) {
      toast.error("Prvo kreirajte barem jednu fazu rada");
      return;
    }

    const bId = activeBoardId || sortedBoards[0]?.id;
    if (targetColumns.length === 0) {
      try {
        const data = await boardApi.get(bId);
        if (data) {
          setTargetColumns(data.columns || []);
          setTargetMembers(data.members || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    setTaskModalOpen(true);
  };

  const handleCreateTaskFromDashboard = async (taskData) => {
    const bId = taskData.target_board_id || activeBoardId || sortedBoards[0]?.id;
    if (!bId) return;

    try {
      await taskApi.create(bId, taskData);
      toast.success("Pacijent je uspješno evidentiran");
      setTaskModalOpen(false);
      fetchRealtimeTaskStats();
    } catch (err) {
      toast.error(err.message || "Greška pri evidentiranju pacijenta");
    }
  };

  return (
    <>
      <Topbar
        title="Analitika Laboratorije"
        subtitle="Pregled i statistika svih pacijenata i radova u realnom vremenu."
        onNewTask={handleOpenNewPatientModal}
        onCreateBoard={openCreateBoard}
      />

      <div className="flex-1 overflow-y-auto flex flex-col justify-between">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-8 md:px-8">
          <div className="mb-4 sm:mb-5 grid gap-4 sm:gap-5 grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <KpiCard
                featured
                label="Ukupno Pacijenata"
                value={stats.totalTasks}
                hint={`Prosječno ${avgPerBoard} po fazi rada`}
                trend={trends.tasks}
                icon={CheckSquare}
                className="h-full min-h-[150px]"
                realtimeData={allTasksData}
              />
            </div>

            <div className="lg:col-span-4">
              <KpiCard
                variant="gradient"
                label="Ukupno Faza Radova"
                value={stats.total}
                hint="Standardni protokoli izrade"
                trend={trends.boards}
                icon={FolderKanban}
                className="h-full min-h-[150px]"
                secondaryStats={{
                  avgPerBoard,
                  activePipelines: sortedBoards.filter((b) => Number(b.task_count || 0) > 0).length,
                }}
              />
            </div>
          </div>

          {loading ? (
            <div className="mb-10 space-y-4 sm:space-y-5">
              <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
                <div className="skeleton h-[280px] sm:h-[300px] rounded-3xl animate-pulse bg-line/60 lg:col-span-8" />
                <div className="skeleton h-[280px] sm:h-[300px] rounded-3xl animate-pulse bg-line/60 lg:col-span-4" />
              </div>
            </div>
          ) : sortedBoards.length > 0 ? (
            <div className="mb-10 space-y-4 sm:space-y-5">
              <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
                <TasksByBoard boards={sortedBoards} className="lg:col-span-8" />
                <PriorityStatusDonut
                  breakdown={priorityBreakdown}
                  className="lg:col-span-4"
                />
              </div>
            </div>
          ) : null}
        </div>

        <footer className="w-full border-t border-line/60 bg-surface/40 py-4 sm:py-5 text-xs text-muted backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 md:px-8">
            <p className="flex items-center gap-1 text-center">
              <span>©</span> {currentYear}
              <span className="font-semibold text-ink">Stomatologija Krsmanović.</span>
              Sva prava zadržana.
            </p>
            <div className="flex items-center gap-1.5 text-faint">
              <span>Made by</span>
              <a
                href="https://srdjanmilosevic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-flex items-center gap-1 font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                <span>Srđan</span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 bg-brand-500 transition-all duration-300 group-hover:w-full" />
              </a>
            </div>
          </div>
        </footer>
      </div>

      {taskModalOpen && (
        <TaskModal
          open={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
          task={null}
          defaultColumnId={targetColumns[0]?.id}
          columns={targetColumns}
          members={targetMembers}
          actions={{
            createTask: handleCreateTaskFromDashboard,
            updateTask: async () => {},
            deleteTask: async () => {},
          }}
        />
      )}
    </>
  );
};

const SectionTitle = ({ icon: Icon, children, hint }) => (
  <div className="mb-4 sm:mb-5 flex items-center gap-2.5">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 shadow-sm border border-brand-500/20">
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0">
      <h3 className="font-display text-sm font-bold tracking-tight text-ink">
        {children}
      </h3>
      {hint && <p className="truncate text-[11px] text-faint">{hint}</p>}
    </div>
  </div>
);

const EmptyHint = ({ icon: Icon, children }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
    <Icon className="h-6 w-6 text-faint" />
    <p className="max-w-[15rem] text-xs text-muted leading-relaxed">{children}</p>
  </div>
);

const getPhaseShortName = (title = "", idx = 0) => {
  const t = title.toLowerCase();
  if (t.includes("priprem")) return "Priprema";
  if (t.includes("print")) return "Print";
  if (t.includes("izrad") || t.includes("frez") || t.includes("sloj")) return "Izrada";
  if (t.includes("zavr") || t.includes("isporuk")) return "Završeno";
  return `Faza ${idx + 1}`;
};

const TasksByBoard = ({ boards, className }) => {
  const max = Math.max(1, ...boards.map((b) => Number(b.task_count || 0)));
  const total = boards.reduce((s, b) => s + Number(b.task_count || 0), 0);
  const hasTasks = total > 0;

  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-line bg-surface p-4 sm:p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-soft)]",
        className
      )}
    >
      <SectionTitle icon={BarChart3} hint="Hronološki raspored pacijenata kroz faze rada.">
        Analitika Pacijenata
      </SectionTitle>

      {hasTasks ? (
        <div className="mt-1 flex flex-1 flex-col gap-5 lg:flex-row lg:gap-6">
          <div className="flex h-[180px] sm:h-[220px] flex-1 items-end gap-2.5 sm:gap-3.5 px-1 sm:px-2 pt-4">
            {boards.map((b, i) => {
              const count = Number(b.task_count || 0);
              const pct = count / max;
              const shortName = getPhaseShortName(b.title, i);

              return (
                <Link
                  key={b.id}
                  to={`/rad/${b.id}`}
                  title={`${b.title} · ${count} pacijenata`}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5 sm:gap-2.5"
                >
                  <div className="relative flex w-full max-w-[46px] sm:max-w-[56px] flex-1 items-end justify-center">
                    {count > 0 ? (
                      <>
                        <span className="absolute -top-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand-600 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tabular text-white opacity-90 sm:opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
                          {count}
                        </span>
                        <div
                          className="w-full rounded-xl sm:rounded-2xl border border-brand-600/30 bg-gradient-to-t from-brand-600 to-brand-400 shadow-sm transition-all duration-300 group-hover:brightness-110"
                          style={{ height: `${Math.max(pct * 100, 14)}%` }}
                        />
                      </>
                    ) : (
                      <div className="h-full w-full rounded-xl sm:rounded-2xl border border-dashed border-line bg-surface-2/40" />
                    )}
                  </div>
                  <span className="flex h-5 sm:h-6 w-full max-w-[70px] sm:max-w-[80px] items-center justify-center rounded-lg sm:rounded-xl bg-surface-2 text-[10px] sm:text-[11px] font-semibold text-ink border border-line/60 shadow-sm transition-colors group-hover:bg-brand-50 group-hover:text-brand-700">
                    {shortName}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col justify-between shrink-0 border-t border-line pt-3 sm:pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6 lg:w-[310px]">
            <div>
              <p className="mb-2.5 sm:mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                Opterećenost po fazama rada (%)
              </p>

              <div className="space-y-2 sm:space-y-2.5">
                {boards.map((b, i) => {
                  const count = Number(b.task_count || 0);
                  const share = total ? Math.round((count / total) * 100) : 0;

                  return (
                    <div key={b.id}>
                      <Link
                        to={`/rad/${b.id}`}
                        className="group flex flex-col gap-1 rounded-xl p-1 -mx-1 transition-all duration-200 hover:bg-surface-2 active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-4.5 w-4.5 sm:h-5 sm:w-5 items-center justify-center rounded-md sm:rounded-lg bg-surface-2 text-[10px] font-bold text-muted border border-line/50 shrink-0">
                            {i + 1}
                          </span>
                          <span className="flex-1 truncate text-xs font-medium text-ink transition-colors group-hover:text-brand-600">
                            {b.title}
                          </span>

                          <span className="shrink-0 rounded-md bg-surface-2 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold tabular text-ink transition-colors group-hover:bg-brand-50 group-hover:text-brand-700 border border-line/50">
                            {count}
                          </span>

                          <span className="w-8 sm:w-10 text-right text-[10px] sm:text-[11px] font-semibold tabular text-faint transition-colors group-hover:text-ink">
                            {share}%
                          </span>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-brand-500 transition-all duration-500"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <EmptyHint icon={BarChart3}>
          Još nema evidentiranih pacijenata — dodajte pacijente kako bi se prikazala analitika.
        </EmptyHint>
      )}
    </div>
  );
};

const PriorityStatusDonut = ({ breakdown, className }) => {
  const total = breakdown.total || 0;
  const R = 54;
  const SW = 15;
  const C = 2 * Math.PI * R;

  const priorities = [
    { key: "urgent", label: "Hitno (Urgentno)", count: breakdown.urgent, color: "#e11d48" },
    { key: "high", label: "Visok prioritet", count: breakdown.high, color: "#f59e0b" },
    { key: "medium", label: "Srednji prioritet", count: breakdown.medium, color: "#0369A1" },
    { key: "low", label: "Nizak prioritet", count: breakdown.low, color: "#94a3b8" },
  ];

  let accumulatedOffset = 0;

  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-line bg-surface p-4 sm:p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-soft)]",
        className
      )}
    >
      <SectionTitle icon={PieChart} hint="Pregled prioriteta svih aktivnih pacijenata.">
        Prioriteti Radova
      </SectionTitle>

      <div className="flex items-center gap-4 sm:gap-5">
        <div className="group/donut relative h-[110px] w-[110px] sm:h-[126px] sm:w-[126px] shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="var(--color-surface-2)"
              strokeWidth={SW}
            />
            {total > 0 &&
              priorities.map((item, idx) => {
                const segLen = (item.count / total) * C;
                const offset = accumulatedOffset;
                accumulatedOffset += segLen;

                if (item.count === 0) return null;

                return (
                  <circle
                    key={idx}
                    cx="70"
                    cy="70"
                    r={R}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={SW}
                    strokeDasharray={`${segLen} ${C}`}
                    strokeDashoffset={-offset}
                    className="transition-all duration-700"
                  />
                );
              })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-xl sm:text-2xl font-bold tabular leading-none text-ink">
              {total}
            </span>
            <span className="mt-1 text-[8px] sm:text-[9px] uppercase tracking-wider text-faint">
              ukupno
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 sm:gap-2">
          {priorities.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 sm:gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-[11px] sm:text-xs text-muted font-medium">{item.label}</span>
              <span className="ml-auto text-xs font-semibold tabular text-ink">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 sm:mt-5 grid flex-1 content-center gap-1.5 sm:gap-2 border-t border-line/60 pt-3 sm:pt-4">
        {priorities.map((item) => {
          const share = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.key} className="flex items-center justify-between text-xs">
              <span className="text-muted text-[11px] sm:text-xs">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular text-ink text-[11px] sm:text-xs">{item.count}</span>
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold tabular text-faint border border-line/50">
                  {share}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Sparkbars = ({ data, isGradient }) => {
  const bars = data.slice(-11);
  const max = Math.max(1, ...bars);
  const peak = Math.max(...bars);
  return (
    <div className="flex h-9 sm:h-10 items-end gap-[3px]" aria-hidden="true">
      {bars.map((v, i) => (
        <span
          key={i}
          className={cn(
            "w-1.5 rounded-full",
            isGradient
              ? "bg-white/40"
              : v === peak
              ? "bg-brand-500"
              : "bg-brand-300"
          )}
          style={{ height: `${Math.max((v / max) * 100, 14)}%` }}
        />
      ))}
    </div>
  );
};

const KpiCard = ({
  label,
  value,
  hint,
  featured,
  variant = "default",
  trend,
  icon: Icon = ArrowUpRight,
  className,
  realtimeData,
  secondaryStats,
}) => {
  const isGradient = variant === "gradient";

  const stageBreakdown = [
    { label: "Priprema", count: realtimeData?.stage0 || 0, color: "bg-brand-400" },
    { label: "Print", count: realtimeData?.stage1 || 0, color: "bg-brand-500" },
    { label: "Izrada", count: realtimeData?.stage2 || 0, color: "bg-brand-600" },
    { label: "Završeno", count: realtimeData?.stage3 || 0, color: "bg-brand-700" },
  ];

  const totalBreakdown =
    stageBreakdown.reduce((s, x) => s + x.count, 0) || 1;
  const completionPct = realtimeData?.completionPct ?? 0;
  const urgentCount = realtimeData?.urgent ?? 0;
  const readyCount = realtimeData?.ready ?? 0;

  if (featured) {
    return (
      <div
        className={cn(
          "group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-line bg-surface p-4 sm:p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-lift)]",
          className
        )}
      >
        <div className="absolute -right-8 -bottom-10 pointer-events-none transition-transform duration-700 group-hover:scale-105 group-hover:-rotate-6">
          <Zap className="h-[220px] sm:h-[264px] w-[220px] sm:w-[264px] text-brand-500 fill-brand-500/10 stroke-[1.2] opacity-10" />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between gap-4 sm:gap-6 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-start gap-3.5 sm:gap-4">
            {Icon && (
              <div className="grid h-11 w-11 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 shadow-sm border border-brand-500/20">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            )}
            <div>
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-faint">
                {label}
              </p>
              <div className="mt-0.5 sm:mt-1 flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  {value}
                </span>
              </div>
              {hint && <p className="mt-0.5 sm:mt-1 text-xs text-muted">{hint}</p>}
            </div>
          </div>

          <div className="hidden flex-1 flex-col justify-center border-y border-line/60 py-4 lg:flex lg:border-x lg:border-y-0 lg:px-8 lg:py-0">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-ink flex items-center gap-1.5">
                Tok radova u laboratoriji
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                </span>
              </span>
              <span className="font-bold tabular text-brand-600">
                {completionPct}% završeno
              </span>
            </div>

            <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-surface-2 p-0.5 shadow-inner">
              {stageBreakdown.map((st, i) => {
                const pct =
                  totalBreakdown > 0 && st.count > 0
                    ? Math.max(8, Math.round((st.count / totalBreakdown) * 100))
                    : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={i}
                    style={{ width: `${pct}%` }}
                    className={cn("h-full rounded-full transition-all duration-500 shadow-sm", st.color)}
                    title={`${st.label}: ${st.count}`}
                  />
                );
              })}
              {totalBreakdown === 1 && stageBreakdown.every((s) => s.count === 0) && (
                <div className="h-full w-full rounded-full bg-line/50" />
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
              {stageBreakdown.map((st, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full shadow-sm", st.color)} />
                  <span className="truncate">{st.label}</span>
                  <span className="font-bold tabular text-ink">({st.count})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:hidden border-t border-line/50 pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-ink flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
                </span>
                Tok radova
              </span>
              <span className="font-bold tabular text-brand-600">
                {completionPct}% završeno
              </span>
            </div>

            <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full bg-surface-2 p-0.5 shadow-inner">
              {stageBreakdown.map((st, i) => {
                const pct =
                  totalBreakdown > 0 && st.count > 0
                    ? Math.max(8, Math.round((st.count / totalBreakdown) * 100))
                    : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={i}
                    style={{ width: `${pct}%` }}
                    className={cn("h-full rounded-full transition-all duration-500 shadow-sm", st.color)}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-4 gap-1 pt-1 text-center text-[10px]">
              {stageBreakdown.map((st, i) => (
                <div key={i} className="flex flex-col items-center rounded-lg bg-surface-2/60 py-1 border border-line/40">
                  <span className="truncate text-muted">{st.label}</span>
                  <span className="font-bold tabular text-ink">{st.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:flex lg:shrink-0 lg:items-center lg:justify-start lg:gap-6 border-t border-line/50 pt-3 lg:border-t-0 lg:pt-0">
            <div className="flex flex-col rounded-2xl bg-rose-50/50 p-2.5 lg:p-0 lg:bg-transparent border border-rose-500/15 lg:border-none">
              <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-600">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                </span>
                Hitni radovi
              </span>
              <span className="mt-0.5 font-display text-2xl font-bold tabular tracking-tight text-ink sm:text-3xl">
                {urgentCount}
              </span>
            </div>

            <div className="hidden lg:block h-8 sm:h-10 w-px bg-line/60" />

            <div className="flex flex-col rounded-2xl bg-emerald-50/50 p-2.5 lg:p-0 lg:bg-transparent border border-emerald-500/15 lg:border-none">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Spremno za slanje
              </span>
              <span className="mt-0.5 font-display text-2xl font-bold tabular tracking-tight text-ink sm:text-3xl">
                {readyCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-3xl p-4 sm:p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-lift)]",
        isGradient
          ? "brand-gradient text-white shadow-[var(--shadow-brand)]"
          : "border border-line bg-surface text-ink hover:shadow-[var(--shadow-soft)]",
        className
      )}
    >
      {isGradient && (
        <>
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/10 blur-2xl pointer-events-none" />

          <div className="absolute -right-10 -bottom-10 pointer-events-none transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3">
            <ToothWatermark className="h-56 sm:h-64 w-56 sm:w-64 text-white opacity-[0.09]" />
          </div>
        </>
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-[11px] sm:text-xs font-bold uppercase tracking-wider",
              isGradient ? "text-white/85" : "text-faint"
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-2xl transition-colors",
              isGradient
                ? "bg-white/20 text-white shadow-inner backdrop-blur"
                : "bg-brand-50 text-brand-600 group-hover:bg-brand-100 border border-brand-500/20"
            )}
          >
            <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </span>
        </div>

        <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p
              className={cn(
                "font-display text-3xl sm:text-[40px] font-bold leading-none tracking-tight tabular",
                isGradient ? "text-white" : "text-ink"
              )}
            >
              {value}
            </p>
            {hint && (
              <p
                className={cn(
                  "mt-1.5 text-[11px] sm:text-xs",
                  isGradient ? "text-white/75" : "text-muted"
                )}
              >
                {hint}
              </p>
            )}
          </div>

          {isGradient && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-white backdrop-blur-md shadow-sm border border-white/10 shrink-0">
              <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-200" /> 4 faze izrade
            </span>
          )}
        </div>

        {isGradient && secondaryStats && (
          <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-2 border-t border-white/15 pt-3 sm:pt-4 text-white/90">
            <div className="flex flex-col">
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-white/70">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Laboratorija
              </span>
              <span className="mt-0.5 flex items-center gap-1 font-display text-xs sm:text-sm font-semibold tabular truncate">
                <Activity className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                {secondaryStats.activePipelines > 0 ? "Aktivno radi" : "Spremna"}
              </span>
            </div>

            <div className="flex flex-col border-l border-white/15 pl-2.5 sm:pl-3">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/70 truncate">
                Opterećenje
              </span>
              <span className="mt-0.5 flex items-center gap-1 font-display text-xs sm:text-sm font-semibold tabular truncate">
                <Zap className="h-3.5 w-3.5 text-amber-200 shrink-0" />
                ~ {secondaryStats.avgPerBoard} pacijenta / radu
              </span>
            </div>
          </div>
        )}
      </div>

      {trend && trend.length >= 2 && !secondaryStats && (
        <div className="relative z-10 mt-3 sm:mt-4 flex justify-end">
          <Sparkbars data={trend} isGradient={isGradient} />
        </div>
      )}
    </div>
  );
};

export default Analytics;