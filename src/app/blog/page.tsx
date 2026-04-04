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
    title: "The Autonomous Marketing Playbook: How to Run R500k/mo in Ads Without Touching a Button",
    excerpt: "Ghost Mode changes everything. Set your ROAS threshold, deploy your campaigns, and let AI handle the rest — killing losers, scaling winners, and writing new copy 24/7.",
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
    title: "How AI Is Replacing R100k/mo Agency Retainers",
    excerpt: "Three agency owners share how they replaced their entire marketing team with a single autonomous system — and saw revenue increase by 200-400%.",
    category: "Case Study",
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
    title: "Build a R600k/mo White-Label AI Agency With Zero Technical Skills",
    excerpt: "Use SOVEREIGN as your agency backend. Service 12 clients at R50k/mo each. Zero code, zero hiring, zero overhead. Here's the exact playbook.",
    category: "Business",
    readTime: "9 min",
    date: "Feb 28, 2026",
  },
];

const _CATEGORIES = ["All", "Industry", "Guide", "Deep Dive", "Case Study", "Technology", "Business"];

export default function BlogPage() {
  const featured = ARTICLES.filter(a => a.featured);
  const regular = ARTICLES.filter(a => !a.featured);

  return (
    <div className="min-h-screen bg-midnight text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-electric/5 via-transparent to-transparent blur-3xl" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-electric to-rose-glow flex items-center justify-center text-xs font-bold">U</div>
          <span className="text-sm font-medium tracking-[0.15em] uppercase">SOVEREIGN</span>
        </Link>
        <div className="flex items-center gap-6 text-xs text-text-secondary">
          <Link href="/pricing" className="hover:text-white transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/case-studies" className="hover:text-white transition-colors">Case Studies</Link>
        </div>
      </nav>

      <main id="main-content">

      <section className="relative z-10 px-8 pt-12 pb-16 max-w-6xl mx-auto">
        <motion.div {...fadeIn(0)} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-electric/10 border border-electric/20 text-electric text-xs font-bold uppercase tracking-wider mb-6">
            <Zap className="w-3 h-3" /> Intelligence Hub
          </div>
          <h1 className="text-4xl md:text-5xl serif-text font-light mb-4">The SOVEREIGN Blog</h1>
          <p className="text-text-secondary max-w-lg mx-auto">Insights on autonomous marketing, AI strategy, and building systems that scale without humans.</p>
        </motion.div>

        {/* Featured Articles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          {featured.map((a, i) => (
            <motion.article key={a.slug} {...fadeIn(i * 0.1)} className="glass-card p-6 group hover:border-electric/30 transition-gpu cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-2 py-0.5 rounded-full bg-electric/10 border border-electric/20 text-electric text-[10px] font-bold uppercase">{a.category}</span>
                <span className="text-[10px] text-text-secondary flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{a.readTime}</span>
              </div>
              <h2 className="text-lg font-bold text-white mb-3 group-hover:text-electric transition-colors leading-snug">{a.title}</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">{a.excerpt}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-secondary flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{a.date}</span>
                <span className="text-xs text-electric font-bold flex items-center gap-1 group-hover:gap-2 transition-gpu">Read <ArrowRight className="w-3 h-3" /></span>
              </div>
            </motion.article>
          ))}
        </div>

        {/* All Articles */}
        <div className="space-y-4">
          {regular.map((a, i) => (
            <motion.article key={a.slug} {...fadeIn(i * 0.05)} className="glass-card p-5 flex items-center gap-5 group hover:border-electric/30 transition-gpu cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-onyx border border-glass-border text-text-secondary text-[9px] font-bold uppercase">{a.category}</span>
                  <span className="text-[10px] text-text-secondary flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{a.readTime}</span>
                  <span className="text-[10px] text-text-secondary">{a.date}</span>
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-electric transition-colors mb-1">{a.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{a.excerpt}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-secondary group-hover:text-electric shrink-0 transition-colors" />
            </motion.article>
          ))}
        </div>
      </section>

      </main>

      <footer className="relative z-10 border-t border-glass-border/30 px-8 py-10 text-center">
        <p className="text-[10px] text-text-secondary/40 uppercase tracking-[0.4em]">SOVEREIGN — Shadow Intelligence Platform</p>
      </footer>
    </div>
  );
}
