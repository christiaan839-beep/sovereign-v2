import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Dashboard Loading State — shows shimmer skeleton while page loads.
 * This is a Next.js convention that automatically wraps pages in Suspense.
 */
export default function DashboardLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Skeleton variant="stat" count={4} />
      <Skeleton variant="card" count={4} />
    </div>
  );
}
