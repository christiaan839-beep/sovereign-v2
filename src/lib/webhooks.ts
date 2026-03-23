/**
 * Webhook Execution Engine
 * 
 * Fires real HTTP requests to external services when SOVEREIGN events occur.
 */

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

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
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "umbra.agent.completed",
        timestamp: new Date().toISOString(),
        userEmail: user.primaryEmailAddress.emailAddress,
        data: { agent, task, payload }
      })
    }).catch(e => console.error("[Webhook Error]:", e));

    return true;
  } catch (err) {
    console.error("[Webhook Exception]:", err);
    return false;
  }
}

// In a real production app, this would be fetched from a database (Supabase/Postgres).
// For now, we simulate the active webhooks that a user configured in the dashboard.
const MOCK_DB_WEBHOOKS = [
  { id: "wh_1", trigger: "hot_lead", url: "https://echo.free.beeceptor.com", active: true },
  { id: "wh_2", trigger: "campaign_kill", url: "https://echo.free.beeceptor.com", active: true },
];

export async function triggerWebhook(event: "hot_lead" | "new_sale" | "campaign_kill" | "report_ready", data: Record<string, unknown>) {
  const activeHooks = MOCK_DB_WEBHOOKS.filter(h => h.trigger === event && h.active);
  
  if (activeHooks.length === 0) return { delivered: 0, failed: 0 };

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString()
  };

  let delivered = 0;
  let failed = 0;

  // Fire all webhooks in parallel
  await Promise.allSettled(
    activeHooks.map(async (hook) => {
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "SOVEREIGN-Webhook-Engine/1.0",
            "X-SOVEREIGN-Event": event
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) delivered++;
        else failed++;
      } catch (e) {
        failed++;
        console.error(`[Webhook Failed] URL: ${hook.url}`, e);
      }
    })
  );

  return { delivered, failed, totalExpected: activeHooks.length };
}
