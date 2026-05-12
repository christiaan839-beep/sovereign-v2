/**
 * /pharma — Life Sciences + Clinical Trials positioning surface.
 *
 * Target ICP: Quality Assurance leads at pharma, biotech, CROs, and
 * medical-device companies running clinical trials. Procurement
 * language throughout. Cyan accent (audit-grade surface).
 *
 * The pitch: 21 CFR Part 11, ICH-GCP, GxP — every regulatory framework
 * pharma operates under demands cryptographically verifiable audit
 * trails. Sovereign's receipts chain is the only AI primitive that
 * ships with that out of the box.
 */

import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  FlaskConical,
  Globe,
  ArrowRight,
  ExternalLink,
  Lock,
  Activity,
  Stethoscope,
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
    title: "21 CFR Part 11 — electronic records + signatures",
    body: "Every agent output produces a signed, time-stamped, immutable receipt. The four Part 11 requirements (audit trail, system validation, electronic signatures, copies for inspection) map onto Sovereign primitives 1-for-1. FDA inspectors verify against `/api/verify` — no Sovereign involvement, no trust required.",
    cta: { href: "/spec", label: "VAOS 1.0 ↔ Part 11 mapping" },
  },
  {
    icon: Globe,
    title: "ICH-GCP E6(R3) compliant audit trails",
    body: "Section 5.18 (essential documents) + Section 8 (sponsor responsibilities) require contemporaneous, attributable, legible, original, and accurate (ALCOA+) records. Sovereign receipts satisfy every ALCOA+ criterion by construction — no add-on, no per-protocol setup.",
    cta: { href: "/trust", label: "ALCOA+ posture" },
  },
  {
    icon: Lock,
    title: "GxP-aligned tenant isolation",
    body: "Per-tenant Merkle root means Sponsor A's protocol data cannot be observed by Sponsor B or by Sovereign operators. Cross-tenant separation is mathematically enforced, not policy-enforced. Required posture for FDA 21 CFR 211.68 (computer system validation).",
    cta: { href: "/trust", label: "Tenant isolation" },
  },
  {
    icon: Stethoscope,
    title: "HIPAA + GDPR Art. 9 special category data",
    body: "PHI never crosses to logging or training. PII layer scrubs identifiers before they reach the model. Receipts contain only canonical projections — never the raw protected health information. BAA available on the Enterprise plan.",
    cta: { href: "/api-docs", label: "PHI handling" },
  },
];

const WORKFLOWS: Block[] = [
  {
    icon: Activity,
    title: "Protocol deviation triage",
    body: "Agent ingests CTMS deviation reports + protocol amendments → flags root-cause patterns + suggests CAPA actions. Every output signed; the CRA can hand the receipt to the auditor. No more 'show me the email where you decided X.'",
  },
  {
    icon: FlaskConical,
    title: "Adverse-event narrative drafting",
    body: "First-draft AE narratives from MedDRA-coded source data. Domain-anchored prompt cites MedDRA term + WHO-UMC causality + seriousness criteria. Final pass critiqued by Claude as 'safety physician' before commit — human reviews only the marked-uncertain cases.",
  },
  {
    icon: CheckCircle2,
    title: "Investigator-site monitoring summary",
    body: "Site visit observations → SDV-ready trip reports. Pattern-matched against the protocol-specific risk register. Auditor-ready receipts mean QA finds the issue before the FDA does.",
  },
];

export default function PharmaPage() {
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
            <FlaskConical className="h-3 w-3" />
            LIFE SCIENCES · GxP-READY
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Clinical-trial-grade AI receipts.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            21 CFR Part 11. ICH-GCP E6(R3). GxP. ALCOA+. Every agent output
            cryptographically signed, time-stamped, and replayable. The audit
            trail your QA team needed AI to ship with — built into every run,
            not bolted on after the deviation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="mailto:lifesciences@sovereignmatrix.agency?subject=Pharma%20AI%20receipts%20—%20Sovereign%20Matrix"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
            >
              Talk to life-sciences →
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
            Regulatory frameworks
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
            Workflows already running
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {WORKFLOWS.map((b) => (
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
                For Quality + Clinical Operations leads
              </h2>
              <p className="text-sm leading-relaxed text-neutral-300">
                Auditor at your door? Paste{" "}
                <Link
                  href="/trust"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  sovereignmatrix.agency/trust
                </Link>{" "}
                — every Part 11 claim independently verifiable against live
                primitives. Need a study-specific evidence pack with sponsor +
                site + protocol scoping? Email{" "}
                <a
                  href="mailto:lifesciences@sovereignmatrix.agency"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  lifesciences@sovereignmatrix.agency
                </a>{" "}
                — 24h SLA for QA-pack requests, Veeva Vault / Medidata Rave /
                OpenClinica integrations on the Team plan.
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
