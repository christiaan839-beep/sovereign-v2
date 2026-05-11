/**
 * Skeleton — Reusable loading placeholder.
 * Matches dashboard dark theme. Animates with pulse.
 *
 * Usage:
 *   <Skeleton className="h-8 w-32" />
 *   <Skeleton variant="card" />
 *   <Skeleton variant="stat" count={4} />
 */

interface SkeletonProps {
  className?: string;
  variant?: "line" | "card" | "stat" | "circle";
  count?: number;
}

function SkeletonLine({ className = "h-4 w-full" }: { className?: string }) {
  return (
    <div className={`bg-white/[0.04] rounded animate-pulse ${className}`} />
  );
}

function SkeletonCard() {
  return (
    <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse">
      <SkeletonLine className="h-3 w-8 mb-3" />
      <SkeletonLine className="h-6 w-12 mb-2" />
      <SkeletonLine className="h-2 w-16" />
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse">
      <SkeletonLine className="h-3 w-6 mb-3" />
      <SkeletonLine className="h-7 w-14 mb-1" />
      <SkeletonLine className="h-2 w-20" />
    </div>
  );
}

export function Skeleton({
  className,
  variant = "line",
  count = 1,
}: SkeletonProps) {
  if (variant === "card") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  if (variant === "stat") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonStat key={i} />
        ))}
      </div>
    );
  }
  return <SkeletonLine className={className} />;
}
