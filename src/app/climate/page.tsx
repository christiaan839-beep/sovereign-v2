/**
 * /climate — Climate-tech + Carbon Accounting + ESG positioning surface.
 *
 * Target ICP: Sustainability leads, ESG analysts, third-party assurance
 * providers at companies subject to CSRD, SEC climate rule, ISSB, or
 * voluntary frameworks (CDP, SBTi, GHG Protocol). Cyan accent
 * (audit-grade surface).
 *
 * The pitch: when third-party assurance is non-negotiable (CSRD Article
 * 8a, SEC climate-rule limited assurance), every emissions number needs
 * a provable provenance chain. Sovereign's receipts are that chain by
 * construction — every AI-assisted calculation comes with a signed,
 * replayable receipt that an assurance provider can verify without ever
 * trusting Sovereign.
 */

import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  Leaf,
  Globe,
  ArrowRight,
  ExternalLink,
  Factory,
  Activity,
  Gauge,
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
    title: "CSRD Article 8a — limited assurance ready",
    body: "EU's Corporate Sustainability Reporting Directive requires third-party limited assurance on the sustainability statement. ESRS E1 disclosures (climate) demand auditable provenance for every emissions number. Sovereign receipts are that provenance — your assurance provider verifies the chain, not your spreadsheet.",
    cta: { href: "/spec", label: "VAOS 1.0 ↔ CSRD mapping" },
  },
  {
    icon: Globe,
    title: "SEC climate rule (S-K 1500) compliant",
    body: "Material climate risks + Scope 1/2 (and material Scope 3) disclosures with limited assurance through FY2026. Every AI-assisted estimate produces a receipt with input, methodology, model used, and timestamp. Auditor verifies independently — the SEC sees the same chain.",
    cta: { href: "/trust", label: "Assurance posture" },
  },
  {
    icon: Factory,
    title: "GHG Protocol Scope 1 / 2 / 3 attestable",
    body: "Calculated emissions factors, activity data sources, and allocation methods preserved in the receipt. An assurance provider can replay the exact computation from the receipt id alone — no spreadsheet archaeology, no 'we trust the consultant.'",
    cta: { href: "/api-docs", label: "Replay endpoint" },
  },
  {
    icon: Leaf,
    title: "SBTi + CDP + ISSB aligned out of the box",
    body: "Science Based Targets initiative target setting, CDP questionnaire pre-fill, ISSB IFRS S2 climate disclosure — all use the same underlying signed receipt chain. One source of truth across every voluntary and mandatory framework you report against.",
    cta: { href: "/trust", label: "Framework matrix" },
  },
];

const WORKFLOWS: Block[] = [
  {
    icon: Gauge,
    title: "Activity data → emissions calculations",
    body: "Agent ingests utility bills, fleet logs, supplier data → applies the right emission factor (IPCC AR6, EPA eGRID, IEA, GHG Protocol) → returns the calculated tonnes CO2e with the factor + source cited in the receipt. Auditor verifies factor selection independently.",
  },
  {
    icon: Activity,
    title: "Scope 3 supplier engagement triage",
    body: "Supplier sustainability questionnaires + product-level LCA requests at scale. Agent drafts follow-ups, flags non-responses, summarizes upstream emissions data. Every supplier interaction signed — the audit trail for category 1 (purchased goods) write-itself.",
  },
  {
    icon: CheckCircle2,
    title: "Disclosure narrative drafting",
    body: "ESRS E1 + IFRS S2 + TCFD narrative sections drafted from the underlying activity data with citations back to the source receipts. Sustainability lead reviews the highlighted-uncertain sections only — the auditor sees the receipts behind every claim.",
  },
];

export default function ClimatePage() {
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
            <Leaf className="h-3 w-3" />
            CLIMATE · ASSURANCE-READY
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Emissions numbers your auditor will sign off on.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            CSRD. SEC climate rule. GHG Protocol. ISSB. Every AI-assisted
            emissions calculation produces a cryptographically signed receipt
            with activity data, emission factor, and methodology preserved. Your
            assurance provider verifies the chain independently — no spreadsheet
            trust required.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="mailto:sustainability@sovereignmatrix.agency?subject=Climate%20AI%20receipts%20—%20Sovereign%20Matrix"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
            >
              Talk to sustainability →
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
            Frameworks aligned
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
                For Sustainability + Finance leads
              </h2>
              <p className="text-sm leading-relaxed text-neutral-300">
                Assurance provider asking for evidence? Paste{" "}
                <Link
                  href="/trust"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  sovereignmatrix.agency/trust
                </Link>{" "}
                — every receipt independently verifiable. Need a year-end
                assurance pack scoped to a single reporting boundary? Email{" "}
                <a
                  href="mailto:sustainability@sovereignmatrix.agency"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  sustainability@sovereignmatrix.agency
                </a>{" "}
                — 24h SLA for assurance-pack requests, Watershed / Persefoni /
                Sweep / Plan A integrations on the Team plan and above.
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
