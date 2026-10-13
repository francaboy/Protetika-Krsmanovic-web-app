import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Archive as ArchiveIcon,
  RotateCcw,
  Search,
  ChevronRight,
  Loader2,
  Trash2,
  CheckSquare,
  Square,
  Stethoscope,
  X,
} from "lucide-react";
import Topbar from "../components/layout/Topbar";
import { PriorityTag } from "../components/ui/Badge";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { taskApi } from "../lib/api";
import { getSocket } from "../lib/socket";
import { cn } from "../lib/utils";

const extractDoctor = (task) => {
  if (!task) return "";
  if (task.doctor) return task.doctor;
  if (task.doctor_name) return task.doctor_name;
  const match = task.description?.match(/^Doktor:\s*([^\n\r]+)/i);
  return match ? match[1].trim() : "";
};

const Archive = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [singleToDelete, setSingleToDelete] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    mode: null,
    title: "",
    description: "",
  });
  const [deleting, setDeleting] = useState(false);

  const fetchArchived = async () => {
    try {
      setLoading(true);
      const data = await taskApi.listArchived();
      setTasks(data || []);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.message || "Nije uspjelo učitavanje arhive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();

    const socket = getSocket();
    if (!socket) return;

    const handleTaskArchived = (task) => {
      if (!task || !task.id) {
        fetchArchived();
        return;
      }
      setTasks((prev) => {
        if (prev.some((t) => String(t.id) === String(task.id))) return prev;
        return [task, ...prev];
      });
    };

    const handleTaskRestored = ({ id }) => {
      if (!id) return;
      setTasks((prev) => prev.filter((t) => String(t.id) !== String(id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };

    const handleTaskDeleted = ({ id }) => {
      if (!id) return;
      setTasks((prev) => prev.filter((t) => String(t.id) !== String(id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };

    socket.on("task:archived", handleTaskArchived);
    socket.on("task:restored", handleTaskRestored);
    socket.on("task:deleted", handleTaskDeleted);

    return () => {
      socket.off("task:archived", handleTaskArchived);
      socket.off("task:restored", handleTaskRestored);
      socket.off("task:deleted", handleTaskDeleted);
    };
  }, []);

  const handleRestore = async (task) => {
    const boardId = task.board_id || task.boardId;
    if (!boardId || !task.id) {
      toast.error("Nedostaju podaci o radu za ovog pacijenta. Rad nije moguće vratiti.");
      return;
    }

    setRestoringId(task.id);
    try {
      await taskApi.restore(boardId, task.id);
      setTasks((prev) => prev.filter((t) => String(t.id) !== String(task.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      toast.success(`Pacijent „${task.title}“ je uspješno vraćen na tablu`);
    } catch (err) {
      console.error("Greška pri vraćanju pacijenta:", err);
      toast.error(err.response?.data?.message || err.message || "Greška pri vraćanju pacijenta");
    } finally {
      setRestoringId(null);
    }
  };

  const tasksWithDoctor = useMemo(() => {
    return tasks.map((t) => ({
      ...t,
      doctorName: extractDoctor(t),
    }));
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasksWithDoctor;
    return tasksWithDoctor.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        t.doctorName?.toLowerCase().includes(q) ||
        t.board_title?.toLowerCase().includes(q) ||
        t.assignee_name?.toLowerCase().includes(q)
    );
  }, [tasksWithDoctor, search]);

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const promptDeleteSingle = (task) => {
    setSingleToDelete(task);
    setConfirmDialog({
      open: true,
      mode: "single",
      title: (
        <span className="block text-balance break-words leading-snug">
          Da li želite trajno obrisati pacijenta{" "}
          <span className="font-bold text-ink underline decoration-priority-urgent/40 decoration-2">
            „{task?.title}“
          </span>
          ?
        </span>
      ),
      description: "Ova radnja je nepovratna. Karton pacijenta biće trajno uklonjen iz baze podataka.",
    });
  };

  const promptDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      open: true,
      mode: "selected",
      title: (
        <span className="block text-balance break-words leading-snug">
          Trajno obrisati {selectedIds.size}{" "}
          {selectedIds.size === 1
            ? "pacijenta"
            : selectedIds.size < 5
            ? "pacijenta"
            : "pacijenata"}
          ?
        </span>
      ),
      description: "Ova radnja je nepovratna. Označeni arhivirani pacijenti biće trajno uklonjeni iz baze podataka.",
    });
  };

  const promptDeleteAll = () => {
    if (tasks.length === 0) return;
    setConfirmDialog({
      open: true,
      mode: "all",
      title: (
        <span className="block text-balance break-words leading-snug">
          Trajno isprazniti čitavu arhivu?
        </span>
      ),
      description: `Biće trajno obrisano svih ${tasks.length} pacijenata iz arhive. Ova radnja se ne može poništiti.`,
    });
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      let tasksToDelete = [];

      if (confirmDialog.mode === "single" && singleToDelete) {
        tasksToDelete = [singleToDelete];
      } else if (confirmDialog.mode === "all") {
        tasksToDelete = tasks;
      } else {
        tasksToDelete = tasks.filter((t) => selectedIds.has(t.id));
      }

      await Promise.all(
        tasksToDelete.map((t) => {
          const bId = t.board_id || t.boardId;
          return taskApi.remove ? taskApi.remove(bId, t.id) : taskApi.delete(bId, t.id);
        })
      );

      const deletedIdSet = new Set(tasksToDelete.map((t) => t.id));
      setTasks((prev) => prev.filter((t) => !deletedIdSet.has(t.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        tasksToDelete.forEach((t) => next.delete(t.id));
        return next;
      });

      toast.success(
        confirmDialog.mode === "all"
          ? "Čitava arhiva je uspješno ispražnjena"
          : confirmDialog.mode === "single"
          ? "Pacijent je trajno obrisan"
          : "Označeni pacijenti su trajno obrisani"
      );
      setConfirmDialog({ open: false, mode: null, title: "", description: "" });
      setSingleToDelete(null);
    } catch (err) {
      console.error("Greška pri brisanju:", err);
      toast.error(err.message || "Greška pri brisanju pacijenata iz arhive");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Topbar
        title="Arhiva pacijenata"
        subtitle="Pregled svih završenih i arhiviranih radova."
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-8 pb-32 md:px-8">
          {/* 1. ORIGINALNA DESKTOP TRAKA (Netaknuto) */}
          <div className="mb-6 hidden md:flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretražite arhivu..."
                  className="h-9 w-64 rounded-full border border-line bg-surface pl-9 pr-4 text-xs shadow-[var(--shadow-card)] outline-none transition-all duration-200 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/15"
                />
              </div>

              {filtered.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-ink shadow-[var(--shadow-card)] transition-colors hover:bg-surface-2"
                >
                  {isAllSelected ? (
                    <CheckSquare className="h-4 w-4 text-brand-600" />
                  ) : (
                    <Square className="h-4 w-4 text-muted" />
                  )}
                  <span>{isAllSelected ? "Poništi sve" : "Označi sve"}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold tabular text-ink border border-line/60">
                Ukupno arhivirano: {filtered.length}
              </span>

              {tasks.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={promptDeleteAll}
                  className="border-priority-urgent/30 text-priority-urgent hover:bg-priority-urgent/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Isprazni arhivu
                </Button>
              )}
            </div>
          </div>

          {/* 2. OPTIMIZOVANA MOBILNA KONTROLNA TRAKA */}
          <div className="mb-4 flex flex-col gap-2.5 md:hidden">
            {/* Pretraga preko cijele širine */}
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pretražite arhivu..."
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

            {/* Dugmad akcija i brojač u ravni */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {filtered.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[11px] font-semibold text-ink shadow-sm active:scale-95 transition-all"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="h-3.5 w-3.5 text-brand-600" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-muted" />
                    )}
                    <span>{isAllSelected ? "Poništi" : "Označi sve"}</span>
                  </button>
                )}

                {tasks.length > 0 && (
                  <button
                    type="button"
                    onClick={promptDeleteAll}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-priority-urgent/30 bg-surface px-2.5 text-[11px] font-semibold text-priority-urgent shadow-sm active:scale-95 transition-all"
                  >
                    <Trash2 className="h-3 w-3" /> Isprazni arhivu
                  </button>
                )}
              </div>

              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold tabular text-ink border border-line/60">
                Arhiva: {filtered.length}
              </span>
            </div>
          </div>

          {/* TRAKA ZA BRISANJE OZNAČENIH (Prilagođena za mobilni i desktop) */}
          {selectedIds.size > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-2xl border border-brand-500/30 bg-brand-50/70 p-3 px-4 shadow-[var(--shadow-card)] backdrop-blur-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-900">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {selectedIds.size}
                </span>
                <span>
                  {selectedIds.size === 1
                    ? "pacijent označen"
                    : selectedIds.size < 5
                    ? "pacijenta označena"
                    : "pacijenata označeno"}
                </span>
              </div>

              <div className="flex w-full sm:w-auto items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-full px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface hover:text-ink transition-colors active:scale-95"
                >
                  Poništi
                </button>

                <Button
                  size="sm"
                  variant="danger"
                  onClick={promptDeleteSelected}
                  className="gap-1 text-xs py-1 h-8 active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Obriši ({selectedIds.size})
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-2xl animate-pulse bg-line/60" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center gap-3 rounded-3xl py-16 sm:py-20 text-center border border-line bg-surface">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 border border-brand-500/20">
                <ArchiveIcon className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Arhiva je prazna</h3>
              <p className="max-w-sm text-xs text-muted leading-relaxed px-4">
                Završeni radovi pacijenata koje arhivirate sa table pojaviće se na ovom mjestu.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP VIEW: Klasični horizontalni redovi (Netaknuto) */}
              <div className="hidden md:block space-y-3">
                {filtered.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <div
                      key={t.id}
                      data-context-type="task"
                      data-context-data={JSON.stringify({
                        id: t.id,
                        title: t.title,
                        priority: t.priority,
                        description: t.description,
                        due_date: t.due_date,
                        board_id: t.board_id || t.boardId,
                        column_id: t.column_id,
                        assignee_id: t.assignee_id,
                        doctor: t.doctorName,
                      })}
                      className={cn(
                        "group flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-soft)]",
                        isSelected
                          ? "border-brand-500/60 bg-brand-50/30"
                          : "border-line bg-surface"
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3.5">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(t.id)}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:text-brand-600"
                          title={isSelected ? "Poništi odabir" : "Označi pacijenta"}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-brand-600" />
                          ) : (
                            <Square className="h-5 w-5 text-faint group-hover:text-muted" />
                          )}
                        </button>

                        <PriorityTag priority={t.priority} className="shrink-0" />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink line-through decoration-emerald-600/50">
                            {t.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <Link
                              to={`/rad/${t.board_id}`}
                              className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
                            >
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: t.board_color || "#2f8159" }}
                              />
                              {t.board_title}
                              <ChevronRight className="h-3 w-3 shrink-0" />
                            </Link>

                            {t.doctorName && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted border border-line/60">
                                <Stethoscope className="h-3 w-3 text-brand-600 shrink-0" />
                                {t.doctorName}
                              </span>
                            )}

                            {t.assignee_name && (
                              <span className="inline-flex items-center gap-1.5 text-faint">
                                • <Avatar name={t.assignee_name} src={t.assignee_avatar} size="xs" /> {t.assignee_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoringId === t.id}
                          onClick={() => handleRestore(t)}
                          title="Vrati pacijenta nazad u fazu rada"
                        >
                          {restoringId === t.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Vrati nazad
                        </Button>

                        <button
                          type="button"
                          onClick={() => promptDeleteSingle(t)}
                          title="Trajno obriši pacijenta"
                          className="grid h-8 w-8 place-items-center rounded-full text-faint opacity-60 transition-all hover:bg-priority-urgent/10 hover:text-priority-urgent hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MOBILE VIEW: Prilagođene kartice sa vertikalnim tokom bez curenja van ekrana */}
              <div className="space-y-2.5 md:hidden">
                {filtered.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "rounded-2xl border p-3.5 shadow-sm transition-all duration-200 active:scale-[0.99]",
                        isSelected
                          ? "border-brand-500/60 bg-brand-50/30"
                          : "border-line bg-surface"
                      )}
                    >
                      {/* Red 1: Checkbox, Naziv pacijenta i Prioritet */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(t.id)}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-muted active:scale-90 transition-transform"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5 text-brand-600" />
                            ) : (
                              <Square className="h-5 w-5 text-faint" />
                            )}
                          </button>
                          <p className="truncate text-sm font-semibold text-ink line-through decoration-emerald-600/50">
                            {t.title}
                          </p>
                        </div>
                        <PriorityTag priority={t.priority} className="shrink-0 text-[10px]" />
                      </div>

                      {/* Red 2: Faza rada i Doktor */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-8">
                        <Link
                          to={`/rad/${t.board_id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-brand-700 border border-line/60"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: t.board_color || "#2f8159" }}
                          />
                          <span className="truncate max-w-[120px]">{t.board_title}</span>
                          <ChevronRight className="h-3 w-3 shrink-0 text-faint" />
                        </Link>

                        {t.doctorName && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted border border-line/60">
                            <Stethoscope className="h-3 w-3 text-brand-600 shrink-0" />
                            <span className="truncate max-w-[110px]">{t.doctorName}</span>
                          </span>
                        )}
                      </div>

                      {/* Red 3: Zaduženi radnik i Akciona dugmad */}
                      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5 pl-8">
                        <div>
                          {t.assignee_name ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted">
                              <Avatar name={t.assignee_name} src={t.assignee_avatar} size="xs" className="h-4 w-4 shrink-0" />
                              <span className="truncate max-w-[90px] text-[11px]">{t.assignee_name}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-faint">Nedodijeljeno</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restoringId === t.id}
                            onClick={() => handleRestore(t)}
                            className="h-7 px-2.5 text-[11px] gap-1 active:scale-95"
                          >
                            {restoringId === t.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-brand-600" />
                            ) : (
                              <RotateCcw className="h-3 w-3" />
                            )}
                            Vrati
                          </Button>

                          <button
                            type="button"
                            onClick={() => promptDeleteSingle(t)}
                            className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-priority-urgent/10 hover:text-priority-urgent active:scale-90 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => {
          setConfirmDialog({ open: false, mode: null, title: "", description: "" });
          setSingleToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Trajno obriši"
        danger
        loading={deleting}
      />
    </>
  );
};

export default Archive;