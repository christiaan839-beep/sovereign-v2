/**
 * /trust/audit — auditor-facing consolidation page.
 *
 * Companion to /trust (which is the editorial-toned principle page).
 * This URL is for AI auditor agents + procurement teams who need
 * one place to find every machine-readable trust artifact.
 *
 * Sources (all already shipped, this page just consolidates them):
 *   - /api/_meta/transparency.json — Sovereign Bill of Trust
 *   - /api/_meta/agents.json — per-agent capability manifest
 *   - docs/FMTI-SELF-AUDIT.md — our own AI-auditor-shaped self-grade
 *   - docs/THREAT_MODEL.md — STRIDE threat model
 *   - .well-known/security.txt — RFC 9116 vulnerability disclosure
 *   - /trust/defenders — public bug-bounty ledger
 */

import Link from "next/link";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const revalidate = 3600;

interface AgentsManifestSummary {
  count: number;
  tierDistribution: Record<string, number>;
}

async function loadAgentsSummary(): Promise<AgentsManifestSummary | null> {
  const path = join(process.cwd(), "src/lib/agent-manifests.generated.ts");
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const t1 = (text.match(/"tier":\s*1/g) ?? []).length;
  const t2 = (text.match(/"tier":\s*2/g) ?? []).length;
  const t3 = (text.match(/"tier":\s*3/g) ?? []).length;
  return {
    count: t1 + t2 + t3,
    tierDistribution: {
      "1-autonomous": t1,
      "2-confirm": t2,
      "3-admin-approval": t3,
    },
  };
}

async function loadFmtiScore(): Promise<{ overall: number; subdomains: number } | null> {
  const path = join(process.cwd(), "docs/FMTI-SELF-AUDIT.md");
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const m = text.match(/\*\*Overall:\*\*\s+([\d.]+)%\s+across\s+(\d+)/);
  if (!m) return null;
  return { overall: Number(m[1]), subdomains: Number(m[2]) };
}

