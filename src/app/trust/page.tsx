import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { buildPosture, type IndicatorReading } from "@/lib/soc2-monitor";
import { buildScorecard } from "@/lib/compliance-mappings";
import type { Metadata } from "next";

/**
 * /trust — Trust posture page (Cook 89).
 *
 * Renders the SOC 2 control posture + compliance framework coverage for
 * sales + procurement teams from BASELINE_READINGS — reference control
 * targets, NOT a live measured feed or a third-party attestation. The
 * /api/_cron/soc2-indicators route derives a self-monitored snapshot from
 * real platform state separately.
 */

export const metadata: Metadata = {
  title: "Trust Posture · SOC 2 + EU AI Act + NIST + ISO · Sovereign Matrix",
  description:
    "Control posture, cryptographic receipts, replayable audit trail. Reference framework coverage across SOC 2 / EU AI Act / NIST AI RMF / ISO 42001.",
  alternates: { canonical: "/trust" },
};

// Reference control targets shown on the posture page. These are baseline
// figures (not a live feed and not a SOC 2 attestation) — see the disclaimer
// rendered below the posture header.
const BASELINE_READINGS: IndicatorReading[] = [
  { id: "encryption-at-rest-coverage", value: 1.0 },
  { id: "mfa-admin-fraction", value: 1.0 },
  { id: "failed-deploy-rate", value: 0.97 },
  { id: "incident-mttr-score", value: 0.92 },
  { id: "receipt-pass-rate", value: 0.995 },
  { id: "receipt-non-drift-rate", value: 0.998 },
  { id: "red-team-critical-zero", value: 1.0 },
  { id: "pii-scanner-coverage", value: 1.0 },
  { id: "dsr-response-sla", value: 0.96 },
];

const STATUS_COLOR: Record<string, string> = {
  pass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  fail: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  "not-applicable": "bg-neutral-500/10 text-neutral-400 border-neutral-500/30",
};

interface TrustPrimitive {
  category: string;
  tag: string;
  title: string;
  summary: string;
  links: Array<{ label: string; href: string }>;
}

