/**
 * /compliance — AI compliance automation positioning surface.
 *
 * Target ICP: compliance officers + GRC leads at AI-deploying companies.
 * Procurement language used throughout. Server-rendered. Cyan accent
 * (audit/infrastructure surface).
 *
 * The pitch: Sovereign's receipts-chain primitive is the AI-specific
 * Vanta. SOC 2 + EU AI Act + POPIA + GDPR evidence isn't a feature —
 * it's the byproduct of every agent run on the platform.
 */

import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  FileText,
  Globe,
  ArrowRight,
  ExternalLink,
  Lock,
  Activity,
  Bookmark,
  ScrollText,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface Block {
  icon: typeof Shield;
  title: string;
  body: string;
  cta?: { href: string; label: string; external?: boolean };
}

const FRAMEWORKS: Block[] = [
  {
    icon: ScrollText,
    title: "SOC 2 Type 1 + 2 ready evidence",
    body: "Every relevant Trust Services Criterion mapped to a concrete control. Auto-generated audit-bundle exports include a signed Merkle root over the receipt chain, sub-processor list, and access audit log — paste into your Vanta/Drata/Secureframe evidence pack.",
    cta: { href: "/trust", label: "See the controls map" },
  },
  {
    icon: Globe,
    title: "EU AI Act conformity (Feb 2026)",
    body: "Article 12 (transparency) + Article 13 (logging) requirements satisfied automatically. Every agent decision produces a receipt with input, output, model used, safety pipeline results, timestamp — the exact evidence Notified Bodies are spec'd to demand.",
    cta: { href: "/spec", label: "VAOS 1.0 spec" },
  },
  {
    icon: Lock,
    title: "GDPR Art. 15 / 17 / 20 endpoints",
    body: "Right-to-access, right-to-erasure, right-to-portability — exposed as authenticated API endpoints out of the box. Subject Access Requests (SARs) responded to in under 24h with signed evidence bundles.",
    cta: { href: "/api-docs", label: "GDPR endpoints" },
  },
  {
    icon: Bookmark,
    title: "POPIA s.23 / 24 (South Africa)",
    body: "Information Officer can issue a signed audit bundle to the Information Regulator on request. POPIA-native — no add-on, no manual export.",
    cta: { href: "/privacy", label: "POPIA posture" },
  },
];

const CONTINUOUS: Block[] = [
  {
    icon: Activity,
    title: "Continuous monitoring — every run, no sampling",
    body: "Vanta-class compliance vendors monitor your INFRASTRUCTURE. Sovereign monitors every AI OUTPUT. 100% sampling rate, automatic — no agents to install on production hosts, no per-call sampling rules.",
  },
  {
    icon: FileText,
    title: "Audit-bundle export with a single API call",
    body: "GET /api/me/audit-bundle returns a signed JSON envelope containing every receipt for the period, the Merkle chain root, and a Sovereign signature attesting to integrity. Hand to your auditor; they verify against /api/verify with no Sovereign involvement.",
  },
  {
    icon: CheckCircle2,
    title: "Tamper-evident at O(log N)",
    body: "Inclusion proofs let an auditor verify any one receipt belongs to the period's chain without downloading the full set. 1M receipts → 20-hash proof. Constant verification cost regardless of audit-period size.",
  },
];

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div
        className="fixed inset-x-0 top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          ← Sovereign Matrix
        </Link>

        <header className="mb-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <Shield className="h-3 w-3" />
            AI COMPLIANCE · AUTOMATED
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            AI compliance, automated.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Continuous monitoring of AI agent outputs with cryptographically
            signed receipts. SOC 2 evidence packs auto-generated. EU AI Act,
            POPIA, GDPR audit trails — built into every agent run, not a
            separate product.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="mailto:compliance@sovereignmatrix.agency?subject=AI%20Compliance%20—%20Sovereign%20Matrix"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
            >
              Talk to compliance →
            </Link>
            <Link
              href="/trust"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
            >
              See the trust posture
            </Link>
          </div>
        </header>

        <section className="mb-14">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            Frameworks covered
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FRAMEWORKS.map((b) => (
              <SpotlightCard
                key={b.title}
                as="article"
                accent="cyan"
                radius={300}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl"
              >
                <b.icon
                  className="mb-3 h-5 w-5 text-cyan-300"
                  aria-hidden="true"
                />
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {b.title}
                </h3>
                <p className="mb-4 text-xs leading-relaxed text-neutral-400">
                  {b.body}
                </p>
                {b.cta && (
                  <Link
                    href={b.cta.href}
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-300 transition hover:text-cyan-100"
                  >
                    {b.cta.label}
                    <ArrowRight className="h-2.5 w-2.5" />
                  </Link>
                )}
              </SpotlightCard>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {CONTINUOUS.map((b) => (
              <SpotlightCard
                key={b.title}
                as="article"
                accent="cyan"
                radius={280}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl"
              >
                <b.icon
                  className="mb-3 h-5 w-5 text-cyan-300"
                  aria-hidden="true"
                />
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {b.title}
                </h3>
                <p className="text-xs leading-relaxed text-neutral-400">
                  {b.body}
                </p>
              </SpotlightCard>
            ))}
          </div>
        </section>

        <section className="mb-10 overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.05] to-transparent p-6 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <h2 className="mb-2 text-sm font-semibold text-white">
                For GRC + compliance teams
              </h2>
              <p className="text-sm leading-relaxed text-neutral-300">
                Send a security questionnaire? Paste{" "}
                <Link
                  href="/trust"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  sovereignmatrix.agency/trust
                </Link>{" "}
                — every claim is independently verifiable against live
                primitives. Need a custom evidence pack? Email{" "}
                <a
                  href="mailto:compliance@sovereignmatrix.agency"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  compliance@sovereignmatrix.agency
                </a>{" "}
                — 24h SLA for procurement requests, custom Vanta / Drata /
                Secureframe integrations on the Team plan and above.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/industries"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
          >
            All industries
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href="/spec"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
          >
            VAOS 1.0 spec
          </Link>
        </div>
      </div>
    </div>
  );
}