export default async function TrustAuditPage() {
  const [agents, fmti] = await Promise.all([
    loadAgentsSummary(),
    loadFmtiScore(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 text-neutral-200">
      <header className="mb-12">
        <Link href="/trust" className="text-xs uppercase tracking-wide text-neutral-500 hover:text-neutral-300">
          ← /trust
        </Link>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">
          Audit hub
        </h1>
        <p className="mt-4 max-w-2xl text-base text-neutral-400">
          Every machine-readable claim Sovereign Matrix makes about itself,
          consolidated in one URL. Procurement teams + AI auditor agents
          (FMTI, EU AI Act baseline, NIST AI RMF, MITRE ATLAS) ingest from
          here.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-neutral-500">
          Schema-versioned. Refreshes every deploy. Designed for both
          human readers and autonomous auditor LLMs.
        </p>
      </header>

      {/* Headline numbers */}
      <section className="mb-12 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Self-audit score"
          value={fmti ? `${fmti.overall}%` : "—"}
          sub={fmti ? `${fmti.subdomains} applicable subdomains` : "audit pending"}
          href="/api/_meta/transparency.json"
          accent="emerald"
        />
        <Stat
          label="Agents classified"
          value={agents ? `${agents.count}` : "—"}
          sub={
            agents
              ? `${agents.tierDistribution["1-autonomous"]} T1 · ${agents.tierDistribution["2-confirm"]} T2 · ${agents.tierDistribution["3-admin-approval"]} T3`
              : "manifest pending"
          }
          href="/api/_meta/agents.json"
          accent="sky"
        />
        <Stat
          label="OWASP LLM Top 10"
          value="9 / 9"
          sub="applicable controls"
          href="/api/_meta/transparency.json"
          accent="violet"
        />
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-1">Machine-readable</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Two JSON endpoints. Schema-versioned. Every claim cites a source
          artifact. Auditor LLMs hit these directly.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            title="Sovereign Bill of Trust"
            description="Platform-level claims: identity, models, safety pipeline, quality, operations, user controls. Every claim cite-able to a file path."
            href="/api/_meta/transparency.json"
            footnote="schemaVersion: 1.0 · refreshes every deploy"
          />
          <Card
            title="Per-agent manifests"
            description="223 agents × tier + models + tools + PII guard mode + output class + capability signals. Auditor LLMs ingest the full taxonomy in one fetch."
            href="/api/_meta/agents.json"
            footnote="100% coverage · static-analysis-derived · manual overrides documented"
          />
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-1">Reflexive</h2>
        <p className="text-sm text-neutral-500 mb-6">
          We score ourselves against the same rubrics external auditors
          use. The score, the methodology, and the disagreements with
          our marketing are all published.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            title="FMTI self-audit"
            description="scripts/run-fmti-self-audit.mjs runs against our own transparency.json + agents.json. Rule-based + LLM-driven scoring across 23 subdomains. Disagreements surfaced explicitly."
            href="https://github.com/christiaan839-beep/sovereign-v2/blob/claude/wizardly-benz/docs/FMTI-SELF-AUDIT.md"
            footnote={fmti ? `current: ${fmti.overall}% · regenerated every deploy` : "score pending"}
          />
          <Card
            title="Threat model"
            description="STRIDE-shaped, every claim cites a file or test. Used as a procurement-ready security artifact instead of a fluffy security page."
            href="https://github.com/christiaan839-beep/sovereign-v2/blob/claude/wizardly-benz/docs/THREAT_MODEL.md"
            footnote="STRIDE · public · file-cited"
          />
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-1">Operational</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Live numbers from the same endpoints powering our internal
          dashboards.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            title="SLO + uptime"
            description="Postgres-backed cross-instance roll-up. p50/p95/p99 latency + success rate per endpoint over 24h. Same data we run on-call against."
            href="/status/slo"
            footnote="updated every 30s edge cache"
          />
          <Card
            title="Anti-drift weekly health"
            description="60+ machine-checked invariants on every PR: tsc clean, lint clean, no spoofable auth headers, no unsafe JSON.parse, every agent has a manifest."
            href="https://github.com/christiaan839-beep/sovereign-v2/blob/claude/wizardly-benz/scripts/weekly-health.mjs"
            footnote="CI-blocking · regenerated nightly"
          />
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-1">Disclosure + safe harbor</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Standard vulnerability disclosure flow. Researchers welcomed.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            title="security.txt"
            description="RFC 9116 vulnerability disclosure policy. Contact + canonical URL + acknowledgments + safe-harbor text."
            href="/.well-known/security.txt"
            footnote="contact within 24 business hours · 90-day disclosure"
          />
          <Card
            title="Defenders ledger"
            description="Public list of issues researchers have reported + how we responded. Closed issues link to the fix commit + the post-mortem."
            href="/trust/defenders"
            footnote="researcher acknowledgments · closed-issue ledger"
          />
        </div>
      </section>

      <footer className="mt-16 border-t border-white/10 pt-8 text-xs text-neutral-500">
        <p>
          Audience: <span className="text-neutral-300">human, ai-agent</span>.
          The machine-readable endpoints carry an{" "}
          <code>X-Sovereign-Transparency-Audience</code> header so auditor
          crawlers know they're a first-class consumer.
        </p>
        <p className="mt-3">
          Found a gap? File it via{" "}
          <Link href="/.well-known/security.txt" className="underline hover:text-neutral-300">
            security.txt
          </Link>
          . Want to verify a claim? Every artifact above links to the
          source file or test in the repo.
        </p>
      </footer>
    </main>
  );
}

interface StatProps {
  label: string;
  value: string;
  sub: string;
  href: string;
  accent: "emerald" | "sky" | "violet";
}

function Stat({ label, value, sub, href, accent }: StatProps) {
  const accentClass = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    sky: "border-sky-500/30 bg-sky-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
  }[accent];
  return (
    <Link
      href={href}
      className={`block rounded-xl border p-5 transition hover:bg-white/[0.04] ${accentClass}`}
    >
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{sub}</div>
    </Link>
  );
}

interface CardProps {
  title: string;
  description: string;
  href: string;
  footnote: string;
}

function Card({ title, description, href, footnote }: CardProps) {
  return (
    <Link
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="block rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <span className="text-xs text-neutral-500" aria-hidden>
          ↗
        </span>
      </div>
      <p className="mt-2 text-sm text-neutral-400">{description}</p>
      <div className="mt-3 text-xs text-neutral-500">{footnote}</div>
    </Link>
  );
}
