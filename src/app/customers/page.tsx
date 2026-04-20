import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Customers · Sovereign Matrix",
  description:
    "Real teams running real playbooks on Sovereign Matrix. Case studies with named customers and measured outcomes. Updated as the Founder Network cohort delivers results.",
  alternates: { canonical: "https://sovereignmatrix.agency/customers" },
  openGraph: {
    title: "Sovereign Matrix — Customers",
    description:
      "Named case studies with measured outcomes from the first 100-customer cohort.",
    url: "https://sovereignmatrix.agency/customers",
    type: "website",
  },
};

/**
 * /customers — editorial case-study index.
 *
 * The bet: a prospect who sees an empty or generic testimonials
 * section reads it as "no one uses this yet." Better to be explicit
 * about where we are ("no case studies yet — we're in the first-100
 * cohort. Be customer #1.") than to pad with stock avatars or
 * anonymous logos.
 *
 * Page evolves:
 *   Today: honest empty state + be-the-first-customer offer
 *   Month 2: 2-3 case studies land (Founder Network delivers)
 *   Month 6: 10+ case studies; this becomes the biggest inbound
 *            conversion surface
 *
 * Matches the editorial system on /trust, /roi, /built-with-claude,
 * /trust/anthropic, /trust/defenders — same bone-cream palette +
 * Instrument Serif + copper accent.
 */

interface CaseStudyCard {
  id: string;
  company: string;
  industry: string;
  outcome: string;
  metric: string;
  playbook: string;
  slug: string;
  date: string;
}

/**
 * Reads published case studies from the database (see migration
 * 0014_case_studies.sql). Revalidated every hour at the edge. If
 * the table is missing or the query fails, returns an empty array
 * so the page gracefully shows the "no case studies yet" state —
 * that's the honest state before the first customer ships.
 *
 * Server component — runs at request time inside Next.js's RSC
 * pipeline, so the DB call never blocks the client.
 */
async function loadCaseStudies(): Promise<CaseStudyCard[]> {
  try {
    const { db } = await import("@/db");
    const { caseStudies } = await import("@/db/schema");
    const { eq, and, isNotNull, desc } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: caseStudies.id,
        slug: caseStudies.slug,
        company: caseStudies.company,
        industry: caseStudies.industry,
        outcome: caseStudies.outcome,
        metric: caseStudies.metric,
        playbook: caseStudies.playbook,
        publishedAt: caseStudies.publishedAt,
      })
      .from(caseStudies)
      .where(
        and(
          eq(caseStudies.approvedByCompany, true),
          isNotNull(caseStudies.publishedAt),
        ),
      )
      .orderBy(desc(caseStudies.publishedAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      company: r.company,
      industry: r.industry ?? "—",
      outcome: r.outcome,
      metric: r.metric,
      playbook: r.playbook,
      date: r.publishedAt
        ? r.publishedAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "",
    }));
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      return []; // Table not migrated yet — honest empty state
    }
    console.warn("[customers] case-studies query failed:", err);
    return [];
  }
}

export const revalidate = 3600;

