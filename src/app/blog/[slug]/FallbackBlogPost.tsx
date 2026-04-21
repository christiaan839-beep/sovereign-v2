"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Calendar, Loader2 } from "lucide-react";
import Link from "next/link";
import { ArticleContent } from "./ArticleContent";

interface FallbackBlogPostProps {
  slug: string;
  title: string;
  meta: { category: string; readTime: string; date: string } | null;
}

export function FallbackBlogPost({ slug, title, meta }: FallbackBlogPostProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContent() {
      try {
        const res = await fetch("/api/agents/smart-router", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Write a detailed, insightful blog post about: "${title}". Write 800–1000 words. Use markdown formatting with ## headings, bullet points, and **bold** text. Be specific and actionable — not generic. Reference real tools, real numbers, and real strategies. Do NOT use phrases like "in today's fast-paced world" or "leverage". Write like a senior engineer explaining to a peer.`,
            task_type: "creative",
          }),
        });
        const data = await res.json();
        setContent(
          data.result ||
            data.response ||
            "This article is being prepared. Please check back shortly."
        );
      } catch {
        setContent(
          "This article is being prepared. Please check back shortly."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, [title]);

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#B5532C]/[0.04] rounded-full blur-[180px]" />
      </div>

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          {meta && (
            <div className="flex items-center gap-3 mb-5">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(181,83,44,0.10)",
                  border: "1px solid rgba(181,83,44,0.22)",
                  color: "#B5532C",
                }}
              >
                {meta.category}
              </span>
              <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {meta.readTime} read
              </span>
              <span className="text-[10px] text-neutral-600 flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {meta.date}
              </span>
            </div>
          )}

          <h1 className="font-['Instrument_Serif'] text-3xl md:text-4xl text-white tracking-tight leading-[1.15] mb-5">
            {title}
          </h1>

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

          <div
            className="mt-8 h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(181,83,44,0.25) 0%, transparent 70%)",
            }}
          />
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2
              className="w-6 h-6 animate-spin"
              style={{ color: "#B5532C" }}
            />
            <p className="text-sm text-neutral-500">
              Generating article with consensus verification...
            </p>
            <p className="text-[10px] text-neutral-700">
              Powered by DeepSeek V3.2 + Nemotron critique
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {content && <ArticleContent content={content} />}
          </motion.div>
        )}

        {!loading && (
          <div
            className="mt-16 p-8 rounded-2xl text-center"
            style={{
              border: "1px solid rgba(181,83,44,0.15)",
              background: "rgba(181,83,44,0.03)",
            }}
          >
            <h3 className="text-lg font-bold text-white mb-2">
              Ready to see it in action?
            </h3>
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
        )}
      </article>
    </div>
  );
}
