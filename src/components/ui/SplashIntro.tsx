"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BOOT_LINES = [
  { text: "SOVEREIGN MATRIX v2.0 INITIALIZING...", delay: 0 },
  { text: "Establishing encrypted uplink to Command Node.", delay: 200 },
  { text: "Nemotron 340B Instruct: ONLINE", delay: 400 },
  { text: "DeepSeek R1 Reasoning Engine: ONLINE", delay: 600 },
  { text: "NeMo Guardrails Safety Layer: ACTIVE", delay: 800 },
  { text: "███████████████████████████ 100%", delay: 1100 },
  { text: "OpenClaw Local Edge Daemon: CONNECTED (port 18789)", delay: 1400 },
  { text: "Ghost Fleet Webcrawler: ARMED", delay: 1700 },
  { text: "SOVEREIGN MATRIX: DEPLOYMENT READY.", delay: 2100 },
];

export function SplashIntro({ onComplete }: { onComplete: () => void }) {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [showGlitch, setShowGlitch] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if user has seen the intro before
  useEffect(() => {
    const seen = typeof window !== "undefined" && sessionStorage.getItem("umbra-intro-seen");
    if (seen) {
      onComplete();
      return;
    }

    // Boot sequence timing
    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => setVisibleLines(i + 1), line.delay);
    });

    // Glitch effect
    setTimeout(() => setShowGlitch(true), 2000);
    
    // Auto-dismiss after sequence complete
    const timer = setTimeout(() => {
      sessionStorage.setItem("umbra-intro-seen", "true");
      setDismissed(true);
      onComplete();
    }, 3500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] bg-[#030303] flex items-center justify-center cursor-pointer"
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem("umbra-intro-seen", "true");
          onComplete();
        }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Scanlines overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
          }}
        />

        {/* CRT glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,183,255,0.05) 0%, transparent 70%)",
          }}
        />

        <div className="relative w-full max-w-xl mx-auto px-8">
          {/* Terminal window */}
          <div className="font-mono text-sm space-y-1">
            {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={`${
                  line.text.includes("PROTOCOL: READY.")
                    ? "text-emerald-400 text-lg font-bold mt-4 animate-pulse"
                    : line.text.includes("100%")
                    ? "text-[#00B7FF]"
                    : line.text.includes("BYPASS AUTHORIZED")
                    ? "text-rose-400"
                    : line.text.includes("ONLINE") || line.text.includes("ARMED") || line.text.includes("ACTIVE") || line.text.includes("STANDBY")
                    ? "text-emerald-400/80"
                    : "text-neutral-500"
                }`}
              >
                {line.text && (
                  <>
                    <span className="text-neutral-700 mr-2">›</span>
                    {line.text}
                  </>
                )}
              </motion.div>
            ))}

            {/* Blinking cursor */}
            {visibleLines < BOOT_LINES.length && (
              <span className="inline-block w-2 h-4 bg-[#00B7FF] animate-pulse" />
            )}
          </div>

          {/* Glitch flash */}
          {showGlitch && (
            <motion.div
              className="absolute inset-0 bg-[#00B7FF]/5"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>

        {/* Skip text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 text-[10px] text-neutral-600 uppercase tracking-[0.3em]"
        >
          Click to skip
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
}
