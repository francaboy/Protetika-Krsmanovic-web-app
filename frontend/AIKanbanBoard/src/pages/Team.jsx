import { useMemo, useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Search,
  Users,
  Crown,
  ShieldCheck,
  User,
  Trash2,
  AlertOctagon,
  Mail,
  ArrowUpRight,
  Briefcase,
  Layers,
  Calendar,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLayout } from "../components/layout/AppLayout";
import { useWorkspace } from "../hooks/useWorkspace";
import { getSocket } from "../lib/socket";
import { userApi, boardApi, taskApi } from "../lib/api";
import Topbar from "../components/layout/Topbar";
import Avatar from "../components/ui/Avatar";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import TaskModal from "../components/board/TaskModal";
import { PriorityTag } from "../components/ui/Badge";
import { formatDueDate, cn } from "../lib/utils";

const roleTone = (role) =>
  role === "owner"
    ? "bg-brand-50 text-brand-700 border border-brand-500/20"
    : role === "admin"
    ? "bg-[#FBF1E2] text-[#c28a3a] border border-[#c28a3a]/20"
    : "bg-sky-50 text-sky-700 border border-sky-500/20";

const roleLabel = (role) => {
  if (role === "owner") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Radnik";
};

export const getPlural = (count, one, few, many) => {
  const n = Math.abs(Number(count) || 0);
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
};

