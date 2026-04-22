"use client";

import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, BadgeCheck, Shield, Cpu, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

/**
 * AGENT DETAIL PAGE — /marketplace/:agentId
 *
 * Shows full info about a specific built-in agent:
 * capabilities, example workflow, models used, safety info.
 */

interface AgentDetail {
  name: string;
  category: string;
  categoryColor: { bg: string; text: string; border: string };
  description: string;
  capabilities: string[];
  workflow: {
    youSay: string;
    agentDoes: string;
    youGet: string;
  };
  models: string[];
  tags: string[];
}

const KNOWN_AGENTS: Record<string, AgentDetail> = {
  "lead-blitz": {
    name: "Lead Blitz",
    category: "sales",
    categoryColor: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
    description:
      "Lead Blitz scrapes and enriches prospects in any niche you specify. It pulls company names, decision-maker contacts, LinkedIn profiles, and recent funding data, then cross-references against email verification services to filter out dead addresses. The output is a qualified lead list with personalized outreach angles derived from each company&apos;s actual pain points and public signals.",
    capabilities: [
      "Scrapes prospects by industry, location, and company size with real-time web search",
      "Enriches each lead with LinkedIn data, job title, and company funding stage",
      "Verifies email addresses against bounce-check services before inclusion",
      "Generates personalized outreach angles based on each company&apos;s public signals",
      "Outputs structured CSV-ready data with contact details and engagement hooks",
      "Guarantee: 5+ qualified companies with contact angles or the run doesn&apos;t count",
    ],
    workflow: {
      youSay: "Find SaaS founders in Austin who raised Series A in the last 6 months",
      agentDoes: "Searches web sources, enriches with LinkedIn data, verifies emails, scores fit against your ICP",
      youGet: "A table of 50+ qualified leads with names, emails, company context, and a draft cold email for each",
    },
    models: ["Nemotron Ultra 253B (lead research + synthesis)", "DeepSeek V3.2 (outreach copy generation)"],
    tags: ["Lead scraping", "Email enrichment", "LinkedIn data"],
  },
  "content-machine": {
    name: "Content Machine",
    category: "content",
    categoryColor: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
    description:
      "Content Machine writes a full SEO-optimized blog post from a single topic, then repurposes it into platform-specific social content for LinkedIn, Twitter, and Instagram. Every piece passes through an anti-slop pipeline that strips cliche phrases, filler sentences, and generic AI patterns. The output reads like it was written by a subject-matter expert, not a language model.",
    capabilities: [
      "Writes 1,500+ word blog posts with proper heading hierarchy and internal linking suggestions",
      "Anti-slop pipeline removes 47 known AI cliche patterns (e.g., \"revolutionize\", \"in today&apos;s fast-paced world\")",
      "Generates LinkedIn post, Twitter thread (5 tweets), and Instagram caption from the blog",
      "Injects target keywords naturally without stuffing — passes Surfer SEO readability checks",
      "Tone selector: Professional, Casual, Technical, or Bold writing styles",
      "Guarantee: 1,500+ word blog + 3 social posts or re-run free",
    ],
    workflow: {
      youSay: "Write a blog post about how AI is changing B2B lead generation, tone: Professional, keywords: AI lead gen",
      agentDoes: "Drafts a structured blog with H2/H3 headings, then spins it into a LinkedIn post, Twitter thread, and Instagram caption",
      youGet: "A publish-ready blog post + 3 platform-specific social posts, all matching your tone and keyword targets",
    },
    models: ["Nemotron Ultra 253B (long-form blog generation)", "Gemma 4 31B (social content repurposing)"],
    tags: ["Blog writing", "Social media", "Email sequences"],
  },
  "competitor-takedown": {
    name: "Competitor Takedown",
    category: "research",
    categoryColor: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
    description:
      "Competitor Takedown runs a three-agent chain: first it deep-scrapes a competitor&apos;s website for messaging, pricing, and positioning. Then it audits their SEO strategy — rankings, keyword gaps, and backlink profile. Finally, it synthesizes everything into a battle card with five concrete counter-positioning strategies you can use in sales calls and marketing copy.",
    capabilities: [
      "Deep-scrapes competitor website: pricing pages, feature lists, testimonials, and messaging patterns",
      "Runs a full SEO audit on the competitor — keyword rankings, domain authority, content gaps",
      "Identifies specific weaknesses in their positioning that your product can exploit",
      "Generates 5+ counter-positioning strategies with talk tracks for sales teams",
      "Compares their pricing model against yours with value-per-dollar analysis",
      "Guarantee: 5+ counter-strategies with specific action items or re-run free",
    ],
    workflow: {
      youSay: "Analyze competitor.com — I run youragency.com and want to beat them in the mid-market segment",
      agentDoes: "Scrapes their site, audits their SEO, then synthesizes a competitive strategy using three independent agents",
      youGet: "A battle card with SWOT analysis, 5 counter-positioning strategies, and keyword gaps you can target immediately",
    },
    models: ["Nemotron Ultra 253B (competitive analysis)", "DeepSeek V3.2 (SEO audit)", "Gemma 4 31B (strategy synthesis)"],
    tags: ["Competitive intel", "Market analysis", "SWOT"],
  },
  "seo-dominator": {
    name: "SEO Dominator",
    category: "seo",
    categoryColor: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
    description:
      "SEO Dominator runs a comprehensive technical and content SEO audit on any URL. It checks crawlability, Core Web Vitals signals, meta tag quality, heading structure, schema markup coverage, and internal linking depth. It then identifies keyword opportunities your competitors rank for that you don&apos;t, and generates a 30-day content calendar to close those gaps.",
    capabilities: [
      "Technical audit: crawlability, sitemap health, robots.txt, canonical tags, and redirect chains",
      "On-page analysis: meta titles, descriptions, heading hierarchy, and content-to-code ratio",
      "Keyword gap analysis: finds terms your competitors rank for that you don&apos;t",
      "Schema markup recommendations with JSON-LD snippets ready to paste",
      "Generates a 30-day content calendar targeting your highest-opportunity keywords",
      "Internal linking suggestions to distribute page authority across your site",
    ],
    workflow: {
      youSay: "Audit youragency.com for SEO — my target keywords are AI agency, lead generation tool",
      agentDoes: "Crawls your site structure, analyzes on-page factors, compares keyword coverage against top 10 SERP competitors",
      youGet: "A full audit report with technical fixes, keyword opportunities, schema markup code, and a 30-day content plan",
    },
    models: ["DeepSeek V3.2 (technical SEO analysis)", "Nemotron Ultra 253B (content strategy generation)"],
    tags: ["Keyword research", "Technical SEO", "Schema markup"],
  },
  "voice-caller": {
    name: "Voice Caller",
    category: "voice",
    categoryColor: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
    description:
      "Voice Caller handles AI-powered cold calls to prospects. It uses sub-200ms voice latency to sound natural in conversation, qualifies leads on budget, timeline, and authority, and books meetings directly on your calendar. Every call follows a customizable script with dynamic objection handling — it adapts in real-time based on what the prospect says, not just a rigid decision tree.",
    capabilities: [
      "Sub-200ms voice latency — sounds like a real conversation, not a robocall",
      "BANT qualification: asks about Budget, Authority, Need, and Timeline naturally",
      "Dynamic objection handling that adapts responses based on prospect pushback",
      "Books meetings directly on your Google Calendar or Calendly link",
      "Records call transcripts and extracts key insights for CRM notes",
      "Customizable call scripts with tone and pacing controls",
    ],
    workflow: {
      youSay: "Call the 20 leads from my Lead Blitz run — qualify for budget over $5K and book a demo",
      agentDoes: "Calls each lead, navigates gatekeepers, qualifies on budget and timeline, handles objections in real-time",
      youGet: "Call transcripts with qualification scores, booked meetings on your calendar, and a summary of common objections heard",
    },
    models: ["Gemma 4 31B (real-time conversation)", "Nemotron Ultra 253B (objection handling strategy)"],
    tags: ["Cold calling", "Lead qualification", "Calendar booking"],
  },
  "code-agent": {
    name: "Code Agent",
    category: "code",
    categoryColor: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    description:
      "Code Agent writes production-grade code, reviews existing code for bugs and security issues, and prepares pull-request-ready diffs. It supports TypeScript, Python, Go, and Rust, with full awareness of popular frameworks like Next.js, FastAPI, and Gin. Every output goes through the quality scorer — if the code doesn&apos;t pass linting and type-check standards, it gets regenerated before you see it.",
    capabilities: [
      "Writes production-ready code in TypeScript, Python, Go, and Rust with framework awareness",
      "Reviews code for security vulnerabilities, performance issues, and logic bugs",
      "Generates PR-ready diffs with commit messages and inline documentation",
      "Understands project context — reads your existing codebase patterns before writing",
      "Auto-retries if output fails quality scoring (linting, type-check, best practices)",
      "Supports Next.js App Router, FastAPI, Gin, Actix, and other major frameworks",
    ],
    workflow: {
      youSay: "Write a Next.js API route that accepts a webhook from Stripe, verifies the signature, and updates the user plan in our Drizzle ORM schema",
      agentDoes: "Reads your schema, writes the route handler with proper error handling, signature verification, and type-safe DB updates",
      youGet: "A complete API route file with imports, types, error handling, and a test file — ready to paste into your project",
    },
    models: ["DeepSeek V3.2 (code generation + reasoning)", "Nemotron Ultra 253B (code review + security analysis)"],
    tags: ["Code generation", "Bug review", "Multi-language"],
  },
  "brand-voice-analyzer": {
    name: "Brand Voice Analyzer",
    category: "content",
    categoryColor: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
    description:
      "Brand Voice Analyzer ingests your existing content — website copy, blog posts, emails, social posts — and extracts a detailed brand voice profile. It identifies your tone patterns, vocabulary preferences, sentence structure tendencies, and emotional register. The output is a reusable style guide that other agents (Content Machine, Ad Optimizer) can reference to match your voice exactly.",
    capabilities: [
      "Analyzes tone across 12 dimensions: formality, humor, urgency, authority, warmth, etc.",
      "Extracts vocabulary fingerprint — words you overuse, words you avoid, brand-specific terms",
      "Maps sentence structure patterns: average length, question frequency, CTA placement",
      "Generates a consistency score comparing your content across channels",
      "Outputs a machine-readable style guide that other agents consume automatically",
      "Identifies voice drift — where your recent content deviates from your core brand",
    ],
    workflow: {
      youSay: "Analyze the brand voice at targetbrand.com — they are in the B2B SaaS space",
      agentDoes: "Scrapes website copy, analyzes tone/vocabulary/sentence patterns, and compares against industry benchmarks",
      youGet: "A brand voice profile with tone scores, vocabulary list, style guide rules, and a consistency rating",
    },
    models: ["Nemotron Ultra 253B (deep linguistic analysis)", "Gemma 4 31B (pattern extraction + scoring)"],
    tags: ["Brand analysis", "Tone detection", "Style guide"],
  },
  "ad-optimizer": {
    name: "Ad Optimizer",
    category: "sales",
    categoryColor: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
    description:
      "Ad Optimizer analyzes your existing ad campaigns, identifies underperforming creatives, and generates new copy variants designed to improve click-through and conversion rates. It works across Google Ads, Meta, and LinkedIn — pulling in competitor ad examples for inspiration. Every generated variant is checked against your brand voice profile to ensure messaging consistency.",
    capabilities: [
      "Analyzes ad performance data to identify underperforming creatives and wasted spend",
      "Generates 5+ headline variants and 3+ description variants per ad group",
      "A/B test recommendations with statistical significance thresholds",
      "Competitor ad research — finds what messaging competitors are running",
      "Brand voice alignment: every variant matches your existing tone and vocabulary",
      "Platform-specific formatting: character limits, extension types, and CTA best practices",
    ],
    workflow: {
      youSay: "Optimize our Google Ads campaign targeting marketing directors at mid-market SaaS — budget is $5K/month",
      agentDoes: "Analyzes current performance, researches competitor ads, generates copy variants, and validates against your brand voice",
      youGet: "New ad copy variants with headlines, descriptions, CTAs, and sitelink extensions — plus A/B test recommendations",
    },
    models: ["Nemotron Ultra 253B (ad analysis + strategy)", "DeepSeek V3.2 (copy generation)", "Gemma 4 31B (brand voice check)"],
    tags: ["Ad analysis", "Copy generation", "ROAS tracking"],
  },
  "war-room": {
    name: "War Room",
    category: "research",
    categoryColor: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
    description:
      "War Room uses the adversarial synthesis engine: three independent AI models debate your business question from different angles. Model A generates a comprehensive answer, Model B critiques it for logical flaws and blind spots, then Model C synthesizes both perspectives into a consensus recommendation. This multi-model approach catches single-model hallucinations and produces answers you can actually trust for strategic decisions.",
    capabilities: [
      "Three-model adversarial debate: generate, critique, then synthesize",
      "Each model approaches the question independently — no groupthink contamination",
      "Critique phase specifically targets logical gaps, unsupported claims, and missing considerations",
      "Synthesis phase resolves disagreements and flags remaining uncertainties explicitly",
      "Works for strategic planning, market entry decisions, pricing strategy, and risk assessment",
      "Transparent reasoning: you see the full generate-critique-synthesize chain, not just the final answer",
    ],
    workflow: {
      youSay: "Should we enter the European market in Q3 or wait until Q1 next year? We have $2M runway.",
      agentDoes: "Model A builds the case for Q3, Model B critiques and finds risks, Model C synthesizes a balanced recommendation",
      youGet: "A consensus recommendation with the full reasoning chain — arguments for, arguments against, and the synthesized verdict",
    },
    models: ["Nemotron Ultra 253B (lead generation)", "DeepSeek V3.2 (critique + reasoning)", "Gemma 4 31B (synthesis)"],
    tags: ["Multi-model", "Consensus AI", "Strategic debate"],
  },
};

