"use client";

/**
 * SectionDivider — cinematic, brand-aware horizontal rule between
 * landing-page sections.
 *
 * Why a real component (not just `<hr/>`):
 *
 *   The landing flows through two distinct surfaces — copper (marketing
 *   / agency) and cyan (audit / infrastructure) — per the dual-accent
 *   rule in docs/design-system/brand-colors.md. A flat section break
 *   loses that signal; a divider that picks up the next-section's
 *   accent reinforces "you're entering a different surface" without
 *   needing words.
 *
 *   Visual: a 1px linear-gradient hairline that fades to transparent
 *   at both ends, plus a soft radial glow centered on the line. The
 *   glow uses the chosen accent at low alpha. On wide viewports the
 *   divider also renders a small framed mark (a thin diamond) at the
 *   midpoint, drawn with an SVG so it crisps at 4K. Pure-CSS, no JS
 *   beyond the framer-motion scroll-reveal so it doesn't bloat the
 *   landing bundle.
 *
 *   Respects prefers-reduced-motion via motion's reducedMotion default
 *   (the reveal collapses to a static render).
 */

import { motion } from "framer-motion";

type Accent = "cyan" | "copper";

interface SectionDividerProps {
  accent?: Accent;
  /** Show the framed midpoint mark. Default true on lg+ screens. */
  withMark?: boolean;
  className?: string;
}

const ACCENT_RGB: Record<Accent, string> = {
  cyan: "0, 183, 255",
  copper: "181, 83, 44",
};

export function SectionDivider({
  accent = "cyan",
  withMark = true,
  className = "",
}: SectionDividerProps) {
  const rgb = ACCENT_RGB[accent];
  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`relative mx-auto my-14 flex h-12 w-full max-w-5xl items-center justify-center ${className}`}
    >
      {/* Hairline gradient rule, fades at the edges */}
      <span
        className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2"
        style={{
          background: `linear-gradient(to right, transparent 0%, rgba(${rgb},0.4) 30%, rgba(${rgb},0.4) 70%, transparent 100%)`,
        }}
      />

      {/* Soft glow centered on the line */}
      <span
        className="absolute top-1/2 left-1/2 h-24 w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[40px]"
        style={{ background: `rgba(${rgb}, 0.06)` }}
      />

      {/* Framed midpoint mark */}
      {withMark && (
        <span
          className="relative hidden h-3 w-3 rotate-45 border lg:block"
          style={{
            borderColor: `rgba(${rgb}, 0.55)`,
            boxShadow: `0 0 14px rgba(${rgb}, 0.35)`,
            background: "transparent",
          }}
        />
      )}
    </motion.div>
  );
}
