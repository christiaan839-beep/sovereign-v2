/**
 * SOVEREIGN TRUST LEVELS — Configurable agent autonomy.
 *
 * When frontier models like Mythos can chain vulnerabilities autonomously,
 * the execution environment needs graduated trust controls.
 *
 * Trust Level 1 (Supervised):   Every action requires human approval
 * Trust Level 2 (Guided):      Routine actions auto-execute, anomalous actions need approval
 * Trust Level 3 (Autonomous):  Auto-execute with full audit trail, alert on anomalies
 * Trust Level 4 (Full Auto):   Maximum autonomy — only critical alerts pause execution
 *
 * Default: Level 2 (Guided) — the "secure by default" middle ground.
 * Enterprise customers can configure per-agent trust levels.
 */

export type TrustLevel = 1 | 2 | 3 | 4;

export interface TrustConfig {
  level: TrustLevel;
  label: string;
  description: string;
  autoExecute: boolean;
  requireApproval: "all" | "anomalous" | "critical" | "none";
  auditLevel: "verbose" | "standard" | "minimal";
  alertOnNewDomain: boolean;
  alertOnDataExport: boolean;
  alertOnExternalApi: boolean;
  maxChainDepth: number; // How many agent handoffs before requiring approval
}

export const TRUST_LEVELS: Record<TrustLevel, TrustConfig> = {
  1: {
    level: 1,
    label: "Supervised",
    description: "Every action requires human approval before execution.",
    autoExecute: false,
    requireApproval: "all",
    auditLevel: "verbose",
    alertOnNewDomain: true,
    alertOnDataExport: true,
    alertOnExternalApi: true,
    maxChainDepth: 1,
  },
  2: {
    level: 2,
    label: "Guided",
    description: "Routine pre-approved actions execute automatically. Anomalous actions require approval.",
    autoExecute: true,
    requireApproval: "anomalous",
    auditLevel: "standard",
    alertOnNewDomain: true,
    alertOnDataExport: true,
    alertOnExternalApi: true,
    maxChainDepth: 3,
  },
  3: {
    level: 3,
    label: "Autonomous",
    description: "Auto-execute with full audit trail. Only critical operations pause for approval.",
    autoExecute: true,
    requireApproval: "critical",
    auditLevel: "standard",
    alertOnNewDomain: false,
    alertOnDataExport: true,
    alertOnExternalApi: false,
    maxChainDepth: 5,
  },
  4: {
    level: 4,
    label: "Full Auto",
    description: "Maximum autonomy. Minimal interruptions. Full audit trail retained.",
    autoExecute: true,
    requireApproval: "none",
    auditLevel: "minimal",
    alertOnNewDomain: false,
    alertOnDataExport: false,
    alertOnExternalApi: false,
    maxChainDepth: 10,
  },
};

export const DEFAULT_TRUST_LEVEL: TrustLevel = 2;

/**
 * Determines if an action needs human approval based on trust level.
 */
export function needsApproval(
  trustLevel: TrustLevel,
  action: { isAnomalous?: boolean; isCritical?: boolean; chainDepth?: number }
): boolean {
  const config = TRUST_LEVELS[trustLevel];

  // Check chain depth limit
  if (action.chainDepth && action.chainDepth > config.maxChainDepth) return true;

  switch (config.requireApproval) {
    case "all": return true;
    case "anomalous": return action.isAnomalous || action.isCritical || false;
    case "critical": return action.isCritical || false;
    case "none": return false;
  }
}

/**
 * Classifies an action as anomalous based on heuristics.
 * Used by the HITL approval queue to decide what to surface.
 */
export function classifyAction(action: {
  targetDomain?: string;
  exportsData?: boolean;
  callsExternalApi?: boolean;
  modifiesUserData?: boolean;
  chainDepth?: number;
}): { isAnomalous: boolean; isCritical: boolean; reason?: string } {
  // Critical: data export + external API = potential exfiltration
  if (action.exportsData && action.callsExternalApi) {
    return { isAnomalous: true, isCritical: true, reason: "Data export to external API detected" };
  }

  // Anomalous: modifying user data without explicit instruction
  if (action.modifiesUserData) {
    return { isAnomalous: true, isCritical: false, reason: "Agent modifying user data" };
  }

  // Anomalous: deep chain (many agent handoffs)
  if (action.chainDepth && action.chainDepth > 3) {
    return { isAnomalous: true, isCritical: false, reason: `Deep chain: ${action.chainDepth} handoffs` };
  }

  return { isAnomalous: false, isCritical: false };
}