export default async function CustomersPage() {
  const CASE_STUDIES = await loadCaseStudies();
  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      {/* ─── Editorial header ─── */}
      <div className="max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Customers · Case Studies
        </p>
        <h1 className="font-serif text-5xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
          Named case studies.
          <br />
          <em className="text-[#B5532C] not-italic">Measured outcomes.</em>
        </h1>
        <p className="text-lg text-[#5C544A] leading-relaxed max-w-2xl">
          We publish case studies here with the customer&apos;s name, the
          playbook they ran, and the dollar amount they measured.
          Stock avatars and anonymous &ldquo;Fortune 500&rdquo; logos
          are easy. Named numbers are harder. This page is how we keep
          ourselves honest.
        </p>
      </div>

      {/* ─── Case-study index ─── */}
      <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        {CASE_STUDIES.length === 0 ? (
          <EmptyCohort />
        ) : (
          <div className="space-y-16">
            {CASE_STUDIES.map((cs) => (
              <article key={cs.id}>
                <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#8F8576] mb-2">
                  {cs.date} · {cs.industry}
                </p>
                <h2 className="font-serif text-3xl lg:text-4xl mb-3">
                  <em className="text-[#B5532C] not-italic">{cs.metric}</em>
                  {" · "}
                  {cs.company}
                </h2>
                <p className="text-[15px] text-[#5C544A] leading-relaxed max-w-2xl mb-4">
                  {cs.outcome}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-mono text-[#8F8576]">
                    Playbook: <span className="text-[#1A1712]">{cs.playbook}</span>
                  </span>
                  <Link
                    href={`/customers/${cs.slug}`}
                    className="text-[#1A1712] border-b border-[#B5532C] hover:text-[#B5532C] transition-colors"
                  >
                    Read the case study →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ─── Founder Network offer ─── */}
      <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Be customer #1 · The Founder Network
        </p>
        <h2 className="font-serif text-3xl lg:text-4xl leading-tight mb-8">
          50% off lifetime. <em className="text-[#B5532C] not-italic">Direct line to the founder.</em>
        </h2>

        <ul className="space-y-4 text-[#1A1712] mb-10">
          <TermLine
            label="Full platform access — Growth tier."
            detail="500 runs/month, every agent, every playbook, plus signed snapshot export and the benchmark leaderboard."
          />
          <TermLine
            label="Direct Slack to the founder."
            detail="I personally see every message. Not a community board, not a helpdesk. You get the person who wrote the code."
          />
          <TermLine
            label="Monthly 1:1 strategy call."
            detail="30 minutes where you tell me what&apos;s broken + what you need next. Your feedback shapes the roadmap."
          />
          <TermLine
            label="Case-study partnership (optional)."
            detail="If we deliver measurable value, we&apos;d love to publish your story. You review every word; kill the draft if the numbers don&apos;t tell the story you want told. No publication without approval."
          />
          <TermLine
            label="50% off for life."
            detail="$24.50/mo instead of $49. Locked in while you&apos;re an active subscriber, including any future price changes."
          />
        </ul>

        <div className="flex gap-3">
          <Link
            href="/signup?plan=founder-network"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1712] text-[#F4EFE6] font-mono text-sm tracking-wide hover:bg-[#B5532C] transition-colors"
          >
            Claim a slot →
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center px-6 py-3 border border-[#1A1712] text-[#1A1712] font-mono text-sm tracking-wide hover:bg-[#1A1712] hover:text-[#F4EFE6] transition-colors"
          >
            See full pricing
          </Link>
        </div>
      </section>

      {/* ─── Colophon ─── */}
      <footer className="mt-32 pt-12 border-t border-[#D8CDB7] max-w-4xl text-[11px] font-mono text-[#8F8576] leading-loose">
        <p>
          Case studies update as the Founder Network cohort delivers
          results. No stock photos. No anonymous &ldquo;enterprise
          customer&rdquo; citations. Named names with measured
          outcomes.
        </p>
        <p className="mt-3">
          Want to vouch for Sovereign without being on this page?
          Email <a href="mailto:christiaan@sovereignmatrix.agency" className="underline decoration-[#B5532C]/40">christiaan@sovereignmatrix.agency</a>.
        </p>
      </footer>
    </main>
  );
}

function EmptyCohort() {
  return (
    <div className="border border-dashed border-[#C7B9A1] rounded-2xl px-10 py-16 text-center">
      <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-4">
        Honest Status
      </p>
      <h3 className="font-serif text-2xl lg:text-3xl text-[#1A1712] mb-4">
        No case studies yet.
      </h3>
      <p className="text-[15px] text-[#5C544A] leading-relaxed max-w-xl mx-auto mb-8">
        Sovereign Matrix is in its first-100-customer cohort. The
        Founder Network is how we earn these case studies — 50% off
        for life, direct line to the founder, monthly 1:1. When the
        first 3 customers deliver measured outcomes they&apos;re happy
        to publish, they land here with their names on them.
      </p>
      <Link
        href="/signup?plan=founder-network"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A1712] text-[#F4EFE6] font-mono text-xs tracking-wide hover:bg-[#B5532C] transition-colors"
      >
        Be customer #1 →
      </Link>
    </div>
  );
}

function TermLine({ label, detail }: { label: string; detail: string }) {
  return (
    <li>
      <p className="font-serif text-lg text-[#1A1712] mb-1">
        <em className="text-[#B5532C] not-italic">—</em> {label}
      </p>
      <p className="text-sm text-[#5C544A] leading-relaxed max-w-xl ml-6">
        {detail}
      </p>
    </li>
  );
}
