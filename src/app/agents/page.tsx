import Link from "next/link";
import { AGENT_SLUGS } from "@/lib/agent-slugs";
import type { Metadata } from "next";

/**
 * /agents — Public catalog of every registered agent (Cook 50 / Tier 6 #26).
 *
 * SEO + discoverability. Pure server component. Renders one card per slug
 * from `AGENT_SLUGS` (the static, client-safe registry list); each card
 * deep-links to /marketplace/<slug> for the detail view.
 *
 * Grouped by inferred category so the page is scannable. Same heuristic
 * the marketplace detail page uses, kept in sync via shared regex shape.
 */

export const metadata: Metadata = {
  title: "All Agents · Sovereign Matrix",
  description:
    "Full public catalog of every agent on the Sovereign Matrix platform. Browse 140 specialized AI agents organized by category.",
  alternates: { canonical: "/agents" },
};

type Category =
  | "sales"
  | "content"
  | "research"
  | "voice"
  | "vision"
  | "code"
  | "industry"
  | "safety"
  | "orchestration"
  | "seo"
  | "intelligence";

const CATEGORY_LABEL: Record<Category, string> = {
  sales: "Sales & Outbound",
  content: "Content & Brand",
  research: "Research & Analysis",
  voice: "Voice & Audio",
  vision: "Vision & Imaging",
  code: "Code & Engineering",
  industry: "Industry Specialists",
  safety: "Safety & Compliance",
  orchestration: "Orchestration",
  seo: "SEO & Growth",
  intelligence: "General Intelligence",
};

const CATEGORY_COLOR: Record<Category, string> = {
  sales: "from-orange-500/20 to-orange-700/5",
  content: "from-violet-500/20 to-violet-700/5",
  research: "from-amber-500/20 to-amber-700/5",
  voice: "from-pink-500/20 to-pink-700/5",
  vision: "from-cyan-500/20 to-cyan-700/5",
  code: "from-blue-500/20 to-blue-700/5",
  industry: "from-emerald-500/20 to-emerald-700/5",
  safety: "from-rose-500/20 to-rose-700/5",
  orchestration: "from-indigo-500/20 to-indigo-700/5",
  seo: "from-teal-500/20 to-teal-700/5",
  intelligence: "from-neutral-500/20 to-neutral-700/5",
};

function inferCategory(slug: string): Category {
  const s = slug.toLowerCase();
  if (/voice|audio|speak|asr|music|tts/.test(s)) return "voice";
  if (/vision|image|ocr|flux|florence|visual|imagen|video|cosmos/.test(s))
    return "vision";
  if (/seo|content|blog|organic|brand|social|creative|page-builder/.test(s))
    return "content";
  if (
    /lead|outbound|abm|sales|closer|funnel|ads|email-sequence|email-onboard|ghost-fleet/.test(
      s,
    )
  )
    return "sales";
  if (/threat|compliance|pii|guard|audit|nemoclaw|content-safety/.test(s))
    return "safety";
  if (/code|sandbox|deploy|webhook|pipeline|auto-heal|error-log/.test(s))
    return "code";
  if (
    /god-brain|war-room|orchestrat|coordinator|chain|swarm|smart-router|agentic|super-agent|nexus|flywheel/.test(
      s,
    )
  )
    return "orchestration";
  if (
    /healthcare|legal|agri|supply-chain|prior-auth|contract|billing|verticals|whitelabel|digital-human|booking/.test(
      s,
    )
  )
    return "industry";
  if (
    /research|search|deep|benchmark|analytics|report|competitive|firecrawl|grounded|doc|memory/.test(
      s,
    )
  )
    return "research";
  return "intelligence";
}

function slugToName(slug: string): string {
  const ACRONYMS: Record<string, string> = {
    seo: "SEO",
    pii: "PII",
    rag: "RAG",
    asr: "ASR",
    ocr: "OCR",
    abm: "ABM",
    crm: "CRM",
    ai: "AI",
    api: "API",
    r1: "R1",
  };
  return slug
    .split("-")
    .map(
      (w) =>
        ACRONYMS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

interface GroupedAgents {
  category: Category;
  slugs: string[];
}

function groupBySlug(slugs: ReadonlyArray<string>): GroupedAgents[] {
  const buckets = new Map<Category, string[]>();
  for (const slug of slugs) {
    const cat = inferCategory(slug);
    const list = buckets.get(cat) ?? [];
    list.push(slug);
    buckets.set(cat, list);
  }
  const order: Category[] = [
    "intelligence",
    "sales",
    "content",
    "research",
    "code",
    "voice",
    "vision",
    "industry",
    "orchestration",
    "safety",
    "seo",
  ];
  return order
    .map((category) => ({
      category,
      slugs: (buckets.get(category) ?? []).sort(),
    }))
    .filter((g) => g.slugs.length > 0);
}

export default function AgentsCatalogPage() {
  const grouped = groupBySlug(AGENT_SLUGS);
  const total = AGENT_SLUGS.length;

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/marketplace"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/dashboard"
              className="text-xs px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-neutral-200 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-500 mb-4">
          Public Catalog
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
          Every agent on Sovereign Matrix
        </h1>
        <p className="mt-4 text-neutral-400 max-w-2xl text-sm leading-relaxed">
          {total} specialized agents. Each one runs through the same 6-layer
          safety pipeline, produces a cryptographically-signed receipt, and is
          replayable on demand. Click any agent for full capability, model
          attribution, and example workflow.
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-24 space-y-16">
        {grouped.map((group) => (
          <section key={group.category}>
            <header className="flex items-baseline justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                {CATEGORY_LABEL[group.category]}
              </h2>
              <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                {group.slugs.length} agents
              </span>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {group.slugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/marketplace/${slug}`}
                  className={`group relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br ${CATEGORY_COLOR[group.category]} p-4 hover:border-white/20 transition-all`}
                >
                  <div className="text-sm font-semibold text-white group-hover:text-white">
                    {slugToName(slug)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1 font-mono">
                    /api/agents/{slug}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500">
          Catalog generated from{" "}
          <code className="text-neutral-400">AGENT_SLUGS</code> — kept in sync
          with the live agent registry on every release.
        </div>
      </footer>
    </div>
  );
}
