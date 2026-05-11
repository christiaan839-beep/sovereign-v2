import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

/**
 * /playbooks — public index of every cornerstone deliverable.
 *
 * Server-rendered (no client interactivity), indexable, Open Graph
 * configured. The vertical packets — agency-content-packet,
 * recruiting-sourcing-sprint, growth-pulse, realestate-listing-pulse —
 * each get a dedicated card with their tagline + a "try it" CTA.
 *
 * The remaining classic playbooks (lead-blitz, content-machine, etc.)
 * are listed below the verticals for completeness; they live in the
 * dashboard rather than getting their own marketing page.
 */

export const metadata: Metadata = {
  title:
    "Playbooks — vertical deliverables for agencies, recruiters, real estate, SMBs | Sovereign Matrix",
  description:
    "One brief → a full week of deliverables in 90 seconds. Cornerstone playbooks for B2B agencies, recruiting agencies, real-estate agents, and African SMBs. Whitelabel-ready, schedule weekly.",
  alternates: { canonical: "https://sovereignmatrix.agency/playbooks" },
  openGraph: {
    title: "Sovereign Matrix Playbooks — vertical-specific weekly deliverables",
    description:
      "One brief → blog + emails + ads + competitor (agency); ICP + booleans + outreach + objections (recruiter); MLS + open-house + comps (real estate); local-SEO + WhatsApp + offer (African SMB).",
    url: "https://sovereignmatrix.agency/playbooks",
    type: "website",
  },
};

interface VerticalPlaybook {
  id: string;
  href: string;
  vertical: string;
  buyer: string;
  pricing: string;
  tagline: string;
  description: string;
  deliverables: string[];
  badgeTone: "amber" | "cyan" | "emerald" | "violet";
}

const VERTICALS: VerticalPlaybook[] = [
  {
    id: "agency-content-packet",
    href: "/playbooks/agency-content-packet",
    vertical: "B2B agencies",
    buyer: "Owners of 5–30 person SEO / content / ad agencies",
    pricing: "$499–$2,000 / mo",
    tagline: "One client → a full week of deliverables in 90 seconds",
    description:
      "The weekly deliverable for B2B agencies. Drop in a client's domain and brand voice — get a 1,500-word SEO blog post, a 3-email welcome sequence, three platform-specific ad creatives, and a competitor weakness teaser. Whitelabel-ready.",
    deliverables: [
      "1,500-word SEO blog post (Markdown, structured H2/H3)",
      "3-email welcome sequence (day-0 / day-2 / day-5 cadence)",
      "3 platform-specific ad creatives (LinkedIn / Meta / Google)",
      "Competitor weakness + market gap teaser",
    ],
    badgeTone: "amber",
  },
  {
    id: "recruiting-sourcing-sprint",
    href: "/playbooks/recruiting-sourcing-sprint",
    vertical: "Recruiting agencies",
    buyer: "Boutique tech / finance / sales recruiting agencies",
    pricing: "$499–$1,500 / mo",
    tagline: "One role brief → a full sourcing playbook in 90 seconds",
    description:
      "The weekly deliverable for boutique recruiting agencies. Drop a role brief and must-have skills — get a structured ICP, three platform-specific boolean searches, three outreach drafts, five non-LinkedIn channels, and a 4-objection playbook.",
    deliverables: [
      "Structured ICP (archetype, signals, motivators, red flags)",
      "Boolean strings for LinkedIn / Google X-Ray / GitHub",
      "Outreach pack: LinkedIn DM, cold email, voicemail script",
      "5 non-LinkedIn sourcing channels with first action",
      "4-objection playbook with response + escalation",
    ],
    badgeTone: "cyan",
  },
  {
    id: "realestate-listing-pulse",
    href: "/playbooks/realestate-listing-pulse",
    vertical: "Real estate",
    buyer: "Residential agents listing 3–15 properties / quarter",
    pricing: "$299–$799 / mo",
    tagline: "One property → a full week of listing assets in 90 seconds",
    description:
      "The weekly deliverable for residential real-estate agents. Drop a property's address and key features — get an MLS-grade listing description, open-house Instagram / Facebook / WhatsApp posts, a buyer-list email blast, a 3-comp analysis, and a one-page suburb market update.",
    deliverables: [
      "MLS-grade listing description (250–400 words, structured)",
      "Open-house posts: Instagram, Facebook, WhatsApp",
      "Buyer-list email blast (segment-aware)",
      "3-comparable analysis with positioning note",
      "Suburb market update + voice-note opener",
    ],
    badgeTone: "violet",
  },
  {
    id: "growth-pulse",
    href: "/playbooks/growth-pulse",
    vertical: "African SMBs",
    buyer: "Solopreneurs and 1–20 person SMBs in ZA / NG / KE / EG / GH",
    pricing: "R349 / mo (≈ $19)",
    tagline: "Built for African SMBs. Billed in Rands.",
    description:
      "The monthly deliverable for African SMBs. Locale-aware (ZAR / NGN / KES / EGP / GHS), WhatsApp-first, designed for the businesses USD-only AI tools price out. Local-SEO checklist, four social posts, re-engagement email, WhatsApp broadcast template, and a limited-time offer card in your local currency.",
    deliverables: [
      "Local-SEO checklist + 5–8 locale keywords",
      "4 social posts (Instagram / Facebook / LinkedIn / X)",
      "Customer re-engagement email (90+ day dormant)",
      "WhatsApp broadcast template with opt-out",
      "Limited-time offer card in your local currency",
    ],
    badgeTone: "emerald",
  },
];

