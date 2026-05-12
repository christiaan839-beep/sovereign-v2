/**
 * /industries — vertical hub page.
 *
 * Single index that maps every supported industry to the right
 * positioning surface. Three categories:
 *
 *   - Audit-grade verticals (cyan accent): compliance, vendor-risk,
 *     insurance — bespoke pages with procurement language.
 *   - Sector landing pages (copper accent): existing /for-* surfaces
 *     for healthcare, legal, fintech, etc.
 *   - Frontier verticals (neutral, coming-soon): AI labs,
 *     journalism, marketplaces — high-leverage ICPs we'll build
 *     proper surfaces for as design partners sign.
 *
 * Server-rendered. The hub design uses a 3-column grid so every
 * vertical fits above-the-fold on desktop.
 */

import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  Stethoscope,
  Scale,
  Landmark,
  GraduationCap,
  Lock,
  Home,
  ShoppingBag,
  Briefcase,
  Wheat,
  Factory,
  Sparkles,
  Newspaper,
  Store,
  GitBranch,
  ArrowRight,
  ClipboardCheck,
  FileSearch,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

type Status = "live" | "soon";
type Accent = "cyan" | "copper" | "neutral";

interface Vertical {
  icon: typeof Building2;
  title: string;
  body: string;
  href: string;
  status: Status;
  accent: Accent;
}

const AUDIT: Vertical[] = [
  {
    icon: ClipboardCheck,
    title: "Compliance Automation",
    body: "SOC 2 evidence packs auto-generated. EU AI Act Article 12-15 audit trails. POPIA, GDPR ROPA + DSAR exports. Vanta-style monitoring for AI.",
    href: "/compliance",
    status: "live",
    accent: "cyan",
  },
  {
    icon: FileSearch,
    title: "Vendor Risk / Procurement",
    body: "Survive every security questionnaire. One URL paste = answers to 80% of standard procurement asks. Live primitives, not a glossy PDF.",
    href: "/vendor-risk",
    status: "live",
    accent: "cyan",
  },
  {
    icon: ShieldCheck,
    title: "Insurance / AI E&O",
    body: "Cryptographic underwriting signals for AI errors-and-omissions carriers. Tier premiums on chain-integrity. Subrogation-grade evidence packs.",
    href: "/insurance",
    status: "live",
    accent: "cyan",
  },
];

const SECTORS: Vertical[] = [
  {
    icon: Stethoscope,
    title: "Healthcare",
    body: "HIPAA-aware AI runs. PHI redaction in the safety pipeline. Audit trails for every clinical-decision-support output.",
    href: "/for-healthcare",
    status: "live",
    accent: "copper",
  },
  {
    icon: Scale,
    title: "Legal",
    body: "Privileged-output handling, bar-association-friendly audit logs, signed receipts for every drafting agent run.",
    href: "/for-legal",
    status: "live",
    accent: "copper",
  },
  {
    icon: Landmark,
    title: "Financial Services / Fintech",
    body: "Model-risk-management (SR 11-7) friendly receipts. Per-agent reasoning attestation. Regulator-grade evidence on demand.",
    href: "/for-fintech",
    status: "live",
    accent: "copper",
  },
  {
    icon: Lock,
    title: "Cybersecurity",
    body: "Verifiable AI for SOC operations, IR runbooks, and security-tool automation. No-trust output gates on every agent.",
    href: "/for-cybersecurity",
    status: "live",
    accent: "copper",
  },
  {
    icon: GraduationCap,
    title: "Education",
    body: "FERPA-aware student-data handling. Academic-integrity attestation. Auditable AI-tutor outputs for institutions.",
    href: "/for-education",
    status: "live",
    accent: "copper",
  },
  {
    icon: Home,
    title: "Real Estate",
    body: "MLS-compliant listing automation. Fair-housing-aware drafting. Audit trails for every property-description agent run.",
    href: "/for-realestate",
    status: "live",
    accent: "copper",
  },
  {
    icon: Briefcase,
    title: "Recruiting / HR",
    body: "EEOC-aware sourcing. Bias-checked job descriptions. Signed receipts for every candidate-outreach agent run.",
    href: "/for-recruiting",
    status: "live",
    accent: "copper",
  },
  {
    icon: ShoppingBag,
    title: "E-commerce",
    body: "Product-description compliance. Review-policy-aware drafting. Auditable AI for catalog & merchandising at scale.",
    href: "/for-ecommerce",
    status: "live",
    accent: "copper",
  },
  {
    icon: Wheat,
    title: "Agriculture",
    body: "Field-level recommendation provenance. Carbon-credit-grade evidence trails. AI agronomy with verifiable outputs.",
    href: "/for-agriculture",
    status: "live",
    accent: "copper",
  },
  {
    icon: Factory,
    title: "Manufacturing",
    body: "Quality-control AI with signed inspection receipts. Supplier-audit-grade evidence for AI-driven decisions.",
    href: "/for-manufacturing",
    status: "live",
    accent: "copper",
  },
  {
    icon: Building2,
    title: "Government / Public Sector",
    body: "FOIA-ready logs. Procurement-friendly evidence packs. AI for public administration with end-to-end audit trails.",
    href: "/for-government",
    status: "live",
    accent: "copper",
  },
  {
    icon: Briefcase,
    title: "Agencies / Consultancies",
    body: "White-label verifiable AI. Client-ready evidence packs. Every deliverable comes with a cryptographic signature.",
    href: "/for-agencies",
    status: "live",
    accent: "copper",
  },
];

