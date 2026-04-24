"use client";

/**
 * LivePlatformMetrics — honest, live stats strip.
 *
 * Fetches /api/_health/slo + /api/_health/performance and renders four
 * numbers anyone with the URL can verify: uptime, P95 latency, cache
 * hit rate, and observed endpoints. These come from the in-memory ring
 * buffer the SLO tracker feeds on every agent request.
 *
 * DESIGN INTENT
 * ─────────────
 * This is deliberately minimalist — a 4-pill strip, not a hero.
 * Purpose: prove the measurement is real without turning the page
 * into a dashboard. Elite-tier platforms (Stripe, Cloudflare) show
 * one or two live numbers; 4 is the ceiling before noise.
 *
 * Palette matches the landing page: copper (#B5532C) accent on the
 * primary metric, muted on the rest.
 *
 * FALLBACKS
 * ─────────
 * If the fetch fails or returns empty (fresh deploy, no traffic yet),
 * renders a discreet "Awaiting first request" state. NEVER shows fake
 * numbers — honesty is the whole point.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Zap, CheckCircle2, Layers } from "lucide-react";

interface SloShape {
  platform: {
    windowSeconds: number;
    totalRequests: number;
    successRatePct: number;
    p95Ms: number;
    observedEndpoints: number;
  };
}

interface PerfShape {
  cache: { hitRatePct: number; hits: number; stampedeSaves: number };
}

export function LivePlatformMetrics() {
  const [slo, setSlo] = useState<SloShape | null>(null);
  const [perf, setPerf] = useState<PerfShape | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sloRes, perfRes] = await Promise.all([
          fetch("/api/_health/slo", { cache: "no-store" }),
          fetch("/api/_health/performance", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (sloRes.ok) setSlo(await sloRes.json());
        if (perfRes.ok) setPerf(await perfRes.json());
      } catch {
        // silent — we'll show the empty state
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasTraffic = (slo?.platform.totalRequests ?? 0) > 0;

  return (
    <section className="relative py-16 md:py-20 px-6 overflow-hidden border-y border-white/[0.04]">
      {/* subtle copper underglow — reads as a status indicator, not decoration */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(181,83,44,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="mb-10 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            LIVE
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            Numbers you can verify.
          </p>
          <span aria-hidden="true" className="h-px flex-1 bg-white/[0.04]" />
          <a
            href="/api/_health/slo"
            className="font-mono text-[10px] text-neutral-600 hover:text-[#B5532C] transition-colors tracking-[0.1em]"
          >
            /api/_health/slo →
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricPill
            icon={CheckCircle2}
            label="Uptime (24h)"
            value={
              !loaded
                ? "—"
                : hasTraffic
                  ? `${slo!.platform.successRatePct.toFixed(2)}%`
                  : "awaiting"
            }
            sub={
              hasTraffic
                ? `${slo!.platform.totalRequests.toLocaleString()} requests`
                : "first request pending"
            }
            accent
            delay={0}
          />
          <MetricPill
            icon={Zap}
            label="P95 latency"
            value={
              !loaded ? "—" : hasTraffic ? `${slo!.platform.p95Ms}ms` : "awaiting"
            }
            sub="across all agents"
            delay={0.08}
          />
          <MetricPill
            icon={Activity}
            label="Cache hit rate"
            value={
              !loaded
                ? "—"
                : perf && perf.cache.hits + perf.cache.stampedeSaves > 0
                  ? `${perf.cache.hitRatePct}%`
                  : "0%"
            }
            sub={
              perf
                ? `${perf.cache.hits} hits · ${perf.cache.stampedeSaves} stampede saves`
                : "stampede-protected"
            }
            delay={0.16}
          />
          <MetricPill
            icon={Layers}
            label="Endpoints tracked"
            value={
              !loaded
                ? "—"
                : String(slo?.platform.observedEndpoints ?? 0)
            }
            sub="per-endpoint SLO"
            delay={0.24}
          />
        </div>

        <p className="mt-6 font-mono text-[10px] text-neutral-600 tracking-[0.08em]">
          Source:{" "}
          <a
            href="/api/_health/slo"
            className="underline decoration-white/[0.12] hover:decoration-[#B5532C]"
          >
            /api/_health/slo
          </a>
          {" · "}
          <a
            href="/api/_health/performance"
            className="underline decoration-white/[0.12] hover:decoration-[#B5532C]"
          >
            /api/_health/performance
          </a>
          {" · "}
          Window resets with instance. Cross-instance aggregation is Q3 work.
        </p>
      </div>
    </section>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  delay,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-[4px] border border-white/[0.06] bg-white/[0.015] px-5 py-5 transition-colors hover:border-white/[0.12]"
    >
      {/* accent beam on the primary metric */}
      {accent && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(181,83,44,0.6) 50%, transparent 100%)",
          }}
        />
      )}
      <div className="flex items-center gap-2 mb-3">
        <Icon
          className={`w-3.5 h-3.5 ${accent ? "text-[#B5532C]" : "text-neutral-500"}`}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          {label}
        </span>
      </div>
      <div
        className={`font-serif text-3xl md:text-4xl tracking-tight leading-none mb-2 ${
          accent ? "text-white" : "text-neutral-200"
        }`}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] text-neutral-600 tracking-[0.04em]">
        {sub}
      </div>
    </motion.div>
  );
}
