"use client";

/**
 * /explorer — public, real-time stream of agent receipts being signed.
 *
 * Compliance officers can audit recent platform activity from any
 * browser; prospects see proof the verifiable-receipts moat is alive
 * (not just marketing copy); journalists writing about audit-grade AI
 * have a permanent URL they can cite.
 *
 * Data source: /api/agent-runs/recent-public — public/no-auth/open-CORS,
 * 15s edge cache. We poll every 12 seconds to land just inside that
 * cache window; deduplication is keyed by receipt id so re-polls
 * don't double-render rows.
 *
 * Visual language:
 *   - Cyan (audit/infrastructure surface per docs/design-system/
 *     brand-colors.md)
 *   - Mono font for receipt metadata to evoke the block-explorer
 *     analogy without aping crypto aesthetics
 *   - New rows fade-and-slide-in (framer-motion staggered enter) so
 *     the live updates are visually legible
 *   - prefers-reduced-motion respected via motion-reduce: on the
 *     decorative spinner
 *
 * Empty state: if no public receipts exist yet, the page renders an
 * explanation of what /r/<id> URLs are for and how to mark a run
 * public, instead of looking broken.
 *
 * Non-goals: this is intentionally NOT a verification surface — each
 * row links to /r/[id] for the full receipt + the live verifier. The
 * explorer's job is "show me activity," not "let me audit each row."
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Cpu,
  Clock,
  ArrowRight,
  Loader2,
  RefreshCcw,
  Activity,
  Lock,
} from "lucide-react";

interface FeedReceipt {
  id: string;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  signatureSha: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 12_000;

export default function ExplorerPage() {
  const [receipts, setReceipts] = useState<FeedReceipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAgoSec, setLastFetchedAgoSec] = useState(0);

  const fetchFeed = useCallback(async (silent: boolean) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/agent-runs/recent-public?limit=30", {
        cache: "no-store",
      });
      const data = (await res.json()) as { receipts?: FeedReceipt[] };
      setReceipts(data?.receipts ?? []);
      setError(null);
      setLastFetchedAgoSec(0);
    } catch {
      setError("Feed unreachable. Retrying…");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeed(true);
    const interval = setInterval(() => void fetchFeed(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  // Tick a counter every second so the "Xs ago" label updates live
  // without hammering the API. Kept out of render via setInterval +
  // state so the React Compiler doesn't flag Date.now() as impure.
  useEffect(() => {
    const t = setInterval(() => {
      setLastFetchedAgoSec((s) => Math.min(s + 1, POLL_INTERVAL_MS / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* Cyan ambient glow — sets the audit surface tone */}
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
        <header className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
            </span>
            LIVE FEED · OPEN VERIFIER
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Receipt Explorer
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            A public stream of Ed25519-signed agent receipts as they&apos;re
            produced by the platform. Every row is a real receipt — click
            through to the full canonical projection, run a live verification
            against <code className="font-mono text-cyan-300">/api/verify</code>
            , or paste the signature into your own browser to check it yourself.
          </p>
        </header>

        {/* Stats strip */}
        <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="In view"
            value={receipts === null ? "—" : `${receipts.length}`}
            sub="this snapshot"
            icon={Activity}
          />
          <StatCard
            label="Refresh"
            value={`${POLL_INTERVAL_MS / 1000}s`}
            sub="live polling"
            icon={RefreshCcw}
          />
          <StatCard
            label="Sealed"
            value="Ed25519 / PQ"
            sub="every row, post-quantum-ready"
            icon={Lock}
          />
          <StatCard
            label="Verifier"
            value="/api/verify"
            sub="open · CORS"
            icon={Shield}
          />
        </section>

        {/* Feed */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] bg-black/30 px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            <span>recent public receipts</span>
            <button
              onClick={() => void fetchFeed(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200 disabled:opacity-40"
              aria-label="Refresh feed"
            >
              {refreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCcw className="h-3 w-3" />
              )}
              <span>{lastFetchedAgoSec}s ago</span>
            </button>
          </div>

          {receipts === null && <FeedSkeleton />}
          {receipts !== null && receipts.length === 0 && <EmptyFeed />}
          {receipts !== null && receipts.length > 0 && (
            <ol className="divide-y divide-white/[0.04]">
              <AnimatePresence initial={false}>
                {receipts.map((r) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <FeedRow r={r} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
        </section>

        {error && (
          <p className="mt-3 text-center text-xs text-amber-300/80">{error}</p>
        )}

        {/* Subscribe via RSS — surfaces the feed for compliance teams
            and journalists who track audit-grade infrastructure. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-[11px]">
          <a
            href="/r/feed.xml"
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/[0.06] px-3 py-1.5 font-mono uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/[0.12]"
            aria-label="Subscribe via RSS"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20A2.18 2.18 0 0 1 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
            </svg>
            Subscribe via RSS
          </a>
          <Link
            href="/badge"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 font-mono uppercase tracking-wider text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
          >
            Get a verify badge →
          </Link>
        </div>

        <p className="mt-6 text-center text-[11px] text-neutral-600">
          Receipts marked &quot;public&quot; by their owners are enumerable
          here. &quot;Unlisted&quot; receipts stay share-by-link;
          &quot;private&quot; receipts never appear in any public feed. Read{" "}
          <Link
            href="/spec"
            className="text-neutral-400 underline-offset-2 hover:text-cyan-300 hover:underline"
          >
            /spec
          </Link>{" "}
          for the full visibility contract.
        </p>
      </div>
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Shield;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
        <Icon className="h-3 w-3 text-cyan-300/80" />
        {label}
      </div>
      <div className="font-mono text-sm font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] text-neutral-500">{sub}</div>
    </div>
  );
}

function FeedRow({ r }: { r: FeedReceipt }) {
  const created = new Date(r.createdAt);
  // Render the ISO string in compact form. We deliberately avoid
  // showing a relative "Xm ago" here because it'd require Date.now()
  // during render — the page header already shows refresh recency.
  const time = created.toUTCString().replace(" GMT", "");
  return (
    <Link
      href={`/r/${r.id}`}
      className="group flex flex-wrap items-center gap-3 px-5 py-3 transition hover:bg-cyan-500/[0.04]"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10"
        aria-hidden="true"
      >
        <Shield className="h-3 w-3 text-cyan-200" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white">{r.agentName}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Cpu className="h-2.5 w-2.5" />
            <span className="font-mono text-neutral-400">{r.modelUsed}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 font-mono">
            <Clock className="h-2.5 w-2.5" />
            {r.durationMs}ms
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-neutral-600">
            sig {r.signatureSha}
          </span>
        </span>
      </span>
      <span className="hidden flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-neutral-600 sm:block">
        {time}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-neutral-700 transition group-hover:text-cyan-300" />
    </Link>
  );
}

function FeedSkeleton() {
  return (
    <ol className="divide-y divide-white/[0.04]" aria-label="Loading receipts">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
          <span className="h-7 w-7 shrink-0 rounded-full bg-white/[0.04]" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3 w-1/3 rounded bg-white/[0.04]" />
            <span className="block h-2.5 w-2/3 rounded bg-white/[0.03]" />
          </span>
        </li>
      ))}
    </ol>
  );
}

function EmptyFeed() {
  return (
    <div className="px-6 py-12 text-center">
      <Shield className="mx-auto mb-3 h-6 w-6 text-neutral-700" />
      <p className="text-sm text-neutral-400">
        No public receipts yet on this deployment.
      </p>
      <p className="mt-1 max-w-md mx-auto text-xs text-neutral-500 leading-relaxed">
        Run any agent and mark its receipt{" "}
        <code className="font-mono text-neutral-400">public</code> via{" "}
        <code className="font-mono text-neutral-400">
          POST /api/agent-runs/&lt;id&gt;/publish
        </code>{" "}
        — it&apos;ll appear here within 15 seconds.
      </p>
    </div>
  );
}