const FRONTIER: Vertical[] = [
  {
    icon: Sparkles,
    title: "AI Labs / Foundation Models",
    body: "Receipt-as-a-service for foundation-model APIs. Tamper-evident attestation for every inference. Partner inquiries welcome.",
    href: "mailto:partnerships@sovereignmatrix.agency?subject=AI%20Labs%20%E2%80%94%20design%20partner",
    status: "soon",
    accent: "neutral",
  },
  {
    icon: Newspaper,
    title: "Journalism / News Verification",
    body: "Provenance receipts for AI-assisted reporting. C2PA-adjacent attestation. Defamation-defensive audit trails.",
    href: "mailto:partnerships@sovereignmatrix.agency?subject=Journalism%20%E2%80%94%20design%20partner",
    status: "soon",
    accent: "neutral",
  },
  {
    icon: Store,
    title: "Marketplace / Platform Trust",
    body: "Per-tenant Merkle roots for marketplace operators. Stamp every AI-generated listing/review with verifiable origin.",
    href: "mailto:partnerships@sovereignmatrix.agency?subject=Marketplace%20%E2%80%94%20design%20partner",
    status: "soon",
    accent: "neutral",
  },
  {
    icon: GitBranch,
    title: "Agent Versioning / SDLC",
    body: "Git-for-agents: signed releases, deterministic re-runs, regression-test attestation for the agent supply chain.",
    href: "mailto:partnerships@sovereignmatrix.agency?subject=Agent%20Versioning%20%E2%80%94%20design%20partner",
    status: "soon",
    accent: "neutral",
  },
];

function accentClasses(accent: Accent, status: Status) {
  if (status === "soon") {
    return {
      border: "border-white/[0.06] hover:border-white/[0.12]",
      iconColor: "text-neutral-400",
      glow: undefined,
      pillBorder: "border-neutral-700/40 bg-neutral-700/10",
      pillText: "text-neutral-400",
    };
  }
  if (accent === "cyan") {
    return {
      border: "border-cyan-500/20 hover:border-cyan-500/40",
      iconColor: "text-cyan-300",
      glow: "cyan" as const,
      pillBorder: "border-cyan-500/30 bg-cyan-500/10",
      pillText: "text-cyan-300",
    };
  }
  return {
    border: "border-amber-700/20 hover:border-amber-700/40",
    iconColor: "text-amber-300",
    glow: "copper" as const,
    pillBorder: "border-amber-700/30 bg-amber-700/10",
    pillText: "text-amber-300",
  };
}

