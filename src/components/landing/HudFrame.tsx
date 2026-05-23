"use client";

/**
 * SOVEREIGN MATRIX — HUD Frame (Wave 121).
 *
 * Cinematic HUD chrome wrapping immersive sections — corner brackets,
 * tracking markers, frame coordinates, system-link state. Modelled on
 * the TEXTURA.US Ithaca reference's `SYS-LINK ESTABLISHED · FRAME LOCKED`
 * but wired to Sovereign-brand semantics (cyan = audit / receipts).
 *
 * Pure CSS + tiny canvas-free rendering. Sits ABOVE the 3D Canvas as
 * a `position: absolute` overlay so it doesn't recompose the scene
 * tree when the parent re-renders.
 *
 * a11y: aria-hidden — these are decorative crosshairs, not informational
 * widgets. The actual platform state lives in /status + /metrics.
 */

import { motion } from "framer-motion";

interface HudFrameProps {
  /** Top-left label. Default "SYS·LINK ESTABLISHED". */
  systemLabel?: string;
  /** Bottom-left label. Default "FRAME LOCKED". */
  frameLabel?: string;
  /** Top-right frame marker, e.g. "01 / 03". */
  frameId?: string;
  /** Bottom-right callout. Default "VAOS · v2.1". */
  buildLabel?: string;
  /** Hide corner brackets (still keeps text markers). */
  hideCorners?: boolean;
  /**
   * Wave 123 — accent color matching the orb. Cyan = audit (default),
   * copper = marketing CTAs. When the parent sticky orb switches accent
   * the HUD chrome follows for visual continuity.
   */
  accent?: "cyan" | "copper";
}

export function HudFrame({
  systemLabel = "SYS·LINK ESTABLISHED",
  frameLabel = "FRAME LOCKED",
  frameId,
  buildLabel = "VAOS · v2.1",
  hideCorners,
  accent = "cyan",
}: HudFrameProps) {
  // Wave 123 — accent-driven chrome. Cyan or copper. Tailwind classes
  // are statically resolvable so the JIT picks them up; the conditional
  // string-mix here only swaps WHICH static class lands in the DOM, not
  // a dynamically-computed one.
  const cornerCls =
    accent === "cyan" ? "border-cyan-400/50" : "border-amber-400/50";
  const dotCls =
    accent === "cyan"
      ? { ping: "bg-cyan-400", core: "bg-cyan-400", text: "text-cyan-300/80" }
      : {
          ping: "bg-amber-400",
          core: "bg-amber-400",
          text: "text-amber-300/80",
        };
  const tickCls = accent === "cyan" ? "bg-cyan-400/40" : "bg-amber-400/40";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
    >
      {/* Corner brackets — drawn as 4 right-angles via borders */}
      {!hideCorners && (
        <>
          <Corner cn={`top-4 left-4 border-t border-l ${cornerCls}`} />
          <Corner cn={`top-4 right-4 border-t border-r ${cornerCls}`} />
          <Corner cn={`bottom-4 left-4 border-b border-l ${cornerCls}`} />
          <Corner cn={`bottom-4 right-4 border-b border-r ${cornerCls}`} />
        </>
      )}

      {/* Top-left: animated dot + system label */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="absolute top-5 left-5 flex items-center gap-2"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotCls.ping}`}
          />
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotCls.core}`}
          />
        </span>
        <span
          className={`font-mono text-[10px] tracking-[0.22em] uppercase ${dotCls.text}`}
        >
          {systemLabel}
        </span>
      </motion.div>

      {/* Top-right: frame id */}
      {frameId && (
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="absolute top-5 right-5 font-mono text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
        >
          {frameId}
        </motion.div>
      )}

      {/* Bottom-left: frame-locked tag */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="absolute bottom-5 left-5 font-mono text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
      >
        {frameLabel}
      </motion.div>

      {/* Bottom-right: build label */}
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="absolute bottom-5 right-5 font-mono text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
      >
        {buildLabel}
      </motion.div>

      {/* Mid crosshair — faint center vertical + horizontal ticks */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 20, height: 20 }}
      >
        <span
          className={`absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 ${tickCls}`}
        />
        <span
          className={`absolute left-1/2 bottom-0 h-2.5 w-px -translate-x-1/2 ${tickCls}`}
        />
        <span
          className={`absolute top-1/2 left-0 h-px w-2.5 -translate-y-1/2 ${tickCls}`}
        />
        <span
          className={`absolute top-1/2 right-0 h-px w-2.5 -translate-y-1/2 ${tickCls}`}
        />
      </div>
    </div>
  );
}

function Corner({ cn }: { cn: string }) {
  // Tailwind border-t / border-l / etc set border-top-width / border-left-width
  // individually; we DON'T zero them out with an inline style or the corners
  // become invisible. The cn argument carries position + edge selection +
  // accent color (passed in from the parent).
  return <div className={`absolute h-4 w-4 ${cn}`} />;
}
