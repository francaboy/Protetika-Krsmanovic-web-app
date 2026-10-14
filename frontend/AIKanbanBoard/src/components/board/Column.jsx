import { useState, useRef, useEffect, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, Trash2, Sparkles, Pencil } from "lucide-react";
import TaskCard from "./TaskCard";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

// Tačne boje za 4 faze rada
const getPhaseTheme = (title = "") => {
  const t = title.toLowerCase();

  // 1. Priprema i modelovanje -> Crvena
  if (t.includes("priprema") || t.includes("modelovanj")) {
    return {
      soft: "rgba(239, 68, 68, 0.05)",
      border: "rgba(239, 68, 68, 0.2)",
      ring: "#ef4444",
      dot: "#ef4444",
      badge: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    };
  }

  // 2. Printanje modela zuba -> Žuta / Amber
  if (t.includes("print") || t.includes("modela")) {
    return {
      soft: "rgba(245, 158, 11, 0.06)",
      border: "rgba(245, 158, 11, 0.25)",
      ring: "#f59e0b",
      dot: "#f59e0b",
      badge: "bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20",
    };
  }

  // 3. Laboratorijska izrada -> Plava
  if (t.includes("izrada") || t.includes("laboratorij") || t.includes("frez") || t.includes("sloj")) {
    return {
      soft: "rgba(14, 165, 233, 0.06)",
      border: "rgba(14, 165, 233, 0.25)",
      ring: "#0ea5e9",
      dot: "#0ea5e9",
      badge: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    };
  }

  // 4. Završeni dentalni radovi -> Ljubičasta
  if (t.includes("završen") || t.includes("dentalni") || t.includes("isporuk")) {
    return {
      soft: "rgba(168, 85, 247, 0.06)",
      border: "rgba(168, 85, 247, 0.25)",
      ring: "#a855f7",
      dot: "#a855f7",
      badge: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    };
  }

  // Podrazumijevana tema
  return {
    soft: "var(--surface)",
    border: "var(--line)",
    ring: "#2f8159",
    dot: "#2f8159",
    badge: "bg-surface-2 text-ink border-line",
  };
};

