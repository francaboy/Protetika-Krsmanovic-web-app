import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Sparkles,
  FileText,
  Users,
  Activity,
  Search,
  ChevronLeft,
  Pencil,
  Trash2,
  Plus,
  ChevronDown,
  Check,
  X,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
} from "lucide-react";
import { useBoard } from "../hooks/useBoard";
import { useBoards } from "../context/BoardsContext";
import { useAuth } from "../context/AuthContext";
import { useLayout } from "../components/layout/AppLayout";
import { aiApi } from "../lib/api";
import { PRIORITIES, cn } from "../lib/utils";

import Topbar from "../components/layout/Topbar";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { AvatarStack } from "../components/ui/Avatar";
import { ColumnSkeleton } from "../components/ui/Skeleton";
import PromptDialog from "../components/ui/PromptDialog";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import KanbanBoard from "../components/board/KanbanBoard";
import TaskModal from "../components/board/TaskModal";
import MembersModal from "../components/board/MembersModal";
import AIGenerateModal from "../components/ai/AIGenerateModal";
import AISummaryModal from "../components/ai/AISummaryModal";
import ActivityFeed from "../components/ActivityFeed";

const SORT_OPTIONS = [
  { value: "date-desc", label: "Najnovije prvo", icon: CalendarArrowDown },
  { value: "date-asc", label: "Najstarije prvo", icon: CalendarArrowUp },
  { value: "name-asc", label: "Naziv (A → Z)", icon: ArrowDownAZ },
  { value: "name-desc", label: "Naziv (Z → A)", icon: ArrowUpAZ },
];

const extractDoctor = (task) => {
  if (!task) return "";
  if (task.doctor) return task.doctor;
  if (task.doctor_name) return task.doctor_name;
  const match = task.description?.match(/^Doktor:\s*([^\n\r]+)/i);
  return match ? match[1].trim() : "";
};