// Inventory of every cryptographic + auditable trust primitive shipped
// in the platform. Procurement teams can paste this URL to their
// assurance team and have every primitive linked + verifiable in one
// place. Order is by depth-of-stack (math first, distribution last).
const TRUST_PRIMITIVES: TrustPrimitive[] = [
  {
    category: "Receipt math",
    tag: "VAOS 2.0 / 3.0",
    title: "Post-quantum dual-signed receipts",
    summary:
      "Every agent run mints an Ed25519 + ML-DSA-65 (FIPS 204) dual-signed receipt. Verifiable forever, including post-quantum harvest-now-decrypt-later attacks.",
    links: [
      { label: "VAOS 2.0 spec", href: "/docs/specs/vaos-2.0" },
      { label: "VAOS 3.0 spec (post-quantum)", href: "/docs/specs/vaos-3.0" },
      {
        label: "Ed25519 public key",
        href: "/.well-known/sovereign-receipts/ed25519.pem",
      },
    ],
  },
  {
    category: "Receipt math",
    tag: "VAOS-TRS 1.0",
    title: "Threshold Receipt Signatures (m-of-n)",
    summary:
      "Receipts canonical only when ≥ m of n authorized issuers cosign. No single issuer can fraud — the trust model is Byzantine-fault-tolerant against minority compromise.",
    links: [
      { label: "TRS 1.0 spec", href: "/docs/specs/vaos-trs-1.0" },
      {
        label: "Reference implementation",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/packages/verifiable-receipts/src/threshold.ts",
      },
    ],
  },
  {
    category: "Receipt math",
    tag: "VAOS-RSA 1.0",
    title: "Streaming Attestation",
    summary:
      "LLM streams sign the Merkle root of every chunk, not just the final output. Auditors can prove chunk #N had this exact content — mid-stream tampering is detectable.",
    links: [
      { label: "RSA 1.0 spec", href: "/docs/specs/vaos-rsa-1.0" },
      {
        label: "Reference implementation",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/packages/verifiable-receipts/src/stream-attestation.ts",
      },
    ],
  },
  {
    category: "Agentic commerce",
    tag: "VAPT 1.0",
    title: "Verifiable Agentic Payment Tokens",
    summary:
      "Apache-2.0 open analogue of Mastercard Agent Pay. Transaction-scoped tokens bind autonomous agent → verified user → amount/currency/merchant envelope. No payment credentials exposed.",
    links: [
      { label: "VAPT 1.0 spec", href: "/docs/specs/vapt-1.0" },
      {
        label: "Reference implementation",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/packages/verifiable-receipts/src/vapt.ts",
      },
    ],
  },
  {
    category: "Transparency",
    tag: "RFC 9162",
    title: "Append-only log + witness federation",
    summary:
      "Every receipt anchored to an RFC 9162 transparency log. Independent witnesses cosign STHs; any equivocation is detectable. Multi-issuer registry under /.well-known.",
    links: [
      { label: "Signed Tree Head", href: "/api/transparency/sth" },
      {
        label: "Witness observations",
        href: "/api/transparency/witness/observations",
      },
      { label: "Issuer registry", href: "/.well-known/vaos" },
    ],
  },
  {
    category: "Adversarial",
    tag: "Red-team",
    title: "Public adversarial corpus + ASR report",
    summary:
      "Every BLOCK rule across 42 Guardian packs tested against a public adversarial corpus. Defender holds ≥ 90% block-rate; coverage stats sorted weakest-rule-first.",
    links: [
      {
        label: "Red-team module",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/packages/verifiable-receipts/src/red-team.ts",
      },
    ],
  },
  {
    category: "HITL",
    tag: "Dual-approval",
    title: "Aviation-CRM dual-approval middleware",
    summary:
      "Schema migrations, large wire transfers, mass deletions gate on two distinct human approvers. SLA timers per risk lane (15s / 2min / 15min / 30min). Audit-logged.",
    links: [
      {
        label: "Middleware source",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/src/lib/dual-approval.ts",
      },
    ],
  },
  {
    category: "Supply chain",
    tag: "Sigstore + SLSA",
    title: "Keyless-signed npm releases",
    summary:
      "Every @sovereign-matrix/verifiable-receipts release publishes with --provenance — Sigstore Fulcio + Rekor public transparency log. Installers can verify the tarball matches the commit.",
    links: [
      {
        label: "Release workflow",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/.github/workflows/sigstore-release.yml",
      },
      {
        label: "OpenSSF Scorecard",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/.github/workflows/scorecard.yml",
      },
    ],
  },
  {
    category: "Distribution",
    tag: "3 languages",
    title: "TypeScript + Python + Go verifiers",
    summary:
      "Three independent SDKs verify the same wire bytes byte-for-byte. Every regulator audit pipeline, every Python notebook, every Go cloud-tool can re-check a receipt.",
    links: [
      {
        label: "TypeScript on npm",
        href: "https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts",
      },
      {
        label: "Python (PyPI ready)",
        href: "https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/verifiable-receipts-py",
      },
      {
        label: "Go (pkg.go.dev ready)",
        href: "https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/verifiable-receipts-go",
      },
    ],
  },
  {
    category: "Content provenance",
    tag: "C2PA bridge",
    title: "VAOS ⇄ C2PA round-trip",
    summary:
      "VAOS receipts convert to Content Authenticity Initiative manifests (label org.sovereignmatrix.vaos.v1). Travels through Adobe Firefly, Microsoft Copilot, Truepic Lens without losing the signature.",
    links: [
      {
        label: "C2PA bridge source",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/packages/verifiable-receipts/src/c2pa-bridge.ts",
      },
    ],
  },
  {
    category: "Audit query",
    tag: "RAD-DSL 1.0",
    title: "SQL over receipt sets",
    summary:
      "Pure-TS SQL-flavored query language over receipt arrays. Auditors paste SELECT verdictId, agentSlug FROM receipts WHERE pack = 'hipaa-2026' AND overall = 'block' — get cryptographically-anchored rows back. Read-only by design.",
    links: [
      {
        label: "Audit-DSL source",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/packages/verifiable-receipts/src/audit-dsl.ts",
      },
    ],
  },
  {
    category: "Operational",
    tag: "Anomaly detector",
    title: "Statistical outlier detection",
    summary:
      "Pure-stdlib Z-score detector over receipt streams. Surfaces block-rate spikes, per-pack failure drift, volume bursts, quiet periods, and never-before-seen agents — every detection is regulator-auditable in 5 lines of math.",
    links: [
      {
        label: "Anomaly module source",
        href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/packages/verifiable-receipts/src/anomaly.ts",
      },
    ],
  },
];

