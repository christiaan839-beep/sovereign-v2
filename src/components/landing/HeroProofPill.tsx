"use client";

/**
 * HeroProofPill — slim live-verification indicator for the landing
 * hero.
 *
 * Pulls /api/agent-runs/latest-public on mount and displays the
 * freshest public receipt id with a subtle pulsing cyan dot. Clicks
 * through to /r/<id>. Stripe's landing hero shows a fake code editor
 * for credibility; this is Sovereign's analog — a real, live-fetched
 * proof-of-life from the production verifier.
 *
 * Visual contract:
 *   - 28px-tall pill with cyan accent (audit/infra surface per
 *     docs/design-system/brand-colors.md)
 *   - 6px pulsing dot — animation respects prefers-reduced-motion
 *   - Mono caption with the truncated receipt id
 *   - Whole pill is a clickable Link → /r/<id>
 *
 * Failure modes:
 *   - Loading: shows a skeleton-styled pill with "Loading…" copy
 *   - No public receipts on the deployment: shows
 *     "Live verifier · run an agent →" linking to /signup
 *   - Network/DB error: shows "Live verifier →" linking to /verified
 *     (degrades gracefully — never breaks the hero)
 *
 * SSR-safe: all network work happens in useEffect on the client.
 * Server pre-renders the loading skeleton.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

interface FreshestReceipt {
  receipt: { id: string; agentName: string; createdAt: string } | null;
  reason?: string;
}

export function HeroProofPill() {
  const [data, setData] = useState<FreshestReceipt | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent-runs/latest-public")
      .then((r) => r.json() as Promise<FreshestReceipt>)
      .then((json) => {
        if (cancelled) return;
        setData(json);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Loading skeleton — same height as the hydrated states to prevent
  // CLS in the hero.
  if (!data && !error) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.04] px-3 py-1 backdrop-blur-xl">
        <span className="relative inline-flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-500/30 animate-pulse motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500/40" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">
          Live verifier · loading…
        </span>
      </div>
    );
  }

  // Empty / error: degrade to a static link, don't break the hero.
  if (error || !data?.receipt) {
    return (
      <Link
        href="/verified"
        className="group inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/[0.06] px-3 py-1 backdrop-blur-xl transition hover:border-cyan-500/50 hover:bg-cyan-500/[0.1]"
      >
        <span className="relative inline-flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-50 animate-ping motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200">
          Live verifier
        </span>
        <span className="font-mono text-[10px] text-cyan-400/70 transition group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    );
  }

  const id = data.receipt.id;
  const agentName = data.receipt.agentName;
  const truncatedId = id.length > 8 ? `${id.slice(0, 8)}…` : id;
  // Malformed createdAt yields NaN here; RelativeTime guards
  // internally against NaN and renders nothing in that case.
  const createdAtMs = new Date(data.receipt.createdAt).getTime();

  return (
    <motion.div
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/r/${id}`}
        className="group inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/[0.08] px-3 py-1 backdrop-blur-xl transition hover:border-cyan-500/60 hover:bg-cyan-500/[0.12]"
        aria-label={`Open the freshest verified receipt: ${agentName} (${truncatedId})`}
      >
        <span className="relative inline-flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-65 animate-ping motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200">
          Verified
        </span>
        <span className="font-mono text-[10px] text-cyan-300/80">·</span>
        <span className="font-mono text-[10px] text-cyan-100">{agentName}</span>
        <span className="font-mono text-[10px] text-cyan-400/60">
          {truncatedId}
        </span>
        <RelativeTime ms={createdAtMs} />
        <span className="font-mono text-[10px] text-cyan-400/70 transition group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </motion.div>
  );
}

/**
 * RelativeTime — renders "Xs ago" / "Xm ago". Uses an effect to
 * compute Date.now() (out of render to satisfy the React Compiler
 * purity check) and a setInterval to refresh every 15s.
 */
function RelativeTime({ ms }: { ms: number }) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    if (!Number.isFinite(ms)) {
      // Malformed createdAt — render nothing rather than "NaNs ago".
      // Initial state is already "" so no setLabel call needed.
      return;
    }
    function recompute() {
      const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
      if (seconds < 60) setLabel(`${seconds}s ago`);
      else if (seconds < 3600) setLabel(`${Math.round(seconds / 60)}m ago`);
      else if (seconds < 86_400) setLabel(`${Math.round(seconds / 3600)}h ago`);
      else setLabel(`${Math.round(seconds / 86_400)}d ago`);
    }
    recompute();
    const t = setInterval(recompute, 15_000);
    return () => clearInterval(t);
  }, [ms]);

  if (!label) return null;
  return (
    <>
      <span className="font-mono text-[10px] text-cyan-300/80">·</span>
      <span className="font-mono text-[10px] text-cyan-300/70">{label}</span>
    </>
  );
}
