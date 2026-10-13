import { cn } from "../../lib/utils";

export const Skeleton = ({ className, ...props }) => (
  <div
    className={cn(
      "skeleton animate-pulse rounded-md bg-line/60 transition-colors",
      className
    )}
    {...props}
  />
);

export const BoardCardSkeleton = () => (
  <div className="card space-y-3 rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
    <div className="flex items-center gap-2.5">
      <Skeleton className="h-6 w-6 rounded-lg" />
      <Skeleton className="h-4 w-1/2 rounded" />
    </div>
    <Skeleton className="h-3 w-full rounded" />
    <Skeleton className="h-3 w-4/5 rounded" />
    <div className="flex items-center justify-between border-t border-line/60 pt-3">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-6 w-6 rounded-full" />
    </div>
  </div>
);

export const ColumnSkeleton = () => (
  <div className="w-[330px] shrink-0 space-y-3 rounded-2xl bg-surface-2/40 p-2.5">
    <div className="flex items-center justify-between px-1.5 pt-1">
      <div className="flex items-center gap-2">
        <Skeleton className="h-2.5 w-2.5 rounded-full" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
      <Skeleton className="h-4 w-6 rounded-full" />
    </div>

    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-4 rounded-md" />
        </div>
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <div className="flex items-center justify-between border-t border-line/60 pt-2.5">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

export const PatientRowSkeleton = () => (
  <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-3.5">
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="space-y-1.5 flex-1 min-w-0">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-3 w-1/4 rounded" />
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  </div>
);

export default Skeleton;