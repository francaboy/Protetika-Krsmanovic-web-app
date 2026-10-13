import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const labelCls = "block text-xs font-semibold tracking-tight text-ink select-none";

export const Input = forwardRef(
  ({ label, error, className, id, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className={labelCls}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={cn(
            "input-base w-full rounded-full transition-all duration-200",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "!border-priority-urgent focus:!ring-priority-urgent/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] font-medium text-priority-urgent">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export const Textarea = forwardRef(
  ({ label, error, className, id, rows = 4, disabled, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={textareaId} className={labelCls}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={cn(
            "input-base w-full resize-none rounded-2xl transition-all duration-200",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "!border-priority-urgent focus:!ring-priority-urgent/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] font-medium text-priority-urgent">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export const Select = forwardRef(
  ({ label, error, className, id, disabled, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className={labelCls}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={cn(
              "input-base w-full cursor-pointer appearance-none rounded-full pr-10 transition-all duration-200",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "!border-priority-urgent focus:!ring-priority-urgent/20",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        </div>
        {error && <p className="text-[11px] font-medium text-priority-urgent">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

export const FilterSelect = forwardRef(
  ({ className, disabled, children, ...props }, ref) => (
    <div className="relative inline-block">
      <select
        ref={ref}
        disabled={disabled}
        className={cn(
          "h-9 cursor-pointer appearance-none rounded-full border border-line bg-surface pl-4 pr-9 text-xs font-medium text-ink shadow-[var(--shadow-card)] outline-none transition-all duration-200",
          "hover:border-brand-500/40 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
    </div>
  )
);

FilterSelect.displayName = "FilterSelect";