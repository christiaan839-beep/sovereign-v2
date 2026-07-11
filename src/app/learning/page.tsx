import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  GraduationCap,
  Headphones,
  Layers,
  TerminalSquare,
} from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";

/**
 * /learning — Learning & Resources (Anthropic Partner Academy).
 *
 * Credibility surface for prospective clients evaluating our AI-governance
 * expertise: the Anthropic Partner Academy curriculum the team works
 * through, packaged as a NotebookLM notebook (four audio overviews) plus a
 * companion Google Doc with the full written curriculum map.
 *
 * CSP note: next.config.ts has no media-src and a strict frame-src, and
 * NotebookLM disallows third-party framing — so both resources are
 * outbound links, never embeds.
 */

export const revalidate = 3600;

// ─────────────────────────────────────────────────────────────────────────
// OPERATOR TODO: paste the public share URLs for the two resources below.
// While a URL is an empty string, its CTA renders as a disabled
// "Publishing shortly" state instead of a dead link.
// ─────────────────────────────────────────────────────────────────────────
const NOTEBOOKLM_URL = "";
const CURRICULUM_DOC_URL = "";

export const metadata: Metadata = {
  title: "Learning & Resources — Anthropic Partner Academy",
  description:
    "The Anthropic Partner Academy curriculum behind Sovereign Matrix: four audio overviews covering AI fluency, building on Claude, Claude Code, and enterprise deployment — plus the full written curriculum map.",
  alternates: { canonical: "https://sovereignmatrix.agency/learning" },
  openGraph: {
    title: "Learning & Resources — Anthropic Partner Academy",
    description:
      "How the team behind Sovereign Matrix trains: the Anthropic Partner Academy curriculum, from AI fluency foundations to enterprise deployment and certifications.",
    url: "https://sovereignmatrix.agency/learning",
    type: "article",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Learning & Resources — Anthropic Partner Academy",
  description:
    "The Anthropic Partner Academy curriculum behind Sovereign Matrix: audio overviews and a written curriculum map covering AI fluency, building on Claude, Claude Code, and enterprise deployment.",
  author: {
    "@type": "Organization",
    name: "Sovereign Matrix",
    url: "https://sovereignmatrix.agency",
  },
  about: {
    "@type": "EducationalOrganization",
    name: "Anthropic Partner Academy",
  },
};

const AUDIO_TRACKS = [
  {
    title: "AI Fluency Foundations",
    label: "Overview 01",
    detail:
      "The shared vocabulary layer: how large language models actually work, where they fail, and how to reason about capability versus reliability. This is the baseline every recommendation we make to a client stands on.",
    Icon: GraduationCap,
  },
  {
    title: "Building & Extending Claude",
    label: "Overview 02",
    detail:
      "Tool use, MCP servers, agent architectures, and evaluation. The engineering discipline behind the 140-agent registry, the unified router, and the MCP surface this platform ships.",
    Icon: Layers,
  },
  {
    title: "Claude Code Specialization",
    label: "Overview 03",
    detail:
      "Agentic coding as an operational practice: harness design, hooks, skills, and review gates. The same tooling that builds and audits this codebase, wave after wave, with the receipts to prove it.",
    Icon: TerminalSquare,
  },
  {
    title: "Enterprise Deployment & Certifications",
    label: "Overview 04",
    detail:
      "Rollout patterns, governance controls, and the Anthropic certification track. Where partner-level fluency meets the compliance exporters — EU AI Act, ISO 42001, NIST AI RMF, SOC 2, GDPR, HIPAA — we build against.",
    Icon: Award,
  },
];

/** Outbound CTA that degrades to a quiet disabled state until its URL is set. */
function ResourceCta({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 text-sm font-semibold text-neutral-500 cursor-default select-none"
      >
        {children}
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
          Publishing shortly
        </span>
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={
        primary
          ? "inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors"
          : "inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 text-sm font-semibold hover:border-white/30 transition-colors"
      }
    >
      {children}
      <ArrowRight className="w-4 h-4" />
    </a>
  );
}

export default function LearningPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#010101] text-white">
      <JsonLd data={articleSchema} />

      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/contact"
          className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors"
        >
          Talk to us
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 max-w-4xl mx-auto">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-6">
          Anthropic Partner Academy
        </p>
        <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl tracking-[-0.02em] leading-[1.05] mb-8">
          Governance expertise you can{" "}
          <em className="not-italic" style={{ color: "#B5532C" }}>
            audit
          </em>
          , starting with ours.
        </h1>
        <p className="text-[17px] md:text-[19px] text-neutral-400 leading-[1.6] max-w-2xl">
          Every claim this platform makes about AI governance rests on how well
          the people behind it understand the model layer. So we publish our
          coursework: the Anthropic Partner Academy curriculum, condensed into
          four audio overviews and a written curriculum map you can read before
          you ever sit in a call with us.
        </p>
        <div className="mt-10 flex items-center gap-4 flex-wrap">
          <ResourceCta href={NOTEBOOKLM_URL} primary>
            <Headphones className="w-4 h-4" />
            Listen on NotebookLM
          </ResourceCta>
          <ResourceCta href={CURRICULUM_DOC_URL}>
            <BookOpen className="w-4 h-4" />
            Read the curriculum map
          </ResourceCta>
        </div>
      </section>

      {/* Why we publish this */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-neutral-500 mb-3">
            01 — Why we publish our training
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight">
            Vendors ask you to trust their expertise. We&apos;d rather you
            inspect it.
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed mb-6 max-w-2xl">
            When you evaluate an AI governance partner, the hard question
            isn&apos;t whether they can demo an agent — it&apos;s whether they
            understand the failure modes, the deployment constraints, and the
            regulatory surface well enough to be accountable for what ships.
            That understanding has a paper trail: the Partner Academy is
            Anthropic&apos;s own training track for the firms building on
            Claude.
          </p>
          <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
            This page is the same material we study internally, in the order we
            study it. If our answers in a procurement review ever sound
            rehearsed, this is the rehearsal.
          </p>
        </div>
      </section>

      {/* The audio curriculum */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-neutral-500 mb-3">
            02 — The audio curriculum
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight">
            Four overviews, foundation to certification.
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed mb-10 max-w-2xl">
            The full curriculum lives in a NotebookLM notebook with four audio
            overviews — listenable end-to-end in a commute each — and a
            companion Google Doc mapping every module, so you can skim the
            written version or go deep on the audio.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {AUDIO_TRACKS.map(({ title, label, detail, Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
              >
                <Icon className="w-5 h-5 text-[#B5532C] mb-4" />
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                  {label}
                </p>
                <h3 className="text-lg font-semibold mb-3">{title}</h3>
                <p className="text-[13px] text-neutral-400 leading-relaxed">
                  {detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-4 flex-wrap">
            <ResourceCta href={NOTEBOOKLM_URL} primary>
              <Headphones className="w-4 h-4" />
              Open the notebook
            </ResourceCta>
            <ResourceCta href={CURRICULUM_DOC_URL}>
              <BookOpen className="w-4 h-4" />
              Full written curriculum
            </ResourceCta>
          </div>
        </div>
      </section>

      {/* What it maps to on the platform */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-neutral-500 mb-3">
            03 — Where the coursework shows up in the product
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight">
            Training you can trace to shipped surfaces.
          </h2>

          <ol className="space-y-3">
            {[
              {
                step: "Fluency → honest routing",
                why: "Knowing what each model tier is actually good for is why the router reserves Claude for verification and code, and absorbs the rest on cheaper lanes — with the routing decision recorded per run.",
              },
              {
                step: "Building on Claude → the agent registry & MCP server",
                why: "Tool use, MCP, and evaluation discipline from the curriculum are the same patterns behind the public MCP server and the signed-receipt pipeline every agent run flows through.",
              },
              {
                step: "Claude Code → auditable engineering practice",
                why: "The platform is built and reviewed with the tooling the specialization track teaches — hooks, review agents, deploy gates — which is why every wave lands with a documented trail.",
              },
              {
                step: "Enterprise deployment → the compliance exporters",
                why: "Deployment and governance modules feed directly into the six exporters — EU AI Act, ISO 42001, NIST AI RMF, SOC 2, GDPR, HIPAA — that turn agent activity into evidence your auditors accept.",
              },
            ].map(({ step, why }, i) => (
              <li
                key={step}
                className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.05] bg-white/[0.015]"
              >
                <span className="font-mono text-[11px] text-[#B5532C] tabular-nums shrink-0 mt-0.5">
                  0{i + 1}
                </span>
                <div>
                  <p className="font-semibold text-white mb-1">{step}</p>
                  <p className="text-[13px] text-neutral-400 leading-relaxed">
                    {why}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Evaluating an AI governance partner?
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed mb-8 max-w-xl mx-auto">
            Start with the curriculum, then ask us anything it covers — model
            selection, deployment controls, or how a signed receipt becomes
            audit evidence. If you&apos;d rather see proof than coursework, the
            trust hub has both.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-bold hover:bg-neutral-200 transition-colors"
            >
              Talk to the team
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/trust"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-sm font-semibold hover:border-white/30 transition-colors"
            >
              Visit the trust hub
            </Link>
          </div>
        </div>
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-white uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
