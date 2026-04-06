/**
 * SOVEREIGN MATRIX — Deterministic Policy Engine
 *
 * Evaluates security/governance policies before every agent action.
 * Policies define what agents CAN and CANNOT do.
 *
 * Features:
 * - JSON policy definitions (hot-reloadable from DB or config)
 * - Pre-action evaluation with block/allow/warn outcomes
 * - Violations logged to audit trail
 * - Per-agent, per-role, and global policy scoping
 *
 * Policy format:
 *   {
 *     id: "no-db-writes",
 *     name: "Block database writes",
 *     scope: { agents: ["*"], roles: ["viewer", "member"] },
 *     rules: [
 *       { action: "db.write", effect: "deny", reason: "Read-only access" },
 *       { action: "db.read", effect: "allow" }
 *     ]
 *   }
 *
 * Usage:
 *   const result = evaluatePolicy("leads", "api.call", { userId, role: "member" });
 *   if (!result.allowed) return error(result.reason);
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("policy-engine");

// ── Types ──

export type PolicyEffect = "allow" | "deny" | "warn";

export interface PolicyRule {
  /** Action pattern — supports wildcards: "api.*", "db.write", "email.send" */
  action: string;
  /** Effect when this rule matches */
  effect: PolicyEffect;
  /** Human-readable reason (shown in denial messages) */
  reason?: string;
  /** Optional conditions */
  conditions?: {
    /** Max executions per hour for this action */
    maxPerHour?: number;
    /** Max token spend per call */
    maxTokens?: number;
    /** Require human approval */
    requireApproval?: boolean;
    /** Time-of-day restrictions (24h format) */
    allowedHours?: { start: number; end: number };
  };
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number; // Higher = evaluated first
  scope: {
    /** Agent names this policy applies to ("*" = all) */
    agents: string[];
    /** User roles this applies to ("*" = all) */
    roles: string[];
    /** Specific user IDs (optional) */
    userIds?: string[];
  };
  rules: PolicyRule[];
}

export interface PolicyResult {
  allowed: boolean;
  effect: PolicyEffect;
  policyId: string | null;
  ruleName: string | null;
  reason: string;
  requiresApproval: boolean;
}

// ── Policy Registry (in-memory, hot-reloadable) ──

let policies: Policy[] = getDefaultPolicies();

function getDefaultPolicies(): Policy[] {
  return [
    {
      id: "global-safety",
      name: "Global Safety Defaults",
      enabled: true,
      priority: 100,
      scope: { agents: ["*"], roles: ["*"] },
      rules: [
        { action: "db.delete", effect: "deny", reason: "Database deletion is restricted" },
        { action: "db.drop", effect: "deny", reason: "Schema changes are restricted" },
        { action: "email.send_bulk", effect: "deny", reason: "Bulk email requires admin approval", conditions: { requireApproval: true } },
        { action: "payment.*", effect: "warn", reason: "Payment actions are logged", conditions: { requireApproval: true } },
        { action: "agent.execute", effect: "allow" },
        { action: "api.call", effect: "allow", conditions: { maxPerHour: 1000 } },
      ],
    },
    {
      id: "viewer-restrictions",
      name: "Viewer Role Restrictions",
      enabled: true,
      priority: 90,
      scope: { agents: ["*"], roles: ["viewer"] },
      rules: [
        { action: "agent.execute", effect: "deny", reason: "Viewers cannot execute agents" },
        { action: "workflow.modify", effect: "deny", reason: "Viewers cannot modify workflows" },
        { action: "settings.*", effect: "deny", reason: "Viewers cannot change settings" },
      ],
    },
    {
      id: "rate-limits",
      name: "Agent Rate Limits",
      enabled: true,
      priority: 80,
      scope: { agents: ["*"], roles: ["*"] },
      rules: [
        { action: "agent.execute", effect: "allow", conditions: { maxPerHour: 200 } },
        { action: "api.external", effect: "allow", conditions: { maxPerHour: 500 } },
      ],
    },
  ];
}

// ── Rate Tracking (per-user, per-action) ──

const rateCounters = new Map<string, { count: number; resetAt: number }>();

