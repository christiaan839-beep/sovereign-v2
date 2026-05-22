"use client";

/**
 * SOVEREIGN MATRIX — System Boot Loader (Wave 121).
 *
 * Cinematic boot overlay that runs once on first mount, then dissolves.
 * Type-on terminal-style HUD lines:
 *
 *   SOVEREIGN MATRIX // VAOS v2.1
 *   > ESTABLISHING SYSTEM LINK …
 *   > VERIFYING ML-DSA-65 KEYPAIR …
 *   > RECEIPT FABRIC ONLINE
 *   > SYS·LINK ESTABLISHED · FRAME LOCKED
 *
 * Total runtime ~1.4s. Respects prefers-reduced-motion → renders the
 * final frame instantly (no typewriter, no fade).
 *
 * Cookie-pinned: visitors only see the boot once per session — repeat
 * visits land directly on the page. (Set `forceShow` for /immersive
 * demos.)
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LINES = [
  { text: "SOVEREIGN MATRIX // VAOS v2.1", at: 0 },
  { text: "> ESTABLISHING SYSTEM LINK …", at: 250 },
  { text: "> VERIFYING ML-DSA-65 KEYPAIR …", at: 500 },
  { text: "> RECEIPT FABRIC ONLINE", at: 800 },
  { text: "> SYS·LINK ESTABLISHED · FRAME LOCKED", at: 1100 },
];

const TOTAL_MS = 1500;
const STORAGE_KEY = "sovereign:boot-seen-v1";

interface SystemBootLoaderProps {
  /** Skip the once-per-session cookie and always show. Used on /immersive. */
  forceShow?: boolean;
  /** Callback fired when the loader dismounts. */
  onComplete?: () => void;
}

// Wave 124 polish — safe sessionStorage access (private windows, sandboxed
// webviews, and corporate browsers can block Storage access entirely; the
// raw call throws SecurityError when blocked, which would crash the boot
// loader's first-mount path). Wrap reads + writes in try/catch.
function readBootSeen(): boolean {
  try {
    return (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}
function writeBootSeen(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private window / blocked storage — accept that the boot may show
       once per page-load instead of once per session. */
  }
}

export function SystemBootLoader({
  forceShow = false,
  onComplete,
}: SystemBootLoaderProps) {
  // Wave 124 polish — lazy-init all three signals so the first effect
  // body does NOT call setState synchronously. The boot loader's
  // initial visibility + reduced-motion preference are determined at
  // mount time from the browser; the lazy initializer is the correct
  // React pattern for client-only initial state and satisfies the
  // react-hooks/set-state-in-effect rule.
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (forceShow) return true;
    return !readBootSeen();
  });
  const [reduceMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [linesShown, setLinesShown] = useState<number>(() => {
    // When motion is reduced AND the loader is going to flash, show
    // every line immediately. Otherwise start at 0 and let the
    // typewriter timers fill in.
    if (typeof window === "undefined") return 0;
    const seen = !forceShow && readBootSeen();
    if (seen) return 0;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    return reduce ? LINES.length : 0;
  });

  useEffect(() => {
    if (!visible) {
      onComplete?.();
      return;
    }

    if (reduceMotion) {
      // Reduced-motion flash: hide after 300ms.
      const t = window.setTimeout(() => {
        writeBootSeen();
        setVisible(false);
        onComplete?.();
      }, 300);
      return () => window.clearTimeout(t);
    }

    const timers: number[] = [];
    LINES.forEach((line, idx) => {
      timers.push(window.setTimeout(() => setLinesShown(idx + 1), line.at));
    });
    timers.push(
      window.setTimeout(() => {
        writeBootSeen();
        setVisible(false);
        onComplete?.();
      }, TOTAL_MS),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [visible, reduceMotion, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="boot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020202]"
          aria-hidden="true"
        >
          {/* Faint grid backdrop matching /metrics + /verify motif */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Corner brackets — match HudFrame motif */}
          <Corners />

          {/* Boot lines */}
          <div className="relative z-10 max-w-2xl px-8 font-mono text-[12px] leading-loose tracking-[0.05em] text-cyan-300/90 sm:text-[13px]">
            {LINES.slice(0, linesShown).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className={
                  i === 0
                    ? "mb-4 text-white font-semibold"
                    : i === LINES.length - 1
                      ? "text-cyan-300"
                      : "text-cyan-400/70"
                }
              >
                {line.text}
              </motion.div>
            ))}
            {linesShown > 0 && linesShown < LINES.length && (
              <motion.span
                aria-hidden="true"
                initial={{ opacity: 0.4 }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block h-3 w-1.5 translate-y-[2px] bg-cyan-300"
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Corners() {
  const base =
    "absolute h-5 w-5 border-cyan-400/50 pointer-events-none transition-opacity";
  return (
    <>
      <div className={`${base} top-6 left-6 border-t border-l`} />
      <div className={`${base} top-6 right-6 border-t border-r`} />
      <div className={`${base} bottom-6 left-6 border-b border-l`} />
      <div className={`${base} bottom-6 right-6 border-b border-r`} />
    </>
  );
}
