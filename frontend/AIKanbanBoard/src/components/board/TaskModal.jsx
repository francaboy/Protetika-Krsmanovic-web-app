import { useState, useEffect, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import { Trash2, ChevronDown, Check } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Input, Textarea } from "../ui/Input";
import DatePicker from "../ui/DatePicker";
import Avatar from "../ui/Avatar";
import { PRIORITIES, priorityMeta, cn } from "../../lib/utils";
import { useBoards } from "../../context/BoardsContext";

const toDateInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const extractDoctor = (task) => {
  if (!task) return "";
  if (task.doctor) return task.doctor;
  if (task.doctor_name) return task.doctor_name;
  const match = task.description?.match(/^Doktor:\s*([^\n\r]+)/i);
  return match ? match[1].trim() : "";
};

const extractCleanDescription = (desc) => {
  if (!desc) return "";
  return desc.replace(/^Doktor:\s*[^\n\r]+[\n\r]*/i, "").trim();
};

const empty = (boardId, columnId) => ({
  title: "",
  doctor: "",
  description: "",
  priority: "medium",
  due_date: "",
  assignee_id: "",
  board_id: boardId ? String(boardId) : "",
  column_id: columnId || "",
});

const CustomSelect = ({ label, value, onChange, placeholder, options, renderOption, renderSelected, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectedOption = options.find((o) => String(o.value) === String(value));

  return (
    <div className="space-y-1.5" ref={ref}>
      {label && <label className="block text-xs font-semibold text-ink">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-xs text-ink shadow-[var(--shadow-card)] transition-all duration-200 active:scale-[0.99]",
            "hover:border-brand-500/40 hover:shadow-[var(--shadow-soft)]",
            open && "border-brand-500 ring-2 ring-brand-500/15",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {selectedOption ? (
              renderSelected ? (
                renderSelected(selectedOption)
              ) : (
                <span className="truncate font-medium">{selectedOption.label}</span>
              )
            ) : (
              <span className="truncate text-muted">{placeholder}</span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-faint transition-transform duration-200",
              open && "rotate-180 text-brand-600"
            )}
          />
        </button>

        {open && !disabled && (
          <div className="card absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow-lift)] no-scrollbar animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150 ease-out">
            {options.map((opt) => {
              const active = String(opt.value) === String(value);
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-all duration-150 active:scale-[0.98]",
                    active
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-ink hover:bg-surface-2"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {renderOption ? renderOption(opt) : <span className="truncate">{opt.label}</span>}
                  </div>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

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

const TaskModal = ({
  open,
  onClose,
  task,
  boardId,
  defaultBoardId,
  defaultColumnId,
  columns,
  members = [],
  actions,
}) => {
  const isEdit = Boolean(task);
  const { boards = [] } = useBoards();

  const boardOptions = useMemo(() => {
    return [...(boards || [])]
      .sort((a, b) => {
        const titleA = (a.title || "").toLowerCase();
        const titleB = (b.title || "").toLowerCase();

        const indexA = PHASE_ORDER.findIndex((p) => titleA.includes(p));
        const indexB = PHASE_ORDER.findIndex((p) => titleB.includes(p));

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        return (a.position || 0) - (b.position || 0);
      })
      .map((b) => ({
        value: String(b.id),
        label: b.title,
        color: b.color || "#2f8159",
      }));
  }, [boards]);

  // Ako je proslijeđen defaultBoardId ili boardId, uzimamo njega kao prioritet
  const resolvedBoardId = useMemo(() => {
    if (task?.board_id) return String(task.board_id);
    if (defaultBoardId) return String(defaultBoardId);
    if (boardId) return String(boardId);
    return boardOptions[0]?.value || "";
  }, [task, defaultBoardId, boardId, boardOptions]);

  const [form, setForm] = useState(empty(resolvedBoardId, defaultColumnId));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        title: task.title || "",
        doctor: extractDoctor(task),
        description: extractCleanDescription(task.description),
        priority: task.priority || "medium",
        due_date: toDateInput(task.due_date),
        assignee_id: task.assignee_id ? String(task.assignee_id) : "",
        board_id: task.board_id ? String(task.board_id) : resolvedBoardId,
        column_id: task.column_id,
      });
    } else {
      setForm(empty(resolvedBoardId, defaultColumnId || columns?.[0]?.id));
    }
  }, [open, task, defaultColumnId, columns, resolvedBoardId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setValue = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const memberOptions = useMemo(() => {
    return [
      { value: "", label: "Nije izabrano" },
      ...members.map((m) => ({
        value: String(m.id),
        label: m.name,
        avatar: m.avatar_url,
      })),
    ];
  }, [members]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Ime i prezime pacijenta je obavezno polje");
    setSaving(true);

    const selectedMember = form.assignee_id
      ? members.find((m) => String(m.id) === String(form.assignee_id))
      : null;

    const cleanDoctor = form.doctor.trim();
    const cleanDesc = form.description.trim();

    let combinedDescription = cleanDesc;
    if (cleanDoctor) {
      combinedDescription = cleanDesc ? `Doktor: ${cleanDoctor}\n\n${cleanDesc}` : `Doktor: ${cleanDoctor}`;
    }

    const payload = {
      title: form.title.trim(),
      doctor: cleanDoctor || null,
      doctor_name: cleanDoctor || null,
      description: combinedDescription || null,
      priority: form.priority,
      due_date: form.due_date || null,
      assignee_id: selectedMember ? selectedMember.id : null,
      assignee_name: selectedMember ? selectedMember.name : null,
      assignee_avatar: selectedMember ? selectedMember.avatar_url : null,
      target_board_id: form.board_id,
      board_id: form.board_id,
    };

    try {
      if (isEdit) {
        await actions.updateTask(task.id, payload);

        if (form.board_id && String(form.board_id) !== String(task.board_id)) {
          toast.success("Pacijent je prebačen u novu fazu rada!");
        } else {
          toast.success("Podaci o pacijentu su ažurirani");
        }
      } else {
        await actions.createTask({
          ...payload,
          column_id: form.column_id || defaultColumnId,
        });
        toast.success("Pacijent je uspješno kreiran");
      }
      onClose();
    } catch (err) {
      toast.error(err.message || "Greška pri ažuriranju podataka o pacijentu");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await actions.deleteTask(task.id);
      toast.success("Pacijent je uspješno obrisan");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error(err.message || "Greška pri brisanju pacijenta");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={() => !saving && onClose()}
        title={isEdit ? "Izmjena pacijenta" : "Kreiranje novog pacijenta"}
        size="md"
      >
        <form
          onSubmit={onSubmit}
          className="space-y-4 max-h-[calc(100dvh-120px)] sm:max-h-none overflow-y-auto overscroll-contain pr-1 touch-pan-y"
        >
          <Input
            label="Ime i prezime pacijenta"
            placeholder="Unesite ime i prezime pacijenta"
            disabled={saving}
            value={form.title}
            onChange={set("title")}
          />

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 block text-xs font-medium tracking-tight text-muted">
              Ime i prezime doktora
            </label>
            <Input
              placeholder="Unesite ime i prezime doktora"
              disabled={saving}
              value={form.doctor}
              onChange={set("doctor")}
            />
          </div>

          <Textarea
            label="Napomene i uputstva za laboratoriju"
            rows={3}
            disabled={saving}
            placeholder="Unesite detaljnija uputstva ili napomenu…"
            value={form.description}
            onChange={set("description")}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <CustomSelect
              label="Prioritet"
              value={form.priority}
              disabled={saving}
              onChange={(val) => setValue("priority", val)}
              placeholder="Izaberite prioritet"
              options={PRIORITIES}
              renderSelected={(opt) => (
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: priorityMeta(opt.value).color }}
                  />
                  <span className="font-medium text-ink">{opt.label}</span>
                </div>
              )}
              renderOption={(opt) => (
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: priorityMeta(opt.value).color }}
                  />
                  <span>{opt.label}</span>
                </div>
              )}
            />
            <DatePicker
              label="Rok završetka"
              value={form.due_date}
              disabled={saving}
              onChange={(val) => setValue("due_date", val)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <CustomSelect
              label="Izaberite radnika"
              value={form.assignee_id}
              disabled={saving}
              onChange={(val) => setValue("assignee_id", val)}
              placeholder="Lista radnika"
              options={memberOptions}
              renderSelected={(opt) =>
                opt.value ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={opt.label} src={opt.avatar} size="xs" />
                    <span className="font-medium text-ink">{opt.label}</span>
                  </div>
                ) : (
                  <span className="text-muted">{opt.label}</span>
                )
              }
              renderOption={(opt) =>
                opt.value ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={opt.label} src={opt.avatar} size="xs" />
                    <span>{opt.label}</span>
                  </div>
                ) : (
                  <span className="text-muted">{opt.label}</span>
                )
              }
            />

            <CustomSelect
              label="Faza rada"
              value={form.board_id}
              disabled={saving}
              onChange={(val) => setValue("board_id", val)}
              placeholder="Izaberite fazu"
              options={boardOptions}
              renderSelected={(opt) => (
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: opt.color }}
                  />
                  <span className="truncate font-medium text-ink">{opt.label}</span>
                </div>
              )}
              renderOption={(opt) => (
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: opt.color }}
                  />
                  <span className="truncate">{opt.label}</span>
                </div>
              )}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
            <div>
              {isEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setConfirmDelete(true)}
                  className="w-full sm:w-auto text-priority-urgent hover:bg-priority-urgent/10 active:scale-95"
                >
                  <Trash2 className="h-4 w-4" /> Obriši pacijenta
                </Button>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="flex-1 sm:flex-initial active:scale-95">
                Odustani
              </Button>
              <Button type="submit" loading={saving} className="flex-1 sm:flex-initial active:scale-95">
                {isEdit ? "Sačuvaj izmjene" : "Dodaj pacijenta"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await handleDeleteConfirm();
          setConfirmDelete(false);
        }}
        title={
          <span className="block text-balance break-words leading-snug">
            Da li želite obrisati pacijenta{" "}
            <span className="font-bold text-ink underline decoration-priority-urgent/40 decoration-2">
              {task?.title}
            </span>
            ?
          </span>
        }
        description="Pacijent i svi prateći podaci biće trajno uklonjeni. Ova radnja se ne može poništiti."
        confirmLabel="Obriši pacijenta"
        danger
        loading={deleting}
      />
    </>
  );
};

export default TaskModal;