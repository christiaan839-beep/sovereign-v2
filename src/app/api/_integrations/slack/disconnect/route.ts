import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { oauthConnections } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("integrations:slack:disconnect");

/**
 * POST /api/_integrations/slack/disconnect
 *
 * Soft-revokes the caller's Slack OAuth connection by stamping
 * `revoked_at`. We keep the row for audit (who-connected-when +
 * which workspaces they added) but it stops being returned by
 * slackClient().
 *
 * We do NOT call Slack's apps.uninstall endpoint here — that's a
 * destructive action which would uninstall the bot for every other
 * user in the workspace. If the user wants to revoke the install,
 * they can do so from Slack directly (Settings → Manage apps).
 *
 * Why `revoked_at` instead of DELETE:
 *   - Audit retention (GDPR Art. 30 processing record)
 *   - Reconnect path can un-set `revoked_at` instead of inserting
 *   - Support can see "user disconnected at X" in incident triage
 */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const updated = await db
      .update(oauthConnections)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(oauthConnections.userId, user.id),
          eq(oauthConnections.provider, "slack"),
          isNull(oauthConnections.revokedAt),
        ),
      )
      .returning({ id: oauthConnections.id });

    if (updated.length === 0) {
      return NextResponse.json(
        { ok: true, alreadyDisconnected: true },
        { status: 200 },
      );
    }

    log.info("Slack connection revoked", { userId: user.id, count: updated.length });
    return NextResponse.json({ ok: true, revoked: updated.length });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // Table not migrated — nothing to disconnect; don't 500 the UI
      return NextResponse.json({ ok: true, alreadyDisconnected: true });
    }
    log.error("Slack disconnect failed", { error: (err as Error).message });
    return NextResponse.json({ error: "Disconnect failed" }, { status: 500 });
  }
}
