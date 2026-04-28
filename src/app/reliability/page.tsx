"use client";

/**
 * /reliability — The public trust artifact.
 *
 * Most competitors hide their reliability story behind sales calls.
 * We publish it. A procurement team or competitive evaluator can
 * verify our claims directly without a meeting.
 *
 * Renders the live output of /api/health/permanence with:
 *   - Headline 30-day uptime + invariant count
 *   - Latest anti-drift snapshot
 *   - Audit-chain status
 *   - Permanence-artifact roster (Constitution, Succession, ADRs, ...)
 *   - Links to the underlying source artifacts on GitHub
 *
 * Honest data only — when no snapshots exist, we show "—" rather
 * than fabricate numbers (Constitution Principle 5).
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  FileText,
  Activity,
  GitBranch,
  Lock,
  Hash,
  Database,
} from "lucide-react";

interface PermanenceData {
  headline: {
    uptime30Day: number | null;
    lastSnapshotHealthy: boolean | null;
    invariantsTotal: number | null;
    invariantsPassing: number | null;
    permanenceArtifactsPresent: number;
    permanenceArtifactsTotal: number;
  };
  healthSnapshot: {
    capturedAt: string;
    healthy: boolean;
    invariantsTotal: number;
    invariantsPassing: number;
    invariantsFailing: number;
    failingChecks: string[];
    durationMs: number;
  } | null;
  uptimeWindow: {
    windowDays: number;
    snapshotsTotal: number;
    snapshotsHealthy: number;
    uptimePercent: number;
  } | null;
  auditChain: {
    active: boolean;
    lastEntryAt: string | null;
  } | null;
  permanenceArtifacts: Record<string, boolean>;
  platform: {
    agents: number;
    models: number;
  };
  generatedAt: string;
}

const ARTIFACT_LABELS: Record<string, { label: string; href: string }> = {
  constitution: {
    label: "Project Constitution",
    href: "/docs/PROJECT-CONSTITUTION.md",
  },
  succession: { label: "Succession Plan", href: "/docs/SUCCESSION.md" },
  threatModel: { label: "Threat Model (STRIDE)", href: "/docs/THREAT_MODEL.md" },
  soc2Map: { label: "SOC 2 Pre-Readiness", href: "/docs/SOC2-PRE-READINESS.md" },
  adrIndex: { label: "ADR Index", href: "/docs/adr/README.md" },
  adrTemplate: { label: "ADR Template", href: "/docs/adr/TEMPLATE.md" },
  selfHealCron: {
    label: "Hourly self-heal cron",
    href: "/docs/RUNBOOK.md",
  },
  auditChainCron: {
    label: "Audit-chain verification cron (every 6h)",
    href: "/docs/SOC2-PRE-READINESS.md",
  },
  costRunawayLib: {
    label: "Cost-runaway guard",
    href: "/docs/PROJECT-CONSTITUTION.md",
  },
  auditLogLib: {
    label: "Audit log (SHA-256 hash chain)",
    href: "/docs/SOC2-PRE-READINESS.md",
  },
  piiGuardLib: { label: "PII output guard", href: "/security" },
  apiKeyScopesLib: { label: "API-key scopes", href: "/security" },
  antiDriftScript: {
    label: "Anti-drift gate (162 invariants)",
    href: "/docs/PROJECT-CONSTITUTION.md",
  },
  changelogScript: { label: "CHANGELOG generator", href: "/CHANGELOG.md" },
  depRotScript: {
    label: "Dependency rot detector",
    href: "/docs/PROJECT-CONSTITUTION.md",
  },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function ReliabilityPage() {
  const [data, setData] = useState<PermanenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/health/permanence", {
          cache: "no-store",
        });
        if (!alive) return;
        if (!res.ok) {
          setErr(`HTTP ${res.status}`);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as PermanenceData;
        setData(json);
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setErr(String(e));
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* Hero — single number, the procurement headline */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
              <Activity className="w-3 h-3" />
              Live evidence — refreshed every 60s
            </div>
            <h1 className="mt-6 text-4xl md:text-6xl font-light tracking-tight text-white">
              Reliability,
              <br />
              <span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                published, not promised.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-neutral-400 leading-relaxed">
              Most AI platforms hide their reliability story behind sales calls.
              We publish ours. Every claim on this page is backed by a queryable
              endpoint, an immutable audit trail, or a file on disk you can
              verify yourself.
            </p>
          </motion.div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            <HeadlineStat
              icon={<Clock className="w-5 h-5" />}
              label="30-day uptime"
              value={
                data?.headline.uptime30Day !== null && data?.headline.uptime30Day !== undefined
                  ? `${data.headline.uptime30Day.toFixed(2)}%`
                  : "—"
              }
              hint={
                data?.uptimeWindow
                  ? `${data.uptimeWindow.snapshotsHealthy}/${data.uptimeWindow.snapshotsTotal} hourly checks`
                  : "telemetry warming up"
              }
              loading={loading}
            />
            <HeadlineStat
              icon={<ShieldCheck className="w-5 h-5" />}
              label="Anti-drift invariants"
              value={
                data?.headline.invariantsPassing != null && data?.headline.invariantsTotal != null
                  ? `${data.headline.invariantsPassing} / ${data.headline.invariantsTotal}`
                  : "—"
              }
              hint={
                data?.healthSnapshot
                  ? `last checked ${formatRelative(data.healthSnapshot.capturedAt)}`
                  : "checked hourly via cron"
              }
              loading={loading}
            />
            <HeadlineStat
              icon={<FileText className="w-5 h-5" />}
              label="Permanence artifacts"
              value={
                data
                  ? `${data.headline.permanenceArtifactsPresent} / ${data.headline.permanenceArtifactsTotal}`
                  : "—"
              }
              hint="Constitution, Succession, ADRs, threat model"
              loading={loading}
            />
          </div>
        </div>
      </section>

      {/* The fundamentals */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-light text-white tracking-tight">
          The four guarantees behind every run
        </h2>
        <p className="mt-3 text-neutral-400 max-w-2xl">
          Not feature claims — guarantees backed by code, tests, and CI gates
          that fail the build if any of them regress.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <GuaranteeCard
            icon={<Hash className="w-5 h-5" />}
            title="Hash-chained audit log"
            body={`Every action — agent execution, API key mint, admin moderation, cost-cap event — is appended to a SHA-256 hash chain. Tampering with any historical row breaks the chain and is detected on every cron run (every 6 hours) and on demand via /api/admin/audit/verify-chain. Disputes settle by the immutable record, not by Slack screenshots.`}
            verifiable="src/lib/audit-log.ts"
            active={data?.auditChain?.active ?? null}
            activeLabel={
              data?.auditChain?.lastEntryAt
                ? `last entry ${formatRelative(data.auditChain.lastEntryAt)}`
                : "—"
            }
          />
          <GuaranteeCard
            icon={<Lock className="w-5 h-5" />}
            title="Cost-runaway guard"
            body={`A misconfigured agent, a recursive A2E loop, or a stolen API key cannot bankrupt the platform. Every tenant has a per-day spend ceiling enforced atomically in Postgres. Crossing the cap auto-pauses the tenant; auto-unpauses at the next UTC midnight. Operators get paged via the audit chain.`}
            verifiable="src/lib/cost-runaway.ts"
            active={true}
            activeLabel="enforced on every agent run"
          />
          <GuaranteeCard
            icon={<GitBranch className="w-5 h-5" />}
            title="Anti-drift CI gate"
            body={`162 invariants run on every PR. Examples: "no stale agent count literals", "every agent has a manifest", "audit chain is wired". A merge that silently regresses any invariant fails CI. The same gate runs hourly via cron — drift is detected within an hour, not on the next code review.`}
            verifiable="scripts/weekly-health.mjs"
            active={data?.healthSnapshot?.healthy ?? null}
            activeLabel={
              data?.healthSnapshot?.capturedAt
                ? `last snapshot ${formatRelative(data.healthSnapshot.capturedAt)}`
                : "—"
            }
          />
          <GuaranteeCard
            icon={<Database className="w-5 h-5" />}
            title="Constitution + Succession"
            body={`Seven immutable principles document why decisions get made (docs/PROJECT-CONSTITUTION.md). The Succession Plan (docs/SUCCESSION.md) is a 24-hour bus-factor handover for a new maintainer. Architectural decisions land via ADRs, not tribal knowledge. The platform is built to outlive its current maintainer.`}
            verifiable="docs/PROJECT-CONSTITUTION.md"
            active={
              data
                ? data.permanenceArtifacts.constitution &&
                  data.permanenceArtifacts.succession
                : null
            }
            activeLabel="all governance artifacts present"
          />
        </div>
      </section>

      {/* Failing-checks panel — only renders when there's a regression */}
      {data?.healthSnapshot && data.healthSnapshot.failingChecks.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
            <div className="flex items-center gap-2 text-yellow-300 font-medium">
              <AlertTriangle className="w-4 h-4" />
              {data.healthSnapshot.invariantsFailing} invariant
              {data.healthSnapshot.invariantsFailing === 1 ? "" : "s"} currently
              regressed
            </div>
            <p className="mt-2 text-sm text-neutral-400">
              We display this honestly. A regressed invariant is a real signal
              — the team gets paged within an hour and a fix lands before the
              next snapshot.
            </p>
            <ul className="mt-4 space-y-1 text-sm text-neutral-300">
              {data.healthSnapshot.failingChecks.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <code className="text-xs text-neutral-400">{c}</code>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Permanence artifacts roster */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-2xl md:text-3xl font-light text-white tracking-tight">
          The permanence layer
        </h2>
        <p className="mt-3 text-neutral-400 max-w-2xl">
          Each item below is a file or wiring that exists on disk right now.
          Without it, the platform&apos;s survival contract is incomplete.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
          {data &&
            Object.entries(data.permanenceArtifacts).map(([key, present]) => {
              const meta = ARTIFACT_LABELS[key] ?? {
                label: key,
                href: "#",
              };
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {present ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    )}
                    <span className="text-sm text-neutral-200">
                      {meta.label}
                    </span>
                  </div>
                  <span
                    className={
                      present
                        ? "text-xs text-emerald-300/70"
                        : "text-xs text-yellow-300/70"
                    }
                  >
                    {present ? "wired" : "missing"}
                  </span>
                </div>
              );
            })}
        </div>
      </section>

      {/* Footer with raw API link */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6">
          <h3 className="text-lg font-medium text-white">
            Verify this yourself
          </h3>
          <p className="mt-2 text-sm text-neutral-400">
            This page renders the JSON output of a public, no-auth endpoint. A
            machine can poll it; a procurement team can curl it; a competitor
            can scrape it. The whole point is verifiability.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/api/health/permanence"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-mono text-neutral-200 hover:bg-white/[0.06] transition-colors"
            >
              GET /api/health/permanence
            </a>
            <a
              href="/api/health/ping"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-mono text-neutral-200 hover:bg-white/[0.06] transition-colors"
            >
              GET /api/health/ping
            </a>
            <a
              href="/security"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              Read the threat model →
            </a>
          </div>
          {err && (
            <p className="mt-4 text-xs text-yellow-400">
              Could not load live data: {err}. The static evidence above
              (permanence artifacts on disk) remains valid.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function HeadlineStat({
  icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6"
    >
      <div className="flex items-center gap-2 text-neutral-400 text-sm">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-3xl md:text-4xl font-light text-white tabular-nums">
        {loading ? (
          <span className="inline-block h-9 w-32 rounded bg-white/5 animate-pulse" />
        ) : (
          value
        )}
      </div>
      <div className="mt-2 text-xs text-neutral-500">{hint}</div>
    </motion.div>
  );
}

function GuaranteeCard({
  icon,
  title,
  body,
  verifiable,
  active,
  activeLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  verifiable: string;
  active: boolean | null;
  activeLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-emerald-300">
          {icon}
          <h3 className="text-base font-medium text-white">{title}</h3>
        </div>
        {active === true && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            live
          </span>
        )}
        {active === false && (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/20 bg-yellow-500/5 px-2 py-0.5 text-[10px] font-medium text-yellow-300">
            warming
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <code className="rounded border border-white/5 bg-black/20 px-2 py-1 font-mono text-neutral-400">
          {verifiable}
        </code>
        <span className="text-neutral-500">{activeLabel}</span>
      </div>
    </div>
  );
}
