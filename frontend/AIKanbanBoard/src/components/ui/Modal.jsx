import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

const widths = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-150">
      {/* Pozadinski sloj */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
      />

      {/* Sadržaj modala - čista CSS animacija bez framer-motion konflikta */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "card relative z-10 my-auto w-full rounded-3xl p-6 shadow-[var(--shadow-lift)] border border-line bg-surface select-text",
          "animate-in zoom-in-95 slide-in-from-bottom-2 duration-150 ease-out",
          widths[size] || widths.md
        )}
      >
        {(title || onClose) && (
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {title && (
                <div className="font-display text-lg font-bold tracking-tight text-ink">
                  {title}
                </div>
              )}
              {description && (
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Zatvori prozor"
                className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-ink active:scale-90"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
        )}

        {children}

        {footer && (
          <div className="mt-6 flex justify-end gap-2 border-t border-line/60 pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;