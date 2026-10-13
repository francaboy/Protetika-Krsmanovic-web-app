import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const sizeMap = {
  sm: { icon: "h-4 w-4", text: "text-xs" },
  md: { icon: "h-6 w-6", text: "text-sm" },
  lg: { icon: "h-9 w-9", text: "text-base" },
};

const Spinner = ({
  size = "md",
  label,
  className,
  iconClassName,
  ...props
}) => {
  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 text-muted select-none",
        className
      )}
      {...props}
    >
      <Loader2
        className={cn(
          "animate-spin text-brand-600 shrink-0",
          currentSize.icon,
          iconClassName
        )}
      />
      {label && (
        <p className={cn("font-medium text-muted", currentSize.text)}>
          {label}
        </p>
      )}
      <span className="sr-only">{label || "Učitavanje..."}</span>
    </div>
  );
};

export const FullScreenSpinner = ({ label = "Učitavanje aplikacije…" }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
    <Spinner size="lg" label={label} />
  </div>
);

export default Spinner;