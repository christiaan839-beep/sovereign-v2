import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, X as XIcon, ArrowRight, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs CrewAI — Which AI Agent Platform Is Better?",
  description: "Compare Sovereign Matrix and CrewAI side-by-side. 132 agents, voice calls, browser automation, and $0 per-token inference vs open-source framework requiring custom development.",
};

const COMPARISON = [
  { feature: "Ready-to-use agents", sovereign: "132 pre-built agents", competitor: "Framework only — you build agents from scratch", winner: "sovereign" },
  { feature: "Voice calling", sovereign: "Built-in AI cold-calling with Twilio", competitor: "Not supported", winner: "sovereign" },
  { feature: "Browser automation", sovereign: "NemoClaw sandboxed browser control", competitor: "Not built-in", winner: "sovereign" },
  { feature: "Per-token cost", sovereign: "$0 via NVIDIA NIM free tier", competitor: "You pay OpenAI/Anthropic directly", winner: "sovereign" },
  { feature: "Dashboard UI", sovereign: "57-page production dashboard", competitor: "No dashboard — code only", winner: "sovereign" },
  { feature: "White-label", sovereign: "Full white-label with client portals", competitor: "Not supported", winner: "sovereign" },
  { feature: "Self-hosted option", sovereign: "Ollama + NemoClaw air-gapped execution", competitor: "Self-hosted by default", winner: "tie" },
  { feature: "Multi-agent orchestration", sovereign: "God Brain, War Room, Swarm, Chain Reactor", competitor: "Crews with sequential/parallel tasks", winner: "tie" },
  { feature: "Open source", sovereign: "Proprietary platform (API available)", competitor: "Fully open-source (MIT)", winner: "competitor" },
  { feature: "Custom agent building", sovereign: "Agent Builder with templates", competitor: "Full Python flexibility", winner: "competitor" },
  { feature: "Safety pipeline", sovereign: "5-layer NeMo Guardrails (jailbreak, PII, content safety)", competitor: "Basic guardrails only", winner: "sovereign" },
  { feature: "Pricing", sovereign: "Free tier, then R9,997/mo (~$550)", competitor: "Free (open-source), cloud plans available", winner: "tie" },
];

export default function VsCrewAI() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="flex items-center justify-between px-8 py-6 max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-[8px] font-bold">S</div>
          <span className="text-xs font-medium tracking-[0.15em] uppercase">SOVEREIGN</span>
        </Link>
        <Link href="/pricing" className="text-xs text-neutral-400 hover:text-white transition-colors">View Pricing</Link>
      </nav>

      <main className="px-8 py-16 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Comparison</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Sovereign Matrix <span className="text-neutral-500">vs</span> CrewAI
          </h1>
          <p className="text-neutral-400 max-w-xl mx-auto">
            CrewAI is an excellent open-source framework for developers. Sovereign Matrix is a complete autonomous workforce — agents, dashboard, voice, browser automation, and white-label included.
          </p>
        </div>

        <div className="space-y-2 mb-16">
          <div className="grid grid-cols-3 gap-4 px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
            <span>Feature</span>
            <span className="text-emerald-400">Sovereign Matrix</span>
            <span>CrewAI</span>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-4 px-4 py-3 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:border-emerald-500/10 transition-colors">
              <span className="text-sm text-white font-medium">{row.feature}</span>
              <span className="text-sm text-neutral-300 flex items-center gap-2">
                {row.winner === "sovereign" || row.winner === "tie" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <span className="w-3.5" />}
                {row.sovereign}
              </span>
              <span className="text-sm text-neutral-500 flex items-center gap-2">
                {row.winner === "competitor" || row.winner === "tie" ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <XIcon className="w-3.5 h-3.5 text-neutral-700 shrink-0" />}
                {row.competitor}
              </span>
            </div>
          ))}
        </div>

        <div className="text-center p-8 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02]">
          <h2 className="text-xl font-bold mb-3">Ready to deploy your AI workforce?</h2>
          <p className="text-sm text-neutral-400 mb-6">132 agents. $0 per-token cost. Start free.</p>
          <Link href="/onboarding" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-black font-bold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all">
            Start Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
