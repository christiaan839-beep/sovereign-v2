"use client";

/**
 * SOVEREIGN MATRIX — Immersive Background Layer
 *
 * Uses CSS-only effects for instant load and smooth performance:
 * - Emerald radial glow pulses
 * - Animated grid overlay (circuit aesthetic)
 * - Subtle floating particles via CSS animation
 * - Zero WebGL — instant load, works on all devices
 */

export function ImmersiveNodeLayer() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Deep black base */}
      <div className="absolute inset-0 bg-black" />

      {/* Central emerald glow — mimics the logo's core light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/[0.07] blur-[200px] animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-[400px] h-[400px] rounded-full bg-emerald-400/[0.05] blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />

      {/* Secondary glow spots */}
      <div className="absolute top-[20%] left-[15%] w-[300px] h-[300px] rounded-full bg-emerald-600/[0.04] blur-[150px]" />
      <div className="absolute bottom-[15%] right-[10%] w-[350px] h-[350px] rounded-full bg-teal-500/[0.03] blur-[160px]" />

      {/* Animated circuit grid overlay */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `
          linear-gradient(rgba(16,185,129,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(16,185,129,0.3) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        animation: 'gridScroll 20s linear infinite',
      }} />

      {/* Finer sub-grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `
          linear-gradient(rgba(16,185,129,0.2) 1px, transparent 1px),
          linear-gradient(90deg, rgba(16,185,129,0.2) 1px, transparent 1px)
        `,
        backgroundSize: '15px 15px',
      }} />

      {/* Radial fade to black edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,transparent_0%,black_75%)]" />

      {/* Top and bottom fade for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />

      {/* CSS Keyframes */}
      <style jsx>{`
        @keyframes gridScroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(60px); }
        }
      `}</style>
    </div>
  );
}
