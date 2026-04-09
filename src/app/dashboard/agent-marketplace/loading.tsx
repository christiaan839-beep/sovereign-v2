import { Skeleton } from "@/components/ui/Skeleton";

export default function AgentMarketplaceLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-full rounded-xl bg-white/[0.04] animate-pulse" />
      <Skeleton variant="card" count={8} />
    </div>
  );
}
