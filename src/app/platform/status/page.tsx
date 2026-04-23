/**
 * /platform/status — live platform dependency health.
 *
 * Server-rendered; probes /api/_health/deep on every render (cached
 * at the edge for 30s so simultaneous refreshes don't thrash the
 * providers). Refresh the page for a fresh probe.
 *
 * Complements the marketing-oriented /status page by showing the
 * concrete providers the platform is ACTUALLY using right now
 * (NVIDIA NIM, Anthropic, Google AI, Neon, Clerk, Resend, Tavily)
 * with real latency numbers — not abstract "API Gateway" labels.
 *
 * This is the operator-trust surface. A competitor can claim 99.9%
 * uptime on a marketing page; they can't fake live probe numbers.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 30; // edge-cached for 30s

export const metadata: Metadata = {
  title: "Platform status — Sovereign Matrix",
  description:
    "Live health of every Sovereign Matrix dependency: Neon database, NIM, Anthropic, Google AI, Clerk, Resend. Refresh for a fresh probe.",
};

interface ProviderCheck {
  status: string;
  latencyMs?: number;
  error?: string;
}

interface DeepHealthResponse {
  status?: string;
  timestamp?: string;
  checks?: Record<string, ProviderCheck>;
}

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function fetchHealth(): Promise<DeepHealthResponse | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/_health/deep`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as DeepHealthResponse;
  } catch {
    return null;
  }
}

function statusTone(status: string): "ok" | "warn" | "fail" | "unknown" {
  const s = status.toLowerCase();
  if (s === "operational" || s === "ok" || s === "ready") return "ok";
  if (s === "degraded" || s === "slow" || s === "skipped" || s === "not_configured") return "warn";
  if (s === "down" || s === "failed") return "fail";
  return "unknown";
}

function toneColor(tone: "ok" | "warn" | "fail" | "unknown"): string {
  if (tone === "ok") return "var(--ed-copper)";
  if (tone === "warn") return "var(--ed-ink-soft)";
  if (tone === "fail") return "var(--ed-copper)";
  return "var(--ed-ink-soft)";
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "operational") return "Operational";
  if (s === "degraded") return "Degraded";
  if (s === "down" || s === "failed") return "Down";
  if (s === "not_configured") return "Not configured";
  if (s === "skipped") return "Skipped";
  return status;
}

function providerDisplayName(key: string): string {
  const map: Record<string, string> = {
    database: "Neon (Postgres)",
    nvidia: "NVIDIA NIM",
    nvidia_nim: "NVIDIA NIM",
    claude: "Anthropic",
    anthropic: "Anthropic",
    gemini: "Google AI",
    google: "Google AI",
    google_ai: "Google AI",
    groq: "Groq",
    cerebras: "Cerebras",
    clerk: "Clerk (auth)",
    resend: "Resend (email)",
    tavily: "Tavily (web search)",
  };
  return map[key.toLowerCase()] ?? key;
}

function latencyTier(latencyMs: number | undefined): string {
  if (typeof latencyMs !== "number") return "—";
  if (latencyMs < 200) return `${latencyMs} ms · fast`;
  if (latencyMs < 1000) return `${latencyMs} ms · normal`;
  if (latencyMs < 3000) return `${latencyMs} ms · slow`;
  return `${latencyMs} ms · very slow`;
}

export default async function Page() {
  const health = await fetchHealth();
  const probedAt = new Date().toISOString();
  const checks = Object.entries(health?.checks ?? {});
  const probeReached = checks.length > 0;
  const tones = checks.map(([, c]) => statusTone(c.status));
  const allOperational = tones.every((t) => t === "ok");
  const anyDown = tones.some((t) => t === "fail");

  const headline = !probeReached
    ? "Status probe unreachable"
    : anyDown
    ? "Some dependencies are down"
    : allOperational
    ? "All systems operational"
    : "Some systems degraded";

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-4xl mx-auto px-6 pt-14 pb-24">
        <nav className="ed-caption mb-10">
          <Link
            href="/"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← Sovereign Matrix
          </Link>
        </nav>

        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Platform status
          </p>
          <h1 className="ed-display text-5xl mb-4" style={{ color: "var(--ed-ink)" }}>
            {headline}
          </h1>
          <p className="ed-body max-w-2xl" style={{ color: "var(--ed-ink-soft)" }}>
            Live dependency probe. Every refresh triggers a fresh check
            against each provider&rsquo;s actual API — no cached dashboard
            lag, no human-edited incident log. Edge-cached for 30s so
            simultaneous refreshes don&rsquo;t hammer the providers.
          </p>
        </header>

        {probeReached ? (
          <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
            <div
              className="grid grid-cols-[2fr_1fr_1.5fr] gap-4 px-5 py-3 ed-label"
              style={{
                borderBottom: "1px solid var(--ed-rule)",
                background: "var(--ed-bg-raised)",
                color: "var(--ed-ink-soft)",
              }}
            >
              <span>Provider</span>
              <span>Status</span>
              <span className="text-right">Latency</span>
            </div>
            {checks.map(([key, check]) => {
              const tone = statusTone(check.status);
              return (
                <div
                  key={key}
                  className="grid grid-cols-[2fr_1fr_1.5fr] gap-4 px-5 py-4 items-baseline"
                  style={{ borderBottom: "1px solid var(--ed-rule)" }}
                >
                  <span className="ed-body" style={{ color: "var(--ed-ink)" }}>
                    {providerDisplayName(key)}
                  </span>
                  <span
                    className="ed-mono text-sm"
                    style={{ color: toneColor(tone) }}
                  >
                    {statusLabel(check.status)}
                  </span>
                  <span
                    className="ed-mono text-sm text-right"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    {latencyTier(check.latencyMs)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="p-10 text-center"
            style={{
              border: "1px solid var(--ed-rule)",
              background: "var(--ed-bg-raised)",
              color: "var(--ed-ink-soft)",
              borderRadius: "2px",
            }}
          >
            <p className="ed-body">
              Could not reach the internal health probe. The platform itself
              may be operational — this page just couldn&rsquo;t measure.
            </p>
          </div>
        )}

        <section className="mt-14 pt-8" style={{ borderTop: "1px solid var(--ed-rule)" }}>
          <h2 className="ed-label mb-5">How this page works</h2>
          <ul className="space-y-2 ed-caption" style={{ color: "var(--ed-ink-soft)" }}>
            <li>
              Refreshes trigger{" "}
              <span className="ed-mono">GET /api/_health/deep</span>, which
              issues a timed request against each provider&rsquo;s own
              health endpoint.
            </li>
            <li>Latency is measured server-to-provider, not browser-to-us.</li>
            <li>Edge cache of 30s prevents thrashing providers.</li>
            <li>
              No marketing dashboard. The probe IS the source of truth —
              a competitor can claim uptime, but can&rsquo;t fake live
              probe numbers.
            </li>
          </ul>
        </section>

        <footer
          className="mt-10 pt-6 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <span>
            Probed at: <span className="ed-mono">{probedAt}</span>
          </span>
          <Link
            href="/trust"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Security posture →
          </Link>
          <Link
            href="/status"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            SLA summary →
          </Link>
        </footer>
      </div>
    </div>
  );
}
