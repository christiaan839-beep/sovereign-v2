import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { db } from "@/db";
import { caseStudies } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { JsonLd } from "@/components/seo/JsonLd";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * /case-studies/[slug] — single customer-win narrative.
 *
 * Server-rendered. Pulls only approved + published rows; anything else
 * 404s. ISR for freshness without DB pounding. Generates rich metadata
 * + JSON-LD Article schema so the page indexes well on Google.
 */

export const revalidate = 300;
export const dynamicParams = true;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function loadCaseStudy(slug: string) {
  if (!slug || slug.length > 200) return null;
  try {
    const [row] = await db
      .select()
      .from(caseStudies)
      .where(
        and(
          eq(caseStudies.slug, slug),
          eq(caseStudies.approvedByCompany, true),
          isNotNull(caseStudies.publishedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: RouteContext): Promise<Metadata> {
  const { slug } = await params;
  const row = await loadCaseStudy(slug);
  if (!row) {
    return { title: "Case Study Not Found | Sovereign Matrix" };
  }
  const title = `${row.company}: ${row.outcome} | Sovereign Matrix`;
  const description = `${row.metric} — delivered with the ${row.playbook} playbook. ${row.outcome.slice(0, 140)}`;
  const url = `https://sovereignmatrix.agency/case-studies/${row.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: row.publishedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CaseStudyPage({ params }: RouteContext) {
  const { slug } = await params;
  const row = await loadCaseStudy(slug);
  if (!row) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${row.company}: ${row.outcome}`,
    datePublished: row.publishedAt?.toISOString(),
    dateModified: row.updatedAt?.toISOString(),
    author: {
      "@type": "Organization",
      name: "Sovereign Matrix",
      url: "https://sovereignmatrix.agency",
    },
    about: {
      "@type": "Thing",
      name: row.industry ?? "Business",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://sovereignmatrix.agency/case-studies/${row.slug}`,
    },
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <JsonLd data={articleSchema} />
      <article className="max-w-3xl mx-auto px-6 py-24">
        <Link
          href="/case-studies"
          className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-white transition-colors uppercase tracking-widest mb-12"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All customer stories
        </Link>

        <header className="mb-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400 mb-4">
            {row.industry ?? "Customer win"}
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-6 leading-tight">
            {row.company}
          </h1>
          <p className="text-lg md:text-xl text-neutral-300 leading-relaxed">
            {row.outcome}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-12">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <p className="text-[10px] uppercase tracking-widest text-emerald-400/70 mb-2">
              Headline metric
            </p>
            <p className="text-3xl font-black text-emerald-400">{row.metric}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Playbook
            </p>
            <p className="text-lg font-semibold text-white">{row.playbook}</p>
          </div>
        </div>

        {row.body ? (
          <div className="prose prose-invert prose-neutral max-w-none prose-headings:text-white prose-p:text-neutral-300 prose-p:leading-relaxed prose-a:text-emerald-400 prose-strong:text-white prose-code:text-emerald-300 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown>{row.body}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 italic">
            Long-form narrative coming soon. The numbers above are real and
            verified by {row.company}.
          </p>
        )}

        <footer className="mt-16 pt-8 border-t border-white/[0.08]">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 transition-colors"
          >
            Run the {row.playbook} playbook on your own data
            <ArrowRight className="w-4 h-4" />
          </Link>
        </footer>
      </article>
    </main>
  );
}
