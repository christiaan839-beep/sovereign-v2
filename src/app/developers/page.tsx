"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Code2, Zap, DollarSign, ArrowRight, Copy, CheckCircle2, Terminal, Users, TrendingUp } from "lucide-react";
import Link from "next/link";
import { TOTAL_AGENTS, TOTAL_MODELS } from "@/lib/platform-stats";

/**
 * DEVELOPER SDK PAGE — The Agent App Store for developers.
 *
 * This is how we become Shopify: let developers build agents,
 * list them on our marketplace, and earn revenue share.
 *
 * Developer 80% / Platform 20% split.
 */

const SDK_EXAMPLE = `import { createAgentRoute } from "@sovereign/sdk";

export const POST = createAgentRoute({
  name: "my-custom-agent",
  requiredFields: ["url"],
  handler: async ({ input }) => {
    // Your agent logic here
    const result = await analyzeWebsite(input.url);
    return { success: true, data: result };
  },
});`;

const SUBMIT_EXAMPLE = `curl -X POST https://sovereignmatrix.agency/api/marketplace \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "SEO Content Optimizer",
    "description": "Analyzes pages and rewrites for top rankings",
    "category": "seo",
    "systemPrompt": "You are an SEO expert...",
    "price": 9.99
  }'`;

function CodeBlock({ code, language = "typescript" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#060606]">
        <span className="text-[10px] text-neutral-500 font-mono">{language}</span>
        <button onClick={copy} className="text-[10px] text-neutral-500 hover:text-white flex items-center gap-1 transition-colors">
          {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-neutral-300 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-[#030303]">
      <title>Build Agents. Earn Revenue. | Sovereign Matrix Developer SDK</title>

      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white">Sovereign Matrix</Link>
          <Link href="/signup" className="text-xs px-4 py-2 rounded-full bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-colors">
            Start Building →
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[11px] font-medium uppercase tracking-wider mb-6">
            <Terminal className="w-3 h-3" /> Agent SDK
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6">
            Build agents.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
              Earn 80% revenue.
            </span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-lg mx-auto mb-8">
            Create AI agents in under 50 lines of code. List them on our marketplace.
            Get paid every time someone uses your agent.
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-neutral-500">
            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400" /> 10,000+ potential users</span>
            <span className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" /> 80/20 revenue split</span>
            <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-400" /> Ship in 1 hour</span>
          </div>
        </motion.div>

        {/* How it works */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {[
            {
              icon: Code2,
              step: "01",
              title: "Write your agent",
              desc: "Use our createAgentRoute factory. It handles auth, rate limiting, safety pipeline, and quality scoring. You just write the business logic.",
            },
            {
              icon: Zap,
              step: "02",
              title: "Submit to marketplace",
              desc: "One API call to list your agent. Set your price, write a description, pick a category. We handle billing, distribution, and support.",
            },
            {
              icon: DollarSign,
              step: "03",
              title: "Earn revenue",
              desc: "Every time a user installs or runs your agent, you earn 80% of the revenue. Payouts monthly via Stripe Connect. No minimum threshold.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <div className="text-3xl font-black text-emerald-500/20 font-mono mb-3">{item.step}</div>
              <item.icon className="w-5 h-5 text-emerald-400 mb-3" />
              <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* SDK Code Example */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-2">Build an agent in 15 lines</h2>
          <p className="text-sm text-neutral-500 mb-6">
            The agent factory handles everything — auth, rate limiting, jailbreak detection, PII scanning, quality scoring.
            You just write the handler.
          </p>
          <CodeBlock code={SDK_EXAMPLE} language="typescript — my-agent/route.ts" />
        </div>

        {/* Submit Example */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-2">Submit to marketplace</h2>
          <p className="text-sm text-neutral-500 mb-6">
            One API call. Your agent is live on the marketplace within minutes.
          </p>
          <CodeBlock code={SUBMIT_EXAMPLE} language="bash — submit agent" />
        </div>

        {/* What you get */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">What the platform handles for you</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Authentication & auth", desc: "Clerk-based user auth. Your agent never touches credentials." },
              { title: "5-layer safety pipeline", desc: "Jailbreak detection, content safety, PII scan, quality scoring, critic review." },
              { title: "Multi-model routing", desc: `${TOTAL_MODELS} models. Smart router picks the best one for each request.` },
              { title: "Rate limiting & plan enforcement", desc: "Free tier limits, paid tier quotas — all handled automatically." },
              { title: "Billing & revenue share", desc: "Stripe integration. 80% goes to you. Monthly payouts." },
              { title: "Analytics dashboard", desc: "See installs, usage, revenue, ratings — all in real time." },
              { title: `Distribution to ${TOTAL_AGENTS} agents`, desc: `Your agent joins a catalog of ${TOTAL_AGENTS} specialized agents.` },
              { title: "White-label ready", desc: "Agencies can rebrand and resell your agent under their brand." },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-sm font-medium text-white">{item.title}</span>
                  <p className="text-xs text-neutral-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue calculator */}
        <div className="mb-20 p-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center">
          <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Revenue potential</h2>
          <p className="text-sm text-neutral-400 mb-6">If your agent gets 100 installs at $9.99/month:</p>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
            <div>
              <div className="text-2xl font-black text-white">$999</div>
              <div className="text-[10px] text-neutral-500">Monthly GMV</div>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400">$799</div>
              <div className="text-[10px] text-neutral-500">Your 80%</div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">$9,590</div>
              <div className="text-[10px] text-neutral-500">Annual revenue</div>
            </div>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-sm transition-colors"
          >
            Start Building <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* FAQ */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Developer FAQ</h2>
          <div className="space-y-4">
            {[
              { q: "How do I get started?", a: "Sign up for a free account, then use the createAgentRoute factory to build your agent. Submit it via the marketplace API. It goes live within minutes." },
              { q: "What's the revenue split?", a: "You keep 80%. We keep 20%. Payouts are monthly via Stripe Connect. No minimum threshold — if you earned $1, you get $0.80." },
              { q: "Can I use my own AI models?", a: "Yes. Your handler can call any API — OpenAI, Anthropic, your own fine-tuned model. The platform routes through our smart router by default, but you can override." },
              { q: "What about safety and moderation?", a: "Every agent runs through our 5-layer safety pipeline automatically. Jailbreak detection, content safety, PII scanning, quality scoring. You don't have to implement any of it." },
              { q: "Can agencies white-label my agent?", a: "Yes. Enterprise agencies can rebrand the entire platform including your agent. You still earn revenue share on every execution." },
            ].map((faq) => (
              <div key={faq.q} className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-semibold text-white mb-1">{faq.q}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            The agent marketplace is open.
          </h2>
          <p className="text-neutral-400 mb-8">
            223 agents. 10,000+ potential users. Your agent could be next.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-bold rounded-full text-sm hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all"
          >
            Create Developer Account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
