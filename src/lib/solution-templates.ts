// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// pre-built playbook templates; superseded by playbooks.ts.
/**
 * SOVEREIGN MATRIX — Solution Templates
 *
 * Pre-configured multi-agent workflows for common business problems.
 * Each template chains agents together via the coordinator with
 * sensible defaults — users click once and get results.
 *
 * These are NOT playbooks (which are lower-level agent chains).
 * Solutions are higher-level: they include the playbook + default inputs
 * + follow-up actions + scheduling recommendations.
 */

export interface SolutionTemplate {
  id: string;
  name: string;
  description: string;
  category: "growth" | "content" | "intelligence" | "operations" | "automation";
  icon: string; // Lucide icon name
  /** Time to first results */
  estimatedTime: string;
  /** What the user gets */
  deliverables: string[];
  /** Playbook ID to execute */
  playbookId: string;
  /** Default inputs (user can override) */
  defaultInputs: Record<string, string>;
  /** Suggested follow-up actions */
  followUps: string[];
  /** Recommended schedule (cron-friendly) */
  suggestedSchedule?: string;
  /** Which agents are involved */
  agents: string[];
}

export const SOLUTION_TEMPLATES: SolutionTemplate[] = [
  // ─── 1. Lead Pipeline ──────────────────────────────
  {
    id: "lead-pipeline",
    name: "Lead Pipeline",
    description: "Find qualified prospects, enrich with contact data, and draft personalized outreach — all in one click.",
    category: "growth",
    icon: "Target",
    estimatedTime: "2-3 minutes",
    deliverables: [
      "5-10 qualified leads with company details",
      "Personalized outreach email per lead",
      "Follow-up sequence (3-5 emails)",
    ],
    playbookId: "lead-blitz",
    defaultInputs: {
      niche: "",
      location: "worldwide",
    },
    followUps: [
      "Review and approve outreach emails",
      "Schedule daily lead runs for continuous pipeline",
      "Connect to HubSpot/Pipedrive to sync leads",
    ],
    suggestedSchedule: "0 9 * * 1-5", // Weekdays at 9am
    agents: ["leads", "email-sequence", "abm-artillery"],
  },

  // ─── 2. Content Engine ─────────────────────────────
  {
    id: "content-engine",
    name: "Content Engine",
    description: "Generate a week of SEO-optimized content: blog posts, social media pack, and email newsletter — matched to your brand voice.",
    category: "content",
    icon: "FileText",
    estimatedTime: "3-5 minutes",
    deliverables: [
      "1 SEO blog post (1500+ words with meta tags)",
      "7-day social media calendar with captions",
      "1 email newsletter draft",
    ],
    playbookId: "content-machine",
    defaultInputs: {
      topic: "",
      tone: "professional",
      platform: "blog",
    },
    followUps: [
      "Review and edit content in the results library",
      "Schedule weekly content generation",
      "Teach brand voice with 3+ content samples",
    ],
    suggestedSchedule: "0 8 * * 1", // Mondays at 8am
    agents: ["blog-gen", "organic-content", "social-router", "brand-voice"],
  },

  // ─── 3. Competitor Monitor ─────────────────────────
  {
    id: "competitor-monitor",
    name: "Competitor Monitor",
    description: "Deep-scan a competitor's website, SEO strategy, and positioning — get an intelligence report with counter-strategies.",
    category: "intelligence",
    icon: "Shield",
    estimatedTime: "2-3 minutes",
    deliverables: [
      "Competitor SEO audit (keyword gaps, traffic estimates)",
      "Brand positioning analysis with vulnerabilities",
      "Counter-strategy recommendations",
    ],
    playbookId: "competitor-takedown",
    defaultInputs: {
      target: "",
      industry: "",
    },
    followUps: [
      "Run weekly to track competitor changes",
      "Feed insights into content strategy",
      "Generate comparison landing page",
    ],
    suggestedSchedule: "0 9 * * 1", // Mondays at 9am
    agents: ["competitor-scan", "seo-dominator", "brand-audit", "site-assassin"],
  },

  // ─── 4. Client Onboarding ──────────────────────────
  {
    id: "client-onboard",
    name: "Client Onboarding",
    description: "New client? Generate a proposal, set up their brand voice profile, run an initial SEO audit, and create a 30-day content plan.",
    category: "operations",
    icon: "Briefcase",
    estimatedTime: "5-8 minutes",
    deliverables: [
      "Custom proposal document",
      "Brand voice profile (learned from samples)",
      "Initial SEO audit with keyword gaps",
      "30-day content calendar",
    ],
    playbookId: "proposal-blaster",
    defaultInputs: {
      client_name: "",
      industry: "",
      website: "",
    },
    followUps: [
      "Review proposal and send to client",
      "Upload client content samples for voice learning",
      "Set up scheduled reports for ongoing delivery",
    ],
    agents: ["proposal-generator", "brand-voice", "seo-dominator", "calendar"],
  },

  // ─── 5. SEO Autopilot ─────────────────────────────
  {
    id: "seo-autopilot",
    name: "SEO Autopilot",
    description: "Continuous SEO improvement: weekly audits, keyword gap analysis, and auto-generated blog posts targeting your weakest areas.",
    category: "automation",
    icon: "BarChart3",
    estimatedTime: "3-5 minutes per cycle",
    deliverables: [
      "SEO health score with trend tracking",
      "Keyword gap report with opportunities",
      "1 auto-generated blog post targeting top gap",
      "30-day content plan based on SEO data",
    ],
    playbookId: "content-machine",
    defaultInputs: {
      domain: "",
      mode: "audit",
    },
    followUps: [
      "Schedule weekly SEO audits",
      "Track ranking improvements over time",
      "Connect to Google Search Console for real data",
    ],
    suggestedSchedule: "0 7 * * 1", // Mondays at 7am
    agents: ["seo-dominator", "blog-gen", "programmatic-seo", "calendar"],
  },
];

/** Get a solution template by ID */
export function getSolution(id: string): SolutionTemplate | undefined {
  return SOLUTION_TEMPLATES.find(t => t.id === id);
}

/** Get solutions by category */
export function getSolutionsByCategory(category: string): SolutionTemplate[] {
  return SOLUTION_TEMPLATES.filter(t => t.category === category);
}
