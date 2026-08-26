/**
 * COMPETITOR REGISTRY
 *
 * Drives /vs/[slug] catch-all pages. Each entry produces a fully indexable
 * comparison page with hero, feature matrix, pricing callout, positioning
 * narrative, and CTA. Pages with hand-curated copy live at
 * /vs/<slug>/page.tsx and take precedence (Next.js static > dynamic).
 *
 * To add a new comparison:
 *   1. Add an entry below.
 *   2. The /vs/<slug> URL renders automatically.
 *   3. Sitemap picks it up via getCompetitorSlugs().
 *
 * Style guide for new entries:
 *   - Be specific. "$50K/yr enterprise contract" beats "expensive."
 *   - Be honest. List what they do better — credibility loop.
 *   - Lead with the customer pain, not the tech difference.
 *   - One-line summary stays under 120 chars (used in OG meta).
 */

export interface CompetitorRow {
  feature: string;
  sovereign: boolean | "partial";
  competitor: boolean | "partial";
  note?: string;
}

export interface Competitor {
  /** URL slug — kebab-case, lowercase, no spaces. */
  slug: string;
  /** Their product name as it appears on their site. */
  name: string;
  /** Their tagline / positioning, paraphrased. */
  theirTagline: string;
  /** Two-sentence summary of who they serve well + who they don't. */
  honestSummary: string;
  /** Their public pricing — exact strings ("from $99/mo", "Custom"). */
  theirPricing: string;
  /** Sovereign's matching tier, for the side-by-side. */
  ourPricing: string;
  /** Feature comparison rows. Order matters — most-differentiating first. */
  comparison: CompetitorRow[];
  /** 2-3 paragraphs of competitive narrative. Keep punchy, no marketing slop. */
  positioning: string[];
  /** Who is this comparison FOR? Helps SEO and sets reader expectations. */
  audience: string;
  /** Optional: their public URL for the "official site →" link. */
  url?: string;
}

/**
 * NEW competitor entries — pages NOT already hand-coded under /vs/<slug>.
 * Existing hand-coded comparisons (lindy, clay, crewai, hubspot, make,
 * manus, n8n, relevance-ai, sintra, zapier, claude-agents) are NOT in
 * this registry — they have richer custom layouts.
 */
