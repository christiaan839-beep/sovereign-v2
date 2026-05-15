import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  Brain,
  Code2,
  Database,
  Eye,
  Mic,
  Network,
  Search,
  ShieldCheck,
  TestTube,
  Wrench,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import {
  listModels,
  modelsByProvider,
  registrySummary,
  type CapabilityTier,
} from "@/lib/model-registry";
import {
  ecosystemSummary,
  frameworksByCategory,
  type AgentFrameworkCategory,
} from "@/lib/open-agent-ecosystem";

/**
 * /oss — Public catalog of every open-source AI model + agent framework
 * Sovereign integrates with or routes to (Cooks 183 + 184).
 *
 * Two registries rendered side-by-side:
 *   1. Models — `src/lib/model-registry.ts` (LLMs in the cascade router)
 *   2. Frameworks — `src/lib/open-agent-ecosystem.ts` (agent runtimes,
 *      memory, code agents, browser agents, RAG, inference, etc.)
 *
 * This page is THE distribution surface for "Sovereign as the
 * verification layer for the open AI ecosystem." It also lets a
 * procurement buyer verify in 30 seconds that the platform isn't
 * locked into a single vendor.
 */

export const metadata: Metadata = {
  title: "Open-Source AI Models + Agent Frameworks · Sovereign Matrix",
  description:
    "Every open-source LLM, agent framework, RAG library, and inference engine Sovereign Matrix integrates with. From DeepSeek-R1 to LangGraph to Browser-Use — verifiable on the open codebase.",
  alternates: { canonical: "/oss" },
};

const TIER_LABEL: Record<CapabilityTier, string> = {
  frontier: "Frontier",
  high: "High",
  reasoning: "Reasoning",
  fast: "Fast",
  code: "Code",
  small: "Small / edge",
  voice: "Voice",
  embedding: "Embedding",
  vision: "Vision",
};

const TIER_ICON: Record<CapabilityTier, typeof Cpu> = {
  frontier: Cpu,
  high: Cpu,
  reasoning: Brain,
  fast: Zap,
  code: Code2,
  small: Cpu,
  voice: Mic,
  embedding: Database,
  vision: Eye,
};

const CATEGORY_LABEL: Record<AgentFrameworkCategory, string> = {
  orchestration: "Agent orchestration",
  memory: "Memory + state",
  "coding-agent": "Coding agents",
  "browser-agent": "Browser agents",
  "research-agent": "Research agents",
  ui: "UI shells",
  rag: "RAG + knowledge",
  guardrails: "Guardrails",
  evaluation: "Evaluation",
  inference: "Inference + serving",
  "fine-tuning": "Fine-tuning",
  observability: "Observability",
};

const CATEGORY_ICON: Record<AgentFrameworkCategory, typeof Network> = {
  orchestration: Network,
  memory: Database,
  "coding-agent": Code2,
  "browser-agent": Network,
  "research-agent": Search,
  ui: Wrench,
  rag: Database,
  guardrails: ShieldCheck,
  evaluation: TestTube,
  inference: Zap,
  "fine-tuning": Brain,
  observability: Eye,
};

