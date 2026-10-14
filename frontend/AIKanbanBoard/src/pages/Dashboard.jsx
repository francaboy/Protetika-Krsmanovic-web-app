import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sparkles,
  ArrowUpRight,
  Plus,
  Clock,
  Printer,
  Wrench,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useBoards } from "../context/BoardsContext";
import { useAuth } from "../context/AuthContext";
import { useLayout } from "../components/layout/AppLayout";
import { boardApi, taskApi } from "../lib/api";
import { getSocket } from "../lib/socket";
import Topbar from "../components/layout/Topbar";
import TaskModal from "../components/board/TaskModal";
import { cn } from "../lib/utils";

const STAGE_CONFIGS = [
  {
    key: "priprema",
    match: "priprem",
    defaultTitle: "Priprema i modelovanje",
    desc: "Digitalno skeniranje, 3D dizajn i modelovanje zuba.",
    icon: Clock,
    color: "#e11d48",
    bgClass: "bg-rose-50/50 hover:bg-rose-50/80 border-rose-200/80",
    badgeClass: "bg-rose-100 text-rose-700 border-rose-200",
    dot: "#ef4444",
  },
  {
    key: "print",
    match: "print",
    defaultTitle: "Printanje modela zuba",
    desc: "3D štampa baza, privremenih mostova i šablona.",
    icon: Printer,
    color: "#d97706",
    bgClass: "bg-amber-50/50 hover:bg-amber-50/80 border-amber-200/80",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "#f59e0b",
  },
  {
    key: "izrada",
    match: "izrad",
    defaultTitle: "Laboratorijska izrada",
    desc: "Frezovanje cirkona, slojevanje keramike i sinterovanje zuba.",
    icon: Wrench,
    color: "#0284c7",
    bgClass: "bg-sky-50/50 hover:bg-sky-50/80 border-sky-200/80",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
    dot: "#0ea5e9",
  },
  {
    key: "zavrseno",
    match: "zavr",
    defaultTitle: "Završeni dentalni radovi",
    desc: "Kontrola kvaliteta, završna obrada i slanje radova.",
    icon: CheckCircle2,
    color: "#7c3aed",
    bgClass: "bg-purple-50/50 hover:bg-purple-50/80 border-purple-200/80",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
    dot: "#8b5cf6",
  },
];

const toVocative = (name) => {
  if (!name) return "";
  const firstName = name.trim().split(" ")[0];
  const lower = firstName.toLowerCase();

  if (lower.endsWith("a") || lower.endsWith("o") || lower.endsWith("e")) {
    return firstName;
  }
  if (lower.endsWith("tar") || lower.endsWith("dar")) {
    return `${firstName.slice(0, -2)}re`;
  }
  const lastChar = lower.charAt(lower.length - 1);
  if (["č", "ć", "đ", "š", "ž", "j"].includes(lastChar)) {
    return `${firstName}u`;
  }
  return `${firstName}e`;
};

