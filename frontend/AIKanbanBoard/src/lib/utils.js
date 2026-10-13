import { formatDistanceToNow, format, isPast, isToday, isTomorrow } from "date-fns";
import { srLatn } from "date-fns/locale";

/** Spajanje CSS klasa bez dodatnih zavisnosti */
export const cn = (...args) => args.flat().filter(Boolean).join(" ");

export const PRIORITIES = [
  { value: "low", label: "Nizak", color: "#64748b" },
  { value: "medium", label: "Srednji", color: "#2563eb" },
  { value: "high", label: "Visok", color: "#d97706" },
  { value: "urgent", label: "Hitno", color: "#e11d48" },
];

export const priorityMeta = (priority) => {
  const p = (priority || "medium").toLowerCase();
  return PRIORITIES.find((item) => item.value === p) || PRIORITIES[1];
};

// Pastelne nijanse faza
const COLUMN_ACCENTS = [
  { dot: "#ef4444", soft: "rgba(239, 68, 68, 0.06)", ring: "rgba(239, 68, 68, 0.22)" }, // Priprema
  { dot: "#f59e0b", soft: "rgba(245, 158, 11, 0.07)", ring: "rgba(245, 158, 11, 0.24)" }, // Print
  { dot: "#0ea5e9", soft: "rgba(14, 165, 233, 0.06)", ring: "rgba(14, 165, 233, 0.22)" }, // Izrada
  { dot: "#a855f7", soft: "rgba(168, 85, 247, 0.06)", ring: "rgba(168, 85, 247, 0.22)" }, // Završetak
  { dot: "#10b981", soft: "rgba(16, 185, 129, 0.06)", ring: "rgba(16, 185, 129, 0.22)" },
];

export const columnAccent = (index = 0) =>
  COLUMN_ACCENTS[((index % COLUMN_ACCENTS.length) + COLUMN_ACCENTS.length) % COLUMN_ACCENTS.length];

export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

/** Deterministička boja avatara na osnovu ID niza */
export const colorFromId = (id = "") => {
  const palette = ["#2f8159", "#2c9c8f", "#6f9b54", "#5f7da6", "#c26a45", "#9a7b3c", "#a05d7d"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

/** Relativno vrijeme na srpskom jeziku */
export const relativeTime = (date) => {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true, locale: srLatn });
  } catch {
    return "";
  }
};

/** Formatiranje roka pacijenta */
export const formatDueDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  if (isToday(d)) return { label: "Danas", overdue: false };
  if (isTomorrow(d)) return { label: "Sutra", overdue: false };
  return { label: format(d, "d. MMM", { locale: srLatn }), overdue: isPast(d) };
};