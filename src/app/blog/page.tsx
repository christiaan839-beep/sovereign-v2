"use client";

import { motion } from "framer-motion";
import { ArrowRight, Zap, Clock, Calendar } from "lucide-react";
import Link from "next/link";

const fadeIn = (d: number) => ({ initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: d, duration: 0.6 } });

const ARTICLES = [
  {
    slug: "why-agencies-are-dying",
    title: "Why Marketing Agencies Are Dying — And What Replaces Them",
    excerpt: "The agency model relies on one assumption: you need humans. But autonomous AI systems are now outperforming full teams at 3% of the cost. Here's why the next wave of agencies will have zero employees.",
    category: "Industry",
    readTime: "8 min",
    date: "Mar 12, 2026",
    featured: true,
  },
  {
    slug: "autonomous-marketing-playbook",
    title: "The Autonomous Marketing Playbook: How to Run $30k/mo in Ads Without Touching a Button",
    excerpt: "Set your ROAS threshold, deploy your campaigns, and let agents handle the rest — killing losers, scaling winners, and writing new copy 24/7.",
    category: "Guide",
    readTime: "12 min",
    date: "Mar 10, 2026",
    featured: true,
  },
  {
    slug: "swarm-intelligence-marketing",
    title: "Swarm Intelligence: Why Two AI Agents Write Better Copy Than Any Human",
    excerpt: "When a Creator agent writes copy and a Critic agent tears it apart, the result is copy that scores 9+/10 consistently. Here's the psychology behind why debate produces better output.",
    category: "Deep Dive",
    readTime: "6 min",
    date: "Mar 8, 2026",
  },
  {
    slug: "ai-replacing-10k-retainers",
    title: "How AI Agents Are Replacing $5k/mo Agency Retainers",
    excerpt: "What happens when a $199/mo platform does the same work as a $5,000/mo agency retainer? Three use cases that show the shift.",
    category: "Analysis",
    readTime: "10 min",
    date: "Mar 5, 2026",
  },
  {
    slug: "ai-vector-memory",
    title: "AI Memory: The Vector System That Never Forgets a Winning Pattern",
    excerpt: "Every successful campaign pattern is stored in vector memory. Every future campaign starts smarter. This is how compound intelligence works — and why it can't be replicated by humans.",
    category: "Technology",
    readTime: "7 min",
    date: "Mar 2, 2026",
  },
  {
    slug: "white-label-ai-agency",
    title: "Build a White-Label AI Agency With Zero Technical Skills",
    excerpt: "Use Sovereign Matrix as your agency backend. Service 10 clients at $99/mo each on a $499/mo Enterprise plan. Zero code, zero hiring.",
    category: "Business",
    readTime: "9 min",
    date: "Feb 28, 2026",
  },
  {
    slug: "ai-agents-vs-chatbots",
    title: "AI Agents vs Chatbots: Why the Difference Matters for Your Business",
    excerpt: "ChatGPT is a chatbot. It answers questions. An AI agent plans, executes, retries, and delivers results. Here's why the distinction changes everything.",
    category: "Guide",
    readTime: "6 min",
    date: "Apr 5, 2026",
    featured: true,
  },
  {
    slug: "hubspot-alternative-for-agencies",
    title: "The Best HubSpot Alternative for Growth-Stage Agencies in 2026",
    excerpt: "HubSpot costs $890/mo for marketing automation. Sovereign Matrix gives you 140 autonomous agents for $199/mo — and they actually execute, not just automate.",
    category: "Comparison",
    readTime: "8 min",
    date: "Apr 3, 2026",
  },
  {
    slug: "consensus-verification-ai",
    title: "Why One AI Model Isn\u2019t Enough: The Case for Consensus Verification",
    excerpt: "When 4 independent models generate, critique, and synthesize an answer, accuracy jumps 22.8 percentage points. Here's how multi-model consensus works and why it matters.",
    category: "Technology",
    readTime: "7 min",
    date: "Apr 1, 2026",
  },
  {
    slug: "project-glasswing-what-it-means",
    title: "Project Glasswing: What Anthropic\u2019s Mythos Means for AI Security",
    excerpt: "Claude Mythos Preview found zero-days in OpenBSD, FFmpeg, and the Linux kernel. When frontier models can hack autonomously, guardrails aren't optional — they're infrastructure.",
    category: "Industry",
    readTime: "10 min",
    date: "Apr 7, 2026",
    featured: true,
  },
  {
    slug: "ai-agents-for-ecommerce",
    title: "How E-Commerce Stores Use AI Agents to Write 10,000 Product Descriptions in a Day",
    excerpt: "Manual product descriptions don\u2019t scale. AI agents generate SEO-optimized, brand-voiced descriptions for entire catalogs — while monitoring competitor prices in real time.",
    category: "Use Case",
    readTime: "7 min",
    date: "Apr 8, 2026",
  },
  {
    slug: "fintech-compliance-ai",
    title: "Why Fintech Companies Need Air-Gapped AI — Not Cloud Chatbots",
    excerpt: "Fiduciary data can\u2019t touch the cloud. Local execution via Ollama + 5-layer safety pipeline = the only architecture that passes compliance audits.",
    category: "Industry",
    readTime: "9 min",
    date: "Apr 8, 2026",
  },
  {
    slug: "ai-recruiting-agents",
    title: "From 1,000 Resumes to 10 Interviews: How AI Agents Transform Recruiting",
    excerpt: "Screening 1,000 applicants takes a human recruiter 2 weeks. AI agents do it in 4 minutes — with less bias and better pattern matching.",
    category: "Use Case",
    readTime: "6 min",
    date: "Apr 9, 2026",
  },
  {
    slug: "flat-pricing-vs-credits",
    title: "Why Credit-Based AI Pricing Is a Trap (And What to Use Instead)",
    excerpt: "CIOs underestimate AI costs by 1,000%. Credits expire, overages multiply, and per-token billing makes budgeting impossible. Flat pricing fixes all of it.",
    category: "Analysis",
    readTime: "8 min",
    date: "Apr 9, 2026",
    featured: true,
  },
  {
    slug: "multi-model-consensus",
    title: "Single Model vs Multi-Model Consensus: Why 4 Models Beat 1",
    excerpt: "When you run the same query through 4 independent models and take the consensus, accuracy jumps 22.8 percentage points. Here\u2019s the data.",
    category: "Technology",
    readTime: "7 min",
    date: "Apr 9, 2026",
  },
];