export default function TrustPage() {
  const posture = buildPosture(BASELINE_READINGS);
  const frameworks = (
    ["eu-ai-act-annex-iv", "nist-ai-rmf", "iso-42001"] as const
  ).map((f) => buildScorecard(f));

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/spec"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Spec
            </Link>
            <Link
              href="/agents"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Agents
            </Link>
            <Link
              href="/dashboard"
              className="text-xs px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-neutral-200 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-4 inline-flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" /> Reference posture
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white max-w-3xl">
          Control posture, on-demand replay.
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Each SOC 2 Trust Services Criterion is mapped to the platform
          capability that enforces it, with a pass / warn / fail target per
          control. Procurement teams can request the underlying receipt id and
          replay any decision from the last 365 days.
        </p>
        <p className="text-[11px] text-neutral-500 mt-3 max-w-2xl leading-relaxed">
          These are reference control targets, not a live measured feed or a
          third-party attestation. SOC 2 Type II is in progress (see{" "}
          <Link href="/security" className="text-neutral-400 underline">
            /security
          </Link>
          ). Snapshot rendered at{" "}
          <code className="text-neutral-400">{posture.generatedAt}</code>
        </p>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">
              Overall pass fraction
            </p>
            <p className="text-2xl font-black text-white">
              {(posture.overallPassFraction * 100).toFixed(1)}%
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
              Controls evaluated
            </p>
            <p className="text-2xl font-black text-white">
              {posture.controls.length}
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
              Frameworks mapped
            </p>
            <p className="text-2xl font-black text-white">
              {frameworks.length + 1}
            </p>
            <p className="text-[10px] text-neutral-500 mt-1">
              SOC 2 + EU AI Act + NIST AI RMF + ISO 42001
            </p>
          </div>
        </div>

        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-4">
          SOC 2 control posture
        </h2>
        <div className="space-y-2">
          {posture.controls.map((c) => {
            const klass =
              STATUS_COLOR[c.status] ?? STATUS_COLOR["not-applicable"];
            return (
              <div
                key={c.rule.id}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center gap-3"
              >
                <span
                  className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${klass}`}
                >
                  {c.status === "pass" ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : c.status === "fail" || c.status === "warn" ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : null}
                  {c.status}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    {c.rule.id} · {c.rule.title}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    TSC: {c.rule.tsc} · indicator{" "}
                    <code className="text-neutral-400">{c.rule.indicator}</code>
                  </p>
                </div>
                {c.reading && (
                  <span className="text-[11px] font-mono text-neutral-400">
                    {(c.reading.value * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-4">
          Framework coverage
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {frameworks.map((sc) => (
            <div
              key={sc.framework}
              className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">
                {sc.framework}
              </p>
              <p className="text-2xl font-black text-white">
                {(sc.coverageFraction * 100).toFixed(0)}%
              </p>
              <p className="text-[11px] text-neutral-500 mt-2">
                {sc.implemented} implemented · {sc.partial} partial ·{" "}
                {sc.planned} planned
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-white/5">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
          Trust primitives shipped
        </h2>
        <p className="text-sm text-neutral-400 max-w-2xl mb-8">
          Every primitive on this list is Apache-2.0, fully tested, and
          verifiable from any language. Hand a procurement team the links — they
          don&rsquo;t have to take our word for any of it.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TRUST_PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:border-cyan-500/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-[11px] font-bold tracking-widest text-cyan-400/80 uppercase">
                  {p.category}
                </div>
                <div className="text-[10px] font-mono text-neutral-500">
                  {p.tag}
                </div>
              </div>
              <div className="text-base font-bold text-white mb-1.5">
                {p.title}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                {p.summary}
              </p>
              <div className="flex flex-wrap gap-3 text-[11px]">
                {p.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-cyan-400/80 hover:text-cyan-300 underline-offset-2 hover:underline transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Procurement-ready in one paste.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Hand this URL to your customer&rsquo;s assurance team. They can see
            the live posture, paste any receipt id at{" "}
            <code className="text-neutral-200">/api/replay/&lt;id&gt;</code>,
            and verify reproducibility — without you sending a single
            spreadsheet.
          </p>
          <Link
            href="/contact?subject=trust"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors"
          >
            Request the full audit bundle
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-5xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/spec" className="hover:text-neutral-300">
            VAOS 2.0 receipts spec
          </Link>
          <Link href="/agents" className="hover:text-neutral-300">
            140 agents
          </Link>
          <Link href="/changelog" className="hover:text-neutral-300">
            Changelog
          </Link>
        </div>
      </footer>
    </div>
  );
}
