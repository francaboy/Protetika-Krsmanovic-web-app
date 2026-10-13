import { useState, useMemo, useEffect } from "react";
import {
  Zap,
  Pencil,
  Archive,
  LayoutDashboard,
  BarChart3,
  CheckSquare,
  Calendar,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
  Trash2,
  X,
  Wifi,
  WifiOff,
  Clock,
  Activity,
} from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useBoards } from "../../context/BoardsContext";
import { useAuth } from "../../context/AuthContext";
import { getSocket } from "../../lib/socket";
import Avatar from "../ui/Avatar";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Input } from "../ui/Input";
import ConfirmDialog from "../ui/ConfirmDialog";
import { cn } from "../../lib/utils";

const MONTH_NAMES = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"
];

const SectionLabel = ({ children, collapsed, hideOnCollapsed }) => {
  if (collapsed) {
    return hideOnCollapsed ? null : <div className="mx-auto my-1.5 h-px w-6 bg-line" />;
  }
  return (
    <p className="px-4 pb-1 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-faint">
      {children}
    </p>
  );
};

const NavItem = ({ to, icon: Icon, label, collapsed, badge, animClass, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={({ isActive }) =>
      cn(
        "group relative flex h-9.5 items-center rounded-2xl text-[13.5px] font-medium transition-all duration-200",
        collapsed ? "mx-auto w-9.5 justify-center" : "gap-2.5 px-3",
        isActive
          ? "bg-brand-50 font-semibold text-brand-700 shadow-sm"
          : "text-muted hover:bg-surface-2 hover:text-ink"
      )
    }
  >
    {({ isActive }) => (
      <>
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500 shadow-sm" />
        )}
        <Icon
          className={cn(
            "h-4.5 w-4.5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            isActive ? "text-brand-600" : "text-muted group-hover:text-ink",
            animClass
          )}
        />
        {!collapsed && <span className="flex-1 truncate text-[12.5px] sm:text-[13.5px]">{label}</span>}
        {!collapsed && badge != null && (
          <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10.5px] font-bold tabular text-bg">
            {badge}
          </span>
        )}
      </>
    )}
  </NavLink>
);

const PHASE_ORDER = ["priprema", "print", "izrada", "završen"];

