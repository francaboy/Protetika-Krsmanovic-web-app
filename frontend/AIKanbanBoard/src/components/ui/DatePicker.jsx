import { useState, useRef, useEffect, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addDays,
} from "date-fns";
import { srLatn } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "../../lib/utils";

const WEEKDAYS = ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"];

const DatePicker = ({ label, value, onChange, placeholder = "Izaberite rok" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const parsedDate = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [value]);

  const [cursor, setCursor] = useState(() => parsedDate || new Date());

  useEffect(() => {
    if (parsedDate) setCursor(parsedDate);
  }, [parsedDate]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectDate = (date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setOpen(false);
  };

  const clearDate = (e) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className="space-y-1.5" ref={ref}>
      {label && <label className="block text-xs font-semibold text-ink">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-line bg-surface px-3 text-xs text-ink shadow-[var(--shadow-card)] transition-all duration-200",
            "hover:border-brand-500/40 hover:shadow-[var(--shadow-soft)]",
            open && "border-brand-500 ring-2 ring-brand-500/15"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted" />
            {parsedDate ? (
              <span className="font-medium text-ink">
                {format(parsedDate, "d. MMMM yyyy.", { locale: srLatn })}
              </span>
            ) : (
              <span className="text-muted">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {parsedDate && (
              <span
                onClick={clearDate}
                className="grid h-4 w-4 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-ink"
                title="Obriši rok"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </div>
        </button>

        {open && (
          <div className="card animate-in absolute left-0 z-50 mt-1.5 w-72 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-lift)]">
            {/* Navigacija po mjesecima */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold capitalize text-ink">
                {format(cursor, "LLLL yyyy.", { locale: srLatn })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCursor((c) => subMonths(c, 1))}
                  className="grid h-6 w-6 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCursor((c) => addMonths(c, 1))}
                  className="grid h-6 w-6 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Dani u sedmici */}
            <div className="mb-1 grid grid-cols-7 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[10px] font-semibold uppercase text-faint">
                  {w}
                </span>
              ))}
            </div>

            {/* Kalendarska mreža dana */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const isSelected = parsedDate && isSameDay(day, parsedDate);
                const isCurrentMonth = isSameMonth(day, cursor);
                const isCurrentDay = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => selectDate(day)}
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg text-xs font-medium transition-all duration-150",
                      !isCurrentMonth && "text-faint/50",
                      isCurrentMonth && !isSelected && "text-ink hover:bg-surface-2",
                      isCurrentDay && !isSelected && "border border-brand-500/40 text-brand-600 font-semibold",
                      isSelected && "bg-brand-500 font-semibold text-white shadow-sm"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>

            {/* Brze prečice */}
            <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[11px]">
              <button
                type="button"
                onClick={() => selectDate(new Date())}
                className="rounded-md px-1.5 py-0.5 font-medium text-brand-600 hover:bg-brand-50 transition-colors"
              >
                Danas
              </button>
              <button
                type="button"
                onClick={() => selectDate(addDays(new Date(), 1))}
                className="rounded-md px-1.5 py-0.5 font-medium text-muted hover:bg-surface-2 transition-colors"
              >
                Sutra
              </button>
              <button
                type="button"
                onClick={() => selectDate(addDays(new Date(), 7))}
                className="rounded-md px-1.5 py-0.5 font-medium text-muted hover:bg-surface-2 transition-colors"
              >
                Za 7 dana
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatePicker;