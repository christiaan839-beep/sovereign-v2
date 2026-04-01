/**
 * SOVEREIGN MATRIX — Playbook Engine
 *
 * Playbooks are pre-configured multi-agent workflows that abstract away
 * individual agents. Users pick a BUSINESS OUTCOME, fill in 2-3 fields,
 * and hit deploy. The system assembles the right agent swarm automatically.
 *
 * Architecture:
 *   Playbook → Step[] → each step calls an agent via the coordinator
 *   Steps can reference outputs from previous steps via {{step_N}} templates
 *
 * Usage:
 *   import { PLAYBOOKS, resolvePlaybook } from "@/lib/playbooks";
 *   const steps = resolvePlaybook("competitor-takedown", { url: "acme.com" });
 */

export interface PlaybookField {
  key: string;
  label: string;
  type: "text" | "url" | "select" | "textarea";
  placeholder: string;
  required: boolean;
  options?: string[]; // For "select" type
}

export interface PlaybookStep {
  agent: string;
  params: Record<string, string>;
  reason: string;
}

export interface Playbook {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
  category: "growth" | "content" | "intelligence" | "operations";
  fields: PlaybookField[];
  steps: PlaybookStep[];
  estimatedTime: string; // e.g., "2-4 min"
  agentCount: number;
}

// ─── Playbook Definitions ───────────────────────────────────────────────────