const TONE_CLASSES: Record<VerticalPlaybook["badgeTone"], string> = {
  amber: "border-amber-500/20 bg-amber-500/[0.04] text-amber-300/90",
  cyan: "border-cyan-500/20 bg-cyan-500/[0.04] text-cyan-300/90",
  emerald: "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300/90",
  violet: "border-violet-500/20 bg-violet-500/[0.04] text-violet-300/90",
};

export default function PlaybooksIndexPage() {
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Sovereign Matrix vertical playbooks",
    description:
      "Cornerstone weekly deliverables for B2B agencies, recruiting agencies, real estate agents, and African SMBs.",
    itemListElement: VERTICALS.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://sovereignmatrix.agency${p.href}`,
      name: p.tagline,
      description: p.description,
    })),
  };
  const breadcrumbs = breadcrumbSchema([
    { name: "Sovereign Matrix", url: "https://sovereignmatrix.agency/" },
    { name: "Playbooks", url: "https://sovereignmatrix.agency/playbooks" },
  ]);

  return (
    <main className="min-h-screen bg-[#030303] text-white">
      <JsonLd data={itemListSchema} />
      <JsonLd data={breadcrumbs} />
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/pricing"
          className="px-4 py-2 rounded-full border border-white/15 text-xs font-semibold hover:border-white/30 transition-colors"
        >
          Pricing →
        </Link>
      </nav>

      <article className="max-w-6xl mx-auto px-6 md:px-10 pt-20 pb-24">
        <header className="mb-16 max-w-3xl">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-4">
            Playbooks
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-tight">
            One brief →{" "}
            <em className="not-italic" style={{ color: "#B5532C" }}>
              a full week of deliverables
            </em>{" "}
            in 90 seconds.
          </h1>
          <p className="text-base md:text-lg text-neutral-400 leading-relaxed">
            Each playbook is a vertical-specific deliverable that the buyer in
            that vertical actually pays for. No &ldquo;general AI
            assistant&rdquo; slop — narrow scope, structured output, every asset
            whitelabel-ready and copy-pasteable.
          </p>
        </header>

        <section className="mb-20">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-500 mb-8">
            Cornerstone playbooks · {VERTICALS.length} verticals
          </h2>

          <ul className="grid md:grid-cols-2 gap-6">
            {VERTICALS.map((p) => (
              <li
                key={p.id}
                className="group rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-white/[0.005] hover:border-white/[0.14] transition-colors overflow-hidden flex flex-col"
              >
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${TONE_CLASSES[p.badgeTone]}`}
                    >
                      {p.vertical}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {p.pricing}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-white mb-2 leading-snug">
                    {p.tagline}
                  </h3>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 mb-3">
                    For: {p.buyer}
                  </p>
                  <p className="text-[14px] text-neutral-400 leading-relaxed mb-5">
                    {p.description}
                  </p>

                  <ul className="space-y-1.5 mb-6 flex-1">
                    {p.deliverables.map((d) => (
                      <li
                        key={d}
                        className="text-[12.5px] text-neutral-300 leading-relaxed before:content-['→'] before:mr-2 before:text-[#B5532C]/70"
                      >
                        {d}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={p.href}
                    className="inline-flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] font-semibold text-white hover:bg-[#B5532C] hover:text-black hover:border-[#B5532C] transition-colors"
                  >
                    Try the {p.vertical.toLowerCase()} playbook
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-10 mb-12">
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="w-4 h-4 text-[#B5532C] mt-1 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">
                Schedule any playbook to run automatically
              </h2>
              <p className="text-[13.5px] text-neutral-400 leading-relaxed">
                Every cornerstone playbook supports recurring runs. Schedule
                weekly or monthly, get the deliverables in your inbox, hand them
                to your team. Recurring scheduling unlocks on the Array plan.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#B5532C] text-black text-[13px] font-semibold hover:bg-[#cd6234] transition-colors"
            >
              See pricing
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard/playbooks"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-[13px] font-semibold text-neutral-300 hover:border-white/30 hover:text-white transition-colors"
            >
              Open dashboard
            </Link>
          </div>
        </section>

        <section className="border-t border-white/[0.06] pt-10">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-500 mb-4">
            Other playbooks (dashboard)
          </h2>
          <p className="text-[13px] text-neutral-400 leading-relaxed mb-4 max-w-2xl">
            The dashboard surfaces additional playbooks beyond the four
            cornerstone verticals — Lead Blitz, Content Machine, Competitor
            Takedown, Proposal Blaster, SEO Domination, Brand Forensics, Funnel
            Autopsy, and a growing library. Sign in to run them.
          </p>
          <Link
            href="/dashboard/playbooks"
            className="inline-flex items-center gap-2 text-[13px] text-neutral-400 hover:text-white underline decoration-white/15 hover:decoration-white/40 underline-offset-4"
          >
            All playbooks in dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>

        <div className="mt-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-white uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" />
            Home
          </Link>
        </div>
      </article>
    </main>
  );
}
