"use client";

/**
 * LiveReceiptFeed — wave 109.6.
 *
 * Promotes the floating LiveActivityTicker concept to a real landing-
 * page block. Polls /api/agent-runs/recent-public?limit=8 and renders
 * the last 8 receipts as a streaming feed with a cyan pulse on each
 * new arrival. Sits inline on the marketing surface so visitors see
 * proof of platform activity instead of just reading about it.
 *
 * Why a full block (and not just the floating ticker):
 *   - The ticker is a glance — it tells visitors "X verifications in
 *     60s" but never SHOWS them. It's social proof, not telemetry.
 *   - This block IS the telemetry. Eight rows of real receipt ids,
 *     agent names, models, and durations — the platform's claim of
 *     audit-grade verification made physical on the landing.
 *
 * Visual contract:
 *   - bg-[#030303] base (matches landing)
 *   - cyan accent (audit/infra surface per brand-colors.md)
 *   - glassmorphism rows (backdrop-blur-xl + bg-white/[0.02])
 *   - new arrivals fade in from top with a cyan pulse on the dot
 *   - existing rows shift down with a smooth easing
 *
 * Failure modes:
 *   - On any fetch error / empty feed → renders a "feed warming up"
 *     placeholder. Never crashes, never blanks the landing.
 *
 * Honours prefers-reduced-motion — static row entry, no pulse.
 *
 * SSR-safe — initial render is the placeholder; first poll happens
 * in useEffect on the client.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Activity, ArrowRight } from "lucide-react";

const POLL_INTERVAL_MS = 15_000;
const FEED_LIMIT = 8;

interface Receipt {
  id: string;
  agentName: string | null;
  modelUsed: string | null;
  durationMs: number | null;
  signatureSha: string;
  createdAt: string;
}

interface FeedResponse {
  count?: number;
  receipts?: Receipt[];
}

/**
 * Format the relative age of a receipt in a compact form.
 *
 * Exported for testing — pins behaviour around the second/minute/
 * hour/day boundaries + invalid input. The function is pure (no
 * side effects, deterministic for given inputs) so the test
 * exercises it directly without rendering the component.
 */
export function ago(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const delta = Math.max(0, now - t);
  const s = Math.floor(delta / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function LiveReceiptFeed() {
  const reduceMotion = useReducedMotion();
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let prevIds = new Set<string>();

    async function tick() {
      try {
        const res = await fetch(
          `/api/agent-runs/recent-public?limit=${FEED_LIMIT}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as FeedResponse;
        if (cancelled) return;
        const next = json.receipts ?? [];
        // Diff against previous tick to detect newcomers — those get
        // the cyan pulse animation. We don't pulse on the initial
        // mount because every row would pulse simultaneously.
        const arrivedIds = new Set<string>();
        if (prevIds.size > 0) {
          for (const r of next) {
            if (!prevIds.has(r.id)) arrivedIds.add(r.id);
          }
        }
        prevIds = new Set(next.map((r) => r.id));
        setReceipts(next);
        if (arrivedIds.size > 0) {
          setNewIds((cur) => {
            const merged = new Set(cur);
            arrivedIds.forEach((id) => merged.add(id));
            return merged;
          });
          // Decay the "is new" badge after 4s so the pulse doesn't
          // stay on forever.
          setTimeout(() => {
            if (cancelled) return;
            setNewIds((cur) => {
              const next = new Set(cur);
              arrivedIds.forEach((id) => next.delete(id));
              return next;
            });
          }, 4000);
        }
      } catch {
        // Stay on the previous good state on transient errors.
      }
    }
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Tick the "now" reference once a second so the relative timestamps
  // update without re-fetching. Cheap, no network.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="px-6 py-24 md:py-28 bg-[#030303]">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            live · audit feed
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <span className="relative inline-flex h-1.5 w-1.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-70 animate-ping motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </span>
        </div>

        <h2 className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-[-0.02em] mb-4 max-w-2xl">
          Receipts ship{" "}
          <em className="not-italic text-cyan-400">while you read this.</em>
        </h2>
        <p className="text-neutral-400 text-[15px] mb-10 max-w-xl leading-relaxed">
          The last {FEED_LIMIT} signed receipts the platform produced — updated
          every {Math.round(POLL_INTERVAL_MS / 1000)} seconds, straight from the
          audit log. Click any row for the full receipt.
        </p>

        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {(receipts === null || receipts.length === 0
              ? Array.from({ length: 3 }).map((_, i) => ({
                  id: `placeholder-${i}`,
                  agentName: null,
                  modelUsed: null,
                  durationMs: null,
                  signatureSha: "",
                  createdAt: new Date(now).toISOString(),
                  __placeholder: true as const,
                }))
              : receipts
            ).map((r) => {
              const isPlaceholder = "__placeholder" in r && r.__placeholder;
              const isNew = !isPlaceholder && newIds.has(r.id);
              return (
                <motion.li
                  key={r.id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className={`group rounded-[6px] border border-white/[0.05] bg-white/[0.02] backdrop-blur-xl px-4 py-3 transition-colors ${
                    isNew
                      ? "ring-1 ring-cyan-500/40 shadow-[0_0_24px_-8px_rgba(0,183,255,0.55)]"
                      : "hover:border-white/[0.08]"
                  }`}
                >
                  {isPlaceholder ? (
                    <div className="flex items-center gap-3 text-neutral-600">
                      <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="font-mono text-[12px]">
                        feed warming up…
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={`/r/${r.id}`}
                      className="flex items-center gap-3 text-[12.5px]"
                    >
                      <span
                        className="relative inline-flex h-1.5 w-1.5 shrink-0"
                        aria-hidden="true"
                      >
                        {isNew && !reduceMotion && (
                          <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-70 animate-ping" />
                        )}
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      </span>
                      <span className="font-mono text-cyan-400 tabular-nums shrink-0">
                        {r.signatureSha || r.id.slice(0, 12)}
                      </span>
                      <span className="text-white truncate flex-1">
                        {r.agentName ?? "agent"}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-500 hidden md:inline">
                        {r.modelUsed ?? "—"}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-500 tabular-nums shrink-0">
                        {r.durationMs != null ? `${r.durationMs}ms` : "—"}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-600 tabular-nums shrink-0 w-10 text-right">
                        {ago(r.createdAt, now)}
                      </span>
                    </Link>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        <div className="mt-8 flex items-center justify-between flex-wrap gap-4">
          <p className="font-mono text-[11px] text-neutral-600">
            full audit history →{" "}
            <Link
              href="/explorer"
              className="text-neutral-500 hover:text-cyan-400 transition-colors"
            >
              /explorer
            </Link>
          </p>
          <Link
            href="/explorer"
            className="inline-flex items-center gap-1.5 text-[12px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors group/cta"
          >
            See every receipt
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/cta:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