export const PLAYBOOKS: Playbook[] = [
  {
    id: "lead-blitz",
    name: "Lead Blitz",
    tagline: "50 qualified leads + outreach in minutes",
    description: "Find prospects in your niche, verify their details, and draft personalized outreach emails — all in one shot.",
    icon: "Target",
    color: "emerald",
    category: "growth",
    fields: [
      { key: "niche", label: "Target Industry", type: "text", placeholder: "e.g. SaaS companies, dental practices", required: true },
      { key: "location", label: "Location", type: "text", placeholder: "e.g. Texas, London, worldwide", required: true },
      { key: "product", label: "Your Product/Service", type: "text", placeholder: "e.g. AI-powered CRM for agencies", required: true },
    ],
    steps: [
      { agent: "leads", params: { niche: "{{niche}}", location: "{{location}}" }, reason: "Find qualified prospects matching the target criteria" },
      { agent: "email-sequence", params: { product: "{{product}}", audience: "{{niche}} in {{location}}", context: "{{step_1}}" }, reason: "Draft personalized outreach based on lead data" },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "competitor-takedown",
    name: "Competitor Takedown",
    tagline: "Full competitive analysis + counter-strategy",
    description: "Deep-dive into a competitor's website, SEO, pricing, and messaging. Get an actionable report to outmaneuver them.",
    icon: "Swords",
    color: "red",
    category: "intelligence",
    fields: [
      { key: "url", label: "Competitor URL", type: "url", placeholder: "e.g. competitor.com", required: true },
      { key: "your_url", label: "Your Website (optional)", type: "url", placeholder: "e.g. youragency.com", required: false },
    ],
    steps: [
      { agent: "site-assassin", params: { url: "{{url}}" }, reason: "Deep scrape and analyze competitor's website structure and messaging" },
      { agent: "seo-dominator", params: { url: "{{url}}", context: "{{step_1}}" }, reason: "Analyze their SEO strategy, rankings, and keyword gaps" },
      { agent: "smart-router", params: { prompt: "Based on this competitive analysis, create a battle card with 5 counter-positioning strategies. Competitor data: {{step_1}} SEO data: {{step_2}}", task_type: "analysis" }, reason: "Synthesize findings into an actionable competitive strategy" },
    ],
    estimatedTime: "3-5 min",
    agentCount: 3,
  },
  {
    id: "content-machine",
    name: "Content Machine",
    tagline: "SEO blog + social posts from one topic",
    description: "Generate a full SEO-optimized blog post, then spin it into social media snippets for every platform.",
    icon: "PenTool",
    color: "violet",
    category: "content",
    fields: [
      { key: "topic", label: "Blog Topic", type: "text", placeholder: "e.g. How AI is transforming lead generation", required: true },
      { key: "tone", label: "Tone", type: "select", placeholder: "Select tone", required: true, options: ["Professional", "Casual", "Technical", "Bold"] },
      { key: "keywords", label: "Target Keywords (optional)", type: "text", placeholder: "e.g. AI lead gen, automated outreach", required: false },
    ],
    steps: [
      { agent: "blog-gen", params: { topic: "{{topic}}", tone: "{{tone}}", keywords: "{{keywords}}" }, reason: "Write a comprehensive, SEO-optimized blog post" },
      { agent: "smart-router", params: { prompt: "Take this blog post and create: 1) A LinkedIn post (professional, 200 words), 2) A Twitter thread (5 tweets), 3) An Instagram caption (casual, with hashtags). Blog: {{step_1}}", task_type: "creative" }, reason: "Repurpose the blog into platform-specific social content" },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "proposal-blaster",
    name: "Proposal Blaster",
    tagline: "Client proposal + case study in one click",
    description: "Generate a professional proposal tailored to a prospect, including a relevant case study and pricing breakdown.",
    icon: "FileText",
    color: "amber",
    category: "operations",
    fields: [
      { key: "client", label: "Client Company Name", type: "text", placeholder: "e.g. Acme Corp", required: true },
      { key: "service", label: "Service Being Proposed", type: "text", placeholder: "e.g. AI-powered lead generation and outbound automation", required: true },
      { key: "budget", label: "Budget Range (optional)", type: "text", placeholder: "e.g. $5K-10K/month", required: false },
    ],
    steps: [
      { agent: "case-study", params: { prompt: "Generate a relevant case study for pitching {{service}} to {{client}}. Include metrics, timeline, and results.", context: "{{service}}" }, reason: "Create a compelling proof-of-results case study" },
      { agent: "proposal-generator", params: { prompt: "Write a professional business proposal for {{client}} for {{service}}. Budget: {{budget}}. Include the case study: {{step_1}}", context: "{{step_1}}" }, reason: "Draft a complete client proposal with the case study embedded" },
    ],
    estimatedTime: "2-4 min",
    agentCount: 2,
  },
  {
    id: "seo-domination",
    name: "SEO Domination",
    tagline: "Full audit + content strategy + keyword plan",
    description: "Audit your website's SEO, find keyword opportunities, analyze top competitors, and get a 30-day content calendar.",
    icon: "TrendingUp",
    color: "cyan",
    category: "growth",
    fields: [
      { key: "url", label: "Your Website URL", type: "url", placeholder: "e.g. youragency.com", required: true },
      { key: "keywords", label: "Target Keywords", type: "text", placeholder: "e.g. AI agency, lead generation tool", required: true },
    ],
    steps: [
      { agent: "seo-dominator", params: { url: "{{url}}", keywords: "{{keywords}}" }, reason: "Comprehensive SEO audit — technical issues, on-page, backlinks" },
      { agent: "smart-router", params: { prompt: "Based on this SEO audit, create a 30-day content calendar targeting the keywords {{keywords}}. Include blog topics, meta descriptions, and internal linking strategy. Audit: {{step_1}}", task_type: "analysis" }, reason: "Turn the audit into an actionable content strategy" },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "brand-forensics",
    name: "Brand Forensics",
    tagline: "Analyze any brand's voice, positioning & gaps",
    description: "Feed in a company URL and get a complete brand voice analysis, messaging teardown, and positioning recommendations.",
    icon: "Fingerprint",
    color: "pink",
    category: "intelligence",
    fields: [
      { key: "url", label: "Brand Website URL", type: "url", placeholder: "e.g. targetbrand.com", required: true },
      { key: "industry", label: "Industry Context", type: "text", placeholder: "e.g. B2B SaaS, e-commerce fashion", required: true },
    ],
    steps: [
      { agent: "site-assassin", params: { url: "{{url}}" }, reason: "Deep scrape the brand's messaging, copy, and visual positioning" },
      { agent: "brand-voice", params: { prompt: "Analyze this brand's voice, messaging patterns, and positioning in the {{industry}} industry. Website data: {{step_1}}", context: "{{step_1}}" }, reason: "Extract brand voice patterns, tone, vocabulary, and positioning gaps" },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "funnel-autopsy",
    name: "Funnel Autopsy",
    tagline: "Find exactly where your funnel leaks",
    description: "Analyze your entire sales funnel from landing page to checkout. Get specific fixes for every drop-off point.",
    icon: "Activity",
    color: "orange",
    category: "growth",
    fields: [
      { key: "url", label: "Landing Page URL", type: "url", placeholder: "e.g. youragency.com/pricing", required: true },
      { key: "goal", label: "Funnel Goal", type: "text", placeholder: "e.g. Book a demo call, Purchase subscription", required: true },
    ],
    steps: [
      { agent: "funnel-xray", params: { url: "{{url}}", prompt: "Analyze this funnel for conversion optimization. The goal is: {{goal}}" }, reason: "Deep analysis of every funnel stage — landing, interest, decision, action" },
      { agent: "smart-router", params: { prompt: "Based on this funnel analysis, provide: 1) Top 5 highest-impact fixes ranked by effort/impact, 2) A/B test suggestions for each fix, 3) Estimated conversion lift per fix. Analysis: {{step_1}}", task_type: "analysis" }, reason: "Prioritize the fixes by business impact" },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "ghost-fleet",
    name: "Apollo Ghost Fleet",
    tagline: "Mass outreach campaign from scratch",
    description: "Find 100 prospects, research their companies, craft personalized emails, and generate a full follow-up sequence.",
    icon: "Ghost",
    color: "neutral",
    category: "growth",
    fields: [
      { key: "niche", label: "Target Audience", type: "text", placeholder: "e.g. VP of Sales at Series B fintechs", required: true },
      { key: "location", label: "Region", type: "text", placeholder: "e.g. United States, Europe, worldwide", required: true },
      { key: "product", label: "What You're Selling", type: "textarea", placeholder: "Describe your product/service in 2-3 sentences", required: true },
      { key: "tone", label: "Email Tone", type: "select", placeholder: "Select tone", required: true, options: ["Direct & Bold", "Professional", "Casual & Friendly", "Consultative"] },
    ],
    steps: [
      { agent: "leads", params: { niche: "{{niche}}", location: "{{location}}" }, reason: "Find and qualify prospects matching the ideal customer profile" },
      { agent: "competitor-scan", params: { target: "{{niche}}" }, reason: "Research the market to inform personalized messaging angles" },
      { agent: "email-sequence", params: { product: "{{product}}", audience: "{{niche}}", tone: "{{tone}}", context: "Leads: {{step_1}}. Market context: {{step_2}}" }, reason: "Draft a multi-touch outreach sequence with personalization hooks" },
    ],
    estimatedTime: "3-5 min",
    agentCount: 3,
  },
];

// ─── Resolution Engine ──────────────────────────────────────────────────────

/**
 * Resolve a playbook's step templates using the provided user input.
 * Replaces {{field}} placeholders with actual values, and {{step_N}}
 * with previous step outputs at execution time.
 */
export function resolvePlaybookSteps(
  playbook: Playbook,
  userInput: Record<string, string>
): PlaybookStep[] {
  return playbook.steps.map((step) => {
    const resolvedParams: Record<string, string> = {};
    for (const [key, template] of Object.entries(step.params)) {
      let resolved = template;
      // Replace user input placeholders
      for (const [field, value] of Object.entries(userInput)) {
        resolved = resolved.replaceAll(`{{${field}}}`, value || "");
      }
      resolvedParams[key] = resolved;
    }
    return {
      ...step,
      params: resolvedParams,
    };
  });
}

/**
 * Get playbooks by category.
 */
export function getPlaybooksByCategory(category: Playbook["category"]): Playbook[] {
  return PLAYBOOKS.filter((p) => p.category === category);
}

/**
 * Find a playbook by ID.
 */
export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}

export const PLAYBOOK_CATEGORIES = [
  { id: "growth" as const, label: "Growth & Leads", icon: "Rocket" },
  { id: "content" as const, label: "Content Creation", icon: "PenTool" },
  { id: "intelligence" as const, label: "Intelligence", icon: "Brain" },
  { id: "operations" as const, label: "Operations", icon: "Settings" },
] as const;