const Column = ({
  column,
  tasks = [],
  onTaskClick,
  onAddTask,
  onRename,
  onDelete,
  onAiGenerate,
  onArchiveTask,
}) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "owner";

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", column },
  });

  const theme = useMemo(() => getPhaseTheme(column.title), [column.title]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [title, setTitle] = useState(column.title);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setTitle(column.title);
  }, [column.title]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const commitRename = () => {
    setEditing(false);
    const t = title.trim();
    if (t && t !== column.title) {
      onRename(column.id, t);
    } else {
      setTitle(column.title);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      commitRename();
    } else if (e.key === "Escape") {
      setTitle(column.title);
      setEditing(false);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full w-full min-h-0 flex-1 flex-col rounded-3xl border p-3 sm:p-5 transition-all duration-300 shadow-sm overflow-hidden",
        isOver && "ring-2 ring-inset"
      )}
      style={{
        backgroundColor: theme.soft,
        borderColor: theme.border,
        ...(isOver ? { "--tw-ring-color": theme.ring } : {}),
      }}
    >
      {/* Zaglavlje faze rada prilagođeno za mobilne uređaje i tablete */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-line/60 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 rounded-full shadow-sm ring-white/60 dark:ring-black/40"
            style={{ backgroundColor: theme.dot }}
          />

          {editing ? (
            <input
              ref={inputRef}
              value={title}
              size={Math.max(title.length || 1, 8)}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              className="w-auto min-w-[90px] max-w-[130px] xs:max-w-[190px] sm:max-w-[280px] rounded-xl border border-brand-500 bg-surface px-2 py-0.5 text-xs sm:text-base font-bold text-ink outline-none ring-2 ring-brand-500/15 shadow-inner"
            />
          ) : (
            <h3
              className="cursor-pointer truncate font-display text-sm sm:text-lg font-bold tracking-tight text-ink transition-colors hover:text-brand-700"
              onDoubleClick={() => setEditing(true)}
              title="Dvaput kliknite za preimenovanje faze"
            >
              {column.title}
            </h3>
          )}

          {/* Pulsirajući badge za broj pacijenata */}
          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold tabular transition-all duration-300 border",
              tasks.length > 0
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "bg-surface-2 text-muted border-line"
            )}
          >
            {tasks.length > 0 && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            )}
            <span>
              {tasks.length}{" "}
              <span className="hidden sm:inline">
                {tasks.length === 1
                  ? "pacijent"
                  : tasks.length >= 2 && tasks.length <= 4
                  ? "pacijenta"
                  : "pacijenata"}
              </span>
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            className="flex items-center gap-1 rounded-xl border border-line/80 bg-surface px-2 sm:px-3 py-1.5 text-xs font-semibold text-ink shadow-[var(--shadow-card)] transition-all hover:bg-surface-2 hover:border-brand-500/40 active:scale-95"
            title="Dodaj novog pacijenta"
          >
            <Plus className="h-3.5 w-3.5 text-brand-600 shrink-0" />
            <span className="hidden sm:inline">Novi pacijent</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="grid h-8 w-8 place-items-center rounded-xl border border-line/70 bg-surface text-faint transition-colors hover:bg-surface-2 hover:text-ink active:scale-90"
              title="Opcije faze rada"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="card animate-in absolute right-0 z-30 mt-1.5 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]">
                <MenuItem
                  icon={Sparkles}
                  onClick={() => {
                    setMenuOpen(false);
                    onAiGenerate(column.id);
                  }}
                >
                  Generiši pomoću AI
                </MenuItem>
                <MenuItem
                  icon={Pencil}
                  onClick={() => {
                    setMenuOpen(false);
                    setEditing(true);
                  }}
                >
                  Preimenuj fazu rada
                </MenuItem>
                
                {isSuperAdmin && (
                  <>
                    <div className="my-1 border-t border-line/60" />
                    <MenuItem
                      icon={Trash2}
                      danger
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmOpen(true);
                      }}
                    >
                      Obriši fazu rada
                    </MenuItem>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zona za kartice pacijenata */}
      <div
        ref={setNodeRef}
        className="min-h-0 flex-1 overflow-y-auto pr-1 pb-4"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={rectSortingStrategy}>
          {tasks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 pt-1">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  columnTitle={column.title}
                  onArchive={onArchiveTask}
                  onClick={onTaskClick}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center border-2 border-dashed border-line/80 bg-surface/30 p-6 text-center rounded-2xl">
              <p className="text-sm font-semibold text-ink">Nema pacijenata u ovoj fazi</p>
              <p className="mt-1 max-w-xs text-xs text-faint">
                Dodajte novog pacijenta ili ga prebacite iz prethodne faze.
              </p>
              <button
                type="button"
                onClick={() => onAddTask(column.id)}
                className="mt-4 flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm transition-all hover:bg-surface-2 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5 text-brand-600" /> Dodaj pacijenta
              </button>
            </div>
          )}
        </SortableContext>
      </div>

      {isSuperAdmin && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            onDelete(column.id);
            setConfirmOpen(false);
          }}
          title="Obrisati ovu fazu rada?"
          description={`Faza „${column.title}“ i svi pripadajući pacijenti biće trajno uklonjeni. Ova radnja se ne može poništiti.`}
          confirmLabel="Obriši fazu rada"
          danger
        />
      )}
    </div>
  );
};

const MenuItem = ({ icon: Icon, children, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors hover:bg-surface-2",
      danger ? "text-priority-urgent hover:bg-priority-urgent/10" : "text-muted hover:text-ink"
    )}
  >
    <Icon className="h-3.5 w-3.5 shrink-0" />
    <span className="truncate">{children}</span>
  </button>
);

export default Column;