const Team = () => {
  const { user } = useAuth();
  const { openCreateBoard } = useLayout();
  const { members: initialMembers = [], tasks: initialTasks = [], boards = [], loading } = useWorkspace();

  const [localMembers, setLocalMembers] = useState([]);
  const [localTasks, setLocalTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [selectedMember, setSelectedMember] = useState(null);

  const [patientModal, setPatientModal] = useState({
    open: false,
    task: null,
    columns: [],
    members: [],
  });

  const [memberToDelete, setMemberToDelete] = useState(null);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);
  const [blockedDetails, setBlockedDetails] = useState({ boardsCount: 0, tasksCount: 0 });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDeleteUsers = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    setLocalMembers(initialMembers);
  }, [initialMembers]);

  useEffect(() => {
    setLocalTasks((initialTasks || []).filter((t) => !t.is_archived));
  }, [initialTasks]);

  const handleInitiateDelete = useCallback(
    (m, e) => {
      if (e) e.stopPropagation();
      if (!m) return;
      if (m.id === user?.id) return toast.error("Ne možete obrisati sopstveni nalog.");
      if (m.role === "owner") return toast.error("Super Admin nalog se ne može obrisati.");

      const boardsCount = m.boards?.length || 0;
      const tasksCount = localTasks.filter((t) => t.assignee_id === m.id).length;

      setMemberToDelete(m);

      if (boardsCount > 0 || tasksCount > 0) {
        setBlockedDetails({ boardsCount, tasksCount });
        setBlockedModalOpen(true);
      } else {
        setConfirmDeleteOpen(true);
      }
    },
    [user, localTasks]
  );

  useEffect(() => {
    const socket = getSocket();

    const handleContextMenuMemberDelete = (e) => {
      const member = e.detail?.member;
      if (!member?.id) return;
      const fullMember = localMembers.find((m) => m.id === member.id) || member;
      handleInitiateDelete(fullMember);
    };

    window.addEventListener("app:team:delete-member", handleContextMenuMemberDelete);

    if (!socket) {
      return () => {
        window.removeEventListener("app:team:delete-member", handleContextMenuMemberDelete);
      };
    }

    const handleNewUser = (newUser) => {
      setLocalMembers((prev) => {
        if (prev.some((m) => m.id === newUser.id)) return prev;
        return [...prev, { ...newUser, boards: [] }];
      });
    };

    const handleDeletedUser = ({ id }) => {
      setLocalMembers((prev) => prev.filter((m) => m.id !== id));
      if (selectedMember?.id === id) setSelectedMember(null);
    };

    const handleTaskUpdated = (updatedTask) => {
      if (!updatedTask?.id) return;
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
      );
    };

    const handleTaskRemoved = (payload) => {
      const id = payload?.id || payload?.taskId;
      if (!id) return;
      setLocalTasks((prev) => prev.filter((t) => t.id !== id));
    };

    socket.on("user:registered", handleNewUser);
    socket.on("user:deleted", handleDeletedUser);
    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:moved", handleTaskUpdated);
    socket.on("task:deleted", handleTaskRemoved);
    socket.on("task:archived", handleTaskRemoved);

    return () => {
      window.removeEventListener("app:team:delete-member", handleContextMenuMemberDelete);
      socket.off("user:registered", handleNewUser);
      socket.off("user:deleted", handleDeletedUser);
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:moved", handleTaskUpdated);
      socket.off("task:deleted", handleTaskRemoved);
      socket.off("task:archived", handleTaskRemoved);
    };
  }, [selectedMember, localMembers, handleInitiateDelete]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...localMembers]
      .filter((m) => {
        if (roleFilter !== "all" && m.role !== roleFilter) return false;
        if (!q) return true;
        return m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "sr"));
  }, [localMembers, search, roleFilter]);

  const stats = useMemo(() => {
    let owners = 0;
    let admins = 0;
    let workers = 0;

    localMembers.forEach((m) => {
      if (m.role === "owner") owners++;
      else if (m.role === "admin") admins++;
      else workers++;
    });

    const activeWorkers = localMembers.filter((m) =>
      localTasks.some((t) => t.assignee_id === m.id)
    ).length;

    return {
      total: localMembers.length,
      owners,
      admins,
      workers,
      activeWorkers,
      busyRatio: localMembers.length > 0 ? Math.round((activeWorkers / localMembers.length) * 100) : 0,
    };
  }, [localMembers, localTasks]);

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    setDeleting(true);
    try {
      if (userApi.deleteUser) {
        await userApi.deleteUser(memberToDelete.id);
      } else {
        await userApi.remove(memberToDelete.id);
      }

      setLocalMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
      toast.success(`Zaposleni „${memberToDelete.name}“ je uspješno obrisan.`);
      setConfirmDeleteOpen(false);
      setMemberToDelete(null);
    } catch (err) {
      toast.error(err.message || "Greška pri brisanju zaposlenog.");
    } finally {
      setDeleting(false);
    }
  };

  const assignedTasksToSelected = useMemo(() => {
    if (!selectedMember) return [];
    return localTasks.filter((t) => t.assignee_id === selectedMember.id);
  }, [selectedMember, localTasks]);

  const handleOpenPatientFromDosier = async (task) => {
    try {
      const data = await boardApi.get(task.board_id);
      setPatientModal({
        open: true,
        task,
        columns: data?.columns || [],
        members: data?.members || localMembers,
      });
    } catch {
      setPatientModal({
        open: true,
        task,
        columns: [],
        members: localMembers,
      });
    }
  };

  const handleUpdatePatient = async (taskId, updates) => {
    try {
      const targetBoardId = updates.target_board_id || patientModal.task?.board_id;
      const res = await taskApi.update(targetBoardId, taskId, updates);

      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...res.task, board_id: targetBoardId } : t))
      );
      toast.success("Podaci o pacijentu su ažurirani");
    } catch (err) {
      toast.error(err.message || "Greška pri ažuriranju pacijenta");
    }
  };

  const handleDeletePatient = async (taskId) => {
    try {
      const targetBoardId = patientModal.task?.board_id;
      await taskApi.remove(targetBoardId, taskId);
      setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
      setPatientModal((prev) => ({ ...prev, open: false, task: null }));
      toast.success("Pacijent je obrisan");
    } catch (err) {
      toast.error(err.message || "Greška pri brisanju pacijenta");
    }
  };

  return (
    <>
      <Topbar
        title="Zaposleni"
        subtitle="Evidencija radnika, zaduženja i uloga u laboratoriji."
        onCreateBoard={openCreateBoard}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-5 sm:py-8 pb-28 md:px-8">
          {/* STATISTIKA */}
          <div className="mb-5 sm:mb-6 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 sm:gap-3.5 rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 border border-brand-500/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-faint">Ukupno</p>
                <p className="font-display text-xl sm:text-2xl font-bold text-ink tabular">{stats.total}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-3.5 rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-500/20">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-faint">Aktivno</p>
                <p className="font-display text-xl sm:text-2xl font-bold text-ink tabular">
                  {stats.activeWorkers} <span className="text-xs font-semibold text-muted">/ {stats.total}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-3.5 rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-[#c28a3a] border border-[#c28a3a]/25">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-faint">Admin tim</p>
                <p className="font-display text-xl sm:text-2xl font-bold text-ink tabular">
                  {stats.owners + stats.admins}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-3.5 rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-500/20">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-faint">Pokrivenost</p>
                <p className="font-display text-xl sm:text-2xl font-bold text-ink tabular">{stats.busyRatio}%</p>
              </div>
            </div>
          </div>

          {/* FILTERI I PRETRAGA: Vertikalno složeni, od ivice do ivice */}
          <div className="mb-5 sm:mb-6 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            {/* Brzi filteri po ulogama: grid 2x2 na mobilnom, fleksibilan red na desktopu */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={cn(
                  "h-9 sm:h-auto rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 border active:scale-95 w-full sm:w-auto flex items-center justify-center",
                  roleFilter === "all"
                    ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                    : "bg-surface text-muted border-line hover:bg-surface-2 hover:text-ink"
                )}
              >
                Svi ({localMembers.length})
              </button>

              <button
                type="button"
                onClick={() => setRoleFilter("owner")}
                className={cn(
                  "h-9 sm:h-auto inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 border active:scale-95 w-full sm:w-auto",
                  roleFilter === "owner"
                    ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                    : "bg-surface text-muted border-line hover:bg-surface-2 hover:text-ink"
                )}
              >
                <Crown className="h-3 w-3 shrink-0" /> Super Admin ({stats.owners})
              </button>

              <button
                type="button"
                onClick={() => setRoleFilter("admin")}
                className={cn(
                  "h-9 sm:h-auto inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 border active:scale-95 w-full sm:w-auto",
                  roleFilter === "admin"
                    ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                    : "bg-surface text-muted border-line hover:bg-surface-2 hover:text-ink"
                )}
              >
                <ShieldCheck className="h-3 w-3 shrink-0" /> Admini ({stats.admins})
              </button>

              <button
                type="button"
                onClick={() => setRoleFilter("member")}
                className={cn(
                  "h-9 sm:h-auto inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 border active:scale-95 w-full sm:w-auto",
                  roleFilter === "member"
                    ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                    : "bg-surface text-muted border-line hover:bg-surface-2 hover:text-ink"
                )}
              >
                <User className="h-3 w-3 shrink-0" /> Radnici ({stats.workers})
              </button>
            </div>

            {/* Traka za pretragu pune širine */}
            <div className="relative w-full md:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pretraži zaposlene..."
                className="h-10 md:h-9 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-xs shadow-[var(--shadow-card)] outline-none transition-all duration-200 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/15"
              />
            </div>
          </div>

          {/* GRID KARTICA ZAPOSLENIH */}
          {loading ? (
            <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-52 rounded-3xl animate-pulse bg-line/60" />
              ))}
            </div>
          ) : localMembers.length === 0 ? (
            <div className="card flex flex-col items-center justify-center gap-3 rounded-3xl py-16 text-center border border-line bg-surface">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 border border-brand-500/20">
                <Users className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold tracking-tight text-ink">
                  Nema evidentiranih zaposlenih
                </h3>
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted px-4">
                  Kada se novi članovi tima registruju, automatski će se prikazati na ovom mjestu.
                </p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center gap-3 rounded-3xl py-16 text-center border border-line bg-surface">
              <p className="text-sm font-semibold text-ink">Nema rezultata za zadatu pretragu</p>
              <p className="text-xs text-muted">Pokušajte unijeti drugačije ime ili promijenite filter uloge.</p>
              <Button variant="secondary" size="sm" onClick={() => { setSearch(""); setRoleFilter("all"); }}>
                Poništi pretragu
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((m, index) => {
                const assignedTasks = localTasks.filter((t) => t.assignee_id === m.id);
                const isCurrentUser = m.id === user?.id;

                return (
                  <div
                    key={m.id}
                    data-member-id={m.id}
                    data-member-name={m.name}
                    data-member-role={m.role}
                    onClick={() => setSelectedMember(m)}
                    className="group/card relative flex flex-col justify-between overflow-hidden rounded-3xl border border-line bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-[var(--shadow-lift)] active:scale-[0.985] cursor-pointer animate-in fade-in-50 slide-in-from-bottom-1"
                    style={{ animationDelay: `${index * 35}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium", roleTone(m.role))}>
                        {m.role === "owner" && <Crown className="h-3 w-3" />}
                        {m.role === "admin" && <ShieldCheck className="h-3 w-3" />}
                        {(m.role === "member" || !m.role) && <User className="h-3 w-3" />}
                        {roleLabel(m.role)}
                      </span>

                      {canDeleteUsers && !isCurrentUser && m.role !== "owner" && (
                        <button
                          type="button"
                          onClick={(e) => handleInitiateDelete(m, e)}
                          title={`Obriši nalog radnika ${m.name}`}
                          className="grid h-7 w-7 place-items-center rounded-xl text-faint opacity-70 sm:opacity-0 transition-all duration-200 hover:bg-priority-urgent/10 hover:text-priority-urgent group-hover/card:opacity-100 active:scale-90"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="my-3 sm:my-4 flex flex-col items-center text-center">
                      <div className="relative">
                        <Avatar
                          name={m.name}
                          id={m.id}
                          src={m.avatar_url}
                          size="lg"
                          className="h-14 w-14 sm:h-16 sm:w-16 text-lg ring-4 ring-surface-2 shadow-sm transition-transform duration-300 group-hover/card:scale-105"
                        />
                        {assignedTasks.length > 0 && (
                          <span
                            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-surface"
                            title={`${assignedTasks.length} aktivnih pacijenata`}
                          >
                            {assignedTasks.length}
                          </span>
                        )}
                      </div>

                      <h4 className="mt-3 flex items-center justify-center gap-1.5 font-display text-base font-bold text-ink">
                        {m.name}
                        {isCurrentUser && (
                          <span className="rounded-md bg-brand-50 px-1.5 py-0.2 text-[10px] font-semibold text-brand-700">
                            Ti
                          </span>
                        )}
                      </h4>

                      <a
                        href={`mailto:${m.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-brand-600"
                        title="Pošalji email radniku"
                      >
                        <Mail className="h-3 w-3" />
                        <span className="max-w-[180px] sm:max-w-[200px] truncate">{m.email}</span>
                      </a>
                    </div>

                    <div className="border-t border-line/60 pt-3 flex items-center justify-between text-[11px]">
                      <span className="text-faint">Trenutno zadužen:</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-ink">
                        <span className={cn(
                          "rounded-md px-1.5 py-0.5 font-bold tabular",
                          assignedTasks.length > 0 ? "bg-brand-50 text-brand-700" : "bg-surface-2 text-muted"
                        )}>
                          {assignedTasks.length} {getPlural(assignedTasks.length, "pacijent", "pacijenta", "pacijenata")}
                        </span>
                        <ArrowUpRight className="h-3 w-3 text-faint group-hover/card:text-brand-600 transition-transform group-hover/card:-translate-y-0.5 group-hover/card:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: RADNI DOSIJE ZAPOSLENOG */}
      <Modal
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        size="md"
        title="Radni dnevnik zaposlenog"
      >
        {selectedMember && (
          <div className="space-y-4 sm:space-y-5">
            <div className="flex items-center gap-3.5 sm:gap-4 rounded-2xl border border-line bg-surface-2/40 p-3.5 sm:p-4">
              <Avatar
                name={selectedMember.name}
                id={selectedMember.id}
                src={selectedMember.avatar_url}
                size="md"
                className="h-11 w-11 sm:h-12 sm:w-12 text-base"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm sm:text-base font-bold text-ink truncate">
                    {selectedMember.name}
                  </h3>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", roleTone(selectedMember.role))}>
                    {roleLabel(selectedMember.role)}
                  </span>
                </div>
                <p className="text-xs text-muted truncate">{selectedMember.email}</p>
              </div>
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-faint">
                  Zaduženi pacijenti ({assignedTasksToSelected.length})
                </span>
              </div>

              {assignedTasksToSelected.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line p-5 sm:p-6 text-center">
                  <p className="text-xs font-semibold text-ink">Radnik trenutno nema zaduženih pacijenata</p>
                  <p className="mt-1 text-[11px] text-faint">Slobodan je za dodjelu novih radova.</p>
                </div>
              ) : (
                <div className="max-h-60 sm:max-h-64 space-y-2 overflow-y-auto pr-1 no-scrollbar">
                  {assignedTasksToSelected.map((t) => {
                    const board = boards.find((b) => b.id === t.board_id);
                    const due = formatDueDate(t.due_date);

                    return (
                      <div
                        key={t.id}
                        onClick={() => handleOpenPatientFromDosier(t)}
                        className="group/item flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-surface p-2.5 transition-all hover:border-brand-500/40 hover:bg-surface-2 active:scale-[0.985] cursor-pointer shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-ink truncate group-hover/item:text-brand-600 transition-colors">
                            {t.title}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                            <span className="inline-flex items-center gap-1 font-medium text-brand-700">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: board?.color || "#2f8159" }}
                              />
                              {board?.title || "Faza rada"}
                            </span>
                            {due && (
                              <span className="inline-flex items-center gap-1 font-semibold tabular text-faint">
                                <Calendar className="h-2.5 w-2.5" /> {due.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <PriorityTag priority={t.priority} />
                          <ArrowUpRight className="h-3.5 w-3.5 text-faint group-hover/item:text-brand-600 transition-transform group-hover/item:-translate-y-0.5 group-hover/item:translate-x-0.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedMember(null)} className="active:scale-95">
                Zatvori dnevnik rada
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {patientModal.open && (
        <TaskModal
          open={patientModal.open}
          onClose={() => setPatientModal((prev) => ({ ...prev, open: false, task: null }))}
          task={patientModal.task}
          defaultColumnId={patientModal.task?.column_id}
          columns={patientModal.columns}
          members={patientModal.members}
          actions={{
            updateTask: handleUpdatePatient,
            deleteTask: handleDeletePatient,
          }}
        />
      )}

      <Modal
        open={blockedModalOpen}
        onClose={() => setBlockedModalOpen(false)}
        size="sm"
        title="Brisanje nije dozvoljeno"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-priority-urgent/20 bg-priority-urgent/10 p-4">
            <AlertOctagon className="h-5 w-5 shrink-0 text-priority-urgent" />
            <div className="text-xs text-ink leading-relaxed">
              <p className="font-semibold text-priority-urgent">
                Zaposleni „{memberToDelete?.name}“ ima aktivna zaduženja!
              </p>
              <p className="mt-1 text-muted">
                Nalog se ne može obrisati dok god radnik ima zadužene pacijente ili dodijeljene faze:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 font-medium text-ink">
                {blockedDetails.tasksCount > 0 && (
                  <li>
                    Aktivni pacijenti u laboratoriji:{" "}
                    <span className="font-bold text-priority-urgent">
                      {blockedDetails.tasksCount}
                    </span>
                  </li>
                )}
                {blockedDetails.boardsCount > 0 && (
                  <li>
                    Dodijeljene faze rada:{" "}
                    <span className="font-bold text-priority-urgent">
                      {blockedDetails.boardsCount}
                    </span>
                  </li>
                )}
              </ul>
              <p className="mt-2 text-[11px] text-faint">
                Otvorite dosije ovog radnika, preraspodijelite zadužene pacijente drugim članovima tima, pa ponovite brisanje.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setBlockedModalOpen(false)} className="active:scale-95">
              Razumijem
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Obrisati nalog radnika ${memberToDelete?.name}?`}
        description="Ovaj član tima nema aktivnih zaduženja u laboratoriji. Ova radnja je nepovratna."
        confirmLabel="Trajno obriši nalog"
        danger
        loading={deleting}
      />
    </>
  );
};

export default Team;