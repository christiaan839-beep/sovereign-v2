import { Skeleton } from "@/components/ui/Skeleton";

export default function InboxLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-10 w-32" />
      <Skeleton variant="card" count={8} />
    </div>
  );
}
