import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ChevronDown,
  LogOut,
  Plus,
  Search,
  Command,
  Bell,
  CheckCircle2,
  Menu,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLayout } from "./AppLayout";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";
import NotificationDropdown from "./NotificationDropdown";
import TaskModal from "../board/TaskModal";
import { notificationApi, boardApi, taskApi } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { cn } from "../../lib/utils";

// Optimizovani indikator prilagođen za mobile i tablet view
export const PresenceIndicator = ({ users = [] }) => {
  if (!users || users.length === 0) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] shadow-sm transition-all shrink-0 select-none",
        "border-emerald-500/30 bg-emerald-50/90 text-emerald-900",
        "dark:border-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-300"
      )}
      title={`Trenutno na tabli: ${users.map((u) => u.name).join(", ")}`}
    >
      <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500" />
      </span>

      <div className="flex items-center gap-1">
        <div className="flex -space-x-1.5 overflow-hidden">
          {users.slice(0, 2).map((u, i) => (
            <Avatar
              key={u.id || i}
              name={u.name}
              src={u.avatar_url}
              size="xs"
              className="h-4 w-4 sm:h-5 sm:w-5 ring-1 ring-surface shrink-0"
            />
          ))}
        </div>
        <span className="text-[10px] sm:text-[11px] font-bold tabular px-0.5">
          {users.length}
        </span>
        <span className="hidden sm:inline text-[10px] font-medium opacity-80">gleda</span>
      </div>
    </div>
  );
};

