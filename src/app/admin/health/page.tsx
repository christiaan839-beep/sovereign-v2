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
 * /admin/health — operator dashboard view of the public /api/health
 * endpoint, with a per-service traffic-light grid and a manual
 * refresh.
 *
 * Why duplicate the JSON in a UI: opening Vercel Logs to grep the
 * health response is the slow path. A single page that auto-refreshes
 * every 30s lets the operator confirm a deploy landed cleanly without
 * leaving the workspace.
 *
 * The endpoint itself never returns 5xx (intentional — see route.ts
 * comment at the top), so this page never has to render a generic
 * "something broke" state. Instead each subsystem renders its own
 * status: ok / sleeping / unconfigured / unreachable / error.
 */

interface HealthPayload {
  status: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  services: Record<string, string>;
  database: { status: string; latencyMs: number };
  circuits?: Record<string, unknown>;
  models?: { totalModels: number };
  agents?: { totalAgents: number };
}

const REFRESH_INTERVAL_MS = 30_000;

const SERVICE_LABELS: Record<string, string> = {
  db: "Postgres",
  nim: "NVIDIA NIM",
  gemini: "Google Gemini",
  claude: "Anthropic",
  groq: "Groq",
  redis: "Upstash Redis",
  email: "Resend",
  auth: "Clerk",
};

function statusColor(state: string): string {
  if (state === "ok") return "text-emerald-400";
  if (state === "sleeping") return "text-amber-300";
  if (state === "unconfigured") return "text-neutral-500";
  return "text-red-400";
}

function StatusIcon({ state }: { state: string }) {
  const className = `h-4 w-4 ${statusColor(state)}`;
  if (state === "ok") return <CheckCircle2 className={className} />;
  if (state === "sleeping" || state === "unconfigured")
    return <AlertTriangle className={className} />;
  return <XCircle className={className} />;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  return `${d}d ${h}h`;
}

export default function AdminHealthPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchHealth() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as HealthPayload;
      setPayload(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchHealth();
    const id = setInterval(() => {
      if (!cancelled) fetchHealth();
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
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
            href="/sign-in?redirect_url=/admin/health"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-400">
            Operator
          </p>
          <h1 className="mt-2 text-3xl font-bold">Platform health</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Live read from <code className="font-mono">/api/health</code>.
            Auto-refreshes every {REFRESH_INTERVAL_MS / 1000}s.
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/[0.05] p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {payload && (
        <>
          {/* Top-level status */}
          <div
            className={`rounded-2xl border p-6 ${
              payload.status === "ok"
                ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                : "border-amber-500/30 bg-amber-500/[0.04]"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-500">
                  Overall
                </p>
                <p
                  className={`mt-1 text-2xl font-semibold ${
                    payload.status === "ok"
                      ? "text-emerald-300"
                      : "text-amber-300"
                  }`}
                >
                  {payload.status}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
                <Datum label="version" value={payload.version} />
                <Datum
                  label="uptime"
                  value={formatUptime(payload.uptimeSeconds)}
                />
                <Datum
                  label="db latency"
                  value={
                    payload.database.latencyMs >= 0
                      ? `${payload.database.latencyMs}ms`
                      : "—"
                  }
                />
                <Datum
                  label="agents"
                  value={String(payload.agents?.totalAgents ?? "—")}
                />
              </div>
            </div>
          </div>

          {/* Service grid */}
          <h2 className="mt-10 mb-4 text-sm font-mono uppercase tracking-[0.2em] text-neutral-500">
            Services
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(payload.services).map(([key, state]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-100">
                    {SERVICE_LABELS[key] ?? key}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    {key}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon state={state} />
                  <span className={`text-xs font-mono ${statusColor(state)}`}>
                    {state}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {payload.models && (
            <p className="mt-6 text-sm text-neutral-500">
              {payload.models.totalModels} models registered &middot;{" "}
              {payload.agents?.totalAgents ?? 0} agents online
            </p>
          )}

          <p className="mt-12 text-center text-xs text-neutral-600">
            Snapshot: {new Date(payload.timestamp).toLocaleString()}
          </p>
        </>
      )}
    </Shell>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm text-neutral-200">{value}</p>
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
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-6 py-12">{children}</div>
    </main>
  );
}
