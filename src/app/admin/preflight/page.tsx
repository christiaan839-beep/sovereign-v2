"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Loader2,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

/**
 * /admin/preflight — single green-light dashboard for go-live.
 *
 * Reads /api/_admin/preflight and renders one tile per check, grouped
 * by concern (database / env / inference / payments / reliability).
 * The verdict is the headline:
 *
 *   "go"               → 0 blockers, 0 warnings — ship.
 *   "go-with-warnings" → 0 blockers, N warnings — ship if you've
 *                        decided the warnings are acceptable.
 *   "block"            → ≥1 blocker — do not ship.
 *
 * No mutation buttons here on purpose. Fixes happen in Vercel
 * (env vars), Neon (migrations), or the relevant /admin/<x> page.
 * This page is a read-only verdict.
 */

type CheckOk = true | false | "warn";
interface Check {
  ok: CheckOk;
  reason?: string;
}
interface Group {
  name: string;
  checks: Record<string, Check>;
}
interface PreflightResponse {
  ok: true;
  generatedAt: string;
  verdict: "go" | "go-with-warnings" | "block";
  counts: { greens: number; warnings: number; blockers: number };
  groups: Group[];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; data: PreflightResponse }
  | { kind: "error"; message: string };

export default function PreflightPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  async function fetchState(): Promise<LoadState> {
    try {
      const res = await fetch("/api/_admin/preflight", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as PreflightResponse;
        return { kind: "ok", data };
      }
      if (res.status === 401)
        return { kind: "error", message: "Sign in is required." };
      if (res.status === 404)
        return {
          kind: "error",
          message: "Not authorised. Add your Clerk user id to ADMIN_USER_IDS.",
        };
      return { kind: "error", message: `Unexpected response: ${res.status}` };
    } catch (err) {
      return {
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  async function load() {
    setState({ kind: "loading" });
    setState(await fetchState());
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || state.kind === "loading") {
    return (
      <Shell>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      </Shell>
    );
  }

  if (!isSignedIn) {
    return (
      <Shell>
        <div className="py-32 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-6 text-2xl font-bold">Sign in required</h1>
          <Link
            href="/sign-in?redirect_url=/admin/preflight"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-red-300">
            Couldn&rsquo;t load preflight
          </h2>
          <p className="mt-2 text-sm text-red-200/80">{state.message}</p>
          <button
            onClick={load}
            className="mt-4 rounded-full border border-white/10 px-4 py-2 text-xs hover:bg-white/5"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const { data } = state;

  return (
    <Shell>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-400">
            Operator
          </p>
          <h1 className="mt-2 text-3xl font-bold">Preflight</h1>
          <p className="mt-2 text-sm text-neutral-400 max-w-2xl">
            One page that says yes or no to &ldquo;is this deployment ready to
            take real money?&rdquo; Fix the red rows in Neon (migrations) or
            Vercel (env vars), then refresh.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </header>

      <Verdict verdict={data.verdict} counts={data.counts} />

      <div className="mt-10 space-y-8">
        {data.groups.map((g) => (
          <GroupBlock key={g.name} group={g} />
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-neutral-600">
        Snapshot: {new Date(data.generatedAt).toLocaleString()}
      </p>
    </Shell>
  );
}

function Verdict({
  verdict,
  counts,
}: {
  verdict: "go" | "go-with-warnings" | "block";
  counts: { greens: number; warnings: number; blockers: number };
}) {
  const tint =
    verdict === "go"
      ? "border-emerald-500/30 bg-emerald-500/[0.05]"
      : verdict === "go-with-warnings"
        ? "border-amber-500/30 bg-amber-500/[0.04]"
        : "border-red-500/30 bg-red-500/[0.05]";
  const headline =
    verdict === "go"
      ? "Cleared for launch."
      : verdict === "go-with-warnings"
        ? "Clear with warnings."
        : "Blocked.";
  const headlineColor =
    verdict === "go"
      ? "text-emerald-300"
      : verdict === "go-with-warnings"
        ? "text-amber-300"
        : "text-red-300";

  return (
    <div className={`rounded-2xl border p-6 ${tint}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-500">
            Verdict
          </p>
          <p className={`mt-1 text-3xl font-bold ${headlineColor}`}>
            {headline}
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="green" value={counts.greens} color="text-emerald-400" />
          <Stat
            label="warnings"
            value={counts.warnings}
            color="text-amber-300"
          />
          <Stat label="blockers" value={counts.blockers} color="text-red-400" />
        </div>
      </div>
      {verdict === "block" && (
        <p className="mt-5 text-sm text-red-200/80">
          One or more blockers must be cleared before any production-side action
          (live customer signup, payment-webhook activation, public DNS flip).
          The blockers below tell you exactly what to do.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <p className={`font-mono text-2xl font-bold ${color}`}>{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </p>
    </div>
  );
}

function GroupBlock({ group }: { group: Group }) {
  return (
    <section>
      <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-neutral-500 mb-3">
        {group.name}
      </h2>
      <div className="grid gap-2 md:grid-cols-2">
        {Object.entries(group.checks).map(([key, check]) => (
          <Row key={key} label={key} check={check} />
        ))}
      </div>
    </section>
  );
}

function Row({ label, check }: { label: string; check: Check }) {
  const Icon =
    check.ok === true
      ? CheckCircle2
      : check.ok === "warn"
        ? AlertTriangle
        : XCircle;
  const iconColor =
    check.ok === true
      ? "text-emerald-400"
      : check.ok === "warn"
        ? "text-amber-400"
        : "text-red-400";
  const tint =
    check.ok === true
      ? "border-white/5 bg-white/[0.02]"
      : check.ok === "warn"
        ? "border-amber-500/20 bg-amber-500/[0.02]"
        : "border-red-500/30 bg-red-500/[0.04]";
  return (
    <div className={`flex items-start gap-3 rounded-xl border ${tint} p-4`}>
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs text-neutral-200">{label}</p>
        {check.reason && (
          <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
            {check.reason}
          </p>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <Link
              href="/admin/customers"
              className="hover:text-neutral-300 transition"
            >
              Customers
            </Link>
            <Link
              href="/admin/tenants"
              className="hover:text-neutral-300 transition"
            >
              Tenants
            </Link>
            <Link
              href="/admin/health"
              className="hover:text-neutral-300 transition"
            >
              Health
            </Link>
            <Link
              href="/admin/preflight"
              className="hover:text-neutral-300 transition"
            >
              Preflight
            </Link>
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-6 py-12">{children}</div>
    </main>
  );
}
