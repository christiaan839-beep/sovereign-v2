"use client";

/**
 * /stats — public, aggregate-only platform metrics.
 *
 * Compliance buyers ask "how many verifications run per day?" during
 * procurement. Prospects want a number that proves the platform is
 * alive at the company level (not just one demo receipt). Journalists
 * writing about audit-grade AI want a citeable URL with real numbers.
 *
 * This page is the answer: three big numbers, refreshed every 60s
 * from /api/stats/public. No per-user data, no per-tenant data, no
 * receipt content — only counts.
 *
 * Visual:
 *   - Cyan accent per the dual-accent brand rule (audit / infra
 *     surface, not a sales page)
 *   - Three large tabular-num counters with framer-motion count-up on
 *     mount. Subsequent refreshes do NOT re-animate (avoids slot-
 *     machine effect).
 *   - Refresh button + auto-poll every 60s
 *   - prefers-reduced-motion respected — count-up collapses to a
 *     direct render
 *
 * Empty state: zeros are valid. Page renders normally with "0 receipts
 * (deploy is fresh — first agent run starts the chain)." copy in a
 * footer instead of a broken state.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Shield,
  Activity,
  Globe,
  Clock,
  RefreshCcw,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface PublicStats {
  totals: {
    signedReceipts: number;
    publicReceipts: number;
    last24h: number;
  };
  computedAt: string;
}

const POLL_INTERVAL_MS = 60_000;

export default function StatsPage() {
  const [data, setData] = useState<PublicStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (silent: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/stats/public", { cache: "no-store" });
      const json = (await res.json()) as PublicStats;
      setData(json);
      setError(null);
    } catch {
      setError("Feed unreachable. Retrying…");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats(true);
    const interval = setInterval(() => void fetchStats(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* Cyan ambient glow — audit surface tone */}
      <div
        className="fixed inset-x-0 top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          ← Sovereign Matrix
        </Link>

        {/* Header */}
        <header className="mb-12">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <Shield className="h-3 w-3" />
            PLATFORM STATS · LIVE
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Audit-grade infrastructure, in numbers.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Aggregate metrics across every tenant on Sovereign Matrix. Refreshed
            every {POLL_INTERVAL_MS / 1000} seconds. No per-user or per-tenant
            data is exposed — only counts.
          </p>
        </header>

        {/* Stat grid */}
        <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <BigStat
            label="Signed receipts"
            sub="Lifetime · HMAC-SHA256"
            value={data?.totals.signedReceipts ?? null}
            icon={Shield}
          />
          <BigStat
            label="Public receipts"
            sub="Enumerable via /explorer"
            value={data?.totals.publicReceipts ?? null}
            icon={Globe}
          />
          <BigStat
            label="Last 24 hours"
            sub="Receipts signed today"
            value={data?.totals.last24h ?? null}
            icon={Activity}
          />
        </section>

        {/* Refresh + computed-at strip */}
        <section className="mb-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 backdrop-blur-xl">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            <Clock className="h-3 w-3 text-cyan-300/80" />
            Computed{" "}
            {data?.computedAt ? (
              <time dateTime={data.computedAt} className="text-neutral-300">
                {new Date(data.computedAt).toUTCString().replace(" GMT", "")}
              </time>
            ) : (
              "—"
            )}
          </span>
          <button
            onClick={() => void fetchStats(false)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200 disabled:opacity-40"
            aria-label="Refresh stats"
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCcw className="h-3 w-3" />
            )}
            Refresh
          </button>
        </section>

        {error && (
          <p className="mb-8 text-center text-xs text-amber-300/80">{error}</p>
        )}

        {/* Empty state hint */}
        {data && data.totals.signedReceipts === 0 && (
          <p className="mb-8 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 text-center text-sm text-cyan-100">
            No receipts yet on this deployment. The first agent run starts the
            chain.{" "}
            <Link
              href="/signup"
              className="font-medium underline-offset-2 hover:underline"
            >
              Run one now →
            </Link>
          </p>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/explorer"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
          >
            Open the live explorer
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/spec"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
          >
            Read the VAOS spec
          </Link>
        </div>

        <p className="mt-10 text-center text-[11px] text-neutral-600">
          The endpoint behind this page is{" "}
          <code className="font-mono text-neutral-400">
            GET /api/stats/public
          </code>{" "}
          — open CORS, 60-second edge cache. Embed it anywhere.
        </p>
      </div>
    </div>
  );
}

/* ─── BigStat: animated counter ────────────────────────────────── */

function BigStat({
  label,
  sub,
  value,
  icon: Icon,
}: {
  label: string;
  sub: string;
  value: number | null;
  icon: typeof Shield;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        <Icon className="h-3 w-3 text-cyan-300/80" aria-hidden="true" />
        {label}
      </div>
      <div className="font-serif text-5xl font-medium tabular-nums tracking-tight text-white">
        {value === null ? <Skeleton /> : <CountUp value={value} />}
      </div>
      <div className="mt-1.5 text-[11px] text-neutral-500">{sub}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <span className="inline-block h-12 w-24 animate-pulse rounded bg-white/[0.04]" />
  );
}

/**
 * CountUp — animates 0 → value on first mount, then snaps to subsequent
 * values without re-animating. Avoids the slot-machine effect on the
 * 60-second refresh.
 *
 * Date.now() is deliberately kept inside requestAnimationFrame (not
 * during render) so the React Compiler's purity check passes.
 */
function CountUp({ value }: { value: number }) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      setHasMounted(true);
      return;
    }
    if (hasMounted) {
      // Subsequent refresh — snap, don't slot-machine.
      setDisplay(value);
      return;
    }
    // First mount — animate from 0
    let start: number | null = null;
    const DURATION_MS = 900;
    let frame = 0;
    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const t = Math.min(elapsed / DURATION_MS, 1);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setHasMounted(true);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-runs only when value changes
  }, [value, reducedMotion]);

  return (
    <motion.span
      key={value}
      initial={{ opacity: hasMounted ? 0.85 : 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {display.toLocaleString()}
    </motion.span>
  );
}
