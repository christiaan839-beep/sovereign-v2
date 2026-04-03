import { createLogger } from "./logger";
import { addNotification } from "./notifications";

const log = createLogger("approval-gate");

export type ApprovalAction = "send_email" | "make_call" | "deploy_code" | "spend_money" | "delete_data";

export interface ApprovalRequest {
  id: string;
  action: ApprovalAction;
  description: string;
  agentName: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const _STORAGE_KEY = "sovereign_approvals";

/**
 * Check if an action requires human approval.
 * High-risk actions (sending emails to 50+ people, making calls, deploying code)
 * are paused until the user explicitly approves.
 */
export function requiresApproval(action: ApprovalAction, context?: Record<string, unknown>): boolean {
  const rules: Record<ApprovalAction, (ctx?: Record<string, unknown>) => boolean> = {
    send_email: (ctx) => (ctx?.recipientCount as number || 0) > 10,
    make_call: () => true, // Always require approval for calls
    deploy_code: () => true, // Always require approval for deployments
    spend_money: (ctx) => (ctx?.amount as number || 0) > 100,
    delete_data: () => true, // Always require approval for deletions
  };

  return rules[action]?.(context) ?? false;
}

/**
 * Create a pending approval request.
 * Returns the approval ID. The agent should pause and wait for approval.
 */
export function createApprovalRequest(
  action: ApprovalAction,
  description: string,
  agentName: string,
  payload: Record<string, unknown>
): ApprovalRequest {
  const request: ApprovalRequest = {
    id: `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    description,
    agentName,
    payload,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  // Notify user
  addNotification({
    type: "usage_warning",
    title: `Approval needed: ${agentName}`,
    body: description,
    href: "/dashboard/approvals",
  });

  log.info("Approval request created", { id: request.id, action, agent: agentName });
  return request;
}

export function getApprovalRules(): Array<{ action: ApprovalAction; rule: string }> {
  return [
    { action: "send_email", rule: "Emails to more than 10 recipients" },
    { action: "make_call", rule: "All outbound voice calls" },
    { action: "deploy_code", rule: "All code deployments" },
    { action: "spend_money", rule: "Transactions over R100" },
    { action: "delete_data", rule: "All data deletions" },
  ];
}
