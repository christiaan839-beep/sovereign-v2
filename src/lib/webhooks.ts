/**
 * Webhook Execution Engine
 * 
 * Fires real HTTP requests to external services when SOVEREIGN events occur.
 */

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { outboundFetch } from "@/lib/outbound-fetch";

const log = createLogger("webhooks");

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export async function fireUserWebhook(agent: string, task: string, payload: unknown) {
  try {
    const user = await currentUser();
    if (!user?.primaryEmailAddress?.emailAddress) return false;

    const userSettings = await db.query.settings.findFirst({
      where: eq(settings.userEmail, user.primaryEmailAddress.emailAddress)
    });

    if (!userSettings?.webhooks) return false;

    const webhooks = JSON.parse(userSettings.webhooks);
    const webhookUrl = webhooks.onComplete;

    if (!webhookUrl || !webhookUrl.startsWith("http")) return false;

    // Fire and forget
    outboundFetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "umbra.agent.completed",
        timestamp: new Date().toISOString(),
        userEmail: user.primaryEmailAddress.emailAddress,
        data: { agent, task, payload }
      })
    }, {
      ruleId: "agent.webhook",
      userId: user.primaryEmailAddress.emailAddress
    }).catch(e => log.error("Webhook delivery error:", e));

    return true;
  } catch (err) {
    log.error("Webhook exception:", err as Record<string, unknown>);
    return false;
  }
}

/**
 * Trigger webhooks for a specific event.
 * Reads webhook configurations from the user's settings in the database.
 */
async function getWebhooksFromDB(event: string): Promise<Array<{ url: string; trigger: string }>> {
  try {
    const user = await currentUser();
    if (!user?.primaryEmailAddress?.emailAddress) return [];
    const userSettings = await db.query.settings.findFirst({
      where: eq(settings.userEmail, user.primaryEmailAddress.emailAddress),
    });
    if (!userSettings?.webhooks) return [];
    const webhooks = JSON.parse(userSettings.webhooks);
    // Support both single webhook URL and array of webhook configs
    if (typeof webhooks === "string" && webhooks.startsWith("http")) {
      return [{ url: webhooks, trigger: event }];
    }
    if (webhooks.onComplete && event) {
      return [{ url: webhooks.onComplete, trigger: event }];
    }
    if (Array.isArray(webhooks)) {
      return webhooks.filter((h: { trigger: string; active?: boolean }) => h.trigger === event && h.active !== false);
    }
    return [];
  } catch {
    return [];
  }
}

export async function triggerWebhook(event: "hot_lead" | "new_sale" | "campaign_kill" | "report_ready", data: Record<string, unknown>) {
  const activeHooks = await getWebhooksFromDB(event);
  
  if (activeHooks.length === 0) return { delivered: 0, failed: 0 };

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString()
  };

  let delivered = 0;
  let failed = 0;

  // Fire all webhooks in parallel
  const user = await currentUser();
  await Promise.allSettled(
    activeHooks.map(async (hook) => {
      try {
        const res = await outboundFetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "SOVEREIGN-Webhook-Engine/1.0",
            "X-SOVEREIGN-Event": event
          },
          body: JSON.stringify(payload)
        }, {
          ruleId: "agent.webhook",
          userId: user?.primaryEmailAddress?.emailAddress || "system"
        });

        if (res.ok) delivered++;
        else failed++;
      } catch (e) {
        failed++;
        log.error(`Webhook failed for URL: ${hook.url}`, e as Record<string, unknown>);
      }
    })
  );

  return { delivered, failed, totalExpected: activeHooks.length };
}
