"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Users,
  FileText,
  Search,
  BarChart3,
  Info,
} from "lucide-react";
import Link from "next/link";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

// ─── Example output data ───

const LEAD_GEN_ROWS = [
  { company: "Streamline HQ", title: "VP of Marketing", pattern: "first.last@streamlinehq.com", score: 9.1 },
  { company: "Beacon Analytics", title: "Head of Growth", pattern: "first@beaconanalytics.io", score: 8.7 },
  { company: "Plexus Labs", title: "CMO", pattern: "first.last@plexuslabs.com", score: 8.4 },
  { company: "Relay Systems", title: "Director of Demand Gen", pattern: "first@relaysystems.co", score: 8.1 },
  { company: "Cortex AI", title: "VP Sales", pattern: "flast@cortexai.com", score: 7.8 },
];

const BLOG_EXCERPT = `The agency model is breaking. Not because agencies don't add value — they do. But because the delivery layer between strategy and execution has become a bottleneck that AI can collapse entirely.

Consider what a mid-market company actually buys when they hire a digital agency: research, content production, campaign setup, reporting. Each of these is a defined workflow with clear inputs and outputs. That's exactly the shape of problem autonomous agents solve well.

The shift isn't about replacing people. It's about removing the weeks of latency between "we need a campaign" and "it's live." When an agent can research your competitors, draft landing page copy, generate ad variants, and set up tracking — all before your Monday standup — the question stops being "should we use AI?" and becomes "why are we still waiting?"`;

const SEO_FINDINGS = [
  { severity: "high", finding: "Missing meta descriptions on 23 of 48 indexed pages", recommendation: "Add unique meta descriptions under 155 characters for each page" },
  { severity: "high", finding: "Core Web Vitals: LCP at 4.2s (target: under 2.5s)", recommendation: "Optimize hero image loading, defer non-critical JS bundles" },
  { severity: "medium", finding: "No internal linking between blog posts and product pages", recommendation: "Add 2-3 contextual internal links per blog post to relevant features" },
  { severity: "medium", finding: "H1 tags duplicated across /pricing and /features", recommendation: "Write unique H1s that match each page's primary keyword target" },
  { severity: "low", finding: "Alt text missing on 12 images", recommendation: "Add descriptive alt text for accessibility and image search indexing" },
];

const COMPETITOR_ANALYSIS = [
  { category: "Tech Stack", yours: "Next.js 15, Tailwind, Vercel", competitor: "WordPress, Elementor, shared hosting", insight: "Significant performance advantage — use this to differentiate on speed" },
  { category: "SEO Coverage", yours: "42 ranking keywords", competitor: "127 ranking keywords", insight: "Competitor leads on long-tail content; target their gaps in 'autonomous agents' and 'AI workflow'" },
  { category: "Pricing", yours: "$99-499/mo flat", competitor: "$2,500-10,000/mo retainer", insight: "10x cost advantage — emphasize in sales materials and landing pages" },
  { category: "Content Volume", yours: "8 blog posts", competitor: "64 blog posts", insight: "Content gap is closeable with agent-generated content at scale" },
  { category: "Integrations", yours: "25+ native", competitor: "Zapier-dependent (no native)", insight: "Native integrations = less friction, lower total cost for customers" },
];

