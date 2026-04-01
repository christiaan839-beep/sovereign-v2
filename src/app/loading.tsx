export default function Loading() {
  return (
    <div className="min-h-screen bg-[#010101] flex flex-col items-center justify-center gap-6">
      {/* Animated logo mark */}
      <div className="relative">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <div className="w-4 h-4 rounded-md bg-emerald-500/40 animate-pulse" />
        </div>
        {/* Orbiting dot */}
        <div className="absolute -inset-3 animate-spin" style={{ animationDuration: "3s" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold text-white">Sovereign Matrix</span>
        <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Initializing agents</span>
      </div>
    </div>
  );
}
