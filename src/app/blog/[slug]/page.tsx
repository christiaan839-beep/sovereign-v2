import type { Metadata } from "next";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { BLOG_CONTENT } from "@/content/blog-posts";
import { ArticleContent } from "./ArticleContent";
import { FallbackBlogPost } from "./FallbackBlogPost";

// All known articles without static content
const KNOWN_ARTICLES: Record<string, { title: string; category: string; readTime: string; date: string }> = {
  "ai-vector-memory": {
    title: "AI Memory: The Vector System That Never Forgets a Winning Pattern",
    category: "Technology",
    readTime: "7 min",
    date: "Mar 2, 2026",
  },
  "white-label-ai-agency": {
    title: "Build a White-Label AI Agency With Zero Technical Skills",
    category: "Business",
    readTime: "9 min",
    date: "Feb 28, 2026",
  },
  "ai-agents-vs-chatbots": {
    title: "AI Agents vs Chatbots: Why the Difference Matters for Your Business",
    category: "Guide",
    readTime: "6 min",
    date: "Apr 5, 2026",
  },
  "hubspot-alternative-for-agencies": {
    title: "The Best HubSpot Alternative for Growth-Stage Agencies in 2026",
    category: "Comparison",
    readTime: "8 min",
    date: "Apr 3, 2026",
  },
  "project-glasswing-what-it-means": {
    title: "Project Glasswing: What Anthropic's Mythos Means for AI Security",
    category: "Industry",
    readTime: "10 min",
    date: "Apr 7, 2026",
  },
  "ai-agents-for-ecommerce": {
    title: "How E-Commerce Stores Use AI Agents to Write 10,000 Product Descriptions in a Day",
    category: "Use Case",
    readTime: "7 min",
    date: "Apr 8, 2026",
  },
  "fintech-compliance-ai": {
    title: "Why Fintech Companies Need Air-Gapped AI — Not Cloud Chatbots",
    category: "Industry",
    readTime: "9 min",
    date: "Apr 8, 2026",
  },
  "ai-recruiting-agents": {
    title: "From 1,000 Resumes to 10 Interviews: How AI Agents Transform Recruiting",
    category: "Use Case",
    readTime: "6 min",
    date: "Apr 9, 2026",
  },
  "flat-pricing-vs-credits": {
    title: "Why Credit-Based AI Pricing Is a Trap (And What to Use Instead)",
    category: "Analysis",
    readTime: "8 min",
    date: "Apr 9, 2026",
  },
  "multi-model-consensus": {
    title: "Single Model vs Multi-Model Consensus: Why 4 Models Beat 1",
    category: "Technology",
    readTime: "7 min",
    date: "Apr 9, 2026",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_CONTENT[slug];
  if (!post) return {};
  return {
    title: `${post.title} | Sovereign Matrix Blog`,
    description: post.excerpt,
    alternates: {
      canonical: `https://sovereignmatrix.agency/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: `https://sovereignmatrix.agency/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const staticPost = BLOG_CONTENT[slug];

  // If we have static content, render the full server component
  if (staticPost) {
    return (
      <div className="min-h-screen bg-[#030303] text-white">
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#B5532C]/[0.04] rounded-full blur-[180px]" />
        </div>

        {/* Nav */}
        <nav className="relative z-10 px-6 md:px-10 py-6 max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/blog"
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors"
          >
            Get Started
          </Link>
        </nav>

        <article className="relative z-10 max-w-3xl mx-auto px-6 pb-24">
          {/* Article header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(181,83,44,0.10)",
                  border: "1px solid rgba(181,83,44,0.22)",
                  color: "#B5532C",
                }}
              >
                {staticPost.category}
              </span>
              <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {staticPost.readTime} read
              </span>
              <span className="text-[10px] text-neutral-600 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {staticPost.date}
              </span>
            </div>

            <h1 className="font-['Instrument_Serif'] text-3xl md:text-4xl text-white tracking-tight leading-[1.15] mb-5">
              {staticPost.title}
            </h1>

            <p className="text-neutral-400 text-base leading-relaxed mb-7 max-w-2xl">
              {staticPost.excerpt}
            </p>

            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: "rgba(181,83,44,0.12)",
                  color: "#B5532C",
                  border: "1px solid rgba(181,83,44,0.20)",
                }}
              >
                S
              </div>
              <div>
                <p className="text-sm text-white font-semibold">Sovereign Matrix</p>
                <p className="text-[10px] text-neutral-600">Agent Intelligence Team</p>
              </div>
            </div>

            {/* Divider */}
            <div
              className="mt-8 h-px w-full"
              style={{ background: "linear-gradient(90deg, rgba(181,83,44,0.25) 0%, transparent 70%)" }}
            />
          </div>

          {/* Article body */}
          <ArticleContent content={staticPost.content} />

          {/* CTA */}
          <div
            className="mt-16 p-8 rounded-2xl text-center"
            style={{
              border: "1px solid rgba(181,83,44,0.15)",
              background: "rgba(181,83,44,0.03)",
            }}
          >
            <h3 className="text-lg font-bold text-white mb-2">Ready to see it in action?</h3>
            <p className="text-sm text-neutral-400 mb-5">
              Run a free competitor scan — no signup required.
            </p>
            <Link
              href="/free/competitor-scan"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all"
              style={{ background: "#B5532C", color: "#fff" }}
            >
              Scan a Competitor Free
            </Link>
          </div>
        </article>
      </div>
    );
  }

  // Fallback: look up metadata for known-but-not-yet-static articles
  const fallbackMeta = KNOWN_ARTICLES[slug];
  const fallbackTitle = fallbackMeta?.title
    || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <FallbackBlogPost
      slug={slug}
      title={fallbackTitle}
      meta={fallbackMeta ?? null}
    />
  );
}