const CustomFilterSelect = ({ value, onChange, placeholder, options, className, align = "auto" }) => {
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
        <div
          className={cn(
            "card animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150 absolute z-[130] mt-1.5 w-full min-w-[170px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow-lift)]",
            align === "right"
              ? "right-0 left-auto"
              : align === "left"
              ? "left-0 right-auto"
              : "left-0 right-auto sm:right-auto"
          )}
        >
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

          <div className="max-h-56 overflow-y-auto no-scrollbar touch-pan-y overscroll-contain">
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

const BoardPage = () => {
  const { boardId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { openCreateBoard } = useLayout();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "owner";

  const { update: updateBoardInContext, remove: removeBoardInContext } = useBoards();
  const b = useBoard(boardId);

  const [taskModal, setTaskModal] = useState({ open: false, task: null, columnId: null });
  const [aiGen, setAiGen] = useState({ open: false, columnId: null });
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  const [editBoardOpen, setEditBoardOpen] = useState(false);
  const [deleteBoardOpen, setDeleteBoardOpen] = useState(false);
  const [patientTitle, setPatientTitle] = useState("");
  const [doctorSubtitle, setDoctorSubtitle] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [isEditingTitleInline, setIsEditingTitleInline] = useState(false);
  const [inlineTitleValue, setInlineTitleValue] = useState("");
  const [isEditingDoctorInline, setIsEditingDoctorInline] = useState(false);
  const [inlineDoctorValue, setInlineDoctorValue] = useState("");

  const inlineTitleInputRef = useRef(null);
  const inlineDoctorInputRef = useRef(null);

  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("");

  useEffect(() => {
    const requestedTaskId = searchParams.get("task");
    if (!requestedTaskId || !b.tasks || b.tasks.length === 0) return;

    const target = b.tasks.find((t) => String(t.id) === String(requestedTaskId));
    if (target) {
      setTaskModal({ open: true, task: target, columnId: target.column_id });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("task");
        return next;
      }, { replace: true });
    }
  }, [searchParams, b.tasks, setSearchParams]);

  useEffect(() => {
    const handleSortEvent = (e) => {
      const { sortType } = e.detail || {};
      if (!sortType) return;
      setSortBy(sortType);

      const labels = {
        "date-desc": "Najnovije prvo",
        "date-asc": "Najstarije prvo",
        "name-asc": "Naziv (A → Z)",
        "name-desc": "Naziv (Z → A)",
      };
      toast.success(`Radovi sortirani: ${labels[sortType] || sortType}`);
    };

    window.addEventListener("app:board:sort", handleSortEvent);
    return () => window.removeEventListener("app:board:sort", handleSortEvent);
  }, []);

  useEffect(() => {
    if (isEditingTitleInline && inlineTitleInputRef.current) {
      inlineTitleInputRef.current.focus();
      inlineTitleInputRef.current.select();
    }
  }, [isEditingTitleInline]);

  useEffect(() => {
    if (isEditingDoctorInline && inlineDoctorInputRef.current) {
      inlineDoctorInputRef.current.focus();
      inlineDoctorInputRef.current.select();
    }
  }, [isEditingDoctorInline]);

  const filteredTasks = useMemo(() => {
    let result = (b.tasks || []).filter((t) => {
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterAssignee && String(t.assignee_id) !== String(filterAssignee)) return false;
      if (search) {
        const q = search.toLowerCase();
        const docName = extractDoctor(t).toLowerCase();
        const titleMatch = t.title?.toLowerCase().includes(q);
        const descMatch = (t.description || "").toLowerCase().includes(q);
        const docMatch = docName.includes(q);
        if (!titleMatch && !descMatch && !docMatch) return false;
      }
      return true;
    });

    const getCreationTime = (task) => {
      if (task.created_at) {
        const time = new Date(task.created_at).getTime();
        if (!Number.isNaN(time) && time > 0) return time;
      }
      if (task.createdAt) {
        const time = new Date(task.createdAt).getTime();
        if (!Number.isNaN(time) && time > 0) return time;
      }
      const parsedId = Number(task.id);
      return !Number.isNaN(parsedId) ? parsedId : 0;
    };

    if (sortBy) {
      const byCol = {};
      result.forEach((t) => {
        if (!byCol[t.column_id]) byCol[t.column_id] = [];
        byCol[t.column_id].push(t);
      });

      const sortedResult = [];
      Object.keys(byCol).forEach((colId) => {
        const colTasks = [...byCol[colId]].sort((a, b) => {
          if (sortBy === "name-asc") {
            return (a.title || "").localeCompare(b.title || "", "sr");
          }
          if (sortBy === "name-desc") {
            return (b.title || "").localeCompare(a.title || "", "sr");
          }
          if (sortBy === "date-desc") {
            return getCreationTime(b) - getCreationTime(a);
          }
          if (sortBy === "date-asc") {
            return getCreationTime(a) - getCreationTime(b);
          }
          return 0;
        });

        colTasks.forEach((t, idx) => {
          sortedResult.push({
            ...t,
            position: (idx + 1) * 1000,
          });
        });
      });

      return sortedResult;
    }

    return [...result].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
  }, [b.tasks, filterPriority, filterAssignee, search, sortBy]);

  const assigneeOptions = useMemo(() => {
    return (b.members || []).map((m) => ({
      value: String(m.id),
      label: m.name,
    }));
  }, [b.members]);

  const handleBreakdown = async (task) => {
    try {
      const subtasks = await aiApi.breakdown(boardId, { taskId: task.id });
      for (const s of subtasks) {
        await b.createTask({
          column_id: task.column_id,
          title: s.title,
          description: s.description,
          priority: s.priority,
        });
      }
      toast.success(`Uspješno dodato ${subtasks.length} potkoraka`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveInlineTitle = async () => {
    const clean = inlineTitleValue.trim();
    if (!clean) {
      setInlineTitleValue(b.board?.title || "");
      setIsEditingTitleInline(false);
      return;
    }
    if (clean === b.board?.title) {
      setIsEditingTitleInline(false);
      return;
    }

    try {
      const updated = await updateBoardInContext(boardId, {
        title: clean,
        description: b.board?.description || "",
      });
      b.setBoard((prev) => ({ ...prev, ...updated }));
      toast.success("Naziv faze rada je promijenjen");
    } catch (err) {
      toast.error(err.message || "Greška pri promjeni naziva");
    } finally {
      setIsEditingTitleInline(false);
    }
  };

  const handleSaveInlineDoctor = async () => {
    const clean = inlineDoctorValue.trim();
    if (clean === (b.board?.description || "")) {
      setIsEditingDoctorInline(false);
      return;
    }

    try {
      const updated = await updateBoardInContext(boardId, {
        title: b.board?.title || "",
        description: clean,
      });
      b.setBoard((prev) => ({ ...prev, ...updated }));
      toast.success("Opis faze je ažuriran");
    } catch (err) {
      toast.error(err.message || "Greška pri izmjeni");
    } finally {
      setIsEditingDoctorInline(false);
    }
  };

  const handleOpenEditBoard = (e) => {
    if (e) e.stopPropagation();
    if (!b.board) return;
    setPatientTitle(b.board.title || "");
    setDoctorSubtitle(b.board.description || "");
    setEditBoardOpen(true);
  };

  const handleSaveBoardEdit = async (e) => {
    e.preventDefault();
    const cleanTitle = patientTitle.trim();
    if (!cleanTitle) return toast.error("Naziv faze rada je obavezan");

    setSavingEdit(true);
    try {
      const updated = await updateBoardInContext(boardId, {
        title: cleanTitle,
        description: doctorSubtitle.trim(),
      });
      b.setBoard((prev) => ({ ...prev, ...updated }));
      toast.success("Podaci o fazi rada su ažurirani");
      setEditBoardOpen(false);
    } catch (err) {
      toast.error(err.message || "Greška pri izmjeni faze rada");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteBoardConfirm = async () => {
    if (!isSuperAdmin) {
      toast.error("Samo Super Admin može obrisati fazu rada.");
      setDeleteBoardOpen(false);
      return;
    }

    try {
      await removeBoardInContext(boardId);
      toast.success("Faza rada je obrisana");
      setDeleteBoardOpen(false);
      navigate("/pocetna");
    } catch (err) {
      toast.error(err.message || "Greška pri brisanju faze rada");
    }
  };

  if (b.error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold">Nije uspjelo učitavanje ove faze rada</p>
        <p className="text-muted">{b.error}</p>
        <Link to="/pocetna">
          <Button variant="outline">Povratak na početnu stranu</Button>
        </Link>
      </div>
    );
  }

  const actions = (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {b.presence.length > 0 && (
        <div className="mr-1 hidden items-center gap-2 sm:flex">
          <span className="text-[11px] text-faint">Trenutno gleda</span>
          <AvatarStack users={b.presence} size="xs" max={3} />
        </div>
      )}
      <Button size="sm" variant="ghost" onClick={() => setActivityOpen(true)} title="Aktivnosti na ovoj fazi">
        <Activity className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setMembersOpen(true)} title="Zaduženi tim">
        <Users className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" onClick={() => setSummaryOpen(true)}>
        <FileText className="h-4 w-4" /> <span className="hidden sm:inline">AI Izvještaj</span>
      </Button>
      <Button size="sm" onClick={() => setAiGen({ open: true, columnId: b.columns[0]?.id })}>
        <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">AI Planer</span>
      </Button>
    </div>
  );

  return (
    <>
      <Topbar
        title={
          <div className="group/title flex items-center gap-2">
            <Link to="/pocetna" className="text-faint hover:text-ink md:hidden">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            {b.board ? (
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: b.board.color || "#2f8159" }}
                />

                {isEditingTitleInline ? (
                  <input
                    ref={inlineTitleInputRef}
                    type="text"
                    value={inlineTitleValue}
                    onChange={(e) => setInlineTitleValue(e.target.value)}
                    onBlur={handleSaveInlineTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveInlineTitle();
                      if (e.key === "Escape") setIsEditingTitleInline(false);
                    }}
                    className="h-8 rounded-lg border border-brand-500 bg-surface px-2 text-sm sm:text-lg font-bold text-ink outline-none ring-2 ring-brand-500/15"
                  />
                ) : (
                  <span
                    onDoubleClick={() => {
                      setInlineTitleValue(b.board.title || "");
                      setIsEditingTitleInline(true);
                    }}
                    className="cursor-pointer select-none rounded px-1 font-display text-base sm:text-lg font-bold leading-tight tracking-tight text-ink hover:bg-surface-2 truncate"
                    title="Dvaput kliknite za brzu promjenu naziva"
                  >
                    {b.board.title}
                  </span>
                )}

                {!isEditingTitleInline && (
                  <div className="flex items-center gap-1 opacity-70 sm:opacity-0 transition-opacity group-hover/title:opacity-100">
                    <button
                      type="button"
                      onClick={handleOpenEditBoard}
                      title="Izmijeni fazu rada"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteBoardOpen(true);
                        }}
                        title="Obriši fazu rada"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-priority-urgent/10 hover:text-priority-urgent"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              "Učitavanje…"
            )}
          </div>
        }
        subtitle={
          isEditingDoctorInline ? (
            <input
              ref={inlineDoctorInputRef}
              type="text"
              value={inlineDoctorValue}
              onChange={(e) => setInlineDoctorValue(e.target.value)}
              onBlur={handleSaveInlineDoctor}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveInlineDoctor();
                if (e.key === "Escape") setIsEditingDoctorInline(false);
              }}
              placeholder="Opis ili napomena za fazu"
              className="mt-0.5 h-6 rounded border border-brand-500 bg-surface px-1.5 text-xs text-ink outline-none ring-2 ring-brand-500/15"
            />
          ) : (
            <span
              onDoubleClick={() => {
                setInlineDoctorValue(b.board?.description || "");
                setIsEditingDoctorInline(true);
              }}
              className="cursor-pointer select-none rounded px-1 text-xs text-muted hover:bg-surface-2 hover:text-ink truncate block max-w-[220px] sm:max-w-md"
              title="Dvaput kliknite za brzu promjenu opisa"
            >
              {b.board?.description || "+ Dodaj opis faze rada (dvoklik)"}
            </span>
          )
        }
        actions={actions}
        onNewTask={() => setTaskModal({ open: true, task: null, columnId: b.columns[0]?.id })}
        onCreateBoard={openCreateBoard}
      />

      {/* FILTER TRAKA: Desktop (u jednom redu) | Mobile/Tablet (Red 1: Pretraga + Sortiranje | Red 2: Prioritet + Zaposleni) */}
      <div className="border-b border-line/50 bg-surface/40 px-4 py-3 sm:px-6">
        {/* DESKTOP VIEW */}
        <div className="hidden md:flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraga…"
              className="h-9 w-56 rounded-full border border-line bg-surface pl-9 pr-4 text-xs shadow-[var(--shadow-card)] outline-none transition-all duration-200 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/15"
            />
          </div>

          <CustomFilterSelect
            value={filterPriority}
            onChange={setFilterPriority}
            placeholder="Svi prioriteti"
            options={PRIORITIES}
          />

          <CustomFilterSelect
            value={filterAssignee}
            onChange={setFilterAssignee}
            placeholder="Svi zaposleni"
            options={assigneeOptions}
          />

          <CustomFilterSelect
            value={sortBy}
            onChange={setSortBy}
            placeholder="Sortiranje"
            options={SORT_OPTIONS}
          />

          {(filterPriority || filterAssignee || search || sortBy) && (
            <button
              type="button"
              onClick={() => {
                setFilterPriority("");
                setFilterAssignee("");
                setSearch("");
                setSortBy("");
              }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Poništi filtere
            </button>
          )}
        </div>

        {/* MOBILE & TABLET VIEW */}
<div className="flex flex-col gap-2 md:hidden">
  {/* Red 1: Pretraga i Sortiranje */}
  <div className="flex items-center gap-2">
    <div className="relative flex-1 min-w-0">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Pretraga…"
        className="h-9 w-full rounded-full border border-line bg-surface pl-9 pr-8 text-xs shadow-[var(--shadow-card)] outline-none transition-all duration-200 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/15"
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

    {/* Sortiranje: Postavljen align="right" i osigurana širina */}
    <div className="w-[125px] shrink-0 relative">
      <CustomFilterSelect
        value={sortBy}
        onChange={setSortBy}
        placeholder="Sortiranje"
        options={SORT_OPTIONS}
        className="w-full"
        align="right"
      />
    </div>
  </div>

  {/* Red 2: Prioritet i Zaposleni jedno pored drugog */}
  <div className="grid grid-cols-2 gap-2">
    <div className="min-w-0 relative">
      <CustomFilterSelect
        value={filterPriority}
        onChange={setFilterPriority}
        placeholder="Prioritet"
        options={PRIORITIES}
        className="w-full"
      />
    </div>
    
    {/* Zaposleni je u desnoj koloni, pa se meni sidri uz desnu ivicu */}
    <div className="min-w-0 relative">
      <CustomFilterSelect
        value={filterAssignee}
        onChange={setFilterAssignee}
        placeholder="Zaposleni"
        options={assigneeOptions}
        className="w-full"
        align="right"
      />
    </div>
  </div>

  {(filterPriority || filterAssignee || search || sortBy) && (
    <div className="flex justify-end pt-1">
      <button
        type="button"
        onClick={() => {
          setFilterPriority("");
          setFilterAssignee("");
          setSearch("");
          setSortBy("");
        }}
        className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold text-faint hover:text-ink transition-colors active:scale-95 border border-line/60"
      >
        Poništi filtere
      </button>
    </div>
  )}
</div>
      </div>

      <div className="flex-1 overflow-hidden pt-4">
        {b.loading ? (
          <div className="flex justify-center gap-4 px-6">
            {[0, 1, 2, 3].map((i) => (
              <ColumnSkeleton key={i} />
            ))}
          </div>
        ) : (
          <KanbanBoard
            columns={b.columns}
            tasks={filteredTasks}
            actions={b}
            onTaskClick={(task) => setTaskModal({ open: true, task, columnId: task.column_id })}
            onAddTask={(columnId) => setTaskModal({ open: true, task: null, columnId })}
            onAiGenerate={(columnId) => setAiGen({ open: true, columnId })}
          />
        )}
      </div>

      <Modal
        open={editBoardOpen}
        onClose={() => !savingEdit && setEditBoardOpen(false)}
        title="Podešavanje faze rada"
        description="Ažurirajte naziv i opis faze rada."
      >
        <form onSubmit={handleSaveBoardEdit} className="space-y-4">
          <Input
            label="Naziv faze rada"
            value={patientTitle}
            disabled={savingEdit}
            onChange={(e) => setPatientTitle(e.target.value)}
            placeholder="Npr. Fiksna protetika..."
            autoFocus
          />
          <Input
            label="Opis / uputstvo za fazu"
            value={doctorSubtitle}
            disabled={savingEdit}
            onChange={(e) => setDoctorSubtitle(e.target.value)}
            placeholder="Npr. Cirkonijumski mostovi i solo krunice"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              disabled={savingEdit}
              onClick={() => setEditBoardOpen(false)}
              className="active:scale-95"
            >
              Odustani
            </Button>
            <Button type="submit" loading={savingEdit} className="active:scale-95">
              Sačuvaj izmjene
            </Button>
          </div>
        </form>
      </Modal>

      {isSuperAdmin && (
        <ConfirmDialog
          open={deleteBoardOpen}
          onClose={() => setDeleteBoardOpen(false)}
          onConfirm={handleDeleteBoardConfirm}
          title="Brisanje faze rada?"
          description={`“${b.board?.title}” i sve kolone i radovi biće trajno obrisani.`}
          confirmLabel="Obriši"
          danger
        />
      )}

      <TaskModal
        open={taskModal.open}
        onClose={() => setTaskModal({ open: false, task: null, columnId: null })}
        task={taskModal.task}
        defaultColumnId={taskModal.columnId}
        columns={b.columns}
        members={b.members}
        actions={b}
        onBreakdown={handleBreakdown}
      />
      <AIGenerateModal
        open={aiGen.open}
        onClose={() => setAiGen({ open: false, columnId: null })}
        boardId={boardId}
        columns={b.columns}
        defaultColumnId={aiGen.columnId}
        onCreated={(tasks) => tasks.forEach(b.upsertTask)}
      />
      <AISummaryModal open={summaryOpen} onClose={() => setSummaryOpen(false)} boardId={boardId} />
      <MembersModal
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        boardId={boardId}
        members={b.members}
        setMembers={b.setMembers}
        canManage={isSuperAdmin}
        ownerId={b.board?.owner_id}
      />
      <ActivityFeed open={activityOpen} onClose={() => setActivityOpen(false)} boardId={boardId} />
      <PromptDialog
        open={addColumnOpen}
        onClose={() => setAddColumnOpen(false)}
        title="Nova faza rada"
        description="Unesite naziv faze rada za praćenje koraka rada."
        label="Naziv faze rada"
        placeholder="Npr. Modelovanje, Glaziranje..."
        submitLabel="Dodaj novu fazu"
        onSubmit={async (name) => {
          setAddColumnOpen(false);
          await b.addColumn(name);
        }}
      />
    </>
  );
};

export default BoardPage;