function VerticalCard({ v }: { v: Vertical }) {
  const cls = accentClasses(v.accent, v.status);
  const isExternal = v.href.startsWith("mailto:");
  const inner = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <v.icon className={`h-5 w-5 ${cls.iconColor}`} aria-hidden="true" />
        {v.status === "soon" && (
          <span
            className={`rounded-full border ${cls.pillBorder} px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls.pillText}`}
          >
            Design partner
          </span>
        )}
        {v.status === "live" && (
          <span
            className={`rounded-full border ${cls.pillBorder} px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls.pillText}`}
          >
            Live
          </span>
        )}
      </div>
      <h3 className="mb-2 text-sm font-semibold text-white">{v.title}</h3>
      <p className="mb-4 text-xs leading-relaxed text-neutral-400">{v.body}</p>
      <div
        className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider ${cls.iconColor}`}
      >
        {v.status === "soon" ? "Contact partnerships" : "Open page"}
        <ArrowRight className="h-3 w-3" />
      </div>
    </>
  );

  if (v.accent === "neutral" || v.status === "soon") {
    return isExternal ? (
      <a
        href={v.href}
        className={`block rounded-2xl border ${cls.border} bg-white/[0.02] p-5 transition`}
      >
        {inner}
      </a>
    ) : (
      <Link
        href={v.href}
        className={`block rounded-2xl border ${cls.border} bg-white/[0.02] p-5 transition`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <SpotlightCard
      as={Link}
      href={v.href}
      accent={cls.glow}
      radius={260}
      className={`block rounded-2xl border ${cls.border} bg-white/[0.02] p-5 backdrop-blur-xl transition`}
    >
      {inner}
    </SpotlightCard>
  );
}

export default function IndustriesPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div
        className="fixed inset-x-0 top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[700px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[180px]" />
        <div className="absolute top-0 right-1/4 translate-x-1/2 w-[700px] h-[400px] bg-amber-700/[0.04] rounded-full blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          ← Sovereign Matrix
        </Link>

        <header className="mb-14 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <Building2 className="h-3 w-3" />
            INDUSTRIES · 12 VERTICALS
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Same primitives. Every vertical&apos;s vocabulary.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-400">
            Sovereign&apos;s HMAC-signed receipts + tamper-evidence + audit
            bundles map cleanly into every regulated industry. Pick your
            vertical — each page is written in your team&apos;s procurement
            language, not ours.
          </p>
        </header>

        <section className="mb-14">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
              Audit-grade surfaces
            </h2>
            <span className="font-mono text-[11px] text-neutral-500">
              3 / 3 live
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {AUDIT.map((v) => (
              <VerticalCard key={v.title} v={v} />
            ))}
          </div>
        </section>

        <section className="mb-14">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-300">
              Sector landing pages
            </h2>
            <span className="font-mono text-[11px] text-neutral-500">
              {SECTORS.length} / {SECTORS.length} live
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {SECTORS.map((v) => (
              <VerticalCard key={v.title} v={v} />
            ))}
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Frontier verticals — design partners open
            </h2>
            <span className="font-mono text-[11px] text-neutral-500">
              4 in cohort
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FRONTIER.map((v) => (
              <VerticalCard key={v.title} v={v} />
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-amber-700/[0.04] p-6 backdrop-blur-xl">
          <h2 className="mb-2 text-sm font-semibold text-white">
            Vertical not listed?
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-neutral-300">
            Sovereign&apos;s primitives are industry-agnostic by design. If your
            team operates in a regulated space we haven&apos;t mapped yet —
            reach out and we&apos;ll spin up a vertical landing page and
            procurement-language pack inside 72 hours, free for the
            design-partner cohort.
          </p>
          <a
            href="mailto:partnerships@sovereignmatrix.agency?subject=New%20vertical%20mapping"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
          >
            Email partnerships@
            <ArrowRight className="h-3 w-3" />
          </a>
        </section>
      </div>
    </div>
  );
}