export function AgentDetailClient() {
  const params = useParams();
  const agentId = params.agentId as string;
  const agent = KNOWN_AGENTS[agentId];

  if (!agent) {
    return (
      <div className="min-h-screen bg-[#010101] flex items-center justify-center">
        <title>Agent Not Found | Sovereign Matrix</title>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto px-6"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-6">
            <Zap className="w-7 h-7 text-neutral-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Agent not found</h1>
          <p className="text-sm text-neutral-400 mb-8">
            No agent matches this slug. Browse the full catalog to find what you&apos;re looking for.
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010101]">
      <title>{agent.name} | Agent Marketplace | Sovereign Matrix</title>

      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white">Sovereign Matrix</Link>
          <Link href="/dashboard" className="text-xs px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-neutral-200 transition-colors">
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Back link */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Marketplace
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{agent.name}</h1>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400">Built-in</span>
            </span>
            <span className={`text-[10px] px-2.5 py-1 rounded-full ${agent.categoryColor.bg} ${agent.categoryColor.text} border ${agent.categoryColor.border} uppercase font-semibold tracking-wide`}>
              {agent.category}
            </span>
          </div>
          <p className="text-neutral-400 text-sm leading-relaxed max-w-2xl">{agent.description}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Capabilities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
          >
            <h2 className="text-sm font-semibold text-white mb-4">Capabilities</h2>
            <ul className="space-y-3">
              {agent.capabilities.map((cap, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-neutral-400 leading-relaxed">{cap}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Example Workflow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
          >
            <h2 className="text-sm font-semibold text-white mb-4">Example Workflow</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">You say</span>
                  <ArrowRight className="w-3 h-3 text-neutral-600" />
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed bg-white/[0.03] rounded-xl px-4 py-3 border border-white/[0.06]">
                  &ldquo;{agent.workflow.youSay}&rdquo;
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Agent does</span>
                  <ArrowRight className="w-3 h-3 text-neutral-600" />
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed bg-white/[0.03] rounded-xl px-4 py-3 border border-white/[0.06]">
                  {agent.workflow.agentDoes}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">You get</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed bg-white/[0.03] rounded-xl px-4 py-3 border border-white/[0.06]">
                  {agent.workflow.youGet}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Models Used */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
          >
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neutral-500" />
              Models Powering This Agent
            </h2>
            <div className="space-y-2.5">
              {agent.models.map((model, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-xs text-neutral-300">{model}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-neutral-600 mt-3">
              All models run on NVIDIA NIM infrastructure. Model selection is automatic based on task requirements.
            </p>
          </motion.div>

          {/* Safety */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-6 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02]"
          >
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Safety &amp; Verification
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed mb-4">
              Every execution of {agent.name} passes through a 5-layer safety pipeline before results reach you. No exceptions.
            </p>
            <div className="space-y-2">
              {[
                { label: "Jailbreak Detection", desc: "Blocks prompt injection before execution" },
                { label: "PII Scan", desc: "Redacts personal data from AI output" },
                { label: "Content Safety", desc: "Pre-flight check on input content" },
                { label: "Quality Scoring", desc: "Grades output quality, rejects low scores" },
                { label: "Critic Review", desc: "Second model verifies factual claims" },
              ].map((layer, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] text-emerald-400 font-medium w-28 shrink-0">{layer.label}</span>
                  <span className="text-[10px] text-neutral-500">{layer.desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Tags */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-2 mt-6"
        >
          {agent.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-3 py-1 rounded-full bg-white/[0.04] text-neutral-500 border border-white/[0.06]"
            >
              {tag}
            </span>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4"
        >
          <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-sm transition-colors">
            Add to Stack <ArrowRight className="w-4 h-4" />
          </button>
          <Link
            href="/marketplace"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 rounded-full text-sm transition-colors"
          >
            Browse More Agents
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