export const COMPETITORS: Competitor[] = [
  {
    slug: "apollo",
    name: "Apollo.io",
    theirTagline: "End-to-end sales platform with prospecting + sequencing.",
    honestSummary:
      "Apollo wins on B2B contact data depth — 275M+ verified profiles, real-time enrichment. They lose when you need an actual agent that researches, drafts, and books — Apollo is sequencing, not autonomy.",
    theirPricing: "$59–$149 / user / month + data add-ons",
    ourPricing: "$19–$199 / month flat — agents included",
    audience:
      "B2B sales leaders comparing prospecting tools to AI sales agents.",
    url: "https://www.apollo.io",
    comparison: [
      {
        feature: "Verified contact database (275M+)",
        sovereign: false,
        competitor: true,
        note: "Apollo's database is industry-leading; Sovereign uses live web research instead",
      },
      {
        feature: "Email sequence builder",
        sovereign: true,
        competitor: true,
        note: "Both ship sequencing — Apollo with templates, Sovereign with AI-drafted variants",
      },
      {
        feature: "Autonomous lead research",
        sovereign: true,
        competitor: false,
        note: "Sovereign's Lead Blitz researches, qualifies, and personalizes; Apollo lists & enriches but doesn't act",
      },
      {
        feature: "AI-drafted personalized outreach",
        sovereign: true,
        competitor: "partial",
        note: "Apollo has AI assist; Sovereign generates per-prospect drafts via 39+ models",
      },
      {
        feature: "Voice / cold-call agent",
        sovereign: true,
        competitor: false,
        note: "Apollo has dialer; Sovereign has autonomous AI cold-callers",
      },
      {
        feature: "Whitelabel for agencies",
        sovereign: true,
        competitor: false,
      },
      {
        feature: "Per-seat pricing",
        sovereign: false,
        competitor: true,
        note: "Sovereign is per-account flat — invite your team without buying seats",
      },
      {
        feature: "ZAR / local-currency billing",
        sovereign: true,
        competitor: false,
        note: "Apollo is USD-only; Sovereign supports PayFast / Yoco / PayStack",
      },
      {
        feature:
          "5-layer safety pipeline (jailbreak, PII, content, quality, critic)",
        sovereign: true,
        competitor: false,
      },
    ],
    positioning: [
      'Apollo is a phone book with a sequencer attached. If you already know the 200 companies you want to reach this month, Apollo\'s data is unbeatable. Sovereign is a different shape of tool: you describe the outcome ("50 qualified meetings with mid-market SaaS founders in Austin") and an agent does the research, qualifies the list, drafts the personalized outreach, and books the calls.',
      "The cost picture flips the moment you stop paying per seat. Apollo's $99/seat × 5-person team = $495/mo before data add-ons. Sovereign at $199 covers your whole team plus the agents that replace what Apollo seats actually do.",
      "Where Apollo wins: large outbound teams that already have a tested ICP and need contact data at scale. Where Sovereign wins: lean teams (2–10 people) who'd rather have an AI worker run the entire prospecting motion than 5 SDRs grinding through a list.",
    ],
  },
  {
    slug: "jasper",
    name: "Jasper",
    theirTagline: "AI content platform for marketing teams.",
    honestSummary:
      'Jasper is best-in-class for content marketing teams who need brand-consistent copy at scale. It\'s a content tool though — not an agent platform. If your workflow ends at "draft me a blog post," Jasper is great. If it includes "research, draft, schedule, repurpose, and report on results," you need an agent.',
    theirPricing: "$49–$125 / user / month + Enterprise",
    ourPricing: "$19–$199 / month flat — content + the rest",
    audience:
      "Marketing leads choosing between a writing tool and an agent platform.",
    url: "https://www.jasper.ai",
    comparison: [
      {
        feature: "Brand voice training",
        sovereign: true,
        competitor: true,
        note: "Jasper's voice memory is mature; Sovereign's brand-voice agent is newer",
      },
      { feature: "Long-form blog writer", sovereign: true, competitor: true },
      {
        feature: "Anti-slop / cliche removal",
        sovereign: true,
        competitor: false,
        note: "Sovereign filters 47 known AI-cliche patterns before delivery",
      },
      {
        feature: "Multi-model routing (lower cost)",
        sovereign: true,
        competitor: false,
        note: "Jasper is OpenAI-only; Sovereign routes to free providers when quality permits",
      },
      {
        feature: "Lead research + outbound",
        sovereign: true,
        competitor: false,
      },
      {
        feature: "Voice / video generation",
        sovereign: true,
        competitor: false,
      },
      {
        feature: "Workflow automation across agents",
        sovereign: true,
        competitor: "partial",
        note: "Jasper has Workflows; Sovereign has agent-to-agent hiring (A2E)",
      },
      {
        feature: "Whitelabel for agencies",
        sovereign: true,
        competitor: false,
      },
      { feature: "Per-seat pricing", sovereign: false, competitor: true },
      {
        feature: "Marketplace of community-built agents",
        sovereign: true,
        competitor: false,
      },
    ],
    positioning: [
      'Jasper picked one job and did it well: content. If your only AI workflow is "write blog posts and ad copy with a consistent brand voice," Jasper is mature, polished, and built for marketing teams. There\'s no shame in starting there.',
      "Sovereign Matrix is a category up. The content engine is one of 140 agents — you also get lead generation, competitor research, voice cold-calling, programmatic SEO, and a multi-agent workflow runner. Pricing starts cheaper because cost-routing sends most calls to free providers (Cerebras, NIM) instead of OpenAI.",
      "Most teams switch to Sovereign when they hit Jasper's edges: content gets drafted but never distributed, leads never get researched, and the team realises they need 5 tools to do what one platform should. The argument for Jasper is depth in one workflow. The argument for Sovereign is breadth without bloat.",
    ],
  },
  {
    slug: "bardeen",
    name: "Bardeen",
    theirTagline: "AI automations triggered from your browser.",
    honestSummary:
      "Bardeen's wedge is the browser extension — automations that fire from the page you're on without leaving Chrome. That's a great fit for repetitive in-browser tasks (LinkedIn → CRM, Gmail → Notion). It's not where you want long-running multi-agent business operations to live.",
    theirPricing: "$0–$129 / user / month",
    ourPricing: "$19–$199 / month flat — runs on the server",
    audience:
      "Operators picking between a browser-automation tool and a server-side agent platform.",
    url: "https://www.bardeen.ai",
    comparison: [
      {
        feature: "Browser-extension automations",
        sovereign: false,
        competitor: true,
        note: "Bardeen owns the in-browser surface; Sovereign runs server-side",
      },
      {
        feature: "Long-running async jobs (hours / days)",
        sovereign: true,
        competitor: false,
        note: "Bardeen requires a tab to be open; Sovereign runs without you",
      },
      { feature: "Voice / phone agents", sovereign: true, competitor: false },
      {
        feature: "Multi-agent orchestration",
        sovereign: true,
        competitor: false,
      },
      {
        feature: "Custom agent marketplace",
        sovereign: true,
        competitor: false,
      },
      { feature: "5-layer output safety", sovereign: true, competitor: false },
      { feature: "Cron / scheduled runs", sovereign: true, competitor: true },
      { feature: "Per-seat pricing", sovereign: false, competitor: true },
    ],
    positioning: [
      "Bardeen is a productivity multiplier. Sovereign is a workforce. Different tools, different problems.",
      'Use Bardeen when you live in your browser and want to one-click "capture this LinkedIn profile to my CRM with notes." Use Sovereign when the work shouldn\'t require you to be at the laptop — overnight lead research, weekly competitor scans, autonomous cold-calling on a schedule.',
      "The two even compose: Bardeen captures the input, posts to a Sovereign webhook, an agent runs the heavy lift in the background, and the result lands back in your inbox. Don't pick one OR the other if you have budget for both.",
    ],
  },
  {
    slug: "autogpt",
    name: "AutoGPT / open-source agent runners",
    theirTagline: "Self-hosted autonomous agents on your own infrastructure.",
    honestSummary:
      "If you have a strong dev team and want full control, AutoGPT (and BabyAGI, AgentGPT, etc.) are excellent learning platforms. The catch: you become the production team. Reliability, safety, observability, billing — none of it ships in the box.",
    theirPricing: "Free — but you operate the infrastructure",
    ourPricing: "$19–$199 / month — no infra to operate",
    audience:
      "Engineers weighing self-hosted agent frameworks against managed agent platforms.",
    url: "https://github.com/Significant-Gravitas/AutoGPT",
    comparison: [
      { feature: "Open source", sovereign: false, competitor: true },
      {
        feature: "Self-hostable / on-prem",
        sovereign: "partial",
        competitor: true,
        note: "Sovereign supports local Ollama execution for inference; full self-host on roadmap",
      },
      {
        feature:
          "Production-grade reliability (idempotency, retries, circuit breakers)",
        sovereign: true,
        competitor: false,
        note: "AutoGPT is research-grade; you build the production layer",
      },
      {
        feature: "5-layer safety pipeline",
        sovereign: true,
        competitor: false,
        note: "Sovereign ships jailbreak / PII / content / quality / critic; AutoGPT has none by default",
      },
      {
        feature: "Multi-tenant + per-tenant memory",
        sovereign: true,
        competitor: false,
      },
      {
        feature: "Plan + budget enforcement",
        sovereign: true,
        competitor: false,
        note: "AutoGPT will happily burn $1000 of GPT-4 tokens; Sovereign caps daily spend per user",
      },
      {
        feature: "Whitelabel + customer-facing portal",
        sovereign: true,
        competitor: false,
      },
      {
        feature: "Pre-built agents for SMB workflows",
        sovereign: true,
        competitor: false,
        note: "140 in Sovereign vs DIY in AutoGPT",
      },
      {
        feature: "Pay nothing for the platform itself",
        sovereign: false,
        competitor: true,
      },
    ],
    positioning: [
      'AutoGPT was a critical milestone — it proved autonomous agents could work. As a learning tool and a hacking surface, it\'s still excellent. But there\'s a reason it hasn\'t replaced production SaaS: the gap between "agent works in a Jupyter notebook" and "agent runs reliably for 1000 paying customers" is 80% of the work.',
      "Sovereign Matrix is the production layer that AutoGPT-class projects don't ship: idempotent webhook handlers, signed budget caps, multi-tenant isolation, an output safety pipeline, customer billing, runbooks for the 5 most common failure modes. That's not a feature list, it's the difference between a side project and a business.",
      "If your goal is to learn how agents work, fork AutoGPT. If your goal is to ship customer outcomes this quarter, Sovereign Matrix is faster.",
    ],
  },
  {
    slug: "sovereign",
    name: "Sovereign Matrix (you are here)",
    theirTagline: "This page exists to satisfy /vs/sovereign linkbacks.",
    honestSummary:
      "We're not going to write a comparison against ourselves. Try /pricing instead.",
    theirPricing: "$19–$199 / month",
    ourPricing: "$19–$199 / month",
    audience: "Curious link explorers.",
    comparison: [],
    positioning: [
      "If you're here from a competitor's /vs/sovereign-matrix page, welcome. The pitch is simple: we replace your AI agency for $99/mo, run on cost-routed infra so most calls cost us $0, and ship 140 pre-built agents you can compose into any business outcome.",
      "Read /case-studies for proof, /pricing for numbers, /marketplace for the agent inventory.",
    ],
  },
];

const COMPETITORS_BY_SLUG: Map<string, Competitor> = new Map(
  COMPETITORS.map((c) => [c.slug, c]),
);

export function getCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS_BY_SLUG.get(slug);
}

/** Slugs we render via /vs/[slug] catch-all. Hand-coded /vs/<slug>/page.tsx
 *  routes are listed separately and excluded — keep them in sync with the
 *  filesystem. */
export const HAND_CODED_VS_SLUGS: ReadonlySet<string> = new Set([
  "claude-agents",
  "clay",
  "crewai",
  "hubspot",
  "lindy",
  "make",
  "manus",
  "n8n",
  "relevance-ai",
  "sintra",
  "zapier",
]);

/** Every comparison URL the site supports — used by the sitemap. */
export function getAllVsSlugs(): string[] {
  const fromRegistry = COMPETITORS.map((c) => c.slug);
  return [...HAND_CODED_VS_SLUGS, ...fromRegistry].sort();
}
