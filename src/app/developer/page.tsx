"use client";

import { motion } from "framer-motion";
import { Code2, Key, Zap, ArrowRight, Terminal, Shield, ExternalLink } from "lucide-react";

/**
 * /developer — Public API documentation page.
 * Dark design with emerald accents, matching Sovereign Matrix brand.
 */

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/v1/agents/leads",
    description: "Find and qualify leads using AI-powered prospecting",
    example: '{"prompt": "Find 50 leads in fintech"}',
  },
  {
    method: "POST",
    path: "/api/v1/agents/blog-gen",
    description: "Generate SEO-optimized blog posts with AI",
    example: '{"prompt": "Write a 2000-word article on AI automation"}',
  },
  {
    method: "POST",
    path: "/api/v1/agents/seo-dominator",
    description: "Run comprehensive SEO analysis on any domain",
    example: '{"prompt": "Analyze SEO for example.com"}',
  },
  {
    method: "POST",
    path: "/api/v1/agents/page-builder",
    description: "Build conversion-optimized landing pages",
    example: '{"prompt": "Build a SaaS landing page for an AI tool"}',
  },
  {
    method: "POST",
    path: "/api/v1/agents/voice-chat",
    description: "Voice AI conversation for customer interactions",
    example: '{"prompt": "Handle inbound sales call for roofing company"}',
  },
];

const RATE_LIMITS = [
  { plan: "Free", limit: "100 requests / day", color: "text-neutral-400" },
  { plan: "Pro", limit: "10,000 requests / day", color: "text-emerald-400" },
  { plan: "Enterprise", limit: "Unlimited", color: "text-cyan-400" },
];

export default function DeveloperPage() {
  const curlExample = `curl -X POST https://sovereignmatrix.agency/api/v1/agents/leads \\
  -H "Authorization: Bearer sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Find 50 leads in fintech"}'`;

  const responseExample = `{
  "success": true,
  "data": {
    "leads": [...],
    "count": 50,
    "model": "gemini-2.0-flash"
  },
  "responseTimeMs": 2340
}`;

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
            <Terminal className="w-3 h-3" />
            Developer API
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Sovereign Matrix API
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            Build on 130+ autonomous AI agents. Lead generation, content creation, SEO, page building, voice AI, and more -- all through a single REST API.
          </p>
        </motion.div>
      </div>

      <div className="max-w-5xl mx-auto px-6 space-y-16 pb-24">
        {/* Authentication */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Key className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Authentication</h2>
          </div>
          <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-neutral-300 mb-4">
              Pass your API key in the <code className="px-1.5 py-0.5 rounded bg-white/5 text-emerald-400 text-sm font-mono">Authorization</code> header with every request.
            </p>
            <div className="p-4 rounded-lg bg-black/40 border border-white/5 font-mono text-sm">
              <span className="text-neutral-500">Authorization:</span>{" "}
              <span className="text-emerald-400">Bearer sk_your_key</span>
            </div>
          </div>
        </motion.section>

        {/* Endpoints */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Endpoints</h2>
          </div>
          <div className="space-y-3">
            {ENDPOINTS.map((ep, i) => (
              <motion.div
                key={ep.path}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {ep.method}
                      </span>
                      <code className="text-sm font-mono text-white">{ep.path}</code>
                    </div>
                    <p className="text-sm text-neutral-400">{ep.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-emerald-400 transition-colors mt-1 shrink-0" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Example */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Example Request</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Request */}
            <div className="rounded-xl bg-black/60 border border-white/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-neutral-400 font-mono">Request</span>
              </div>
              <pre className="p-4 text-sm font-mono text-neutral-300 overflow-x-auto whitespace-pre">
                {curlExample}
              </pre>
            </div>
            {/* Response */}
            <div className="rounded-xl bg-black/60 border border-white/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                <span className="text-xs text-neutral-400 font-mono">Response</span>
              </div>
              <pre className="p-4 text-sm font-mono text-neutral-300 overflow-x-auto whitespace-pre">
                {responseExample}
              </pre>
            </div>
          </div>
        </motion.section>

        {/* Rate Limits */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Rate Limits</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {RATE_LIMITS.map((tier, i) => (
              <motion.div
                key={tier.plan}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 + i * 0.05 }}
                className="p-5 rounded-xl bg-white/[0.02] border border-white/5 text-center"
              >
                <h3 className={`text-lg font-bold ${tier.color} mb-1`}>{tier.plan}</h3>
                <p className="text-sm text-neutral-400">{tier.limit}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Get API Key CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Get Your API Key</h2>
          </div>
          <div className="p-8 rounded-xl bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10 text-center">
            <p className="text-neutral-300 mb-6">
              Generate your API key from the dashboard to start making requests.
            </p>
            <a
              href="/dashboard/integrations"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-colors"
            >
              Go to API Keys <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
