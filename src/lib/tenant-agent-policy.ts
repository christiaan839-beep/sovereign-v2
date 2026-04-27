/**
 * TENANT AGENT POLICY — per-tenant allow/deny rules over the 223 agents.
 *
 * Some tenants don't want every agent. Healthcare tenants want PII
 * agents disabled. Finance tenants want browser-control agents
 * disabled. Compliance teams want only Tier 1 (autonomous) agents
 * available to staff.
 *
 * This module is the policy LIBRARY (pure-function evaluator).
 * Storage + admin UI for these policies is the next sprint; for now
 * policies are programmatic — read from env or per-tenant config.
 *
 * The factory hook (added in agent-factory.ts when wired) calls
 * `evaluateTenantPolicy()` BEFORE any other gate. If denied, return
 * a 403 with the reason.
 *
 * SHAPE
 *   {
 *     mode: "allow-list" | "deny-list" | "allow-all",
 *     // For allow-list: only these slugs OR these tiers/capabilities are usable.
 *     // For deny-list: everything except these slugs is usable.
 *     allowedSlugs?: string[],
 *     deniedSlugs?: string[],
 *     maxTier?: 1 | 2 | 3,                    // hard cap
 *     forbidCapabilities?: string[],          // e.g. ["browser_control", "voice_call"]
 *     forbidProviders?: string[],             // e.g. ["openai"] (we only want Anthropic + NIM)
 *     forbidOutputClass?: ("public" | "tenant-private" | "confidential")[],
 *   }
 *
 * Default (no policy): allow-all.
 */

import type { AgentManifest, AgentTier } from "./agent-manifest";

export interface TenantAgentPolicy {
  mode: "allow-list" | "deny-list" | "allow-all";
  allowedSlugs?: string[];
  deniedSlugs?: string[];
  maxTier?: AgentTier;
  forbidCapabilities?: string[];
  forbidProviders?: string[];
  forbidOutputClass?: AgentManifest["outputClass"][];
}

export interface PolicyVerdict {
  allowed: boolean;
  reason?: string;
  rule?: string;
}

const ALLOW_ALL: PolicyVerdict = { allowed: true };

/**
 * Pure function — given a manifest + a tenant policy, decide whether
 * the agent is usable for this tenant.
 *
 * NEVER throws. Null/undefined policy = allow-all (fail-open for
 * backward-compat with tenants who don't have a policy yet).
 *
 * Evaluation order:
 *   1. If policy is null/undefined → allow-all.
 *   2. Hard caps (maxTier / forbidCapabilities / forbidProviders /
 *      forbidOutputClass) apply REGARDLESS of mode — including
 *      "allow-all". A tenant whose only configured setting is
 *      `forbidProviders: ["openai"]` still gets that enforced.
 *   3. Mode-specific allow/deny list rules apply on top of the caps.
 */
export function evaluateTenantPolicy(
  manifest: AgentManifest,
  policy: TenantAgentPolicy | null | undefined,
): PolicyVerdict {
  if (!policy) return ALLOW_ALL;

  // Hard tier cap — applies to all modes including allow-all.
  if (policy.maxTier !== undefined && manifest.tier > policy.maxTier) {
    return {
      allowed: false,
      reason: `Agent tier ${manifest.tier} exceeds tenant cap of ${policy.maxTier}`,
      rule: "max_tier",
    };
  }

  // Forbidden capabilities (signal kinds — e.g. "browser_control").
  if (policy.forbidCapabilities && policy.forbidCapabilities.length > 0) {
    const agentKinds = new Set(manifest.signals.map((s) => s.kind));
    const violation = policy.forbidCapabilities.find((c) => agentKinds.has(c as never));
    if (violation) {
      return {
        allowed: false,
        reason: `Agent uses forbidden capability: ${violation}`,
        rule: "forbid_capability",
      };
    }
  }

  // Forbidden providers.
  if (policy.forbidProviders && policy.forbidProviders.length > 0) {
    const agentProviders = new Set(manifest.models.map((m) => m.provider));
    const violation = policy.forbidProviders.find((p) => agentProviders.has(p as never));
    if (violation) {
      return {
        allowed: false,
        reason: `Agent uses forbidden provider: ${violation}`,
        rule: "forbid_provider",
      };
    }
  }

  // Forbidden output classes.
  if (policy.forbidOutputClass?.includes(manifest.outputClass)) {
    return {
      allowed: false,
      reason: `Agent outputClass "${manifest.outputClass}" is forbidden for this tenant`,
      rule: "forbid_output_class",
    };
  }

  // Mode-specific rules.
  if (policy.mode === "allow-list") {
    if (!policy.allowedSlugs?.includes(manifest.slug)) {
      return {
        allowed: false,
        reason: `Agent "${manifest.slug}" is not in the tenant's allow-list`,
        rule: "not_in_allowlist",
      };
    }
  } else if (policy.mode === "deny-list") {
    if (policy.deniedSlugs?.includes(manifest.slug)) {
      return {
        allowed: false,
        reason: `Agent "${manifest.slug}" is in the tenant's deny-list`,
        rule: "in_denylist",
      };
    }
  }

  return ALLOW_ALL;
}

/**
 * Convenience: build a healthcare-friendly policy (block PII-heavy
 * agents + browser control + Tier 3). Used as a starting template
 * in tenant-onboarding flows.
 */
export function healthcareTemplate(): TenantAgentPolicy {
  return {
    mode: "deny-list",
    maxTier: 2,
    forbidCapabilities: ["browser_control", "voice_call"],
    forbidOutputClass: ["public"], // healthcare tenants don't publish externally
  };
}

/**
 * Convenience: finance-friendly template — block external network egress
 * + payment_op + browser control. Tighter than healthcare.
 */
export function financeTemplate(): TenantAgentPolicy {
  return {
    mode: "deny-list",
    maxTier: 1,
    forbidCapabilities: [
      "browser_control",
      "voice_call",
      "external_fetch",
      "payment_op",
    ],
  };
}
