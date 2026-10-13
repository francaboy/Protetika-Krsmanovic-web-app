import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  CheckCheck,
  Trash2,
  Clock,
  ArrowRightLeft,
  UserPlus,
  FileCheck,
  AlertCircle,
  Archive,
  Sparkles,
  Zap,
  CheckCircle2,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import { relativeTime, cn } from "../../lib/utils";

const getNotificationIcon = (type = "") => {
  switch (type.toLowerCase()) {
    case "priority_urgent":
      return <Zap className="h-4 w-4 text-rose-600 fill-rose-500/20" />;
    case "patient_completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "task_deleted":
    case "board_deleted":
      return <AlertCircle className="h-4 w-4 text-priority-urgent" />;
    case "task_moved":
    case "patient_moved":
    case "stage_changed":
      return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
    case "board_assigned":
    case "task_assigned":
      return <UserPlus className="h-4 w-4 text-brand-600" />;
    case "task_archived":
      return <Archive className="h-4 w-4 text-amber-600" />;
    case "ai_generated":
      return <Sparkles className="h-4 w-4 text-purple-600" />;
    case "task_created":
    default:
      return <FileCheck className="h-4 w-4 text-emerald-600" />;
  }
};

const NotificationDropdown = ({
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onClose,
}) => {
  const navigate = useNavigate();
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleItemClick = (n) => {
    if (!n.is_read) onMarkAsRead?.(n.id);

    const bId = n.board_id || n.boardId || n.target_board_id;
    const tId = n.task_id || n.taskId;

    if (bId && n.type !== "board_deleted") {
      const taskParam = tId ? `?task=${tId}` : "";
      navigate(`/rad/${bId}${taskParam}`);
      onClose?.();
    } else if (tId) {
      navigate(`/pacijenti?task=${tId}`);
      onClose?.();
    }
  };

  return (
    <div className="card animate-in w-full sm:w-[400px] md:w-[420px] max-w-full overflow-hidden rounded-3xl border border-line bg-surface p-0 shadow-[var(--shadow-lift)]">
      {/* Zaglavlje prilagođeno za manje ekrane */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5 sm:py-3.5 bg-surface-2/30">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-display text-sm font-bold text-ink truncate">Obavještenja</h3>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tabular text-brand-700 border border-brand-500/20 shrink-0">
              {unreadCount} {unreadCount === 1 ? "novo" : "nova"}
            </span>
          ) : (
            <span className="text-[10px] sm:text-[11px] font-medium text-faint shrink-0">Sve pročitano</span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors active:scale-95"
              title="Označi sva obavještenja kao pročitana"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Označi pročitano</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-faint hover:text-priority-urgent transition-colors active:scale-95"
              title="Obriši sva obavještenja"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Očisti sve</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista obavještenja sa optimizovanim vertikalnim skrolom */}
      <div className="max-h-[60vh] sm:max-h-[390px] overflow-y-auto divide-y divide-line/60 no-scrollbar">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 sm:py-14 px-4 text-center">
            <Clock className="h-7 w-7 text-faint" />
            <p className="text-xs font-semibold text-ink">Nemate novih obavještenja</p>
            <p className="max-w-[220px] text-[11px] text-muted leading-relaxed">
              Sve izmjene na radovima i dodjele pacijenata stizaće ovdje.
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const timeAgo = relativeTime(n.created_at || n.createdAt);
            const isUrgent = n.type === "priority_urgent";
            const isCompleted = n.type === "patient_completed";

            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={cn(
                  "group relative flex cursor-pointer items-start gap-3 p-3.5 sm:p-4 transition-colors hover:bg-surface-2 active:bg-surface-2/80",
                  !n.is_read && isUrgent && "bg-rose-50/50 dark:bg-rose-950/20",
                  !n.is_read && isCompleted && "bg-emerald-50/50 dark:bg-emerald-950/20",
                  !n.is_read && !isUrgent && !isCompleted && "bg-brand-50/40"
                )}
              >
                <div className="relative shrink-0 pt-0.5">
                  {n.actor_avatar || n.actor_name ? (
                    <Avatar
                      name={n.actor_name}
                      src={n.actor_avatar}
                      size="sm"
                      className="h-8 w-8"
                    />
                  ) : (
                    <div
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full border shadow-sm",
                        isUrgent
                          ? "bg-rose-50 border-rose-200 dark:bg-rose-900/30 dark:border-rose-800/40"
                          : isCompleted
                          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800/40"
                          : "bg-surface-2 border-line"
                      )}
                    >
                      {getNotificationIcon(n.type)}
                    </div>
                  )}
                  {!n.is_read && (
                    <span
                      className={cn(
                        "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface shadow-sm",
                        isUrgent ? "bg-rose-600" : isCompleted ? "bg-emerald-600" : "bg-priority-urgent"
                      )}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <p
                      className={cn(
                        "text-xs font-semibold truncate leading-tight",
                        isUrgent ? "text-rose-600 font-bold" : isCompleted ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-ink"
                      )}
                    >
                      {n.title || "Izmjena na pacijentu"}
                    </p>
                    <span className="text-[10px] font-medium text-faint shrink-0 tabular">
                      {timeAgo}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">
                    {n.message}
                  </p>
                </div>

                {!n.is_read && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAsRead?.(n.id);
                    }}
                    title="Označi kao pročitano"
                    className="shrink-0 rounded-lg p-1.5 text-faint hover:bg-surface hover:text-ink opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity active:scale-90"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;