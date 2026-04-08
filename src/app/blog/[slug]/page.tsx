"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

/**
 * Blog Post Detail Page — Generates content via NIM API, renders
 * within the site's dark design system (not raw HTML).
 */

// Known articles with metadata for instant rendering
const KNOWN_ARTICLES: Record<string, { title: string; category: string; readTime: string; date: string }> = {
  "why-agencies-are-dying": { title: "Why Marketing Agencies Are Dying \u2014 And What Replaces Them", category: "Industry", readTime: "8 min", date: "Mar 12, 2026" },
  "autonomous-marketing-playbook": { title: "The Autonomous Marketing Playbook: How to Run $30k/mo in Ads Without Touching a Button", category: "Guide", readTime: "12 min", date: "Mar 10, 2026" },
  "swarm-intelligence-marketing": { title: "Swarm Intelligence: Why Two AI Agents Write Better Copy Than Any Human", category: "Deep Dive", readTime: "6 min", date: "Mar 8, 2026" },
  "ai-replacing-10k-retainers": { title: "How AI Agents Are Replacing $5k/mo Agency Retainers", category: "Analysis", readTime: "10 min", date: "Mar 5, 2026" },
  "ai-vector-memory": { title: "AI Memory: The Vector System That Never Forgets a Winning Pattern", category: "Technology", readTime: "7 min", date: "Mar 2, 2026" },
  "white-label-ai-agency": { title: "Build a White-Label AI Agency With Zero Technical Skills", category: "Business", readTime: "9 min", date: "Feb 28, 2026" },
  "ai-agents-vs-chatbots": { title: "AI Agents vs Chatbots: Why the Difference Matters for Your Business", category: "Guide", readTime: "6 min", date: "Apr 5, 2026" },
  "hubspot-alternative-for-agencies": { title: "The Best HubSpot Alternative for Growth-Stage Agencies in 2026", category: "Comparison", readTime: "8 min", date: "Apr 3, 2026" },
  "consensus-verification-ai": { title: "Why One AI Model Isn\u2019t Enough: The Case for Consensus Verification", category: "Technology", readTime: "7 min", date: "Apr 1, 2026" },
  "project-glasswing-what-it-means": { title: "Project Glasswing: What Anthropic\u2019s Mythos Means for AI Security", category: "Industry", readTime: "10 min", date: "Apr 7, 2026" },
};

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const meta = KNOWN_ARTICLES[slug];
  const title = meta?.title || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch("/api/agents/smart-router", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Write a detailed, insightful blog post about: "${title}". Write 800-1200 words. Use markdown formatting with ## headings, bullet points, and bold text. Be specific and actionable \u2014 not generic. Reference real tools, real numbers, and real strategies. Do NOT use AI slop phrases like "in today's fast-paced world" or "leverage". Write like a senior engineer explaining to a peer.`,
            task_type: "creative",
          }),
        });
        const data = await res.json();
        setContent(data.result || data.response || "Content is being generated. Please refresh in a moment.");
      } catch {
        setContent("This article is being prepared. Please check back shortly.");
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, [title]);

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 py-6 max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/blog" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>
        <Link href="/signup" className="px-4 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors">
          Get Started
        </Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 pb-24">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          {meta && (
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">{meta.category}</span>
              <span className="text-[10px] text-neutral-500 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{meta.readTime}</span>
              <span className="text-[10px] text-neutral-600">{meta.date}</span>
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-[1.15] mb-4">{title}</h1>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-400">S</div>
            <div>
              <p className="text-sm text-white font-semibold">Sovereign Matrix</p>
              <p className="text-[10px] text-neutral-600">Agent Intelligence Team</p>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            <p className="text-sm text-neutral-500">Generating article with consensus verification...</p>
            <p className="text-[10px] text-neutral-700">Powered by DeepSeek V3.2 + Nemotron critique</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="prose prose-invert prose-sm max-w-none
              prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
              prose-p:text-neutral-300 prose-p:leading-relaxed
              prose-li:text-neutral-300
              prose-strong:text-white
              prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
              prose-code:text-emerald-400 prose-code:bg-white/[0.04] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-blockquote:border-emerald-500/30 prose-blockquote:text-neutral-400"
          >
            {content?.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold text-white mt-8 mb-3">{line.replace("## ", "")}</h2>;
              if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold text-white mt-6 mb-2">{line.replace("### ", "")}</h3>;
              if (line.startsWith("- ")) return <li key={i} className="text-neutral-300 ml-4">{line.replace("- ", "")}</li>;
              if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-white font-semibold my-2">{line.replace(/\*\*/g, "")}</p>;
              if (line.trim() === "") return <br key={i} />;
              return <p key={i} className="text-neutral-300 leading-relaxed my-3">{line}</p>;
            })}
          </motion.div>
        )}

        {/* CTA */}
        <div className="mt-16 p-8 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] text-center">
          <h3 className="text-lg font-bold text-white mb-2">Ready to see it in action?</h3>
          <p className="text-sm text-neutral-400 mb-4">Try a free competitor scan — no signup required.</p>
          <Link href="/free/competitor-scan" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Scan a Competitor Free
          </Link>
        </div>
      </article>
    </div>
  );
}
