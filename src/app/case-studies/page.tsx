import Link from "next/link";
import { db } from "@/db";
import { caseStudies } from "@/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import CuratedExamples from "./CuratedExamples";
import { RealWins } from "./RealWins";
import { JsonLd } from "@/components/seo/JsonLd";

/**
 * /case-studies — public proof page.
 *
 * Server-rendered shell that pulls real published wins from the DB and
 * renders them above the curated example library. ISR (5 min) keeps DB
 * load low while still letting fresh approvals appear within minutes.
 */

export const revalidate = 300;

interface DbCaseStudy {
  slug: string;
  company: string;
  industry: string | null;
  outcome: string;
  metric: string;
  playbook: string;
  publishedAt: Date | null;
}

async function loadRealWins(): Promise<DbCaseStudy[]> {
  try {
    const rows = await db
      .select({
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
      .limit(24);
    return rows;
  } catch {
    // Table missing or DB blip — render the curated section alone, never crash.
    return [];
  }
}

export default async function CaseStudiesPage() {
  const wins = await loadRealWins();

  // schema.org Review aggregate so search engines can pick up the win count.
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: wins.map((w, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Article",
        headline: `${w.company}: ${w.outcome}`,
        url: `https://sovereignmatrix.agency/case-studies/${w.slug}`,
      },
    })),
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {wins.length > 0 && <JsonLd data={itemListSchema} />}
      <div className="max-w-4xl mx-auto px-6 py-32">
        <Link
          href="/"
          className="text-xs text-neutral-500 hover:text-white transition-colors uppercase tracking-widest mb-8 block"
        >
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Customer Stories
        </h1>
        <p className="text-neutral-400 mb-16 text-lg">
          {wins.length > 0
            ? "Real numbers, real customers — every entry sits above the patterns."
            : "See how teams use Sovereign Matrix to automate their business."}
        </p>

        <RealWins wins={wins} />

        <CuratedExamples />

        <div className="mt-12 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <p className="text-sm text-neutral-400">
            Want to be featured?{" "}
            <a
              href="mailto:christiaan@sovereignmatrix.agency"
              className="text-white hover:underline"
            >
              christiaan@sovereignmatrix.agency
            </a>
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 text-xs text-neutral-500">
          <p>
            <Link
              href="/enterprise"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              Enterprise
            </Link>{" "}
            |{" "}
            <Link
              href="/pricing"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              Pricing
            </Link>{" "}
            |{" "}
            <Link
              href="/"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              Home
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
