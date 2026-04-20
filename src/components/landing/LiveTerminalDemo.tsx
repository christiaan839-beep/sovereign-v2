"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * LIVE TERMINAL DEMO — Hero product-in-action.
 *
 * Studying: railway.app (live deploy terminal), cursor.com (IDE
 * keystroke playback). Common pattern: scripted sequence that FEELS
 * like it happened 5 seconds ago to a real user. Pacing is key —
 * short bursts (~150ms) for "thinking" lines, longer pauses (~700ms)
 * after result lines. Total loop: ~8s.
 *
 * Pattern source:
 *   - Railway shows deploy stages with colored labels + timestamps
 *   - Cursor shows code being typed character-by-character
 *   - We show the Lead Blitz agent pipeline with phase markers
 *
 * No real API call — this is a deterministic scripted sequence. The
 * REAL version runs inside /dashboard/playbooks after signup; this
 * is the trailer.
 *
 * Accessibility:
 *   - prefers-reduced-motion shows the final state immediately
 *   - aria-live="polite" for screen readers
 *   - Plays once on mount, loops every 20s (so a visitor scrolling
 *     past doesn't see it replaying constantly)
 */

interface TerminalLine {
  prompt?: string;    // "$" or ">"  — leading symbol
  promptColor?: string; // tailwind class for the prompt
  text: string;
  pauseBefore?: number; // ms before this line starts typing
  pauseAfter?: number;  // ms after this line finishes
  instant?: boolean;    // don't typewriter; appear fully
  color?: string;       // tailwind class for the text
}

const SEQUENCE: TerminalLine[] = [
  {
    prompt: ">",
    promptColor: "text-[#B5532C]",
    text: "playbook run lead-blitz --niche=\"B2B SaaS\" --location=\"San Francisco\"",
    pauseBefore: 300,
    pauseAfter: 450,
  },
  {
    text: "[0.14s] Resolving playbook chain: leads → email-sequence",
    instant: true,
    color: "text-neutral-500",
    pauseAfter: 200,
  },
  {
    text: "[0.42s] Agent {leads} model=nemotron-ultra-253b routing...",
    instant: true,
    color: "text-neutral-500",
    pauseAfter: 300,
  },
  {
    text: "[1.18s] Tavily research: found 23 companies matching criteria",
    instant: true,
    color: "text-emerald-400/80",
    pauseAfter: 250,
  },
  {
    text: "[1.67s] Qualifying with 5-layer safety pipeline",
    instant: true,
    color: "text-neutral-500",
    pauseAfter: 250,
  },
  {
    text: "[2.31s] Claude critic: output approved (quality=0.91)",
    instant: true,
    color: "text-[#B5532C]",
    pauseAfter: 250,
  },
  {
    text: "[2.89s] Agent {email-sequence} generating personalized outreach...",
    instant: true,
    color: "text-neutral-500",
    pauseAfter: 300,
  },
  {
    text: "[3.42s] Drafted 23 emails · avg 147 words · 0 PII flags",
    instant: true,
    color: "text-emerald-400/80",
    pauseAfter: 250,
  },
  {
    text: "[3.71s] ✓ Playbook complete. Snapshot: rpl_k8s2_1d9f → /api/_replay/rpl_k8s2_1d9f",
    instant: true,
    color: "text-white",
    pauseAfter: 1200,
  },
];

const LOOP_DELAY_MS = 20_000;
const CHARS_PER_MS = 0.04; // Typewriter speed for prompt line (~25ms/char)

export function LiveTerminalDemo() {
  const [visibleLines, setVisibleLines] = useState<Array<{ line: TerminalLine; typed: string }>>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Honor prefers-reduced-motion by showing the final state immediately.
    // matchMedia is browser-only, so we can't move this to a lazy useState
    // initializer without causing SSR/client hydration mismatch — the
    // post-mount setState is intentional.
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time sync required (see above)
      setVisibleLines(SEQUENCE.map((line) => ({ line, typed: line.text })));
      setIsPlaying(false);
      return;
    }

    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    async function playSequence() {
      while (!cancelled) {
        setVisibleLines([]);
        for (let i = 0; i < SEQUENCE.length; i++) {
          if (cancelled) return;
          const line = SEQUENCE[i];
          if (line.pauseBefore) {
            await delay(line.pauseBefore);
            if (cancelled) return;
          }

          if (line.instant) {
            setVisibleLines((prev) => [...prev, { line, typed: line.text }]);
          } else {
            // Typewriter effect character by character
            setVisibleLines((prev) => [...prev, { line, typed: "" }]);
            const chars = line.text.length;
            const duration = chars / CHARS_PER_MS;
            const start = Date.now();
            await new Promise<void>((resolve) => {
              function frame() {
                if (cancelled) return resolve();
                const elapsed = Date.now() - start;
                const typedCount = Math.min(chars, Math.floor(elapsed * CHARS_PER_MS));
                setVisibleLines((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { line, typed: line.text.slice(0, typedCount) };
                  return next;
                });
                if (typedCount >= chars) return resolve();
                requestAnimationFrame(frame);
              }
              requestAnimationFrame(frame);
            });
            if (cancelled) return;
            if (duration > chars * 25) await delay(chars * 25 - duration);
          }

          if (line.pauseAfter) {
            await delay(line.pauseAfter);
          }
        }
        await delay(LOOP_DELAY_MS);
      }
    }

    function delay(ms: number): Promise<void> {
      return new Promise((resolve) => {
        const t = setTimeout(resolve, ms);
        timeouts.push(t);
      });
    }

    playSequence();

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mt-12 max-w-3xl"
    >
      {/* Frame — reminiscent of macOS terminal window but more restrained */}
      <div
        ref={containerRef}
        className="relative rounded-2xl border border-white/[0.08] bg-[#0A0807] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        {/* Window chrome — minimal, mono label */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.04] bg-[#060605]">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
            sovereign://playbooks/lead-blitz
          </span>
          {isPlaying && (
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-emerald-400/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              running
            </span>
          )}
        </div>

        {/* Content */}
        <div
          className="px-6 py-6 font-mono text-[12.5px] leading-[1.7] min-h-[280px]"
          aria-live="polite"
          aria-label="Live terminal demo — scripted Lead Blitz playbook execution"
        >
          {visibleLines.map((entry, i) => (
            <div key={i} className="flex gap-2">
              {entry.line.prompt && (
                <span className={entry.line.promptColor ?? "text-white"}>{entry.line.prompt}</span>
              )}
              <span className={entry.line.color ?? "text-white"}>
                {entry.typed}
                {/* Cursor on the active (last) line */}
                {i === visibleLines.length - 1 && !entry.line.instant && entry.typed.length < entry.line.text.length && (
                  <span className="ml-0.5 inline-block h-[14px] w-[2px] bg-[#B5532C] animate-pulse align-middle" />
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[11px] font-mono text-neutral-600 tracking-wide">
        ↑ Deterministic demo. Your live run happens at
        <a href="/dashboard/playbooks?auto=lead-blitz" className="text-[#B5532C] hover:text-white transition-colors mx-1 underline decoration-[#B5532C]/40">
          /dashboard/playbooks
        </a>
        after signup.
      </p>
    </motion.div>
  );
}
