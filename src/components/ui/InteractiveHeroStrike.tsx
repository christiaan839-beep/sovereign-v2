"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Cpu, Sparkles, ShieldCheck } from "lucide-react";

const EXAMPLE_PROMPTS = [
  "Find leads for SaaS companies",
  "Write a blog about AI",
  "Audit my website SEO",
];

/**
 * InteractiveHeroStrike — Wired to real AI agent via /api/demo/analyze.
 * Text input with example prompts, streaming typewriter response.
 */
export function InteractiveHeroStrike() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const responseRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSubmit = async (prompt: string) => {
    const text = prompt || input;
    if (!text.trim() || isLoading) return;
    setInput(text);
    setIsLoading(true);
    setStreamText("");

    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      const res = await fetch("/api/demo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();

      const fullText =
        data.response || "Analysis complete. Sign up free for the full output.";

      let i = 0;
      intervalRef.current = setInterval(() => {
        i++;
        setStreamText(fullText.slice(0, i));
        if (i >= fullText.length && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 12);
    } catch {
      setStreamText(
        "Our agents are warming up. Try again in a moment, or sign up for instant access."
      );
    } finally {
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(input);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-5">
      {/* Input */}
      <form onSubmit={handleFormSubmit} className="w-full relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-emerald-600/10 to-emerald-500/20 rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
        <div className="relative flex items-center bg-[#0a0a0a] border border-white/10 rounded-2xl p-2 shadow-2xl">
          <label htmlFor="hero-agent-goal" className="sr-only">Describe a goal for the agent</label>
          <input
            id="hero-agent-goal"
            type="text"
            placeholder="Try it — describe a goal..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            aria-label="Describe a goal for the agent"
            className="flex-1 bg-transparent text-white px-5 py-3.5 outline-none placeholder:text-neutral-500 text-sm disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3.5 rounded-xl bg-white text-black font-semibold text-sm flex items-center gap-2 hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isLoading ? (
              <>
                <Cpu className="w-4 h-4 animate-spin text-emerald-600" />{" "}
                Thinking...
              </>
            ) : (
              <>
                Run Agent <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Example prompts */}
      {!streamText && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSubmit(prompt)}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs text-neutral-400 border border-white/[0.06] rounded-lg bg-white/[0.02] hover:border-emerald-500/20 hover:text-emerald-400 hover:bg-emerald-500/[0.04] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      <AnimatePresence>
        {isLoading && !streamText && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-emerald-400/80 uppercase tracking-wider">
                Agent processing...
              </span>
            </div>
            <span className="flex items-center gap-2 text-[10px] text-emerald-400/60 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streamed response */}
      <AnimatePresence>
        {streamText && (
          <motion.div
            ref={responseRef}
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0 }}
            className="w-full rounded-xl bg-black/80 border border-emerald-500/15 p-5 backdrop-blur-xl shadow-[0_0_40px_rgba(16,185,129,0.06)]"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/70 font-mono">
                Agent Response
              </span>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {streamText}
              <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse" />
            </p>
            <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
              <span className="text-[10px] text-neutral-600 font-mono">
                Free demo — 5 tries per hour
              </span>
              <a
                href="/signup"
                className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Get Full Access →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No signup label */}
      {!streamText && (
        <div className="flex items-center gap-2 mt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/50" />
          <span className="text-[11px] text-neutral-500">
            No signup required
          </span>
        </div>
      )}
    </div>
  );
}