// ─── Section wrapper ───
function OutputSection({
  id,
  icon: Icon,
  label,
  title,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      className="mb-20"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-emerald-400" />
        </div>
        <div>
          <span className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-semibold block">
            {label}
          </span>
          <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-[#080808] overflow-hidden">
        {children}
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          href="/signup"
          className="group inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Try this agent{" "}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </motion.section>
  );
}

// ─── Severity badge ───
function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    high: "text-red-400 bg-red-500/10 border-red-500/20",
    medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${colors[level] || colors.low}`}
    >
      {level}
    </span>
  );
}

// ─── Main Page ───
export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 py-3">
        <div className="bg-[#080808]/90 backdrop-blur-2xl border border-white/[0.06] rounded-full px-5 h-12 flex items-center justify-between w-full max-w-4xl">
          <Link href="/" className="flex items-center gap-2.5">
            <SovereignLogo size="sm" />
            <span className="text-sm font-semibold text-white">Results</span>
          </Link>
          <Link
            href="/signup"
            className="px-4 py-1.5 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main id="main-content">

      {/* Hero */}
      <section className="pt-28 pb-12 px-6 text-center max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-white">
            Results Gallery
          </h1>
          <p className="text-neutral-400 text-sm md:text-base max-w-xl mx-auto mb-6">
            Example outputs from Sovereign Matrix agents. These formats show
            what each agent produces — structure, depth, and detail.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <Info className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[11px] text-neutral-500">
              Example outputs for illustration — not real company data
            </span>
          </div>
        </motion.div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pb-24">
        {/* ─── Lead Generation ─── */}
        <OutputSection
          id="leads"
          icon={Users}
          label="Lead Generation Agent"
          title="Sample lead list output"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Company
                  </th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Title
                  </th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Email Pattern
                  </th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 text-right">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {LEAD_GEN_ROWS.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm text-white font-medium">
                      {row.company}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-neutral-400">
                      {row.title}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-neutral-500 font-mono">
                      {row.pattern}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={`text-sm font-semibold font-mono ${
                          row.score >= 8.5
                            ? "text-emerald-400"
                            : row.score >= 8.0
                              ? "text-amber-400"
                              : "text-neutral-400"
                        }`}
                      >
                        {row.score.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-[10px] text-neutral-600 font-mono">
              5 of 53 results shown
            </span>
            <span className="text-[10px] text-neutral-600">
              Scores based on ICP fit, hiring signals, funding recency
            </span>
          </div>
        </OutputSection>

        {/* ─── Blog Generation ─── */}
        <OutputSection
          id="blog"
          icon={FileText}
          label="Blog Generation Agent"
          title="Sample blog post excerpt"
        >
          <div className="p-6">
            <h3 className="text-base font-bold text-white mb-1">
              Why AI Agents Are Replacing the Traditional Agency Model
            </h3>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[10px] text-neutral-600 font-mono">
                2,147 words
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span className="text-[10px] text-neutral-600 font-mono">
                8 min read
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span className="text-[10px] text-neutral-600 font-mono">
                Readability: Grade 8
              </span>
            </div>
            <div className="text-sm text-neutral-400 leading-relaxed whitespace-pre-line border-l-2 border-emerald-500/20 pl-5">
              {BLOG_EXCERPT}
            </div>
            <div className="mt-5 pt-4 border-t border-white/[0.04] flex items-center gap-4">
              <span className="text-[10px] text-neutral-600">
                Brand voice applied from memory
              </span>
              <span className="w-1 h-1 rounded-full bg-neutral-700" />
              <span className="text-[10px] text-neutral-600">
                One-click publish to WordPress, Medium, LinkedIn
              </span>
            </div>
          </div>
        </OutputSection>

        {/* ─── SEO Audit ─── */}
        <OutputSection
          id="seo"
          icon={Search}
          label="SEO Audit Agent"
          title="Sample audit findings"
        >
          <div className="divide-y divide-white/[0.04]">
            {SEO_FINDINGS.map((item, i) => (
              <div key={i} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="shrink-0 pt-0.5">
                  <SeverityBadge level={item.severity} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white mb-1">{item.finding}</p>
                  <p className="text-xs text-neutral-500">
                    {item.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-white/[0.04]">
            <span className="text-[10px] text-neutral-600 font-mono">
              5 findings shown — full audit covers technical SEO, content gaps,
              backlink profile, and keyword opportunities
            </span>
          </div>
        </OutputSection>

        {/* ─── Competitor Analysis ─── */}
        <OutputSection
          id="competitor"
          icon={BarChart3}
          label="Competitor Analysis Agent"
          title="Sample competitive comparison"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Category
                  </th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    You
                  </th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Competitor
                  </th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Insight
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_ANALYSIS.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm text-white font-medium whitespace-nowrap">
                      {row.category}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-emerald-400/80">
                      {row.yours}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-neutral-500">
                      {row.competitor}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-neutral-400 max-w-xs">
                      {row.insight}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-white/[0.04]">
            <span className="text-[10px] text-neutral-600 font-mono">
              Full report includes tech stack detection, backlink comparison,
              content gap analysis, and counter-strategy recommendations
            </span>
          </div>
        </OutputSection>

        {/* ─── CTA ─── */}
        <section className="text-center pt-8 pb-12">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
            See your own results.
          </h2>
          <p className="text-neutral-500 text-sm mb-8 max-w-md mx-auto">
            Run any of these agents on your actual data. Free tier available, no
            credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="group flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-200 transition-colors"
            >
              Start Free{" "}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/"
              className="px-8 py-4 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </section>
      </div>

      </main>
    </div>
  );
}
