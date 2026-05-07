"use client";
"use no memo";
 

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * CinematicLoader — Shows a brief loading sequence on first page visit.
 * The Sovereign Matrix logo glitches in, then dissolves into particles
 * that scatter outward, revealing the page underneath.
 *
 * Duration: ~1.8s total. Only shows once per session.
 */
export function CinematicLoader({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"loading" | "dissolve" | "done">(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("sm-loaded")) return "done";
    return "loading";
  });

  useEffect(() => {
    // Skip if already shown this session
    if (typeof window !== "undefined" && sessionStorage.getItem("sm-loaded")) {
      setPhase("done");
      return;
    }

    // Phase 1: Show logo (0.8s)
    const t1 = setTimeout(() => setPhase("dissolve"), 800);
    // Phase 2: Dissolve (1s)
    const t2 = setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem("sm-loaded", "1");
    }, 1800);
    // Safety fallback — if phases don't fire (HMR, slow hydration), force done after 3s
    const tSafety = setTimeout(() => {
      setPhase((prev) => {
        if (prev !== "done") sessionStorage.setItem("sm-loaded", "1");
        return "done";
      });
    }, 3000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(tSafety); };
  }, []);

  if (phase === "done") return <>{children}</>;

  const showLoader = phase === "loading" || phase === "dissolve";

  return (
    <>
      {/* Page content hidden behind loader */}
      <div style={{ opacity: 0 }}>{children}</div>

      <AnimatePresence>
        {showLoader && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020202]"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Glitch logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: phase === "loading" ? [0, 1, 0.7, 1] : 0,
                scale: phase === "loading" ? [0.8, 1, 0.98, 1] : 1.2,
              }}
              transition={{
                duration: phase === "loading" ? 0.6 : 0.8,
                ease: "easeOut",
              }}
              className="flex flex-col items-center gap-4"
            >
              {/* S logo mark */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center backdrop-blur-xl">
                  <span className="text-3xl font-bold text-emerald-400 font-serif tracking-tight">S</span>
                </div>

                {/* Glitch lines */}
                {phase === "loading" && (
                  <>
                    <motion.div
                      className="absolute inset-0 bg-emerald-500/10 rounded-2xl"
                      animate={{ x: [-2, 2, -1, 0], opacity: [0.5, 0, 0.3, 0] }}
                      transition={{ duration: 0.3, repeat: 2 }}
                    />
                    <motion.div
                      className="absolute inset-0 bg-cyan-500/10 rounded-2xl"
                      animate={{ x: [2, -2, 1, 0], opacity: [0.3, 0, 0.2, 0] }}
                      transition={{ duration: 0.3, repeat: 2, delay: 0.05 }}
                    />
                  </>
                )}
              </div>

              <motion.p
                className="text-[11px] uppercase tracking-[0.3em] text-emerald-500/60 font-mono"
                animate={{
                  opacity: phase === "loading" ? [0, 1] : [1, 0],
                }}
                transition={{ duration: 0.3 }}
              >
                initializing
              </motion.p>

              {/* Loading bar */}
              <div className="w-32 h-[2px] bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  initial={{ width: "0%" }}
                  animate={{ width: phase === "loading" ? "70%" : "100%" }}
                  transition={{ duration: phase === "loading" ? 0.8 : 0.3, ease: "easeOut" }}
                />
              </div>
            </motion.div>

            {/* Scatter particles on dissolve */}
            {phase === "dissolve" && (
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-emerald-400 rounded-full"
                    initial={{
                      left: "50%",
                      top: "50%",
                      opacity: 1,
                    }}
                    animate={{
                      left: `${50 + (Math.random() - 0.5) * 80}%`,
                      top: `${50 + (Math.random() - 0.5) * 80}%`,
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{
                      duration: 0.8,
                      delay: i * 0.02,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