const _CATEGORIES = ["All", "Industry", "Guide", "Deep Dive", "Case Study", "Technology", "Business"];

export default function BlogPage() {
  const featured = ARTICLES.filter(a => a.featured);
  const regular = ARTICLES.filter(a => !a.featured);

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/[0.03] rounded-full blur-[200px]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-6 md:px-8 py-6 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">Sovereign Matrix</span>
        </Link>
        <div className="flex items-center gap-6 text-xs text-neutral-500">
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/vs/hubspot" className="hover:text-white transition-colors">Compare</Link>
          <Link href="/signup" className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors">Get Started</Link>
        </div>
      </nav>

      <main id="main-content">

      <section className="relative z-10 px-8 pt-12 pb-16 max-w-6xl mx-auto">
        <motion.div {...fadeIn(0)} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
            <Zap className="w-3 h-3" /> Blog
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Agent Intelligence</h1>
          <p className="text-neutral-400 max-w-lg mx-auto">Insights on autonomous agents, AI infrastructure, and building systems that scale without humans.</p>
        </motion.div>

        {/* Featured Articles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          {featured.map((a, i) => (
            <Link key={a.slug} href={`/blog/${a.slug}`}>
            <motion.article {...fadeIn(i * 0.1)} className="rounded-2xl border border-white/[0.06] bg-[#080808] p-6 group hover:border-emerald-500/20 transition-gpu cursor-pointer h-full">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">{a.category}</span>
                <span className="text-[10px] text-neutral-500 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{a.readTime}</span>
              </div>
              <h2 className="text-lg font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors leading-snug">{a.title}</h2>
              <p className="text-sm text-neutral-500 leading-relaxed mb-4">{a.excerpt}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{a.date}</span>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 group-hover:gap-2 transition-gpu">Read <ArrowRight className="w-3 h-3" /></span>
              </div>
            </motion.article>
            </Link>
          ))}
        </div>

        {/* All Articles */}
        <div className="space-y-4">
          {regular.map((a, i) => (
            <Link key={a.slug} href={`/blog/${a.slug}`}>
            <motion.article {...fadeIn(i * 0.05)} className="rounded-2xl border border-white/[0.06] bg-[#080808] p-5 flex items-center gap-5 group hover:border-emerald-500/20 transition-gpu cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 text-[9px] font-bold uppercase">{a.category}</span>
                  <span className="text-[10px] text-neutral-500 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{a.readTime}</span>
                  <span className="text-[10px] text-neutral-500">{a.date}</span>
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors mb-1">{a.title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">{a.excerpt}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 shrink-0 transition-colors" />
            </motion.article>
            </Link>
          ))}
        </div>
      </section>

      </main>

      <footer className="relative z-10 border-t border-white/[0.04] px-8 py-10 text-center">
        <p className="text-[10px] text-neutral-700 uppercase tracking-[0.4em]">Sovereign Matrix — Agent Operating System</p>
      </footer>
    </div>
  );
}
