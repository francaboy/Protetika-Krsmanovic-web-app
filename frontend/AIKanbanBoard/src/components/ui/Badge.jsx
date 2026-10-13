import { cn, priorityMeta } from "../../lib/utils";

// Standardni bedž prioriteta (korišten u modalima i tabelarnim prikazima)
export const PriorityBadge = ({ priority, className }) => {
  const meta = priorityMeta(priority) || {
    label: "Srednji",
    color: "#2563eb",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight tabular select-none border",
        className
      )}
      style={{
        color: meta.color,
        backgroundColor: `${meta.color}18`,
        borderColor: `${meta.color}35`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full shadow-sm"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
};

// Uppercase stilizovana oznaka (korištena na samom vrhu kartice pacijenta)
export const PriorityTag = ({ priority, className }) => {
  const meta = priorityMeta(priority) || {
    label: "Srednji",
    color: "#2563eb",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] tabular select-none border",
        className
      )}
      style={{
        color: meta.color,
        backgroundColor: `${meta.color}15`,
        borderColor: `${meta.color}30`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full shadow-sm"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
};

// Generički višenamjenski bedž sa podrškom za varijante
export const Badge = ({ children, variant = "default", className }) => {
  const variants = {
    default: "bg-surface-2 text-muted border-line/60",
    outline: "bg-transparent text-muted border-line",
    success: "bg-emerald-50 text-emerald-700 border-emerald-500/20",
    urgent: "bg-priority-urgent/10 text-priority-urgent border-priority-urgent/20",
    brand: "bg-brand-50 text-brand-700 border-brand-500/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight select-none",
        variants[variant] || variants.default,
        className
      )}
    >
      {children}
    </span>
  );
};

export default Badge;