const Sidebar = ({ collapsed, onToggle, onCreateBoard, onCommand, mobileOpen, setMobileOpen }) => {
  const { boards = [], loading, remove, update } = useBoards();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = user?.role === "owner";

  const [boardToDelete, setBoardToDelete] = useState(null);
  const [boardToRename, setBoardToRename] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // Real-time podaci za mobilni view
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [latency, setLatency] = useState(18);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.volatile.emit("ping", () => {
          setLatency(Date.now() - start);
        });
      }
    }, 10000);

    return () => clearInterval(pingInterval);
  }, []);

  const sortedBoards = useMemo(() => {
    return [...boards].sort((a, b) => {
      const titleA = (a.title || "").toLowerCase();
      const titleB = (b.title || "").toLowerCase();

      const indexA = PHASE_ORDER.findIndex((p) => titleA.includes(p));
      const indexB = PHASE_ORDER.findIndex((p) => titleB.includes(p));

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      return (a.position || 0) - (b.position || 0);
    });
  }, [boards]);

  const handleDeleteConfirm = async () => {
    if (!boardToDelete) return;
    if (!isSuperAdmin) {
      toast.error("Samo Super Admin može obrisati fazu rada.");
      setBoardToDelete(null);
      return;
    }

    try {
      await remove(boardToDelete.id);
      if (
        location.pathname === `/rad/${boardToDelete.id}` ||
        location.pathname === `/board/${boardToDelete.id}`
      ) {
        navigate("/pocetna");
      }
      toast.success("Faza rada je obrisana");
    } catch (err) {
      toast.error(err.message || "Greška prilikom brisanja faze rada");
    } finally {
      setBoardToDelete(null);
    }
  };

  const handleOpenRename = (e, b) => {
    e.preventDefault();
    e.stopPropagation();
    setBoardToRename(b);
    setNewTitle(b.title || "");
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean) return toast.error("Naziv faze rada ne može biti prazan");
    if (clean === boardToRename.title) {
      setBoardToRename(null);
      return;
    }

    setSavingRename(true);
    try {
      await update(boardToRename.id, { title: clean });
      toast.success("Naziv faze rada je promijenjen");
      setBoardToRename(null);
    } catch (err) {
      toast.error(err.message || "Greška pri preimenovanju faze rada");
    } finally {
      setSavingRename(false);
    }
  };

  const formattedTime = currentTime.toLocaleTimeString("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const formattedDate = `${currentTime.getDate()}. ${MONTH_NAMES[currentTime.getMonth()]} ${currentTime.getFullYear()}.`;

  const sidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full">
      {/* 1. Header */}
      <div className="flex h-14 sm:h-16 items-center gap-2.5 px-3.5 shrink-0 border-b border-line/40">
        <div className="brand-gradient grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-2xl shadow-[var(--shadow-brand)] transition-transform duration-300 hover:scale-105">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-white"
            aria-hidden="true"
          >
            <path d="M7 3C4.24 3 2 5.24 2 8c0 3.5 1.5 6 3 9.5 1.2 2.8 2.5 3.5 4 3.5s2.3-.8 3-3c.7 2.2 1.5 3 3 3s2.8-.7 4-3.5c1.5-3.5 3-6 3-9.5 0-2.76-2.24-5-5-5-2 0-3.5 1.2-5 1.2S9 3 7 3z" />
          </svg>
        </div>
        {(!collapsed || isMobile) && (
          <span className="flex-1 truncate font-display text-[16.5px] sm:text-[17.5px] font-bold tracking-tight text-ink">
            Kontrolna tabla
          </span>
        )}
        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-faint transition-all duration-200 hover:bg-surface-2 hover:text-ink active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          !collapsed && (
            <button
              type="button"
              onClick={onToggle}
              title="Sakrij bočnu traku"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {collapsed && !isMobile && (
        <div className="flex justify-center pb-1 pt-2 shrink-0">
          <button
            type="button"
            onClick={onToggle}
            title="Proširi bočnu traku"
            className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Skrolabilna unutrašnjost menija */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar px-1 py-1">
        <SectionLabel collapsed={collapsed && !isMobile} hideOnCollapsed={!isMobile}>
          Menu
        </SectionLabel>
        <nav className="space-y-0.5 px-2">
          <NavItem
            to="/pocetna"
            icon={LayoutDashboard}
            label="Početna"
            collapsed={collapsed && !isMobile}
            animClass="group-hover:scale-110 group-hover:-rotate-3"
            onClick={() => isMobile && setMobileOpen(false)}
          />
          <NavItem
            to="/analitika"
            icon={BarChart3}
            label="Analitika"
            collapsed={collapsed && !isMobile}
            animClass="group-hover:scale-110 group-hover:translate-y-[-2px]"
            onClick={() => isMobile && setMobileOpen(false)}
          />
          <NavItem
            to="/pacijenti"
            icon={CheckSquare}
            label="Pacijenti"
            collapsed={collapsed && !isMobile}
            animClass="group-hover:scale-115 group-hover:rotate-6"
            onClick={() => isMobile && setMobileOpen(false)}
          />
          <NavItem
            to="/arhiva"
            icon={Archive}
            label="Arhiva"
            collapsed={collapsed && !isMobile}
            animClass="group-hover:-translate-y-1 group-hover:scale-105"
            onClick={() => isMobile && setMobileOpen(false)}
          />
          <NavItem
            to="/kalendar"
            icon={Calendar}
            label="Kalendar"
            collapsed={collapsed && !isMobile}
            animClass="group-hover:scale-110 group-hover:rotate-12"
            onClick={() => isMobile && setMobileOpen(false)}
          />
          <NavItem
            to="/zaposleni"
            icon={Users}
            label="Zaposleni"
            collapsed={collapsed && !isMobile}
            animClass="group-hover:scale-110 group-hover:translate-x-0.5"
            onClick={() => isMobile && setMobileOpen(false)}
          />
        </nav>

        <div className="mx-auto my-1.5 h-px w-6 bg-line/60" />

        {/* Brzi pregled radova */}
        <div
          className={cn(
            "group/quick flex h-7.5 items-center rounded-2xl font-medium text-muted transition-colors duration-200",
            collapsed && !isMobile ? "hidden" : "px-3"
          )}
        >
          {(!collapsed || isMobile) && (
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 fill-none stroke-brand-600 transition-transform duration-300 group-hover/quick:scale-125 group-hover/quick:rotate-12" />
              <span className="text-[10.5px] sm:text-[11.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                Brzi Pregled Radova
              </span>
            </div>
          )}
        </div>

        {/* Lista faza rada */}
        <div className="mt-0.5 space-y-0.5 px-2 pb-1 max-h-36 sm:max-h-44 overflow-y-auto no-scrollbar">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("flex h-8.5 items-center gap-3", collapsed && !isMobile ? "justify-center" : "px-1")}>
                <div className="skeleton h-4.5 w-4.5 shrink-0 rounded-lg" />
                {(!collapsed || isMobile) && <div className="skeleton h-3 flex-1 rounded" />}
              </div>
            ))
          ) : sortedBoards.length === 0 ? (
            (!collapsed || isMobile) && <p className="px-3 py-1 text-[11.5px] text-faint">Nemate još faza rada</p>
          ) : (
            sortedBoards.map((b) => {
              const color = b.color || "#2f8159";
              return (
                <div
                  key={b.id}
                  className="group/board relative flex h-8.5 w-full items-center rounded-2xl transition-colors duration-200 hover:bg-surface-2"
                >
                  <NavLink
                    to={`/rad/${b.id}`}
                    onClick={() => isMobile && setMobileOpen(false)}
                    title={b.title}
                    className={({ isActive }) =>
                      cn(
                        "flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-2xl text-[12.5px] sm:text-[13.5px] transition-colors",
                        collapsed && !isMobile ? "justify-center px-0" : "pl-2 pr-1",
                        isActive ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:text-ink"
                      )
                    }
                  >
                    {collapsed && !isMobile ? (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm transition-transform duration-200 group-hover/board:scale-125"
                        style={{ backgroundColor: color }}
                      />
                    ) : (
                      <span
                        className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-lg border shadow-sm transition-transform duration-200 group-hover/board:scale-110"
                        style={{
                          backgroundColor: `${color}20`,
                          borderColor: `${color}40`,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-sm"
                          style={{ backgroundColor: color }}
                        />
                      </span>
                    )}

                    {(!collapsed || isMobile) && (
                      <span className="min-w-0 flex-1 truncate">{b.title}</span>
                    )}
                  </NavLink>

                  {(!collapsed || isMobile) && (
                    <div className="flex w-12 shrink-0 items-center justify-end pr-1.5">
                      <span className="text-right text-[10.5px] font-semibold tabular text-faint group-hover/board:hidden">
                        {b.task_count ?? 0}
                      </span>

                      <div className="hidden items-center gap-1 group-hover/board:flex">
                        <button
                          type="button"
                          onClick={(e) => handleOpenRename(e, b)}
                          title="Izmijenite naziv"
                          className="flex h-5 w-5 items-center justify-center rounded-lg p-0.5 text-faint transition-all hover:bg-surface hover:text-ink hover:scale-110"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setBoardToDelete(b);
                            }}
                            title="Obrišite fazu rada"
                            className="flex h-5 w-5 items-center justify-center rounded-lg p-0.5 text-faint transition-all hover:bg-priority-urgent/10 hover:text-priority-urgent hover:scale-110"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mx-auto my-1.5 h-px w-6 bg-line/60" />

        <SectionLabel collapsed={collapsed && !isMobile} hideOnCollapsed={!isMobile}>
          Generalne opcije
        </SectionLabel>
        <nav className="space-y-0.5 px-2">
          <NavItem
            to="/podesavanja"
            icon={Settings}
            label="Podešavanja"
            collapsed={collapsed && !isMobile}
            animClass="group-hover:rotate-45 group-hover:scale-110"
            onClick={() => isMobile && setMobileOpen(false)}
          />
          <button
            type="button"
            onClick={() => {
              if (isMobile) setMobileOpen(false);
              onCommand?.();
            }}
            title={collapsed && !isMobile ? "Pretraga & prečice" : undefined}
            className={cn(
              "group flex h-9.5 w-full items-center rounded-2xl text-[12.5px] sm:text-[13.5px] font-medium text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink",
              collapsed && !isMobile ? "mx-auto w-9.5 justify-center" : "gap-2.5 px-3"
            )}
          >
            <HelpCircle className="h-4.5 w-4.5 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
            {(!collapsed || isMobile) && <span className="flex-1 truncate text-left">Pomoć & pretraga</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/prijava");
            }}
            title={collapsed && !isMobile ? "Odjavi se" : undefined}
            className={cn(
              "group flex h-9.5 w-full items-center rounded-2xl text-[12.5px] sm:text-[13.5px] font-medium text-muted transition-colors duration-200 hover:bg-priority-urgent/10 hover:text-priority-urgent",
              collapsed && !isMobile ? "mx-auto w-9.5 justify-center" : "gap-2.5 px-3"
            )}
          >
            <LogOut className="h-4.5 w-4.5 shrink-0 transition-transform duration-300 group-hover:-translate-x-1 group-hover:scale-105" />
            {(!collapsed || isMobile) && <span className="flex-1 truncate text-left">Odjavite se</span>}
          </button>
        </nav>
      </div>

      {/* 3. Donji blok: Uvijek priljubljen */}
      <div className="border-t border-line/60 p-2 sm:p-2.5 shrink-0 space-y-1.5 bg-surface mt-1">
        <div
          onClick={() => {
            if (isMobile) setMobileOpen(false);
            navigate("/podesavanja");
          }}
          className={cn(
            "flex h-10 cursor-pointer items-center rounded-2xl transition-all duration-200 hover:bg-surface-2",
            collapsed && !isMobile ? "justify-center px-1" : "gap-2.5 px-2"
          )}
        >
          <Avatar
            name={user?.name}
            id={user?.id}
            src={user?.avatar_url}
            size="sm"
            className="shrink-0 transition-transform duration-200 hover:scale-105"
          />
          {(!collapsed || isMobile) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-ink leading-tight">{user?.name}</p>
              <p className="truncate text-[10.5px] text-faint mt-0.5">{user?.email}</p>
            </div>
          )}
        </div>

        {isMobile && (
          <div className="rounded-2xl border border-line/80 bg-surface-2/60 p-2 shadow-sm space-y-1.5">
            <div className="flex items-center justify-between border-b border-line/50 pb-1">
              <div className="flex items-center gap-1.5 text-ink">
                <Clock className="h-3 w-3 text-brand-600 animate-pulse" />
                <span className="font-mono text-[11.5px] font-bold tracking-tight tabular">
                  {formattedTime}
                </span>
              </div>
              <span className="text-[10.5px] font-semibold text-ink/80">
                {formattedDate}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10.5px]">
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <>
                    <Wifi className="h-3 w-3 text-emerald-500" />
                    <span className="font-medium text-ink">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-rose-500" />
                    <span className="font-medium text-rose-600">Offline</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1 font-mono text-[9.5px] text-muted">
                <Activity className="h-2.5 w-2.5 text-brand-600" />
                <span>{isOnline ? `${latency}ms` : "--"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed top-3 left-3 z-45 hidden md:flex flex-col rounded-3xl border border-line bg-surface/90 shadow-soft backdrop-blur-xl transition-[width] duration-300 ease-[var(--ease-spring)] select-none max-h-[calc(100vh-24px)] overflow-hidden",
          collapsed ? "w-[72px]" : "w-[252px]"
        )}
      >
        {sidebarContent(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex items-start md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-[285px] h-auto max-h-[calc(100dvh-24px)] mt-3 ml-2 flex-col rounded-3xl border border-line bg-surface shadow-2xl z-10 animate-in slide-in-from-left duration-300 ease-out overflow-hidden">
            {sidebarContent(true)}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(boardToRename)}
        onClose={() => !savingRename && setBoardToRename(null)}
        title="Promjena naziva"
        description="Unesite novi naziv za ovu fazu rada."
      >
        <form onSubmit={handleRenameSubmit} className="space-y-4">
          <Input
            label="Naziv faze rada"
            value={newTitle}
            disabled={savingRename}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Npr. Cirkonijumske krunice"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={savingRename}
              onClick={() => setBoardToRename(null)}
            >
              Odustani
            </Button>
            <Button type="submit" loading={savingRename}>
              Sačuvajte izmjene
            </Button>
          </div>
        </form>
      </Modal>

      {isSuperAdmin && (
        <ConfirmDialog
          open={Boolean(boardToDelete)}
          onClose={() => setBoardToDelete(null)}
          onConfirm={handleDeleteConfirm}
          title="Da li ste sigurni?"
          description={`“${boardToDelete?.title}” i svi vezani podaci biće trajno obrisani.`}
          confirmLabel="Obriši"
          danger
        />
      )}
    </>
  );
};

export default Sidebar;