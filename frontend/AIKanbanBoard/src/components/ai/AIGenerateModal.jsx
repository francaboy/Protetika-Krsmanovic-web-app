import { useState, useEffect, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import {
  Sparkles,
  Loader2,
  Check,
  ChevronDown,
  Users,
  Stethoscope,
  FileText,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Input } from "../ui/Input";
import { PriorityBadge } from "../ui/Badge";
import { aiApi } from "../../lib/api";
import { cn } from "../../lib/utils";

const CustomSelect = ({ label, value, onChange, placeholder, options }) => {
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
    <div className="space-y-1.5 w-full" ref={ref}>
      {label && <label className="block text-xs font-semibold text-ink">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-xs text-ink shadow-[var(--shadow-card)] transition-all duration-200 active:scale-95",
            "hover:border-brand-500/40 hover:shadow-[var(--shadow-soft)]",
            open && "border-brand-500 ring-2 ring-brand-500/15"
          )}
        >
          <span className={cn("truncate font-medium", !selectedOption && "text-muted")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-faint transition-transform duration-200",
              open && "rotate-180 text-brand-600"
            )}
          />
        </button>

        {open && (
          <div className="card animate-in absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow-lift)] no-scrollbar">
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
                    "flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-colors duration-150 active:scale-[0.98]",
                    active
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-ink hover:bg-surface-2"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
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

const COUNT_OPTIONS = [
  { value: 2, label: "2 pacijenta" },
  { value: 4, label: "4 pacijenta" },
  { value: 6, label: "6 pacijenata" },
  { value: 8, label: "8 pacijenata" },
  { value: 10, label: "10 pacijenata" },
];

const AIGenerateModal = ({ open, onClose, boardId, columns, defaultColumnId, onCreated }) => {
  const [patientsLine, setPatientsLine] = useState("");
  const [doctorsLine, setDoctorsLine] = useState("");
  const [notesLine, setNotesLine] = useState("");
  const [count, setCount] = useState(2);
  const [columnId, setColumnId] = useState(defaultColumnId || columns[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  useEffect(() => {
    if (open) {
      setPatientsLine("");
      setDoctorsLine("");
      setNotesLine("");
      setSuggestions(null);
      setCount(2);
      setColumnId(defaultColumnId || columns[0]?.id || "");
    }
  }, [open, defaultColumnId, columns]);

  const columnOptions = useMemo(() => {
    return columns.map((c) => ({
      value: c.id,
      label: c.title,
    }));
  }, [columns]);

  const generate = async (e) => {
    e?.preventDefault();
    if (!patientsLine.trim()) {
      return toast.error("Unesite barem jednog pacijenta");
    }

    setLoading(true);
    try {
      const res = await aiApi.generateTasks(boardId, {
        patientsLine: patientsLine.trim(),
        doctorsLine: doctorsLine.trim(),
        notesLine: notesLine.trim(),
        count: Number(count),
      });
      setSuggestions(res.tasks || []);
    } catch (err) {
      toast.error(err.message || "Greška pri generisanju pacijenata");
    } finally {
      setLoading(false);
    }
  };

  const removeSuggestion = (indexToRemove) => {
    setSuggestions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const addAll = async () => {
    if (!suggestions || suggestions.length === 0) {
      return toast.error("Nema predloženih pacijenata za unos");
    }

    setLoading(true);
    try {
      const res = await aiApi.generateTasks(boardId, {
        patientsLine: patientsLine.trim(),
        doctorsLine: doctorsLine.trim(),
        notesLine: notesLine.trim(),
        count: Number(count),
        column_id: columnId,
      });

      onCreated?.(res.tasks);
      toast.success(
        `Uspješno dodano ${res.tasks.length} ${
          res.tasks.length === 1
            ? "novi pacijent"
            : res.tasks.length < 5
            ? "nova pacijenta"
            : "novih pacijenata"
        }`
      );
      onClose();
    } catch (err) {
      toast.error(err.message || "Greška pri dodavanju pacijenata");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-500" /> AI Planer Pacijenata
        </span>
      }
      description="Upišite imena pacijenata, doktore i napomene odvojene zarezom."
    >
      {!suggestions && (
        <form onSubmit={generate} className="space-y-4">
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Users className="h-3.5 w-3.5 text-brand-600 shrink-0" />
              Ime i prezime pacijenata
            </label>
            <Input
              placeholder="npr. Marko Marković, Petar Petrović..."
              autoFocus
              required
              value={patientsLine}
              onChange={(e) => setPatientsLine(e.target.value)}
            />
            <p className="text-[11px] text-faint">Odvojite imena pacijenata zarezom.</p>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Stethoscope className="h-3.5 w-3.5 text-brand-600 shrink-0" />
              Ordinirajući doktori
            </label>
            <Input
              placeholder="npr. Dr Krsmanović, Dr Petrović..."
              value={doctorsLine}
              onChange={(e) => setDoctorsLine(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <FileText className="h-3.5 w-3.5 text-brand-600 shrink-0" />
              Napomene, specifikacija materijala ili opis rada
            </label>
            <Input
              placeholder="npr. Cirkonijum most gornja A2, Keramička krunica B1, Otisak za model"
              value={notesLine}
              onChange={(e) => setNotesLine(e.target.value)}
            />
          </div>

          {/* Grid za selektore prilagođen za mobilni i tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomSelect
              label="Maksimalan broj pacijenata"
              value={count}
              onChange={(val) => setCount(Number(val))}
              placeholder="Izaberite limit"
              options={COUNT_OPTIONS}
            />
            <CustomSelect
              label="Izaberite fazu rada"
              value={columnId}
              onChange={setColumnId}
              placeholder="Izaberite fazu"
              options={columnOptions}
            />
          </div>

          <Button type="submit" className="w-full mt-2 active:scale-95" loading={loading}>
            <Sparkles className="h-4 w-4" /> Generiši nove pacijente
          </Button>
        </form>
      )}

      {loading && !suggestions && (
        <div className="mt-5 flex items-center justify-center gap-2 py-8 text-muted text-xs">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" /> Prepoznavanje i formiranje pacijenata…
        </div>
      )}

      {suggestions && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint tabular">
              Spremno {suggestions.length}{" "}
              {suggestions.length === 1
                ? "novi pacijent"
                : suggestions.length < 5
                ? "nova pacijenta"
                : "novih pacijenata"}
            </p>
            <button
              type="button"
              onClick={() => setSuggestions(null)}
              className="flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Izmijeni parametre
            </button>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1 no-scrollbar">
            {suggestions.map((t, i) => (
              <div
                key={i}
                className="group card rounded-2xl p-3.5 border border-line bg-surface flex items-start justify-between gap-2 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink truncate">{t.title}</p>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  {t.doctor && <p className="text-xs text-brand-600 font-medium mt-0.5">{t.doctor}</p>}
                  {t.description && (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted border-t border-line/60 pt-1.5">
                      {t.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeSuggestion(i)}
                  title="Ukloni ovog pacijenta sa spiska"
                  className="p-1.5 rounded-lg text-faint opacity-70 hover:opacity-100 hover:bg-priority-urgent/10 hover:text-priority-urgent transition-all active:scale-90 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-line/60">
            <Button variant="ghost" onClick={generate} disabled={loading} className="active:scale-95">
              Generiši ponovo
            </Button>
            <Button onClick={addAll} loading={loading} disabled={suggestions.length === 0} className="active:scale-95">
              <Check className="h-4 w-4" /> Dodaj u:{" "}
              {columns.find((c) => c.id === columnId)?.title}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AIGenerateModal;