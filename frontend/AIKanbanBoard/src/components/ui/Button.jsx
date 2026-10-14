import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const variants = {
  primary:
    "brand-gradient text-white hover:brightness-[1.07] hover:shadow-[0_14px_34px_rgba(36,102,70,0.45)]",
  secondary:
    "bg-surface hover:bg-surface-2 text-ink border border-line shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-soft)]",
  ghost: "hover:bg-surface-2 text-muted hover:text-ink",
  danger:
    "bg-priority-urgent text-white shadow-[0_8px_20px_rgba(225,29,72,0.28)] hover:brightness-[1.06]",
  outline:
    "border border-line bg-surface hover:border-brand-500/40 hover:bg-surface-2 text-ink shadow-[var(--shadow-card)]",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100/80 border border-brand-500/20",
};

const sizes = {
  sm: "h-8 px-3.5 text-xs gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-[15px] gap-2",
  icon: "h-10 w-10 p-0",
  iconSm: "h-8 w-8 p-0",
};

const loaderSizes = {
  sm: "h-3.5 w-3.5",
  iconSm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  icon: "h-4 w-4",
  lg: "h-4.5 w-4.5",
};

const Button = forwardRef(
  (
    {
      children,
      type = "button",
      variant = "primary",
      size = "md",
      loading = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isIconButton = size === "icon" || size === "iconSm";

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold transition-all duration-200 ease-[var(--ease-spring)] focus-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]",
          variants[variant] || variants.primary,
          sizes[size] || sizes.md,
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2
              className={cn(
                "animate-spin shrink-0",
                loaderSizes[size] || "h-4 w-4"
              )}
            />
            {!isIconButton && children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;