function checkRate(key: string, maxPerHour: number): boolean {
  const now = Date.now();
  const counter = rateCounters.get(key);

  if (counter && counter.resetAt > now) {
    if (counter.count >= maxPerHour) return false;
    counter.count++;
    return true;
  }

  rateCounters.set(key, { count: 1, resetAt: now + 3600_000 });
  return true;
}

// ── Wildcard Matching ──

function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  if (pattern === value) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return value.startsWith(prefix);
  }
  return false;
}

// ── Main Evaluation ──

/**
 * Evaluate policies for an agent action.
 * Call this BEFORE every agent execution.
 */
export function evaluatePolicy(
  agentName: string,
  action: string,
  context: { userId: string; role?: string }
): PolicyResult {
  const role = context.role || "member";

  // Sort by priority (highest first)
  const sorted = [...policies].filter(p => p.enabled).sort((a, b) => b.priority - a.priority);

  for (const policy of sorted) {
    // Check scope
    const agentMatch = policy.scope.agents.some(a => matchesPattern(a, agentName));
    const roleMatch = policy.scope.roles.some(r => matchesPattern(r, role));
    const userMatch = !policy.scope.userIds || policy.scope.userIds.includes(context.userId);

    if (!agentMatch || !roleMatch || !userMatch) continue;

    // Evaluate rules
    for (const rule of policy.rules) {
      if (!matchesPattern(rule.action, action)) continue;

      // Check conditions
      if (rule.conditions?.maxPerHour) {
        const rateKey = `${context.userId}:${action}`;
        if (!checkRate(rateKey, rule.conditions.maxPerHour)) {
          log.warn("Policy rate limit hit", { policy: policy.id, action, userId: context.userId });
          return {
            allowed: false,
            effect: "deny",
            policyId: policy.id,
            ruleName: rule.action,
            reason: `Rate limit exceeded: max ${rule.conditions.maxPerHour}/hour for ${action}`,
            requiresApproval: false,
          };
        }
      }

      if (rule.conditions?.allowedHours) {
        const hour = new Date().getHours();
        if (hour < rule.conditions.allowedHours.start || hour >= rule.conditions.allowedHours.end) {
          return {
            allowed: false,
            effect: "deny",
            policyId: policy.id,
            ruleName: rule.action,
            reason: `Action only allowed between ${rule.conditions.allowedHours.start}:00 and ${rule.conditions.allowedHours.end}:00`,
            requiresApproval: false,
          };
        }
      }

      // Apply effect
      if (rule.effect === "deny") {
        log.warn("Policy denied action", { policy: policy.id, action, agent: agentName, reason: rule.reason });
        return {
          allowed: false,
          effect: "deny",
          policyId: policy.id,
          ruleName: rule.action,
          reason: rule.reason || `Denied by policy: ${policy.name}`,
          requiresApproval: false,
        };
      }

      if (rule.effect === "warn") {
        log.info("Policy warning", { policy: policy.id, action, agent: agentName });
        return {
          allowed: true,
          effect: "warn",
          policyId: policy.id,
          ruleName: rule.action,
          reason: rule.reason || `Warning from policy: ${policy.name}`,
          requiresApproval: rule.conditions?.requireApproval || false,
        };
      }

      // Allow
      return {
        allowed: true,
        effect: "allow",
        policyId: policy.id,
        ruleName: rule.action,
        reason: "",
        requiresApproval: rule.conditions?.requireApproval || false,
      };
    }
  }

  // Default: allow (no matching policy)
  return { allowed: true, effect: "allow", policyId: null, ruleName: null, reason: "", requiresApproval: false };
}

// ── Policy Management ──

/** Load custom policies (replaces defaults) */
export function loadPolicies(newPolicies: Policy[]): void {
  policies = [...getDefaultPolicies(), ...newPolicies];
  log.info("Policies reloaded", { total: policies.length });
}

/** Add a single policy */
export function addPolicy(policy: Policy): void {
  policies.push(policy);
  log.info("Policy added", { id: policy.id });
}

/** Remove a policy by ID */
export function removePolicy(id: string): boolean {
  const before = policies.length;
  policies = policies.filter(p => p.id !== id);
  return policies.length < before;
}

/** List all active policies */
export function listPolicies(): Policy[] {
  return [...policies];
}

/** Get a specific policy */
export function getPolicy(id: string): Policy | undefined {
  return policies.find(p => p.id === id);
}
