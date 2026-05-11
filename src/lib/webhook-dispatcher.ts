// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// generic webhook fanout; superseded by /api/_webhooks routes.
import { createLogger } from "@/lib/logger";

const log = createLogger("webhook-dispatcher");

/**
 * WEBHOOK DISPATCHER — Notify external systems when agents complete work.
 *
 * When a playbook finishes, a lead is found, or content is generated,
 * this system pushes the result to any configured webhook URL.
 *
 * Supports: Slack, Discord, Zapier, n8n, Make.com, custom URLs.
 * Every dispatch is logged for audit trail.
 */

export interface WebhookEvent {
  type: "playbook.completed" | "playbook.failed" | "lead.found" | "content.generated" | "agent.error" | "approval.required";
  data: Record<string, unknown>;
  timestamp: number;
  agentName?: string;
  tenantId?: string;
}

interface WebhookTarget {
  url: string;
  secret?: string; // HMAC signing secret
  events: WebhookEvent["type"][]; // Which events to receive
  active: boolean;
}

// In-memory webhook registry (production: DB table)
const webhookTargets: WebhookTarget[] = [];
const webhookHistory: Array<{ event: WebhookEvent; target: string; status: number; timestamp: number }> = [];
const MAX_HISTORY = 500;

/**
 * Register a webhook target
 */
export function registerWebhook(target: WebhookTarget): void {
  webhookTargets.push(target);
  log.info(`Webhook registered: ${target.url} for events: ${target.events.join(", ")}`);
}

/**
 * Dispatch an event to all registered webhooks that listen for it
 */
export async function dispatchWebhook(event: WebhookEvent): Promise<void> {
  const targets = webhookTargets.filter(
    t => t.active && t.events.includes(event.type)
  );

  if (targets.length === 0) return;

  const payload = JSON.stringify({
    event: event.type,
    data: event.data,
    timestamp: new Date(event.timestamp).toISOString(),
    agent: event.agentName,
    platform: "sovereign-matrix",
  });

  // Dispatch to all targets in parallel
  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "SovereignMatrix/2.0",
        "X-Webhook-Event": event.type,
      };

      // HMAC signature if secret is configured
      if (target.secret) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(target.secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
        headers["X-Webhook-Signature"] = Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");
      }

      const res = await fetch(target.url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      // Log dispatch
      webhookHistory.push({
        event,
        target: target.url,
        status: res.status,
        timestamp: Date.now(),
      });
      if (webhookHistory.length > MAX_HISTORY) {
        webhookHistory.splice(0, webhookHistory.length - MAX_HISTORY);
      }

      if (!res.ok) {
        log.warn(`Webhook failed: ${target.url} → ${res.status}`);
      }

      return { url: target.url, status: res.status };
    })
  );

  const succeeded = results.filter(r => r.status === "fulfilled").length;
  log.info(`Webhook dispatched: ${event.type} → ${succeeded}/${targets.length} targets`);
}

/**
 * Get recent webhook dispatch history
 */
export function getWebhookHistory(limit = 50) {
  return webhookHistory.slice(-limit).reverse();
}

/**
 * Get registered webhook targets
 */
export function getWebhookTargets() {
  return webhookTargets.map(t => ({
    url: t.url,
    events: t.events,
    active: t.active,
  }));
}

/**
 * Convenience dispatchers for common events
 */
export function notifyPlaybookComplete(playbookName: string, result: Record<string, unknown>, tenantId?: string) {
  return dispatchWebhook({
    type: "playbook.completed",
    data: { playbook: playbookName, ...result },
    timestamp: Date.now(),
    agentName: playbookName,
    tenantId,
  });
}

export function notifyLeadFound(lead: Record<string, unknown>, agentName: string, tenantId?: string) {
  return dispatchWebhook({
    type: "lead.found",
    data: lead,
    timestamp: Date.now(),
    agentName,
    tenantId,
  });
}

export function notifyContentGenerated(content: Record<string, unknown>, agentName: string, tenantId?: string) {
  return dispatchWebhook({
    type: "content.generated",
    data: content,
    timestamp: Date.now(),
    agentName,
    tenantId,
  });
}

export function notifyAgentError(error: string, agentName: string, tenantId?: string) {
  return dispatchWebhook({
    type: "agent.error",
    data: { error },
    timestamp: Date.now(),
    agentName,
    tenantId,
  });
}
