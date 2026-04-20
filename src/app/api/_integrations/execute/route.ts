import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { executeConnector, getAvailableConnectors } from "@/lib/integrations/connector";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeDecrypt } from "@/lib/crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("integration-execute");

/**
 * INTEGRATION CONNECTOR EXECUTOR — /api/_integrations/execute
 *
 * Executes an action on an external service via the connector framework.
 * Auth tokens are resolved from the user's encrypted settings.
 *
 * POST body:
 *   { integrationId: "hubspot", actionId: "list-contacts", params: { limit: 10 } }
 */

export async function GET() {
  return NextResponse.json({
    available: getAvailableConnectors(),
    usage: "POST { integrationId, actionId, params }",
  });
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { integrationId, actionId, params = {} } = body;

    if (!integrationId || !actionId) {
      return NextResponse.json(
        { error: "integrationId and actionId are required", available: getAvailableConnectors() },
        { status: 400 }
      );
    }

    // Resolve auth token from user settings
    let token = "";
    try {
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userEmail, userId),
      });
      if (userSettings?.apiKeys) {
        const keys = JSON.parse(safeDecrypt(userSettings.apiKeys));
        // Look for integration-specific key (e.g., "hubspot_token", "slack_token")
        token = keys[`${integrationId}_token`] || keys[`${integrationId}_api_key`] || "";
      }
    } catch {
      log.warn("Failed to resolve integration token from settings", { userId, integrationId });
    }

    // Fall back to environment variable
    if (!token) {
      const envKeyMap: Record<string, string> = {
        hubspot: "HUBSPOT_ACCESS_TOKEN",
        slack: "SLACK_BOT_TOKEN",
        "google-sheets": "GOOGLE_SHEETS_API_KEY",
        gmail: "GMAIL_ACCESS_TOKEN",
        webhook: "", // No auth needed for generic webhooks
      };
      const envKey = envKeyMap[integrationId];
      if (envKey) token = process.env[envKey] || "";
    }

    const result = await executeConnector({
      integrationId,
      actionId,
      params,
      auth: { type: "bearer", token },
    });

    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (err) {
    log.error("Integration execution error", { error: (err as Error).message });
    return NextResponse.json({ error: "Integration execution failed" }, { status: 500 });
  }
}
