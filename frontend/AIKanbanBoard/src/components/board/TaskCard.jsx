import { useMemo, useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Archive, CheckCircle2, Stethoscope } from "lucide-react";
import Avatar from "../ui/Avatar";
import { PriorityTag } from "../ui/Badge";
import { cn, formatDueDate } from "../../lib/utils";

const TaskCard = ({ task, columnTitle = "", onArchive, onClick, overlay = false }) => {
  if (!task || !task.id || !task.title) {
    return null;
  }

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
    disabled: isMobile, // Potpuno isključen drag na mobilnim uređajima
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const due = formatDueDate(task.due_date);

  const isDone = useMemo(() => {
    const col = (columnTitle || "").toLowerCase();
    const st = (task.status || "").toLowerCase();
    return (
      st.includes("završen") ||
      st.includes("gotov") ||
      col.includes("završen") ||
      col.includes("predaja") ||
      col.includes("gotov")
    );
  }, [task.status, columnTitle]);

  const { doctorName, cleanDescription } = useMemo(() => {
    let doc = task.doctor || task.doctor_name || null;
    let desc = task.description || "";

    if (!doc && desc) {
      const match = desc.match(/^Doktor:\s*([^\n\r]+)/i);
      if (match) doc = match[1].trim();
    }

    const clean = desc ? desc.replace(/^Doktor:\s*[^\n\r]+[\n\r]*/i, "").trim() : "";
    return { doctorName: doc, cleanDescription: clean };
  }, [task.doctor, task.doctor_name, task.description]);

  const handleArchiveClick = (e) => {
    e.stopPropagation();
    onArchive?.(task);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(!isMobile ? listeners : {})}
      data-context-type="task"
      data-context-data={JSON.stringify({
        id: task.id,
        title: task.title,
        priority: task.priority,
        description: task.description,
        due_date: task.due_date,
        board_id: task.board_id,
        column_id: task.column_id,
        assignee_id: task.assignee_id,
        doctor: doctorName,
      })}
      onClick={() => {
        if (!isDragging) onClick?.(task);
      }}
      className={cn(
        "group relative select-none rounded-2xl border bg-surface p-3.5 sm:p-4 transition-all duration-200 active:scale-[0.985] touch-pan-y",
        "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-soft)]",
        isMobile
          ? "cursor-pointer"
          : isDragging
          ? "cursor-grabbing opacity-30 pointer-events-none"
          : "cursor-grab active:cursor-grabbing",
        isDone ? "border-emerald-500/25 bg-emerald-500/[0.02]" : "border-line",
        overlay && "rotate-2 cursor-grabbing shadow-[var(--shadow-lift)] ring-2 ring-brand-500/20"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <PriorityTag priority={task.priority} />

        <div className="flex items-center gap-1">
          {isDone && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Završeno
            </span>
          )}

          {isDone && onArchive && (
            <button
              type="button"
              onClick={handleArchiveClick}
              title="Arhivirajte pacijenta"
              className="grid h-6 w-6 place-items-center rounded-lg text-faint opacity-70 transition-all hover:bg-surface-2 hover:text-ink hover:opacity-100 active:scale-90"
            >
              <Archive className="h-3.5 w-3.5 text-brand-600" />
            </button>
          )}
        </div>
      </div>

      <p
        className={cn(
          "mt-2 text-[14px] font-semibold leading-snug tracking-tight transition-colors",
          isDone ? "text-faint line-through decoration-emerald-600/50 decoration-2" : "text-ink"
        )}
      >
        {task.title}
      </p>

      {doctorName && (
        <div className="mt-2 flex items-center">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line/70 bg-surface-2/60 px-2 py-0.5 text-[11px] font-medium text-muted transition-colors group-hover:border-brand-500/30 group-hover:bg-brand-50/40">
            <Stethoscope className="h-3 w-3 text-brand-600 shrink-0" />
            <span className="font-semibold text-ink">Doktor:</span>
            <span className="truncate max-w-[140px] sm:max-w-[160px]">{doctorName}</span>
          </span>
        </div>
      )}

      {cleanDescription && (
        <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted">
          {cleanDescription}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
        {task.assignee_id && task.assignee_name ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar
              name={task.assignee_name || "Radnik"}
              id={task.assignee_id}
              src={task.assignee_avatar}
              size="xs"
            />
            <span className="max-w-[6.5rem] sm:max-w-[7rem] truncate text-[11px] font-medium text-muted">
              {task.assignee_name}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-faint">Nije zadužen</span>
        )}

        {due && (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular shrink-0",
              due.overdue && !isDone
                ? "bg-priority-urgent/10 font-semibold text-priority-urgent"
                : "bg-surface-2 text-muted"
            )}
          >
            <Calendar className="h-3 w-3" /> {due.label}
          </span>
        )}
      </div>
    </div>
  );
};

export default TaskCard;