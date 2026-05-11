/**
 * Root loading state — shown during page transitions before any
 * route-specific loading.tsx is found. System surface, so it follows
 * the brand-colors rule and uses cyan (audit/infrastructure), not
 * copper. See docs/design-system/brand-colors.md.
 *
 * The orbiting dot + pulsing core is intentionally low-motion so it
 * doesn't trigger animation fatigue on slow networks where the
 * skeleton is on screen for a few seconds.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#010101] flex flex-col items-center justify-center gap-6">
      {/* Cyan glow blob — sets the audit-grade tone */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-cyan-500/[0.04] rounded-full blur-[140px]" />
      </div>

      {/* Animated mark — cyan core, orbiting dot */}
      <div className="relative">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
          <div className="w-4 h-4 rounded-md bg-cyan-400/50 animate-pulse" />
        </div>
        <div
          className="absolute -inset-3 animate-spin motion-reduce:animate-none"
          style={{ animationDuration: "3s" }}
          aria-hidden="true"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(0,183,255,0.65)]" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 relative z-10">
        <span className="text-sm font-semibold text-white tracking-tight">
          Sovereign Matrix
        </span>
        <span className="text-[10px] font-mono text-cyan-300/70 uppercase tracking-[0.22em]">
          Verifying session
        </span>
      </div>
    </div>
  );
}
