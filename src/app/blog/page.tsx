"use client";

import { motion } from "framer-motion";
import { ArrowRight, Zap, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-posts";

const fadeIn = (d: number) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { delay: d, duration: 0.6 },
});

const _CATEGORIES = [
  "All",
  "Industry",
  "Guide",
  "Deep Dive",
  "Case Study",
  "Technology",
  "Business",
];

export default function BlogPage() {
  const featured = BLOG_POSTS.filter((a) => a.featured);
  const regular = BLOG_POSTS.filter((a) => !a.featured);

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/[0.03] rounded-full blur-[200px]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-6 md:px-8 py-6 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">
            Sovereign Matrix
          </span>
        </Link>
        <div className="flex items-center gap-6 text-xs text-neutral-500">
          <Link href="/pricing" className="hover:text-white transition-colors">
            Pricing
          </Link>
          <Link
            href="/vs/hubspot"
            className="hover:text-white transition-colors"
          >
            Compare
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main id="main-content">
        <section className="relative z-10 px-8 pt-12 pb-16 max-w-6xl mx-auto">
          <motion.div {...fadeIn(0)} className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
              <Zap className="w-3 h-3" /> Blog
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Agent Intelligence
            </h1>
            <p className="text-neutral-400 max-w-lg mx-auto">
              Insights on autonomous agents, AI infrastructure, and building
              systems that scale without humans.
            </p>
          </motion.div>

          {/* Featured Articles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
            {featured.map((a, i) => (
              <Link key={a.slug} href={`/blog/${a.slug}`}>
                <motion.article
                  {...fadeIn(i * 0.1)}
                  className="rounded-2xl border border-white/[0.06] bg-[#080808] p-6 group hover:border-emerald-500/20 transition-gpu cursor-pointer h-full"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
                      {a.category}
                    </span>
                    <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {a.readTime}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors leading-snug">
                    {a.title}
                  </h2>
                  <p className="text-sm text-neutral-500 leading-relaxed mb-4">
                    {a.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {a.date}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 group-hover:gap-2 transition-gpu">
                      Read <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </motion.article>
              </Link>
            ))}
          </div>

          {/* All Articles */}
          <div className="space-y-4">
            {regular.map((a, i) => (
              <Link key={a.slug} href={`/blog/${a.slug}`}>
                <motion.article
                  {...fadeIn(i * 0.05)}
                  className="rounded-2xl border border-white/[0.06] bg-[#080808] p-5 flex items-center gap-5 group hover:border-emerald-500/20 transition-gpu cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 text-[9px] font-bold uppercase">
                        {a.category}
                      </span>
                      <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {a.readTime}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {a.date}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors mb-1">
                      {a.title}
                    </h3>
                    <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                      {a.excerpt}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 shrink-0 transition-colors" />
                </motion.article>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.04] px-8 py-10 text-center">
        <p className="text-[10px] text-neutral-700 uppercase tracking-[0.4em]">
          Sovereign Matrix — Agent Operating System
        </p>
      </footer>
    </div>
  );
}
