/**
 * /vendor-risk — vendor risk assessment positioning surface.
 *
 * Target ICP: founders / GTM leads at AI vendors selling into
 * procurement-heavy enterprise. The pain: 200-question security
 * questionnaires every deal. The pitch: Sovereign's verified-output
 * stamp + /trust hub IS the answer to most of those questions.
 *
 * Server-rendered. Cyan accent (audit/infrastructure surface).
 */

import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  ArrowRight,
  Building2,
  FileSearch,
  ScrollText,
  Globe,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface Block {
  icon: typeof Shield;
  title: string;
  body: string;
}

const ANSWERS: Block[] = [
  {
    icon: FileSearch,
    title: '"Do you log AI outputs?"',
    body: "Yes — every output is HMAC-SHA256 signed, stored, and exposed at /r/<id>. The questionnaire's evidence URL is one click away.",
  },
  {
    icon: ScrollText,
    title: '"Can we audit your AI decisions?"',
    body: "Yes — GET /api/me/audit-bundle returns a signed evidence pack covering the period. The auditor verifies independently at /api/verify — no Sovereign involvement.",
  },
  {
    icon: Globe,
    title: '"What\'s your SOC 2 / ISO 27001 posture?"',
    body: "Controls map at docs/soc2-controls.md in our public repo. Vanta / Drata / Secureframe integration available on Team plan. Customer's auditor grants direct vendor-risk access via their portal.",
  },
  {
    icon: Building2,
    title: '"Who are your sub-processors?"',
    body: "Full list at /sub-processors with data category, region, DPA link, and last-review date. Updated within 24h of any change with email notification to customers on Team+.",
  },
];

const WORKFLOW: Block[] = [
  {
    icon: ClipboardCheck,
    title: "Paste-one-URL answer",
    body: "Customer asks for security documentation? Paste sovereignmatrix.agency/trust. Every claim is independently verifiable against live primitives — not a glossy PDF.",
  },
  {
    icon: Shield,
    title: "Embed the badge on your site",
    body: "<script src='/embed/verify.js' data-receipt='<your-id>'> — one line, ~2KB. The Sovereign Verified stamp is on your site, your customers' security teams click through and verify the underlying claim.",
  },
  {
    icon: CheckCircle2,
    title: "Procurement-team SLA",
    body: "Standard security questionnaires answered in 24h. Custom DPAs / SOC 2 evidence packs / Vanta-vendor access turned around in 48h. Built for the procurement cycle, not against it.",
  },
];

export default function VendorRiskPage() {
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
            <ClipboardCheck className="h-3 w-3" />
            VENDOR RISK · PROCUREMENT-READY
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Survive every security questionnaire.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Sovereign&apos;s Verified-Output stamp is the answer to{" "}
            <em className="not-italic text-neutral-200">
              show us your AI audit posture
            </em>{" "}
            — one URL paste, every claim independently verifiable. Built for AI
            vendors who are tired of 200-question Excel sheets.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
            >
              See pricing →
            </Link>
            <Link
              href="/trust"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
            >
              Read our trust posture
            </Link>
          </div>
        </header>

        <section className="mb-14">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            Common questionnaire questions, pre-answered
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ANSWERS.map((b) => (
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
                <p className="text-xs leading-relaxed text-neutral-400">
                  {b.body}
                </p>
              </SpotlightCard>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            How vendors actually use it
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {WORKFLOW.map((b) => (
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
                Already in a deal cycle?
              </h2>
              <p className="text-sm leading-relaxed text-neutral-300">
                Forward your current security questionnaire to{" "}
                <a
                  href="mailto:vendor-risk@sovereignmatrix.agency"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  vendor-risk@sovereignmatrix.agency
                </a>{" "}
                — we&apos;ll send back a draft response mapped to{" "}
                <Link
                  href="/trust"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  /trust
                </Link>{" "}
                primitives within 24h. Free for any company evaluating Sovereign
                Matrix for the first time.
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
            href="/compliance"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
          >
            Compliance automation
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
