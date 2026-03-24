export default function Loading() {
  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-sm text-neutral-500 font-medium">Loading...</span>
      </div>
    </div>
  );
}
