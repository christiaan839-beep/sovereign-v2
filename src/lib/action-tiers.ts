/**
 * SOVEREIGN MATRIX — 3-Tier Permission & Approval System
 *
 * Tier 1: AUTONOMOUS — Read-only, no side effects. Executes immediately.
 * Tier 2: CONFIRM    — Writes data or sends content. Requires user confirmation.
 * Tier 3: RESTRICTED — Destructive, financial, or external actions. Requires admin approval.
 */

export type ActionTier = 1 | 2 | 3;

export const TIER_LABELS: Record<ActionTier, string> = {
  1: "Autonomous",
  2: "Requires Confirmation",
  3: "Admin Approval Required",
};

export interface TierInfo {
  tier: ActionTier;
  label: string;
  requiresConfirmation: boolean;
  description: string;
}

/** Agents that execute immediately — read-only, no side effects */
const _TIER_1_AGENTS = new Set([
  "smart-router",
  "deep-think",
  "vision",
  "embed",
  "rerank",
  "translate",
  "ocr",
  "competitor-scan",
]);

/** Agents that write data or send content — require user confirmation */
const TIER_2_AGENTS = new Set([
  "blog-gen",
  "email-sequence",
  "leads",
  "seo",
  "content",
  "ad-report",
  "proposal-generator",
  "slack-notify", // posts to the user's Slack workspace on their behalf
]);

/** Agents that are destructive, financial, or make external calls — require admin approval */
const TIER_3_AGENTS = new Set([
  "voice-closer",
  "computer-use",
  "whitelabel",
]);

const TIER_3_REASONS: Record<string, string> = {
  "voice-closer": "This agent will make outbound phone calls",
  "computer-use": "This agent will take control of a browser session",
  "whitelabel": "This agent will modify domain and branding configuration",
};

/**
 * Get the action tier for a given agent.
 * Unknown agents default to Tier 1 (autonomous) for backward compatibility.
 */
export function getActionTier(agentName: string): TierInfo {
  if (TIER_3_AGENTS.has(agentName)) {
    return {
      tier: 3,
      label: TIER_LABELS[3],
      requiresConfirmation: true,
      description: TIER_3_REASONS[agentName] ?? "This action requires admin approval",
    };
  }

  if (TIER_2_AGENTS.has(agentName)) {
    return {
      tier: 2,
      label: TIER_LABELS[2],
      requiresConfirmation: true,
      description: "This agent writes data or sends content. Please confirm before executing.",
    };
  }

  return {
    tier: 1,
    label: TIER_LABELS[1],
    requiresConfirmation: false,
    description: "Read-only operation. Executes immediately.",
  };
}

/**
 * Build the confirmation response payload for Tier 2 agents.
 */
export function buildConfirmResponse(agentName: string, preview: Record<string, unknown>) {
  return {
    tier: "confirm" as const,
    label: TIER_LABELS[2],
    preview,
    confirmUrl: `/api/agents/${agentName}/confirm`,
    message: "Review the preview above and re-submit with { confirmed: true } to execute.",
  };
}

/**
 * Build the restricted response payload for Tier 3 agents.
 */
export function buildRestrictedResponse(agentName: string) {
  const tierInfo = getActionTier(agentName);
  return {
    tier: "restricted" as const,
    label: TIER_LABELS[3],
    reason: tierInfo.description,
    requiresAdmin: true,
    message: "Admin approval is required. Re-submit with { confirmed: true } after obtaining authorization.",
  };
}
