import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ExternalLink,
  RefreshCw,
  Search,
  Plus,
  Settings as SettingsIcon,
  ArrowUpDown,
  ChevronRight,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  UserX,
  ArrowRightLeft,
  Trash2,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { useBoards } from "./BoardsContext";
import { cn } from "../lib/utils";
import { boardApi, taskApi } from "../lib/api";

const ContextMenuCtx = createContext(null);

const PHASE_ORDER = [
  "priprema",
  "print",
  "izrada",
  "frezovanj",
  "slojevanj",
  "završ",
  "isporuk",
];

const EXACT_STAGES = [
  { match: "priprem", dot: "#ef4444" },
  { match: "print", dot: "#f59e0b" },
  { match: "izrad", dot: "#0ea5e9" },
  { match: "zavr", dot: "#8b5cf6" },
];

const getStageDot = (title = "") => {
  const t = (title || "").toLowerCase();
  const matched = EXACT_STAGES.find((s) => t.includes(s.match));
  return matched ? matched.dot : "#10b981";
};

export const ContextMenuProvider = ({ children, onNewTask, onNewBoard, onOpenCommand }) => {
  const { user } = useAuth();
  const { boards = [] } = useBoards();
  const navigate = useNavigate();
  const location = useLocation();

  const [menu, setMenu] = useState(null);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const menuRef = useRef(null);
  const clickableTargetRef = useRef(null);
  const submenuTimerRef = useRef(null);

  const sortedBoards = useMemo(() => {
    return [...(boards || [])].sort((a, b) => {
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

  const closeMenu = useCallback(() => {
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
    setMenu(null);
    setActiveSubmenu(null);
    clickableTargetRef.current = null;
  }, []);

  const handleSubmenuEnter = (type) => {
    if (submenuTimerRef.current) {
      clearTimeout(submenuTimerRef.current);
      submenuTimerRef.current = null;
    }
    setActiveSubmenu(type);
  };

  const handleSubmenuLeave = () => {
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
    submenuTimerRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 180);
  };

  const currentPath = location.pathname;
  const isBoardPage = currentPath.startsWith("/board/") || currentPath.startsWith("/rad/");
  const isArchivePage = currentPath.includes("arhiva") || currentPath.includes("archive");
  const isTeamPage = currentPath === "/zaposleni" || currentPath === "/team";

  const canDelete = user?.role === "owner" || user?.role === "admin";

  useEffect(() => {
    const handleContextMenu = (e) => {
      if (e.shiftKey) return;
      e.preventDefault();

      const clickable = e.target.closest("a, button, [role='button'], [data-context-type='task'], tr");
      clickableTargetRef.current = clickable || null;

      const taskEl = e.target.closest("[data-context-type='task']");
      let taskData = null;
      if (taskEl) {
        try {
          taskData = JSON.parse(taskEl.getAttribute("data-context-data") || "{}");
        } catch {
          taskData = null;
        }
      }

      const memberEl = e.target.closest(
        "[data-member-id], [data-user-id], [data-member], [data-id], tr[data-id], .member-card, .team-member"
      );
      let memberData = null;

      if (memberEl) {
        const id =
          memberEl.getAttribute("data-member-id") ||
          memberEl.getAttribute("data-user-id") ||
          memberEl.getAttribute("data-id") ||
          memberEl.id;

        const name =
          memberEl.getAttribute("data-member-name") ||
          memberEl.getAttribute("data-name") ||
          memberEl.querySelector("h3, h4, .font-semibold, .font-bold")?.textContent?.trim() ||
          "zaposlenog";

        const role = memberEl.getAttribute("data-member-role") || null;
        const boardId = memberEl.getAttribute("data-board-id") || null;

        if (id) {
          memberData = { id, name, role, boardId };
        }
      }

      const menuWidth = 230;
      const menuHeight = 380;
      let x = e.clientX;
      let y = e.clientY;

      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 12;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 12;
      }

      setActiveSubmenu(null);
      setMenu({
        x,
        y,
        hasClickable: Boolean(clickable),
        taskData,
        memberData,
      });
    };

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") closeMenu();
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
      if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
    };
  }, [closeMenu]);

  const handleOpenClickable = () => {
    const el = clickableTargetRef.current;
    closeMenu();
    if (el) {
      el.click();
    } else {
      toast("Nema elementa za otvaranje", { icon: "ℹ️" });
    }
  };

  const handleSortBoard = (sortType) => {
    closeMenu();
    window.dispatchEvent(
      new CustomEvent("app:board:sort", {
        detail: { sortType },
      })
    );
  };

  const handleMoveToStage = async (task, targetBoard) => {
    closeMenu();
    if (!task?.id || !targetBoard?.id) return;

    if (String(task.board_id) === String(targetBoard.id)) {
      toast("Pacijent se već nalazi u ovoj fazi rada", { icon: "ℹ️" });
      return;
    }

    try {
      await taskApi.update(task.board_id || targetBoard.id, task.id, {
        target_board_id: targetBoard.id,
      });

      toast.success(`Pacijent „${task.title}“ je prebačen u: ${targetBoard.title}`);
    } catch (err) {
      toast.error(err.message || "Greška pri prebacivanju u drugu fazu rada");
    }
  };

  const handleDeleteTask = (task) => {
    closeMenu();
    window.dispatchEvent(
      new CustomEvent("app:task:delete", {
        detail: { task },
      })
    );
  };

  const handleDeleteMember = async (memberData) => {
    closeMenu();
    if (!memberData?.id) {
      toast.error("Desnim klikom kliknite direktno na red ili karticu radnika");
      return;
    }

    window.dispatchEvent(
      new CustomEvent("app:team:delete-member", {
        detail: { member: memberData },
      })
    );

    if (memberData.boardId) {
      try {
        await boardApi.removeMember(memberData.boardId, memberData.id);
        toast.success(`Zaposleni ${memberData.name} je uklonjen`);
      } catch (err) {
        toast.error(err.message || "Greška pri brisanju zaposlenog");
      }
    }
  };

  return (
    <ContextMenuCtx.Provider value={{ closeMenu }}>
      {children}

      {menu && (
        <div
          ref={menuRef}
          style={{ top: `${menu.y}px`, left: `${menu.x}px` }}
          className="fixed z-[99999] w-56 animate-in fade-in zoom-in-95 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-[var(--shadow-lift)] backdrop-blur-xl duration-150 select-none"
        >
          {/* 1. OTVORI */}
          <button
            type="button"
            disabled={!menu.hasClickable}
            onClick={handleOpenClickable}
            className={cn(
              "group/item mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-150",
              !menu.hasClickable
                ? "cursor-not-allowed opacity-40 bg-surface-2 text-muted"
                : "bg-brand-50 text-brand-700 border border-brand-500/20 shadow-sm hover:bg-surface-2 hover:text-ink hover:border-transparent hover:font-medium"
            )}
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5 text-brand-600 transition-colors group-hover/item:text-muted" />
              <span>Otvori</span>
            </div>
            <span className="text-[10px] opacity-75 group-hover/item:text-faint">↵</span>
          </button>

          {/* 2. SORTIRANJE */}
          {isBoardPage && (
            <div
              className="relative"
              onMouseEnter={() => handleSubmenuEnter("sort")}
              onMouseLeave={handleSubmenuLeave}
            >
              <div
                className={cn(
                  "group/item flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors",
                  activeSubmenu === "sort"
                    ? "bg-brand-50 text-brand-700 font-semibold"
                    : "text-ink hover:bg-brand-50 hover:text-brand-700"
                )}
              >
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted group-hover/item:text-brand-600" />
                  <span>Sortiranje</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-faint" />
              </div>

              {activeSubmenu === "sort" && (
                <div
                  onMouseEnter={() => handleSubmenuEnter("sort")}
                  onMouseLeave={handleSubmenuLeave}
                  className="absolute left-full -top-1 ml-1.5 w-52 rounded-2xl border border-line bg-surface/98 p-1 shadow-[var(--shadow-lift)] backdrop-blur-xl animate-in fade-in slide-in-from-left-2 duration-150 before:absolute before:-left-3 before:top-0 before:h-full before:w-3"
                >
                  <SubmenuItem
                    icon={CalendarArrowDown}
                    label="Najnovije prvo"
                    onClick={() => handleSortBoard("date-desc")}
                  />
                  <SubmenuItem
                    icon={CalendarArrowUp}
                    label="Najstarije prvo"
                    onClick={() => handleSortBoard("date-asc")}
                  />
                  <div className="my-1 border-t border-line/60" />
                  <SubmenuItem
                    icon={ArrowDownAZ}
                    label="Naziv (A → Z)"
                    onClick={() => handleSortBoard("name-asc")}
                  />
                  <SubmenuItem
                    icon={ArrowUpAZ}
                    label="Naziv (Z → A)"
                    onClick={() => handleSortBoard("name-desc")}
                  />
                </div>
              )}
            </div>
          )}

          {/* 3. OSVJEŽI */}
          <MenuItem
            icon={RefreshCw}
            label="Osvježi"
            onClick={() => {
              closeMenu();
              window.location.reload();
            }}
          />

          {/* 4. PREBACI U FAZU */}
          {menu.taskData && sortedBoards.length > 0 && (
            <div
              className="relative"
              onMouseEnter={() => handleSubmenuEnter("move")}
              onMouseLeave={handleSubmenuLeave}
            >
              <div
                className={cn(
                  "group/item flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors",
                  activeSubmenu === "move"
                    ? "bg-brand-50 text-brand-700 font-semibold"
                    : "text-ink hover:bg-brand-50 hover:text-brand-700"
                )}
              >
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted group-hover/item:text-brand-600" />
                  <span>Prebaci u fazu</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-faint" />
              </div>

              {activeSubmenu === "move" && (
                <div
                  onMouseEnter={() => handleSubmenuEnter("move")}
                  onMouseLeave={handleSubmenuLeave}
                  className="absolute left-full -top-1 ml-1.5 w-56 rounded-2xl border border-line bg-surface/98 p-1 shadow-[var(--shadow-lift)] backdrop-blur-xl animate-in fade-in slide-in-from-left-2 duration-150 before:absolute before:-left-3 before:top-0 before:h-full before:w-3"
                >
                  {sortedBoards.map((b) => {
                    const dotColor = getStageDot(b.title);
                    const isCurrent = String(b.id) === String(menu.taskData?.board_id);

                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleMoveToStage(menu.taskData, b)}
                        className={cn(
                          "group/sub flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors text-left",
                          isCurrent
                            ? "bg-surface-2 text-muted opacity-60 cursor-default"
                            : "text-ink hover:bg-brand-50 hover:text-brand-700 active:scale-[0.98]"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="h-2 w-2 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className="truncate">{b.title}</span>
                        </div>
                        {isCurrent && <span className="text-[10px] text-faint">(trenutna)</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5. PRETRAGA */}
          <MenuItem
            icon={Search}
            label="Pretraga"
            shortcut="⌘K"
            onClick={() => {
              closeMenu();
              onOpenCommand?.();
            }}
          />

          {/* 6. NOVI PACIJENT */}
          <MenuItem
            icon={Plus}
            label="Novi pacijent"
            color="text-brand-600"
            onClick={() => {
              closeMenu();
              onNewTask?.();
            }}
          />

          {/* 7. BRISANJE PACIJENTA */}
          {(isBoardPage || isArchivePage) && menu.taskData && canDelete && (
            <>
              <div className="my-1 border-t border-line/60" />
              <MenuItem
                icon={Trash2}
                label={isArchivePage ? "Trajno obriši pacijenta" : "Obriši pacijenta"}
                danger
                onClick={() => handleDeleteTask(menu.taskData)}
              />
            </>
          )}

          {/* 8. BRISANJE ZAPOSLENOG */}
          {isTeamPage && menu.memberData && canDelete && menu.memberData.role !== "owner" && (
            <>
              <div className="my-1 border-t border-line/60" />
              <MenuItem
                icon={UserX}
                label={menu.memberData?.name ? `Obriši ${menu.memberData.name}` : "Obriši zaposlenog"}
                danger
                onClick={() => handleDeleteMember(menu.memberData)}
              />
            </>
          )}

          <div className="my-1 border-t border-line/60" />

          {/* 9. PODEŠAVANJA */}
          <MenuItem
            icon={SettingsIcon}
            label="Podešavanja"
            onClick={() => {
              closeMenu();
              navigate("/podesavanja");
            }}
          />
        </div>
      )}
    </ContextMenuCtx.Provider>
  );
};

const MenuItem = ({ icon: Icon, label, shortcut, color, danger, disabled, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "group/item flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors",
      disabled && "opacity-40 cursor-not-allowed hover:bg-transparent text-muted",
      !disabled && danger && "text-priority-urgent hover:bg-priority-urgent/10 hover:text-priority-urgent",
      !disabled && !danger && "text-ink hover:bg-brand-50 hover:text-brand-700"
    )}
  >
    <div className="flex items-center gap-2">
      <Icon
        className={cn(
          "h-3.5 w-3.5 transition-colors",
          disabled
            ? "text-faint"
            : danger
            ? "text-priority-urgent"
            : color || "text-muted group-hover/item:text-brand-600"
        )}
      />
      <span>{label}</span>
    </div>
    {shortcut && (
      <span className="text-[10px] font-semibold text-faint group-hover/item:text-brand-600">
        {shortcut}
      </span>
    )}
  </button>
);

const SubmenuItem = ({ icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group/sub flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-700 text-left"
  >
    {Icon && <Icon className="h-3.5 w-3.5 text-muted group-hover/sub:text-brand-600" />}
    <span className="truncate">{label}</span>
  </button>
);