const Topbar = ({
  title,
  subtitle,
  actions,
  presence = [],
  onNewTask,
  onCreateTask,
  onOpenMobileSidebar,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { openCommand, openMobileSidebar } = useLayout() || {};
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [defaultBoardId, setDefaultBoardId] = useState(null);
  const [targetColumns, setTargetColumns] = useState([]);
  const [targetMembers, setTargetMembers] = useState([]);

  const ref = useRef(null);
  const notifRef = useRef(null);

  const isBoardView = Boolean(actions || (presence && presence.length > 0));

  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationApi.list();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error("Greška pri učitavanju notifikacija:", err);
    }
  }, []);

  const handleClearAll = async () => {
    try {
      await notificationApi.clearAll();
      setNotifications([]);
      setUnreadCount(0);
      toast.success("Sva obavještenja su obrisana");
    } catch (err) {
      toast.error("Greška pri brisanju obavještenja");
    }
  };

  useEffect(() => {
    loadNotifications();

    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      const isUrgent = notification.type === "priority_urgent";
      const isCompleted = notification.type === "patient_completed";

      toast.custom(
        (t) => (
          <div
            className={cn(
              "flex items-center gap-3 rounded-full border px-4 py-2.5 shadow-[var(--shadow-lift)] backdrop-blur-md transition-all duration-300 select-none",
              isUrgent
                ? "border-rose-500/30 bg-rose-50/95 dark:bg-rose-950/90 text-rose-950 dark:text-rose-100"
                : isCompleted
                ? "border-emerald-500/30 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100"
                : "border-line bg-surface/95 text-ink",
              t.visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-2 opacity-0 scale-95"
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full border shadow-sm",
                isUrgent
                  ? "bg-rose-500 text-white border-rose-600"
                  : isCompleted
                  ? "bg-emerald-500 text-white border-emerald-600"
                  : "bg-brand-50 text-brand-600 border-brand-500/20"
              )}
            >
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 pr-1">
              {notification.title && (
                <p className="truncate text-xs font-bold tracking-tight">
                  {notification.title}
                </p>
              )}
              <p className="truncate text-[12px] font-medium opacity-90">
                {notification.message}
              </p>
            </div>
          </div>
        ),
        { duration: isUrgent ? 6000 : 4500 }
      );
    };

    const handleSyncTasks = () => {
      loadNotifications();
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("task:moved", handleSyncTasks);
    socket.on("task:created", handleSyncTasks);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("task:moved", handleSyncTasks);
      socket.off("task:created", handleSyncTasks);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target))
        setNotifOpen(false);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewPatientClick = async () => {
    const customHandler = onNewTask || onCreateTask;
    if (typeof customHandler === "function") {
      customHandler();
      return;
    }

    try {
      const res = await boardApi.list();
      const boards = res.boards || res || [];
      if (boards.length === 0) {
        toast.error("Nema kreiranih radnih faza za unos pacijenta");
        return;
      }
      const bId = boards[0].id;
      setDefaultBoardId(bId);
      const detail = await boardApi.get(bId);
      if (detail) {
        setTargetColumns(detail.columns || []);
        setTargetMembers(detail.members || []);
      }
      setTaskModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Greška pri otvaranju forme za pacijenta");
    }
  };

  const handleCreateTaskFromTopbar = async (taskData) => {
    if (!defaultBoardId) return;
    try {
      await taskApi.create(defaultBoardId, taskData);
      setTaskModalOpen(false);
      setDefaultBoardId(null);
      setTargetColumns([]);
      setTargetMembers([]);
      toast.success("Pacijent je uspješno kreiran");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Greška pri kreiranju pacijenta");
    }
  };

  return (
    <>
      <header className="glass sticky top-0 z-20 flex h-[70px] sm:h-[72px] items-center gap-2 sm:gap-3 border-b border-line/60 px-3 sm:px-6">
        {/* Dugme za otvaranje menija (Mobilni & Tablet) */}
        <button
          type="button"
          onClick={() => {
            if (typeof openMobileSidebar === "function") {
              openMobileSidebar();
            } else if (typeof onOpenMobileSidebar === "function") {
              onOpenMobileSidebar();
            }
          }}
          className="group grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-2xl border border-line bg-surface text-ink shadow-[var(--shadow-card)] transition-all duration-200 hover:border-brand-500/40 hover:bg-surface-2 active:scale-90 md:hidden"
          title="Otvori navigaciju"
        >
          <Menu className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
        </button>

        {/* Naslov i podnaslov: UVIJEK SAKRIVENI na Mobile i Tablet (hidden), a vidljivi isključivo na Desktopu (md:block) */}
        <div className="hidden md:block min-w-0 truncate">
          {title &&
            (typeof title === "string" ? (
              <h1 className="truncate font-display text-base sm:text-lg font-bold leading-tight tracking-tight text-ink">
                {title}
              </h1>
            ) : (
              <div className="font-display text-base sm:text-lg font-bold leading-tight tracking-tight text-ink truncate">
                {title}
              </div>
            ))}
          {subtitle &&
            (typeof subtitle === "string" ? (
              <p className="truncate text-[11px] sm:text-xs text-muted">{subtitle}</p>
            ) : (
              <div className="text-[11px] sm:text-xs text-muted truncate">{subtitle}</div>
            ))}
        </div>

        {/* Desna strana Topbara */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Pretraga (Desktop) */}
          <button
            type="button"
            onClick={openCommand}
            className="hidden h-9 sm:h-10 w-44 sm:w-56 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs sm:text-sm text-faint shadow-[var(--shadow-card)] transition-all duration-200 hover:border-brand-500/40 hover:text-muted hover:shadow-[var(--shadow-soft)] lg:flex"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left truncate">Pretraga…</span>
            <kbd className="flex items-center gap-0.5 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
              <Command className="h-3 w-3" />K
            </kbd>
          </button>

          {/* Oznaka ko trenutno gleda tablu */}
          {presence && presence.length > 0 && (
            <PresenceIndicator users={presence} />
          )}

          {/* Sve akcije sa boarda */}
          {actions && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              {actions}
            </div>
          )}

          {/* Zvonce za obavještenja sa prilagođenim pozicioniranjem za mobilni/tablet */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-[var(--shadow-card)] transition-all duration-200 hover:text-ink hover:shadow-[var(--shadow-soft)] active:scale-95 shrink-0"
              title="Obavještenja"
            >
              <Bell className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] sm:h-5 sm:min-w-[20px] items-center justify-center rounded-full bg-priority-urgent px-1 text-[9px] sm:text-[10px] font-bold tabular text-white shadow-sm ring-2 ring-surface animate-in zoom-in-75">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                {/* Backdrop na mobilnom za lakše zatvaranje */}
                <div 
                  className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] sm:hidden" 
                  onClick={() => setNotifOpen(false)} 
                />
                <div className="fixed inset-x-4 top-20 z-50 max-w-sm mx-auto sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-w-none">
                  <NotificationDropdown
                    notifications={notifications}
                    onMarkAsRead={handleMarkAsRead}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    onClearAll={handleClearAll}
                    onClose={() => setNotifOpen(false)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Dugme za unos novog pacijenta */}
          {!isBoardView && (
            <Button
              size="sm"
              onClick={handleNewPatientClick}
              className="h-9 px-2.5 sm:px-3.5 text-xs shrink-0 active:scale-95 shadow-sm inline-flex"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="hidden min-[400px]:inline font-semibold">Novi pacijent</span>
            </Button>
          )}

          {/* Profilni meni */}
          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="group flex items-center rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-card)] transition-all duration-200 hover:border-brand-500/40 hover:shadow-[var(--shadow-soft)] active:scale-95 sm:py-1 sm:pl-1 sm:pr-2.5 shrink-0"
            >
              <Avatar
                name={user?.name}
                id={user?.id}
                src={user?.avatar_url}
                size="sm"
                className="h-7 w-7 sm:h-8 sm:w-8 transition-transform duration-200 group-hover:scale-105"
              />
              <span className="hidden max-w-[7rem] truncate text-xs sm:text-sm font-medium text-ink lg:block sm:ml-2">
                {user?.name?.split(" ")[0]}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-faint sm:block sm:ml-1" />
            </button>

            {menuOpen && (
              <div className="card animate-in absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)] z-50">
                <div
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/podesavanja");
                  }}
                  className="cursor-pointer rounded-xl px-3 py-2 transition-colors hover:bg-surface-2"
                >
                  <p className="truncate text-sm font-semibold text-ink">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-faint">{user?.email}</p>
                </div>
                <div className="my-1 border-t border-line/60" />
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/prijava");
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-priority-urgent transition-colors hover:bg-surface-2 active:scale-95"
                >
                  <LogOut className="h-4 w-4" /> Odjavite se
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {taskModalOpen && (
        <TaskModal
          open={taskModalOpen}
          onClose={() => {
            setTaskModalOpen(false);
            setDefaultBoardId(null);
            setTargetColumns([]);
            setTargetMembers([]);
          }}
          task={null}
          defaultColumnId={targetColumns[0]?.id}
          columns={targetColumns}
          members={targetMembers}
          actions={{
            createTask: handleCreateTaskFromTopbar,
            updateTask: async () => {},
            deleteTask: async () => {},
          }}
        />
      )}
    </>
  );
};

export default Topbar;