const Dashboard = () => {
  const { boards = [], loading } = useBoards();
  const { user } = useAuth();
  const { openCreateBoard } = useLayout();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();

  const [taskModal, setTaskModal] = useState({
    open: false,
    boardId: null,
    defaultColumnId: null,
    columns: [],
    members: [],
  });

  const [boardsDetails, setBoardsDetails] = useState({});

  const fetchStagesData = useCallback(async () => {
    if (!boards || boards.length === 0) return;

    try {
      const details = {};
      await Promise.all(
        boards.map(async (b) => {
          try {
            const data = await boardApi.get(b.id);
            const tasks = (data?.tasks || []).filter((t) => !t.is_archived);
            const urgentTasks = tasks.filter((t) => t.priority === "urgent");

            details[b.id] = {
              columns: data?.columns || [],
              members: data?.members || [],
              tasks,
              totalCount: tasks.length,
              urgentCount: urgentTasks.length,
            };
          } catch {
            details[b.id] = { columns: [], members: [], tasks: [], totalCount: 0, urgentCount: 0 };
          }
        })
      );
      setBoardsDetails(details);
    } catch (err) {
      console.error("Greška pri učitavanju detalja faza rada:", err);
    }
  }, [boards]);

  useEffect(() => {
    fetchStagesData();
  }, [fetchStagesData]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleSync = () => fetchStagesData();

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
  }, [fetchStagesData]);

  const mappedStages = useMemo(() => {
    const totalAllTasks = Object.values(boardsDetails).reduce(
      (sum, item) => sum + (item.totalCount || 0),
      0
    );

    return STAGE_CONFIGS.map((config, idx) => {
      const matchedBoard = boards.find((b) =>
        (b.title || "").toLowerCase().includes(config.match)
      ) || boards[idx];

      const boardId = matchedBoard?.id;
      const details = boardId ? boardsDetails[boardId] : null;

      const totalTasks = details?.totalCount ?? (matchedBoard?.task_count || 0);
      const urgentTasks = details?.urgentCount ?? 0;
      const members = details?.members || [];
      const percentage = totalAllTasks > 0 ? Math.round((totalTasks / totalAllTasks) * 100) : 0;

      return {
        ...config,
        boardId,
        title: matchedBoard?.title || config.defaultTitle,
        totalTasks,
        urgentTasks,
        members,
        percentage,
        columns: details?.columns || [],
      };
    });
  }, [boards, boardsDetails]);

  const handleOpenNewPatient = async (e, stage) => {
    e?.stopPropagation?.();
    if (!stage.boardId) {
      toast.error("Faza rada nije kreirana");
      return;
    }

    let cols = stage.columns || [];
    let mems = stage.members || [];

    if (!cols.length || !mems.length) {
      try {
        const data = await boardApi.get(stage.boardId);
        if (data) {
          cols = data.columns || [];
          mems = data.members || [];
        }
      } catch (err) {
        console.error(err);
      }
    }

    setTaskModal({
      open: true,
      boardId: stage.boardId,
      defaultColumnId: cols[0]?.id || null,
      columns: cols,
      members: mems,
    });
  };

  const handleCreateTask = async (taskData) => {
    const targetId = taskData.target_board_id || taskData.board_id || taskModal.boardId;
    if (!targetId) return;

    try {
      await taskApi.create(targetId, taskData);
      toast.success("Pacijent je uspješno evidentiran");
      setTaskModal({ open: false, boardId: null, defaultColumnId: null, columns: [], members: [] });
      fetchStagesData();
    } catch (err) {
      toast.error(err.message || "Greška pri evidentiranju pacijenta");
    }
  };

  return (
    <>
      <Topbar
        title="Pregled Pacijenata i Radova"
        subtitle="Izaberite radnu fazu za upravljanje pacijentima i radovima laboratorije."
        onNewTask={() => mappedStages[0] && handleOpenNewPatient({ stopPropagation: () => {} }, mappedStages[0])}
        onCreateBoard={openCreateBoard}
      />

      <div className="flex-1 overflow-y-auto flex flex-col justify-between">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-8 md:px-8">
          {/* DOBRODOŠLICA */}
          <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
                Stomatologija Krsmanović
              </p>
              <h2 className="mt-1 font-display text-2xl sm:text-[clamp(26px,3vw,34px)] font-bold leading-tight tracking-tight text-ink">
                Dobro došli, {toVocative(user?.name)}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted">
                Brzi pristup i direktan uvid u 4 ključne faze radova.
              </p>
            </div>

            {/* Dugme za brzi pregled cjelokupne analitike */}
            <button
              type="button"
              onClick={() => navigate("/analitika")}
              className="inline-flex items-center gap-2 self-start md:self-auto rounded-2xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink shadow-[var(--shadow-card)] transition-all duration-200 hover:border-brand-500/40 hover:text-brand-600 hover:shadow-[var(--shadow-soft)] active:scale-95 shrink-0"
            >
              <Sparkles className="h-4 w-4 text-brand-500" />
              <span>Otvorite Analitiku Pacijenata</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          {/* 4 VELIKE KARTICE - GLAVNI BOARDOVI */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-60 sm:h-64 rounded-3xl animate-pulse bg-line/60" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {mappedStages.map((stage, idx) => {
                const Icon = stage.icon;

                return (
                  <div
                    key={stage.key}
                    onClick={() => stage.boardId && navigate(`/rad/${stage.boardId}`)}
                    className={cn(
                      "group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-surface p-4 xs:p-5 sm:p-7 shadow-[var(--shadow-card)] transition-all duration-300 cursor-pointer select-none",
                      "hover:shadow-[var(--shadow-lift)] hover:-translate-y-1 active:scale-[0.99]",
                      stage.bgClass
                    )}
                  >
                    {/* Pozadinski suptilni vodeni žig ikonice */}
                    <div className="absolute -right-6 -bottom-6 pointer-events-none opacity-5 transition-transform duration-500 group-hover:scale-125 group-hover:rotate-6">
                      <Icon className="h-48 w-48" style={{ color: stage.color }} />
                    </div>

                    {/* Gornji red: Ikonica, Brojač faze i Bedževi */}
                    <div>
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className="grid h-10 w-10 xs:h-12 xs:w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl shadow-sm border transition-transform duration-300 group-hover:scale-110"
                            style={{
                              backgroundColor: `${stage.color}15`,
                              borderColor: `${stage.color}30`,
                              color: stage.color,
                            }}
                          >
                            <Icon className="h-5.5 w-5.5 xs:h-6 xs:w-6 sm:h-7 sm:w-7" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] xs:text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted">
                                Faza {idx + 1}
                              </span>
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: stage.dot }}
                              />
                            </div>
                            {/* POPRAVLJENO: Spriječeno prelamanje na mobilnim i S25 Ultra */}
                            <h3 className="font-display text-[14px] xs:text-[16px] sm:text-lg md:text-xl font-bold tracking-tight text-ink group-hover:text-brand-600 transition-colors whitespace-nowrap truncate">
                              {stage.title}
                            </h3>
                          </div>
                        </div>

                        {/* Bedž hitnih pacijenata */}
                        {stage.urgentTasks > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 text-white px-2 xs:px-2.5 py-0.5 xs:py-1 text-[9px] xs:text-[10px] sm:text-[11px] font-bold shadow-sm animate-pulse shrink-0 self-center">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span className="whitespace-nowrap">
                              {stage.urgentTasks}{" "}
                              {stage.urgentTasks % 10 === 1 && stage.urgentTasks % 100 !== 11
                                ? "rad kasni"
                                : [2, 3, 4].includes(stage.urgentTasks % 10) && ![12, 13, 14].includes(stage.urgentTasks % 100)
                                ? "rada kasne"
                                : "radova kasni"}
                            </span>
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-[11px] sm:text-xs leading-relaxed text-muted line-clamp-2">
                        {stage.desc}
                      </p>
                    </div>

                    {/* Srednji red: Glavna metrika i raspodjela */}
                    <div className="my-4 xs:my-5 border-y border-line/60 py-3 sm:py-4">
                      <div className="flex items-baseline justify-between mb-2 gap-2">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="font-display text-2xl xs:text-3xl sm:text-4xl font-bold tracking-tight tabular text-ink">
                            {stage.totalTasks}
                          </span>
                          <span className="text-[11px] sm:text-xs font-semibold text-muted truncate">
                            {stage.totalTasks === 1
                              ? "pacijent"
                              : stage.totalTasks >= 2 && stage.totalTasks <= 4
                              ? "pacijenta"
                              : "pacijenata"}
                          </span>
                        </div>

                        <span className="text-[11px] xs:text-xs font-bold tabular shrink-0" style={{ color: stage.color }}>
                          {stage.percentage}% ukupnih radova
                        </span>
                      </div>

                      {/* Progres linija opterećenja ove faze */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.max(stage.percentage, 6)}%`,
                            backgroundColor: stage.color,
                          }}
                        />
                      </div>
                    </div>

                    {/* Donji red: Dugmad za akciju i ulazak u board */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {/* Brzo dodavanje pacijenta direktno u ovu fazu */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenNewPatient(e, stage)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 xs:px-3 py-1.5 text-[11px] xs:text-xs font-semibold text-ink transition-all duration-200 hover:border-brand-500/40 hover:bg-surface-2 active:scale-95 shadow-sm shrink-0"
                        title={`Dodaj novog pacijenta u: ${stage.title}`}
                      >
                        <Plus className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                        <span className="whitespace-nowrap">Novi pacijent</span>
                      </button>

                      {/* Ulazak u kanban ploču faze */}
                      <div className="inline-flex items-center gap-0.5 xs:gap-1 text-[11px] xs:text-xs font-bold text-ink group-hover:text-brand-600 group-hover:translate-x-1 transition-all min-w-0">
                        <span className="truncate whitespace-nowrap">Pregledajte pacijente</span>
                        <ChevronRight className="h-3.5 w-3.5 xs:h-4 xs:w-4 shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="w-full border-t border-line/60 bg-surface/40 py-4 sm:py-5 text-xs text-muted backdrop-blur-sm mt-8">
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

      {/* MODAL ZA KREIRANJE PACIJENTA SA IZABRANOM FAZOM RADA */}
      {taskModal.open && (
        <TaskModal
          open={taskModal.open}
          onClose={() => setTaskModal({ open: false, boardId: null, defaultColumnId: null, columns: [], members: [] })}
          task={null}
          boardId={taskModal.boardId}
          defaultBoardId={taskModal.boardId}
          boards={boards}
          defaultColumnId={taskModal.defaultColumnId || taskModal.columns[0]?.id}
          columns={taskModal.columns}
          members={taskModal.members}
          actions={{
            createTask: handleCreateTask,
            updateTask: async () => {},
            deleteTask: async () => {},
          }}
        />
      )}
    </>
  );
};

export default Dashboard;