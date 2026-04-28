import { createLogger } from "@/lib/logger";
import { safeFetch, SsrfBlockedError } from "@/lib/safe-fetch";
import { checkUrlForSsrf } from "@/lib/ssrf-guard";

const log = createLogger("webhook-dispatcher");

/**
 * WEBHOOK DISPATCHER — Notify external systems when agents complete work.
 *
 * When a playbook finishes, a lead is found, or content is generated,
 * this system pushes the result to any configured webhook URL.
 *
 * Supports: Slack, Discord, Zapier, n8n, Make.com, custom URLs.
 * Every dispatch is logged for audit trail.
 *
 * Round 25 — every outbound HTTP call goes through `safeFetch`, which
 * runs the SSRF guard on the initial URL AND on every redirect target.
 * Without that, an attacker registers a webhook target pointing at
 * 169.254.169.254 (AWS IMDS) and we leak IAM credentials on every
 * event. Registration ALSO refuses unsafe URLs up-front so the bad
 * target never lands in the registry.
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
 * Register a webhook target.
 *
 * Round 25 — refuses unsafe URLs at registration time. Without this
 * gate, a hostile target lands in the registry and gets fetched on
 * every matching event. The dispatch path also re-checks (defense
 * in depth via safeFetch), but the cleanest defense is to reject
 * before persistence. Returns false on rejection so callers can
 * surface a 400 to the user.
 */
export function registerWebhook(target: WebhookTarget): boolean {
  const check = checkUrlForSsrf(target.url);
  if (!check.safe) {
    log.warn("Webhook registration refused (SSRF)", {
      url: target.url,
      category: check.category,
      reason: check.reason,
    });
    return false;
  }
  webhookTargets.push(target);
  log.info(`Webhook registered: ${target.url} for events: ${target.events.join(", ")}`);
  return true;
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

      // safeFetch enforces SSRF on the initial URL AND on every
      // redirect hop. maxRedirects: 0 because a webhook target
      // shouldn't be redirecting at all — if it does, we treat it
      // as suspicious rather than chase it. timeoutMs: 10s.
      let status = 0;
      try {
        const res = await safeFetch(target.url, {
          method: "POST",
          headers,
          body: payload,
          maxRedirects: 0,
          timeoutMs: 10_000,
        });
        status = res.status;
      } catch (err) {
        // SSRF rejections become explicit log lines so a regression
        // in the registry-time gate (a stale row created before R25)
        // doesn't fail silently.
        if (err instanceof SsrfBlockedError) {
          log.error("Webhook dispatch blocked (SSRF)", {
            url: target.url,
            reason: err.message,
          });
          status = 0;
        } else {
          log.warn("Webhook dispatch failed", {
            url: target.url,
            error: err instanceof Error ? err.message : String(err),
          });
          status = 0;
        }
      }

      // Log dispatch
      webhookHistory.push({
        event,
        target: target.url,
        status,
        timestamp: Date.now(),
      });
      if (webhookHistory.length > MAX_HISTORY) {
        webhookHistory.splice(0, webhookHistory.length - MAX_HISTORY);
      }

      if (status === 0 || (status >= 400)) {
        log.warn(`Webhook failed: ${target.url} → ${status}`);
      }

      return { url: target.url, status };
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
