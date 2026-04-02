import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, X as XIcon, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs Jasper AI — Autonomous Agents vs Content Generator",
  description: "Compare Sovereign Matrix and Jasper AI. 132 autonomous agents across sales, SEO, voice, and code vs a single-purpose content writing tool.",
};

const COMPARISON = [
  { feature: "Scope", sovereign: "Full business automation (132 agents)", competitor: "Content generation only", winner: "sovereign" },
  { feature: "Lead generation", sovereign: "AI finds and enriches prospects", competitor: "Not supported", winner: "sovereign" },
  { feature: "Voice agents", sovereign: "AI makes phone calls and books meetings", competitor: "Not supported", winner: "sovereign" },
  { feature: "Browser automation", sovereign: "NemoClaw scrapes and navigates websites", competitor: "Not supported", winner: "sovereign" },
  { feature: "SEO automation", sovereign: "Full SEO pipeline (audit, keywords, content, schema)", competitor: "SEO content suggestions only", winner: "sovereign" },
  { feature: "Code generation", sovereign: "Full-stack code agent (HTML, CSS, JS, Python)", competitor: "Not supported", winner: "sovereign" },
  { feature: "Content quality", sovereign: "Anti-slop pipeline + quality scoring", competitor: "High-quality with brand voice", winner: "tie" },
  { feature: "Brand voice", sovereign: "AI-extracted brand voice profiles", competitor: "Mature brand voice system", winner: "tie" },
  { feature: "Content templates", sovereign: "Blog, email, social, video scripts", competitor: "50+ content templates", winner: "competitor" },
  { feature: "Team collaboration", sovereign: "Org workspaces with RBAC", competitor: "Team features with permissions", winner: "tie" },
  { feature: "Per-token cost", sovereign: "$0 via NVIDIA NIM free tier", competitor: "Included in subscription", winner: "sovereign" },
  { feature: "Pricing", sovereign: "From R9,997/mo (~$550) — full platform", competitor: "From $49/mo — content only", winner: "tie" },
];

export default function VsJasper() {
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
            Sovereign Matrix <span className="text-neutral-500">vs</span> Jasper AI
          </h1>
          <p className="text-neutral-400 max-w-xl mx-auto">
            Jasper writes content. Sovereign Matrix writes content, finds leads, makes calls, builds pages, audits competitors, and closes deals — autonomously.
          </p>
        </div>

        <div className="space-y-2 mb-16">
          <div className="grid grid-cols-3 gap-4 px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
            <span>Feature</span>
            <span className="text-emerald-400">Sovereign Matrix</span>
            <span>Jasper AI</span>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-4 px-4 py-3 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:border-emerald-500/10 transition-colors">
              <span className="text-sm text-white font-medium">{row.feature}</span>
              <span className="text-sm text-neutral-300 flex items-center gap-2">
                {row.winner === "sovereign" || row.winner === "tie" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XIcon className="w-3.5 h-3.5 text-neutral-700 shrink-0" />}
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
          <h2 className="text-xl font-bold mb-3">Need more than a content writer?</h2>
          <p className="text-sm text-neutral-400 mb-6">Deploy 132 agents across your entire business. Free to start.</p>
          <Link href="/onboarding" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-black font-bold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all">
            Start Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
