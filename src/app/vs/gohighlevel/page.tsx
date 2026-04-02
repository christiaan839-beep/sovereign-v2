import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, X as XIcon, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Sovereign Matrix vs GoHighLevel — AI Agents vs CRM Templates",
  description: "Compare Sovereign Matrix and GoHighLevel. Autonomous AI agents that execute vs empty CRM templates you fill manually. Which scales your agency?",
};

const COMPARISON = [
  { feature: "Content generation", sovereign: "AI writes blogs, emails, social posts autonomously", competitor: "Empty templates — you write everything manually", winner: "sovereign" },
  { feature: "Lead generation", sovereign: "AI finds, enriches, and verifies prospects automatically", competitor: "You import leads from external tools", winner: "sovereign" },
  { feature: "Voice calling", sovereign: "AI cold-calls, qualifies, and books meetings", competitor: "Manual calling with dialer", winner: "sovereign" },
  { feature: "SEO automation", sovereign: "Autonomous keyword analysis, content generation, schema markup", competitor: "Basic SEO settings only", winner: "sovereign" },
  { feature: "Competitor intelligence", sovereign: "AI analyzes tech stack, pricing, SEO gaps, counter-moves", competitor: "Not supported", winner: "sovereign" },
  { feature: "CRM features", sovereign: "Basic lead management (growing)", competitor: "Full CRM with pipelines, contacts, deals", winner: "competitor" },
  { feature: "Website builder", sovereign: "AI generates complete pages from text prompts", competitor: "Drag-and-drop builder with templates", winner: "tie" },
  { feature: "Email marketing", sovereign: "AI writes and sends sequences", competitor: "Full email marketing suite", winner: "tie" },
  { feature: "Appointment scheduling", sovereign: "AI books via voice and Cal.com", competitor: "Built-in calendar with booking widget", winner: "tie" },
  { feature: "White-label", sovereign: "Full platform white-label with custom domain", competitor: "Full white-label (mature)", winner: "tie" },
  { feature: "AI intelligence", sovereign: "51+ AI models with smart routing", competitor: "Basic ChatGPT wrapper integration", winner: "sovereign" },
  { feature: "Pricing", sovereign: "From R9,997/mo (~$550) — AI included", competitor: "From $97/mo — AI features extra cost", winner: "tie" },
];

export default function VsGoHighLevel() {
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
            Sovereign Matrix <span className="text-neutral-500">vs</span> GoHighLevel
          </h1>
          <p className="text-neutral-400 max-w-xl mx-auto">
            GoHighLevel gives you empty templates. Sovereign Matrix gives you an autonomous workforce that fills them in, sends them out, and follows up — without human intervention.
          </p>
        </div>

        <div className="space-y-2 mb-16">
          <div className="grid grid-cols-3 gap-4 px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
            <span>Feature</span>
            <span className="text-emerald-400">Sovereign Matrix</span>
            <span>GoHighLevel</span>
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
          <h2 className="text-xl font-bold mb-3">Stop paying for empty templates.</h2>
          <p className="text-sm text-neutral-400 mb-6">Deploy AI agents that actually do the work. Free to start.</p>
          <Link href="/onboarding" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-black font-bold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all">
            Start Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
