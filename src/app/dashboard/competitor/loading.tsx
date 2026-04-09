import { Skeleton } from "@/components/ui/Skeleton";

export default function CompetitorLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-10 w-56" />
      <Skeleton variant="card" count={4} />
      <Skeleton className="h-48 w-full rounded-2xl bg-white/[0.04] animate-pulse" />
    </div>
  );
}
