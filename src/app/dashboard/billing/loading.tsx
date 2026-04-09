import { Skeleton } from "@/components/ui/Skeleton";

export default function BillingLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Skeleton variant="stat" count={3} />
      <Skeleton className="h-48 w-full rounded-2xl bg-white/[0.04] animate-pulse" />
    </div>
  );
}
