/**
 * MARKETPLACE DELIVERABLES
 *
 * Buyer-outcome groupings for the marketplace. Reframes the 137-agent
 * inventory by what business deliverable it produces, not by underlying
 * technology category.
 *
 * Why: a prospect lands on /marketplace and asks "what does this DO for
 * my business?" — not "what category of LLM agent is this?". Lead with
 * the outcome; the agents inside become the proof.
 *
 * Each entry maps to real agent slugs in src/lib/agent-slugs.ts. Keep the
 * agent list tight — 4–6 agents per deliverable, not 20. The point is
 * "here's the package," not "here's an exhaustive list."
 */

import { AGENT_SLUG_SET } from "@/lib/agent-slugs";

export interface Deliverable {
  /** URL slug — used by /marketplace#<slug> jumps. */
  slug: string;
  /** Headline outcome the buyer cares about. Short, punchy. */
  outcome: string;
  /** One-sentence explanation of what running this delivers. */
  promise: string;
  /** Tier indicator — "Free" / "Starter" / "Growth" / "Node". */
  tier: "Free" | "Starter" | "Growth" | "Node";
  /** Lucide icon name. UI maps these to actual components. */
  icon:
    | "Target"
    | "PenTool"
    | "Search"
    | "Phone"
    | "Shield"
    | "Brain"
    | "Workflow"
    | "Mail";
  /** Tailwind palette key — bg/border/text accents. */
  palette: "emerald" | "violet" | "amber" | "pink" | "cyan" | "indigo";
  /** Agent slugs that compose this deliverable. Order = display order. */
  agents: string[];
  /** Real-world headline metric — what a typical run produces. */
  metric: string;
  /** Approximate runtime to first output. */
  timeToFirst: string;
}

export const DELIVERABLES: Deliverable[] = [
  {
    slug: "lead-generation",
    outcome: "Lead generation engine",
    promise: "Find, enrich, and book qualified meetings — without an SDR team.",
    tier: "Starter",
    icon: "Target",
    palette: "emerald",
    agents: ["leads", "abm-artillery", "ghost-fleet", "outbound", "closer"],
    metric: "50+ qualified leads / run",
    timeToFirst: "8–12 min",
  },
  {
    slug: "content-publishing",
    outcome: "Content publishing engine",
    promise:
      "Blog, social, and email content drafted, anti-slop'd, and scheduled.",
    tier: "Starter",
    icon: "PenTool",
    palette: "violet",
    agents: [
      "content",
      "blog-gen",
      "social-router",
      "email-sequence",
      "organic-content",
    ],
    metric: "1 blog + 3 social posts + 5-email sequence",
    timeToFirst: "4–6 min",
  },
  {
    slug: "competitor-intelligence",
    outcome: "Competitor intelligence ops",
    promise:
      "Watch every competitor move — pricing, content, hiring, ads — on a schedule.",
    tier: "Growth",
    icon: "Search",
    palette: "amber",
    agents: [
      "competitor",
      "competitor-scan",
      "competitive-radar",
      "brand-audit",
    ],
    metric: "Battle card + 5 counter-positioning angles",
    timeToFirst: "6–10 min",
  },
  {
    slug: "voice-conversion",
    outcome: "Voice cold-call conversion",
    promise:
      "Sub-200ms AI cold-callers that BANT-qualify leads and book meetings.",
    tier: "Node",
    icon: "Phone",
    palette: "pink",
    agents: ["voice", "voice-closer", "voice-assistant", "voice-chat"],
    metric: "20–50 calls / hour, ~12% book rate",
    timeToFirst: "Real-time",
  },
  {
    slug: "customer-onboarding",
    outcome: "Customer onboarding automation",
    promise:
      "From signed deal to working client in 24 hours — contracts, emails, kickoff packet.",
    tier: "Starter",
    icon: "Mail",
    palette: "cyan",
    agents: [
      "auto-onboard",
      "email-onboard",
      "contract-analyzer",
      "client-report",
    ],
    metric: "Contract draft + 4-email sequence + dashboard provisioned",
    timeToFirst: "3–5 min",
  },
  {
    slug: "strategic-decisions",
    outcome: "Strategic decision war room",
    promise:
      "Three independent agents debate your biggest call. You see all sides + the synthesis.",
    tier: "Growth",
    icon: "Brain",
    palette: "indigo",
    agents: ["god-brain", "war-room", "deep-search", "deep-think"],
    metric: "Consensus recommendation + dissent + risk register",
    timeToFirst: "2–4 min",
  },
];

/** Sanity-check helper used by tests + dev runtime. Returns the slugs of
 *  any deliverable agents that aren't in the canonical AGENT_SLUG_SET —
 *  catches typos / stale entries before they ship to prod. */
export function findOrphanDeliverableAgents(): string[] {
  const orphans: string[] = [];
  for (const d of DELIVERABLES) {
    for (const agent of d.agents) {
      if (!AGENT_SLUG_SET.has(agent)) orphans.push(`${d.slug}:${agent}`);
    }
  }
  return orphans;
}
