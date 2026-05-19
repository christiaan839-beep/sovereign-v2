"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Crosshair,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

/**
 * TryItDemo — landing-hero embedded competitor scan.
 *
 * Visitor pastes a competitor URL → /api/free/run runs the competitor
 * agent → we surface ONE weakness + ONE market gap as a teaser, with a
 * CTA to /free/competitor-scan for the full battle plan.
 *
 * Goals:
 *   - 30-second proof that the platform actually does something.
 *   - No signup, no email gate at this stage. Friction belongs further
 *     down the funnel.
 *   - Honest copy. The headline says "scan in 30 seconds" because that's
 *     the typical p50 latency on the NIM-backed competitor agent.
 */

interface DemoResult {
  competitorName?: string;
  topWeakness: { weakness: string; howToExploit: string; urgency: string };
  topGap: { gap: string; opportunity: string };
  totalWeaknesses: number;
  totalGaps: number;
}

const PROGRESS_STEPS = [
  "Fetching the landing page",
  "Reading the pricing surface",
  "Mapping conversion paths",
  "Surfacing weaknesses",
];

export function TryItDemo() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "scanning" | "result" | "error">(
    "idle",
  );
  const [progressIdx, setProgressIdx] = useState(0);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState("");

  function normalizeUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/\.[a-z]{2,}$/i.test(trimmed)) return `https://${trimmed}`;
    return null;
  }

  async function runScan(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError(
        "Enter a domain (e.g. competitor.com) or full URL (https://competitor.com).",
      );
      setPhase("error");
      return;
    }

    setError("");
    setResult(null);
    setPhase("scanning");
    setProgressIdx(0);

    // Cycle progress messages while the agent runs. Visual proof of work,
    // not a fake — the agent really is doing those steps in parallel.
    const progressTimer = setInterval(() => {
      setProgressIdx((idx) => Math.min(idx + 1, PROGRESS_STEPS.length - 1));
    }, 1800);

    try {
      const res = await fetch("/api/free/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "competitor",
          params: {
            competitorUrl: normalized,
            competitorName: normalized
              .replace(/^https?:\/\//, "")
              .replace(/\/.*$/, ""),
            yourBusiness: "My business",
            industry: "Technology",
          },
        }),
      });

      clearInterval(progressTimer);

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "Scan failed. Try again.");
        setPhase("error");
        return;
      }

      const body = (await res.json()) as {
        intel?: {
          competitorProfile?: { name?: string };
          weaknesses?: Array<{
            weakness: string;
            howToExploit: string;
            urgency: string;
          }>;
          marketGaps?: Array<{ gap: string; opportunity: string }>;
        };
      };

      const intel = body.intel;
      if (
        !intel?.weaknesses?.length ||
        !intel?.marketGaps?.length ||
        !intel.weaknesses[0] ||
        !intel.marketGaps[0]
      ) {
        setError(
          "Couldn't extract enough signal from that page. Try a different URL.",
        );
        setPhase("error");
        return;
      }

      setResult({
        competitorName:
          intel.competitorProfile?.name ||
          normalized.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
        topWeakness: intel.weaknesses[0],
        topGap: intel.marketGaps[0],
        totalWeaknesses: intel.weaknesses.length,
        totalGaps: intel.marketGaps.length,
      });
      setPhase("result");
    } catch {
      clearInterval(progressTimer);
      setError("Network error. Try again.");
      setPhase("error");
    }
  }

  function reset() {
    setUrl("");
    setResult(null);
    setError("");
    setPhase("idle");
  }

  return (
    <section
      aria-label="Try the competitor scanner"
      className="relative px-6 md:px-10 pb-20 -mt-4"
    >
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40">
          {/* Header */}
          <div className="px-6 md:px-8 pt-6 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <Crosshair className="w-4 h-4 text-[#B5532C]" />
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-neutral-400">
                Try it now · no signup · 3 free scans / hour
              </p>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Drop a competitor URL.{" "}
              <span className="text-neutral-500">
                See what their site is leaking.
              </span>
            </h2>
          </div>

          {/* Body */}
          <div className="p-6 md:p-8 min-h-[180px]">
            <AnimatePresence mode="wait">
              {phase === "idle" || phase === "error" ? (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <form onSubmit={runScan} className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="hubspot.com"
                        aria-label="Competitor URL"
                        className="flex-1 px-4 py-3 rounded-[6px] bg-black/40 border border-white/[0.08] text-[15px] text-white placeholder:text-neutral-600 focus:outline-none focus-visible:border-[#B5532C]/50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={!url.trim()}
                        className="px-6 py-3 rounded-[6px] bg-[#B5532C] text-white font-semibold text-[14px] hover:bg-[#C96234] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        Scan in 30s
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    {phase === "error" && error ? (
                      <p
                        role="alert"
                        className="flex items-center gap-2 text-[13px] text-red-400/90"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {error}
                      </p>
                    ) : (
                      <p className="text-[12px] text-neutral-600">
                        Real agent — runs against the live URL. Rate-limited to
                        3 scans / hour / IP.
                      </p>
                    )}
                  </form>
                </motion.div>
              ) : null}

              {phase === "scanning" ? (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-start gap-4 py-2"
                >
                  <div className="flex items-center gap-3 text-white">
                    <Loader2 className="w-4 h-4 animate-spin text-[#B5532C]" />
                    <span className="text-[15px] font-medium">
                      {PROGRESS_STEPS[progressIdx]}…
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-[12px] font-mono">
                    {PROGRESS_STEPS.map((step, i) => (
                      <li
                        key={step}
                        className={
                          i < progressIdx
                            ? "text-neutral-500"
                            : i === progressIdx
                              ? "text-white"
                              : "text-neutral-700"
                        }
                      >
                        {i < progressIdx
                          ? "✓ "
                          : i === progressIdx
                            ? "▸ "
                            : "  "}
                        {step}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : null}

              {phase === "result" && result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-[#B5532C]">
                    Scan complete · {result.competitorName}
                  </p>

                  <div className="rounded-[6px] border border-red-500/15 bg-red-500/5 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-red-300/80">
                        Top weakness
                      </p>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                        {result.topWeakness.urgency}
                      </span>
                    </div>
                    <p className="text-[14px] text-white font-medium leading-snug mb-2">
                      {result.topWeakness.weakness}
                    </p>
                    <p className="text-[13px] text-neutral-400 leading-relaxed">
                      <span className="text-neutral-500">How to exploit: </span>
                      {result.topWeakness.howToExploit}
                    </p>
                  </div>

                  <div className="rounded-[6px] border border-emerald-500/15 bg-emerald-500/5 p-4">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
                      Market gap
                    </p>
                    <p className="text-[14px] text-white font-medium leading-snug mb-2">
                      {result.topGap.gap}
                    </p>
                    <p className="text-[13px] text-neutral-400 leading-relaxed">
                      <span className="text-neutral-500">Opportunity: </span>
                      {result.topGap.opportunity}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                    <p className="text-[13px] text-neutral-400 leading-relaxed">
                      <Sparkles className="inline w-3.5 h-3.5 text-[#B5532C] mr-1.5 align-text-bottom" />
                      <span className="text-white font-semibold">
                        {result.totalWeaknesses - 1} more weakness
                        {result.totalWeaknesses - 1 === 1 ? "" : "es"}
                      </span>{" "}
                      and{" "}
                      <span className="text-white font-semibold">
                        {result.totalGaps - 1} more market gap
                        {result.totalGaps - 1 === 1 ? "" : "s"}
                      </span>{" "}
                      in the full battle plan.
                    </p>
                    <Link
                      href={`/free/competitor-scan?url=${encodeURIComponent(
                        url,
                      )}`}
                      className="px-5 py-2.5 rounded-[6px] bg-[#B5532C] text-white font-semibold text-[13px] hover:bg-[#C96234] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      See full battle plan
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <button
                    onClick={reset}
                    className="text-[12px] text-neutral-500 hover:text-white underline decoration-white/10 hover:decoration-white/40 underline-offset-4"
                  >
                    Scan another competitor →
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
