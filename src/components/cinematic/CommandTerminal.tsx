"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useInView } from "framer-motion";

/**
 * COMMAND TERMINAL — Cinematic auto-playing terminal that shows
 * autonomous agents executing real commands in sequence.
 * Triggers when scrolled into view. The "wow" moment.
 */

interface TerminalLine {
  type: "command" | "output" | "success" | "info" | "separator";
  text: string;
  delay?: number; // ms before this line appears
}

const SEQUENCE: TerminalLine[] = [
  { type: "command", text: "sovereign deploy --agent lead-hunter --target \"fintech, Series A, US\"" },
  { type: "info", text: "[Lead Hunter] Initializing... connecting to 3 data sources", delay: 400 },
  { type: "output", text: "[Lead Hunter] Scanning 2,847 companies...", delay: 800 },
  { type: "output", text: "[Lead Hunter] Found 53 matches. Enriching profiles via Apollo...", delay: 1200 },
  { type: "success", text: "[Lead Hunter] ✓ 48 verified emails exported to CSV — 4.2s", delay: 600 },
  { type: "separator", text: "", delay: 300 },
  { type: "command", text: "sovereign deploy --agent content-writer --topic \"AI replacing agencies\" --words 1500", delay: 200 },
  { type: "info", text: "[Content Writer] Researching topic via Tavily... 5 sources found", delay: 600 },
  { type: "output", text: "[Content Writer] Drafting with DeepSeek V3.2 (anti-slop filter active)...", delay: 1000 },
  { type: "output", text: "[Content Writer] 1,487 words generated. AI detection score: 4.2%", delay: 1200 },
  { type: "success", text: "[Content Writer] ✓ Blog post published to /blog/ai-replacing-agencies — 6.1s", delay: 600 },
  { type: "separator", text: "", delay: 300 },
  { type: "command", text: "sovereign deploy --agent seo-dominator --target competitor.io --mode xray", delay: 200 },
  { type: "info", text: "[SEO Dominator] Crawling competitor.io... 342 pages indexed", delay: 800 },
  { type: "output", text: "[SEO Dominator] Identified 847 uncontested keyword gaps", delay: 1000 },
  { type: "output", text: "[SEO Dominator] Generated 12 tactical counter-moves", delay: 800 },
  { type: "success", text: "[SEO Dominator] ✓ Full report exported with action plan — 3.8s", delay: 500 },
  { type: "separator", text: "", delay: 300 },
  { type: "command", text: "sovereign deploy --agent voice-closer --leads top-10 --objective qualify", delay: 200 },
  { type: "info", text: "[Voice Closer] Connecting to Twilio... voice engine ready", delay: 600 },
  { type: "output", text: "[Voice Closer] Calling 10 leads in parallel... sub-200ms latency", delay: 1400 },
  { type: "output", text: "[Voice Closer] 3 qualified leads. 2 meetings booked to calendar.", delay: 1000 },
  { type: "success", text: "[Voice Closer] ✓ All 10 calls completed in 4m 32s — 0 human intervention", delay: 500 },
];

function useTypewriter(text: string, speed: number = 18, active: boolean = false) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) { setDisplayed(""); setDone(false); return; }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(interval); setDone(true); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, active]);

  return { displayed, done };
}

function TerminalLineComponent({ line, active, onDone }: { line: TerminalLine; active: boolean; onDone: () => void }) {
  const isCommand = line.type === "command";
  const { displayed, done } = useTypewriter(line.text, isCommand ? 14 : 8, active);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle non-command lines (output/info/separator) — auto-advance after calculated duration
  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!active) return;
    if (line.type === "separator") {
      timerRef.current = setTimeout(onDone, 100);
    } else if (!isCommand) {
      timerRef.current = setTimeout(onDone, line.text.length * 8 + 100);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active, isCommand, line, onDone]);

  // Handle command lines — advance when typewriter finishes
  useEffect(() => {
    if (done && isCommand) onDone();
  }, [done, isCommand, onDone]);

  if (line.type === "separator") return <div className="h-2" />;

  const colorMap = {
    command: "text-emerald-400",
    output: "text-neutral-400",
    success: "text-emerald-300",
    info: "text-cyan-400/70",
    separator: "",
  };

  return (
    <div className={`font-mono text-[11px] md:text-xs leading-relaxed ${colorMap[line.type]}`}>
      {isCommand && <span className="text-emerald-500/60 mr-2">▸</span>}
      {active ? displayed : line.text}
      {active && !done && isCommand && <span className="animate-pulse text-emerald-400">▊</span>}
    </div>
  );
}

export function CommandTerminal() {
  const ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [currentLine, setCurrentLine] = useState(-1);
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  // Cleanup all pending timers on unmount
  useEffect(() => {
    return () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); };
  }, []);

  // Trigger first line when scrolled into view
  useEffect(() => {
    if (isInView && currentLine === -1) {
      advanceTimer.current = setTimeout(() => setCurrentLine(0), 600);
    }
  }, [isInView, currentLine]);

  const advanceLine = useCallback(() => {
    setCurrentLine((prev) => {
      const next = prev + 1;
      setVisibleLines((v) => [...v, prev]);
      if (next < SEQUENCE.length) {
        const delay = SEQUENCE[next].delay || 200;
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
        advanceTimer.current = setTimeout(() => setCurrentLine(next), delay);
      }
      return prev;
    });
  }, []);

  // Auto-scroll to bottom as lines appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLines, currentLine]);

  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-3xl mx-auto"
      >
        {/* Terminal window */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.04)]">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-[#080808]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
            </div>
            <span className="text-[10px] text-neutral-600 font-mono ml-2">sovereign-matrix — autonomous execution</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-[9px] text-emerald-500/60 font-mono">LIVE</span>
            </div>
          </div>

          {/* Terminal content */}
          <div ref={scrollRef} className="p-4 md:p-6 space-y-1 max-h-[380px] overflow-y-auto scrollbar-hide">
            {/* Already completed lines */}
            {visibleLines.map((idx) => (
              <TerminalLineComponent key={idx} line={SEQUENCE[idx]} active={false} onDone={() => {}} />
            ))}

            {/* Currently typing line */}
            {currentLine >= 0 && currentLine < SEQUENCE.length && (
              <TerminalLineComponent
                key={`active-${currentLine}`}
                line={SEQUENCE[currentLine]}
                active={true}
                onDone={advanceLine}
              />
            )}

            {/* Completion message */}
            {visibleLines.length >= SEQUENCE.length && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="mt-4 pt-4 border-t border-white/[0.04]">
                <p className="text-[11px] font-mono text-emerald-400/80">
                  ✓ 4 agents deployed. 0 human intervention. Total execution: 18.3s
                </p>
                <p className="text-[10px] font-mono text-neutral-600 mt-1">
                  Ready for next mission. Type &apos;sovereign --help&apos; or deploy another agent.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
