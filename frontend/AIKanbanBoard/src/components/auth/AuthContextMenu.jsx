import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  LogIn,
  UserPlus,
  KeyRound,
  RefreshCw,
} from "lucide-react";

export const AuthContextMenu = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const openAt = useCallback((clientX, clientY) => {
    // Blokiraj prikaz na touch uređajima (telefon/tablet)
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const menuWidth = 230;
    const menuHeight = 160;
    let x = clientX;
    let y = clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 12;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 12;
    }

    setMenu({ x, y });
  }, []);

  useEffect(() => {
    const handleContextMenu = (e) => {
      if (e.shiftKey) return;
      if (window.matchMedia("(pointer: coarse)").matches) return;

      e.preventDefault();
      openAt(e.clientX, e.clientY);
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
    };
  }, [closeMenu, openAt]);

  const handleForgotPassword = () => {
    closeMenu();
    toast("Za resetovanje lozinke obratite se administratoru ordinacije.", {
      icon: "🔑",
      duration: 5000,
    });
  };

  return (
    <>
      {children}

      {menu && (
        <div
          ref={menuRef}
          style={{ top: `${menu.y}px`, left: `${menu.x}px` }}
          className="fixed z-[99999] w-56 animate-in fade-in zoom-in-95 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-[var(--shadow-lift)] backdrop-blur-xl duration-150 select-none"
        >
          {/* 1. Prebaci na Registraciju / Prijavu */}
          <button
            type="button"
            onClick={() => {
              closeMenu();
              navigate(isLoginPage ? "/register" : "/login");
            }}
            className="group/item flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            {isLoginPage ? (
              <UserPlus className="h-3.5 w-3.5 text-muted group-hover/item:text-brand-600" />
            ) : (
              <LogIn className="h-3.5 w-3.5 text-muted group-hover/item:text-brand-600" />
            )}
            <span>{isLoginPage ? "Prebaci na Registraciju" : "Prebaci na Prijavu"}</span>
          </button>

          {/* 2. Zaboravljena lozinka? */}
          <button
            type="button"
            onClick={handleForgotPassword}
            className="group/item flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            <KeyRound className="h-3.5 w-3.5 text-muted group-hover/item:text-brand-600" />
            <span>Zaboravljena lozinka?</span>
          </button>

          <div className="my-1 border-t border-line/60" />

          {/* 3. Osvježi stranicu */}
          <button
            type="button"
            onClick={() => {
              closeMenu();
              window.location.reload();
            }}
            className="group/item flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted group-hover/item:text-brand-600" />
            <span>Osvježi stranicu</span>
          </button>
        </div>
      )}
    </>
  );
};