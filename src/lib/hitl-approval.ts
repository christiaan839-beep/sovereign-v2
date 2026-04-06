/**
 * SOVEREIGN MATRIX — Human-in-the-Loop (HITL) Approval System
 *
 * Pauses agent execution for human approval on high-stakes actions.
 * Integrates with Slack/email notifications and the policy engine.
 *
 * Flow:
 *   1. Agent triggers an action marked "requireApproval" by policy
 *   2. System creates a pending approval request
 *   3. User is notified (Slack/email/dashboard)
 *   4. User approves, denies, or it times out (auto-deny)
 *   5. Agent resumes or aborts based on decision
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("hitl-approval");

// ── Types ──

export type ApprovalStatus = "pending" | "approved" | "denied" | "timeout";

export interface ApprovalRequest {
  id: string;
  userId: string;
  agentName: string;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
  expiresAt: number;
}

// ── In-Memory Approval Queue ──

const approvalQueue = new Map<string, ApprovalRequest>();
const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes default

// ── Create Approval Request ──

/**
 * Create a pending approval request and notify the user.
 * Returns the approval ID for polling.
 */
export async function requestApproval(options: {
  userId: string;
  agentName: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<string> {
  const id = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timeoutMs = options.timeoutMs || APPROVAL_TIMEOUT_MS;

  const request: ApprovalRequest = {
    id,
    userId: options.userId,
    agentName: options.agentName,
    action: options.action,
    description: options.description,
    metadata: options.metadata || {},
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + timeoutMs,
  };

  approvalQueue.set(id, request);
  log.info("Approval requested", { id, agent: options.agentName, action: options.action });

  // Notify via Slack if configured
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*Approval Required* — Agent \`${options.agentName}\` wants to: ${options.description}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Approval Required*\nAgent \`${options.agentName}\` wants to perform: *${options.action}*\n\n${options.description}\n\n_Expires in ${Math.round(timeoutMs / 60_000)} minutes_`,
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }

  return id;
}

// ── Approve/Deny ──

/**
 * Approve a pending request.
 */
export function approveRequest(id: string, decidedBy: string): boolean {
  const req = approvalQueue.get(id);
  if (!req || req.status !== "pending") return false;

  req.status = "approved";
  req.decidedAt = Date.now();
  req.decidedBy = decidedBy;
  log.info("Approval granted", { id, decidedBy });
  return true;
}

/**
 * Deny a pending request.
 */
export function denyRequest(id: string, decidedBy: string): boolean {
  const req = approvalQueue.get(id);
  if (!req || req.status !== "pending") return false;

  req.status = "denied";
  req.decidedAt = Date.now();
  req.decidedBy = decidedBy;
  log.info("Approval denied", { id, decidedBy });
  return true;
}

// ── Poll / Wait ──

/**
 * Wait for an approval decision. Polls every 2 seconds.
 * Returns the final status after decision or timeout.
 */
export async function waitForApproval(id: string): Promise<ApprovalStatus> {
  const pollInterval = 2000;
  const maxPolls = 300; // 10 minutes at 2s intervals

  for (let i = 0; i < maxPolls; i++) {
    const req = approvalQueue.get(id);
    if (!req) return "denied";

    // Check timeout
    if (Date.now() >= req.expiresAt && req.status === "pending") {
      req.status = "timeout";
      log.warn("Approval timed out", { id });
      return "timeout";
    }

    if (req.status !== "pending") return req.status;

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return "timeout";
}

// ── Query ──

/**
 * Get all pending approvals for a user.
 */
export function getPendingApprovals(userId: string): ApprovalRequest[] {
  const now = Date.now();
  const pending: ApprovalRequest[] = [];

  for (const req of approvalQueue.values()) {
    if (req.userId === userId && req.status === "pending") {
      if (now >= req.expiresAt) {
        req.status = "timeout";
      } else {
        pending.push(req);
      }
    }
  }

  return pending;
}

/**
 * Get approval history for a user.
 */
export function getApprovalHistory(userId: string, limit: number = 20): ApprovalRequest[] {
  return [...approvalQueue.values()]
    .filter(req => req.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

/**
 * Get a specific approval request.
 */
export function getApproval(id: string): ApprovalRequest | undefined {
  return approvalQueue.get(id);
}

// ── Cleanup ──

/** Prune old approval requests (older than 24h) */
export function pruneApprovals(): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let pruned = 0;
  for (const [id, req] of approvalQueue) {
    if (req.createdAt < cutoff) {
      approvalQueue.delete(id);
      pruned++;
    }
  }
  return pruned;
}
