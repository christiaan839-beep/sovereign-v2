import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Cpu,
  Code2,
  GitBranch,
} from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";

/**
 * /anthropic — Partnership thesis page.
 *
 * Lives at sovereignmatrix.agency/anthropic. Linked from candidate
 * applications, the open-source @sovereign/ai-router README, and the
 * /vs/claude-agents comparison. Anthropic recruiters land here when
 * reviewing the founder's application; the page reinforces the
 * narrative that Sovereign Matrix is an Anthropic-aligned platform
 * (Constitutional-AI safety thesis, Sonnet for code agents, Opus for
 * verifier roles, Haiku for fast classification).
 *
 * Server-rendered, SSG'd at build, JSON-LD article schema for indexing.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Sovereign Matrix x Anthropic — Building on Claude | Sovereign Matrix",
  description:
    "Why Sovereign Matrix routes Claude as the premium-quality lane in our 8-provider AI router. Constitutional-AI-inspired safety pipeline, Computer Use early-access, and the partnership thesis.",
  alternates: { canonical: "https://sovereignmatrix.agency/anthropic" },
  openGraph: {
    title: "Sovereign Matrix x Anthropic",
    description:
      "Building on Claude — Constitutional-AI-aligned multi-tenant agent platform. Routing Sonnet for code, Opus for verification, Haiku for classification.",
    url: "https://sovereignmatrix.agency/anthropic",
    type: "article",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Sovereign Matrix x Anthropic — Building on Claude",
  description:
    "Partnership thesis: why Sovereign Matrix routes Claude as the premium-quality lane in our 8-provider AI router.",
  author: {
    "@type": "Organization",
    name: "Sovereign Matrix",
    url: "https://sovereignmatrix.agency",
  },
  about: {
    "@type": "SoftwareApplication",
    name: "Anthropic Claude",
  },
};

export default function AnthropicPage() {
  return (
    <main className="min-h-screen bg-[#010101] text-white">
      <JsonLd data={articleSchema} />

      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors"
        >
          Try Free
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 max-w-4xl mx-auto">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-6">
          Partnership Thesis
        </p>
        <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl tracking-[-0.02em] leading-[1.05] mb-8">
          Built on{" "}
          <em className="not-italic" style={{ color: "#B5532C" }}>
            Claude
          </em>
          .
          <br />
          Aligned with{" "}
          <em className="not-italic" style={{ color: "#B5532C" }}>
            Anthropic
          </em>
          .
        </h1>
        <p className="text-[17px] md:text-[19px] text-neutral-400 leading-[1.6] max-w-2xl">
          Sovereign Matrix is a multi-tenant AI workforce platform with 140
          specialised agents. Claude is the premium-quality lane in our unified
          8-provider router — and the model whose safety research shaped how we
          built the platform itself.
        </p>
        <div className="mt-10 flex items-center gap-4 flex-wrap">
          <Link
            href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/ai-router"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors"
          >
            View the open-source router
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/case-studies"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 text-sm font-semibold hover:border-white/30 transition-colors"
          >
            Read customer wins
          </Link>
        </div>
      </section>

      {/* The router thesis */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-neutral-500 mb-3">
            01 — Where Claude lives in our stack
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight">
            Three Claude tiers. One unified router.
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed mb-10 max-w-2xl">
            We route Claude when quality demonstrably matters. The router
            absorbs ~80% of inference on free providers (Cerebras, NIM, Ollama);
            Claude stays reserved for the workloads where verification, code
            correctness, and reasoning depth justify the cost.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                model: "Claude Opus 4.7",
                role: "War Room verifier",
                detail:
                  "Three independent agents debate a high-stakes business decision. Opus moderates the debate, scores each position, and synthesises the strongest answer. The accuracy of the verifier matters more than its cost.",
                Icon: Shield,
              },
              {
                model: "Claude Sonnet 4.6",
                role: "Code agents",
                detail:
                  "code-agent, code-reviewer, code-sandbox all route to Sonnet. The trade-off — Sonnet beats every cheaper model on code reasoning at a price point that's acceptable for SMB SaaS pricing.",
                Icon: Code2,
              },
              {
                model: "Claude Haiku 4.5",
                role: "Routing + classification",
                detail:
                  "Fast classification decisions inside the platform itself: which agent should handle this prompt? what category does this lead fit? Haiku at $1/M input is the cheapest reliable classifier we've benchmarked.",
                Icon: Cpu,
              },
            ].map(({ model, role, detail, Icon }) => (
              <div
                key={model}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
              >
                <Icon className="w-5 h-5 text-[#B5532C] mb-4" />
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                  {role}
                </p>
                <h3 className="text-lg font-semibold mb-3">{model}</h3>
                <p className="text-[13px] text-neutral-400 leading-relaxed">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Constitutional AI alignment */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-neutral-500 mb-3">
            02 — The safety pipeline
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight">
            Five layers, inspired by Constitutional AI.
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed mb-10 max-w-2xl">
            Every agent output runs through a 5-layer pipeline before reaching
            the caller. The layer order and the critic-review pattern were
            shaped by Anthropic&apos;s safety research direction.
          </p>

          <ol className="space-y-3">
            {[
              {
                step: "Jailbreak detection",
                why: "Block prompt injection BEFORE the handler runs. Pre-flight check on input, not post-flight.",
              },
              {
                step: "Content safety",
                why: "Topic + harm filters on inbound user content. Same rationale as a moderation API.",
              },
              {
                step: "Handler execution",
                why: "Agent runs. Output goes to the next layer, never directly to the user.",
              },
              {
                step: "PII redaction",
                why: "Post-flight scan for emails, phone numbers, credit cards, SSNs in agent output. 5 patterns; small overhead.",
              },
              {
                step: "Quality scoring + critic review",
                why: "Output below threshold gets regenerated once. Critic agent reviews if useCritic=true. This is the layer Constitutional AI taught us how to think about — model-self-correction without infinite loops.",
              },
            ].map(({ step, why }, i) => (
              <li
                key={step}
                className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.05] bg-white/[0.015]"
              >
                <span className="font-mono text-[11px] text-[#B5532C] tabular-nums shrink-0 mt-0.5">
                  0{i + 1}
                </span>
                <div>
                  <p className="font-semibold text-white mb-1">{step}</p>
                  <p className="text-[13px] text-neutral-400 leading-relaxed">
                    {why}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="text-[12px] text-neutral-500 mt-6 italic">
            Implementation lives in src/lib/agent-factory.ts. All five layers
            run in parallel via Promise.all so total user-perceived latency
            stays under 200ms.
          </p>
        </div>
      </section>

      {/* Open source / Computer Use */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-neutral-500 mb-3">
            03 — The open-source layer
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight">
            Router extracted as MIT-licensed package.
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed mb-8 max-w-2xl">
            <span className="font-mono text-emerald-400">
              @sovereign/ai-router
            </span>{" "}
            is the multi-provider router that powers Sovereign Matrix. Zero
            deps, MIT license, drops into any TypeScript project. Routes across
            Anthropic, OpenAI, Cerebras, NVIDIA NIM, Groq, DeepSeek, and local
            Ollama with one call.
          </p>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 mb-8">
            <pre className="text-[12px] font-mono text-emerald-300 overflow-x-auto">
              {`import { createRouter } from "@sovereign/ai-router";

const router = createRouter({
  providers: [
    { name: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY },
    { name: "cerebras",  apiKey: process.env.CEREBRAS_API_KEY  },
    { name: "nvidia-nim", apiKey: process.env.NVIDIA_NIM_API_KEY },
  ],
  budget: { dailyCapCents: 500, onCapReached: "fallback-to-free" },
});

await router.complete({
  prompt: "...",
  priority: "best",        // routes Claude first
  userId: "user_abc",      // for budget tracking
});`}
            </pre>
          </div>

          <Link
            href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/ai-router"
            className="inline-flex items-center gap-2 text-[#B5532C] hover:text-[#d96b3f] transition-colors"
          >
            <GitBranch className="w-4 h-4" />
            github.com/christiaan839-beep/sovereign-v2/tree/main/packages/ai-router
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* What we'd love from Anthropic */}
      <section className="py-16 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-neutral-500 mb-3">
            04 — What we&apos;d love from Anthropic
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight">
            Three concrete asks.
          </h2>

          <div className="space-y-5">
            {[
              {
                ask: "Anthropic Startup Program",
                detail:
                  "We've applied at anthropic.com/startups. The credits would directly fund the Claude Sonnet code-agent + Opus verifier roles where we route paid traffic.",
              },
              {
                ask: "Computer Use API early access",
                detail:
                  "We have a computer-use agent in the registry — currently a stub. Pilot access would let us ship a first-class autonomous-browser agent for Sovereign customers.",
              },
              {
                ask: "Co-marketing case study",
                detail:
                  "Once the first SA mid-market customer ships measurable outcomes on Sovereign + Claude, that's a case study Anthropic could co-publish (emerging-markets distribution, agency replacement, vertical specialisation).",
              },
            ].map(({ ask, detail }) => (
              <div
                key={ask}
                className="flex items-start gap-3 p-5 rounded-xl border border-white/[0.06] bg-white/[0.015]"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-white mb-1">{ask}</p>
                  <p className="text-[14px] text-neutral-400 leading-relaxed">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            For Anthropic recruiters reading this:
          </h2>
          <p className="text-base text-neutral-400 leading-relaxed mb-8 max-w-xl mx-auto">
            Sovereign Matrix is built solo by Christiaan de Wet in collaboration
            with Claude as pair-programmer, per Anthropic&apos;s candidate AI
            guidance. Repo is public. README documents specific architectural
            decisions. Glad to defend any of them live, unassisted.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="mailto:christiaan@sovereignmatrix.agency"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 transition-colors"
            >
              Email Christiaan
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="https://github.com/christiaan839-beep/sovereign-v2"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-sm font-semibold hover:border-white/30 transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              View source
            </Link>
          </div>
        </div>
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-white uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