export default function OssPage() {
  const modelStats = registrySummary();
  const ecoStats = ecosystemSummary();
  const tiers: CapabilityTier[] = [
    "reasoning",
    "frontier",
    "high",
    "code",
    "fast",
    "vision",
    "voice",
    "embedding",
    "small",
  ];
  const categories: AgentFrameworkCategory[] = [
    "orchestration",
    "memory",
    "coding-agent",
    "browser-agent",
    "research-agent",
    "rag",
    "inference",
    "fine-tuning",
    "guardrails",
    "evaluation",
    "ui",
    "observability",
  ];

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/readiness"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Readiness
            </Link>
            <Link
              href="/investors"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Investors
            </Link>
            <Link
              href="/demo/verify-receipt"
              className="text-xs px-4 py-2 rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
            >
              Verify demo
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          Open-Source Ecosystem
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          We route to{" "}
          <span className="text-cyan-400">{modelStats.modelCount} models</span>{" "}
          and integrate with{" "}
          <span className="text-cyan-400">
            {ecoStats.total} open-source agent frameworks.
          </span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          No vendor lock-in. {modelStats.openWeightsCount} models with fully
          open weights. {ecoStats.shippedAdapters} agent-framework adapters
          shipped, {ecoStats.plannedAdapters} more on the roadmap. Every
          decision routed through the same 5-layer verifier and signed receipt —
          regardless of which model produced it.
        </p>

        <div className="mt-8 grid sm:grid-cols-4 gap-3">
          <Stat label="Models" value={`${modelStats.modelCount}`} />
          <Stat label="Providers" value={`${modelStats.providerCount}`} />
          <Stat label="Open weights" value={`${modelStats.openWeightsCount}`} />
          <Stat label="Agent frameworks" value={`${ecoStats.total}`} />
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Models we route to ({modelStats.modelCount})
        </h2>
        {tiers.map((tier) => {
          const all = listModels().filter((m) => m.capabilityTier === tier);
          if (all.length === 0) return null;
          const Icon = TIER_ICON[tier];
          return (
            <div key={tier} className="mb-8">
              <div className="flex items-center gap-2.5 mb-3">
                <Icon className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  {TIER_LABEL[tier]}
                </h3>
                <span className="text-[11px] text-neutral-500">
                  · {all.length} {all.length === 1 ? "model" : "models"}
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {all.map((m) => (
                  <a
                    key={m.id}
                    href={m.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <p className="text-sm font-medium text-white truncate">
                        {m.name}
                      </p>
                      <span className="text-[10px] uppercase tracking-wider text-neutral-500 shrink-0">
                        {m.license}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {m.provider} ·{" "}
                      {m.paramsBillion
                        ? `${m.paramsBillion}B params`
                        : "params undisclosed"}{" "}
                      · {(m.contextWindow / 1000).toFixed(0)}k ctx
                      {m.weightsOpen && " · open weights"}
                    </p>
                    <p className="text-[11px] text-cyan-300/80 mt-1.5">
                      {m.costPerMillionInputUsd === 0
                        ? "Free / self-hosted"
                        : `$${m.costPerMillionInputUsd.toFixed(2)} / 1M in · $${m.costPerMillionOutputUsd.toFixed(2)} / 1M out`}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Open-source agent frameworks we integrate with ({ecoStats.total})
        </h2>
        {categories.map((cat) => {
          const fs = frameworksByCategory(cat);
          if (fs.length === 0) return null;
          const Icon = CATEGORY_ICON[cat];
          return (
            <div key={cat} className="mb-8">
              <div className="flex items-center gap-2.5 mb-3">
                <Icon className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  {CATEGORY_LABEL[cat]}
                </h3>
                <span className="text-[11px] text-neutral-500">
                  · {fs.length} {fs.length === 1 ? "framework" : "frameworks"}
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {fs.map((f) => {
                  const badge = badgeForStatus(f.sovereignStatus);
                  return (
                    <a
                      key={f.id}
                      href={f.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/40 transition-colors"
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <p className="text-sm font-medium text-white truncate">
                          {f.name}
                        </p>
                        <span
                          className={`text-[9px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mb-1.5">
                        {f.license} · {f.starsK.toFixed(1)}k★ · {f.language}
                      </p>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        {f.blurb}
                      </p>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Providers
        </h2>
        <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Object.entries(modelsByProvider())
            .sort((a, b) => b[1].length - a[1].length)
            .map(([provider, models]) => (
              <div
                key={provider}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
              >
                <p className="text-sm text-white font-medium">{provider}</p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  {models.length} model{models.length === 1 ? "" : "s"}
                </p>
              </div>
            ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            The verification layer for the entire open ecosystem.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Bring your model. Bring your agent framework. Sovereign signs the
            receipt, verifies the output, anchors the chain, and lets your
            auditor replay any decision — regardless of which model or runtime
            produced it.
          </p>
          <Link
            href="/demo/verify-receipt"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Verify a real receipt
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/spec" className="hover:text-neutral-300">
            Receipts spec
          </Link>
          <Link href="/readiness" className="hover:text-neutral-300">
            Vertical readiness
          </Link>
          <Link href="/investors" className="hover:text-neutral-300">
            Investors
          </Link>
          <Link href="/demo/verify-receipt" className="hover:text-neutral-300">
            Verify demo
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <p className="text-3xl font-black text-white tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mt-1">
        {label}
      </p>
    </div>
  );
}

function badgeForStatus(
  status:
    | "adapter-shipped"
    | "adapter-planned"
    | "embed"
    | "coexist"
    | "compete",
): { label: string; cls: string } {
  switch (status) {
    case "adapter-shipped":
      return {
        label: "Adapter live",
        cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
      };
    case "adapter-planned":
      return {
        label: "On roadmap",
        cls: "bg-amber-500/10 border-amber-500/20 text-amber-300",
      };
    case "embed":
      return {
        label: "Embeddable",
        cls: "bg-cyan-500/10 border-cyan-500/20 text-cyan-300",
      };
    case "coexist":
      return {
        label: "Coexist",
        cls: "bg-white/5 border-white/10 text-neutral-400",
      };
    case "compete":
      return {
        label: "Compete",
        cls: "bg-rose-500/10 border-rose-500/20 text-rose-300",
      };
  }
}
