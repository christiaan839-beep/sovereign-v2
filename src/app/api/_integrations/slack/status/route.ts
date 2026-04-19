import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { oauthConnections } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * GET /api/_integrations/slack/status
 *
 * Returns a lightweight connection-state payload for the integrations
 * dashboard card. No secrets — only workspaceName + connectedAt so the
 * UI can render "Connected to Acme Workspace · 3d ago".
 *
 * Response:
 *   { connected: false, configurable: boolean }
 *   { connected: true, workspace: string, connectedAt: ISO, scopes: string[] }
 *
 * `configurable` is true if SLACK_CLIENT_ID is set — the UI uses this
 * to disable the "Connect" button when the integration isn't wired up
 * in this env (dev, preview).
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configurable = Boolean(process.env.SLACK_CLIENT_ID);

  try {
    const [row] = await db
      .select({
        workspaceName: oauthConnections.workspaceName,
        connectedAt: oauthConnections.installedAt,
        scopes: oauthConnections.scopes,
      })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.userId, user.id),
          eq(oauthConnections.provider, "slack"),
          isNull(oauthConnections.revokedAt),
        ),
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ connected: false, configurable });
    }

    return NextResponse.json({
      connected: true,
      configurable,
      workspace: row.workspaceName ?? "Slack Workspace",
      connectedAt: row.connectedAt?.toISOString() ?? null,
      scopes: row.scopes ?? [],
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // oauth_connections not migrated — treat as not-connected gracefully
      return NextResponse.json({ connected: false, configurable });
    }
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
