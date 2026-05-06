"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

/**
 * /status — public, real-time reliability dashboard.
 *
 * Renders `/api/health/deep` with auto-refresh every 60 s. Every
 * tile is a real ping result (DB SELECT 1, AI provider model-list
 * pings, env-presence checks for the rest). The page deliberately
 * exists so a prospect can send the URL to their boss as proof of
 * operational discipline — and so a customer wondering "is it me?"
 * can self-answer in 5 seconds.
 *
 * No hardcoded uptime claims. The numbers are whatever the live
 * pings say. If something is down, the page says so. If something
 * recovers, the page reflects that within the next 60 s tick.
 */

type CheckStatus = "ok" | "degraded" | "down";
interface Check {
  status: CheckStatus;
  latency_ms: number;
  detail?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "down" | "partial";
  healthy: number;
  degraded: number;
  down: number;
  total: number;
  uptime_percent: number;
  checks: Record<string, Check>;
  checked_at: string;
  total_latency_ms: number;
}

const REFRESH_MS = 60_000;

const CHECK_LABELS: Record<string, { label: string; group: string }> = {
  database: { label: "Database (Neon)", group: "Core" },
  nvidia_nim: { label: "NVIDIA NIM", group: "AI Providers" },
  anthropic: { label: "Anthropic Claude", group: "AI Providers" },
  gemini: { label: "Google Gemini", group: "AI Providers" },
  groq: { label: "Groq", group: "AI Providers" },
  email: { label: "Email (Resend)", group: "Operations" },
  auth: { label: "Auth (Clerk)", group: "Operations" },
  payments_paypal: { label: "Payments (PayPal)", group: "Payments" },
  payments_yoco: { label: "Payments (Yoco)", group: "Payments" },
  payments_stripe: { label: "Payments (Stripe)", group: "Payments" },
};

export default function StatusPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(isFirst: boolean) {
      try {
        const res = await fetch("/api/health/deep", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HealthResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
          setLastRefreshAt(new Date());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unreachable");
        }
      } finally {
        if (!cancelled && isFirst) setLoadingFirst(false);
      }
    }
    load(true);
    const id = setInterval(() => load(false), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <Link
            href="/proof"
            className="text-xs text-neutral-400 hover:text-neutral-100 transition"
          >
            See the numbers &rarr;
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* ── Headline ── */}
        <header className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-500/60">
              Live status
            </p>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">
              {loadingFirst ? (
                <span className="text-neutral-500">Checking…</span>
              ) : data?.status === "healthy" ? (
                <span>
                  <span className="text-emerald-400">All systems</span>{" "}
                  <span className="text-white">operational.</span>
                </span>
              ) : data?.status === "down" ? (
                <span>
                  <span className="text-red-400">A core service</span>{" "}
                  <span className="text-white">is down.</span>
                </span>
              ) : (
                <span>
                  <span className="text-amber-400">Some services</span>{" "}
                  <span className="text-white">are degraded.</span>
                </span>
              )}
            </h1>
            {data && (
              <p className="mt-3 text-sm text-neutral-400">
                {data.healthy}/{data.total} services healthy &middot;{" "}
                <span className="font-mono text-neutral-300">
                  {data.uptime_percent.toFixed(1)}%
                </span>{" "}
                right now &middot; total ping{" "}
                <span className="font-mono text-neutral-300">
                  {data.total_latency_ms}ms
                </span>
              </p>
            )}
          </div>
          <RefreshIndicator
            lastRefreshAt={lastRefreshAt}
            loading={loadingFirst}
          />
        </header>

        {error && !data && (
          <div className="mb-12 rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-6 flex gap-4">
            <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <p className="text-sm font-semibold text-red-300">
                Status endpoint unreachable
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                If you&rsquo;re seeing this, the Vercel edge in your region may
                be having an incident. Auto-retry in 60 s. ({error})
              </p>
            </div>
          </div>
        )}

        {data && <Groups data={data} />}

        <section className="mt-20 rounded-2xl border border-white/5 bg-white/[0.02] p-7">
          <h3 className="text-lg font-semibold text-white">
            What we hold ourselves to
          </h3>
          <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
            Beyond the live numbers above, we commit to four bars in{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
              STANDARDS.md
            </code>
            : every lead is hand-reviewed before it ships, every Slack message
            gets a reply within an hour during business hours, Monday delivery
            is sacred (miss it, the month is on us), and money-back is
            no-friction same-day.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/proof"
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              See the live numbers &rarr;
            </Link>
            <span className="text-neutral-700">·</span>
            <Link
              href="/letters"
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              Friday Letter archive &rarr;
            </Link>
            <span className="text-neutral-700">·</span>
            <Link
              href="/lead-engine"
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              See the Lead Engine &rarr;
            </Link>
          </div>
        </section>

        {data && (
          <p className="mt-12 text-center text-xs text-neutral-600">
            Auto-refreshes every 60 s &middot; last checked{" "}
            <time dateTime={data.checked_at}>
              {new Date(data.checked_at).toLocaleTimeString("en-US")}
            </time>
          </p>
        )}
      </div>

      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-neutral-600">
          Sovereign Matrix &middot;{" "}
          <Link href="/" className="hover:text-neutral-400">
            Home
          </Link>{" "}
          &middot;{" "}
          <Link href="/proof" className="hover:text-neutral-400">
            Proof
          </Link>{" "}
          &middot;{" "}
          <Link href="/letters" className="hover:text-neutral-400">
            Letters
          </Link>
        </div>
      </footer>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function RefreshIndicator({
  lastRefreshAt,
  loading,
}: {
  lastRefreshAt: Date | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-xs text-neutral-500 flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Pinging 10 services in parallel…
      </div>
    );
  }
  return (
    <div className="text-xs text-neutral-500 flex items-center gap-2">
      <RefreshCw className="h-3 w-3" />
      {lastRefreshAt
        ? `Refreshed ${lastRefreshAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
        : "Refreshed just now"}
    </div>
  );
}

function Groups({ data }: { data: HealthResponse }) {
  const groups = new Map<string, [string, Check][]>();
  for (const [key, check] of Object.entries(data.checks)) {
    const meta = CHECK_LABELS[key] ?? { label: key, group: "Other" };
    if (!groups.has(meta.group)) groups.set(meta.group, []);
    groups.get(meta.group)!.push([key, check]);
  }

  const order = ["Core", "AI Providers", "Payments", "Operations", "Other"];
  const sorted = [...groups.entries()].sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
  );

  return (
    <div className="space-y-10">
      {sorted.map(([group, items]) => (
        <section key={group}>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-4">
            {group}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map(([key, check]) => (
              <Tile key={key} tileKey={key} check={check} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Tile({ tileKey, check }: { tileKey: string; check: Check }) {
  const meta = CHECK_LABELS[tileKey] ?? { label: tileKey, group: "Other" };
  const Icon =
    check.status === "ok"
      ? CheckCircle2
      : check.status === "degraded"
        ? AlertTriangle
        : XCircle;
  const tint =
    check.status === "ok"
      ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300"
      : check.status === "degraded"
        ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-300"
        : "border-red-500/30 bg-red-500/[0.06] text-red-300";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${tint} p-5`}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold text-white">{meta.label}</h3>
            <span className="font-mono text-[11px] text-neutral-500">
              {check.latency_ms}ms
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400 capitalize">
            {check.status}
            {check.detail ? (
              <span className="text-neutral-500"> &middot; {check.detail}</span>
            ) : null}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
