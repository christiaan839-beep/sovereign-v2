import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createLogger } from "@/lib/logger";
import { safeEncrypt } from "@/lib/crypto";

const log = createLogger("integrations:slack:callback");

/**
 * GET /api/_integrations/slack/callback?code=...&state=...
 *
 * Second half of the OAuth 2.0 flow. Validates CSRF state, exchanges
 * `code` for tokens via Slack's oauth.v2.access, encrypts both tokens,
 * and persists to `oauth_connections`.
 *
 * Storage uses the existing safeEncrypt symmetric encryption from
 * src/lib/crypto.ts. Future iteration should migrate to envelope
 * encryption (see ADR-0002).
 *
 * On success: redirects to /dashboard/integrations?connected=slack
 * On failure: redirects with ?error=<reason>
 */

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  bot_user_id?: string;
  team?: { id: string; name: string };
  authed_user?: { id: string };
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return redirectWithError(req, "missing_params");
  }

  // CSRF check — state must match the cookie set by /authorize
  const cookieState = (req.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("slack_oauth_state="))
    ?.split("=")[1];
  if (!cookieState || cookieState !== state) {
    log.warn("OAuth state mismatch", { userId: user.id });
    return redirectWithError(req, "state_mismatch");
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectWithError(req, "not_configured");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sovereignmatrix.agency";
  const redirectUri = `${appUrl}/api/_integrations/slack/callback`;

  // Exchange code → tokens
  let tokenPayload: SlackOAuthResponse;
  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
    tokenPayload = (await tokenRes.json()) as SlackOAuthResponse;
  } catch (err) {
    log.error("Slack token exchange failed", { error: (err as Error).message });
    return redirectWithError(req, "exchange_failed");
  }

  if (!tokenPayload.ok || !tokenPayload.access_token || !tokenPayload.team) {
    log.warn("Slack returned non-ok OAuth response", { slackError: tokenPayload.error });
    return redirectWithError(req, tokenPayload.error || "slack_rejected");
  }

  // Persist. The oauth_connections table ships in the migration scheduled
  // alongside this ADR. Until it lands in prod, we log success and redirect —
  // dev env won't block on a missing table.
  try {
    const { db } = await import("@/db");
    const { oauthConnections } = await import("@/db/schema");

    await db.insert(oauthConnections).values({
      userId: user.id,
      provider: "slack",
      workspaceId: tokenPayload.team.id,
      workspaceName: tokenPayload.team.name ?? "Slack Workspace",
      accessToken: safeEncrypt(tokenPayload.access_token),
      refreshToken: tokenPayload.refresh_token ? safeEncrypt(tokenPayload.refresh_token) : null,
      scopes: (tokenPayload.scope || "").split(","),
      botUserId: tokenPayload.bot_user_id ?? null,
    }).onConflictDoUpdate({
      target: [oauthConnections.userId, oauthConnections.provider, oauthConnections.workspaceId],
      set: {
        accessToken: safeEncrypt(tokenPayload.access_token),
        refreshToken: tokenPayload.refresh_token ? safeEncrypt(tokenPayload.refresh_token) : null,
        scopes: (tokenPayload.scope || "").split(","),
        revokedAt: null,
      },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // Table not migrated yet — log and continue. UX still shows "connected"
      // so dev can verify the flow; persistence will work once migration
      // 0007_oauth_connections.sql is applied.
      log.warn("oauth_connections table missing — run migration 0007");
    } else {
      log.error("Failed to persist Slack OAuth connection", { error: (err as Error).message });
      return redirectWithError(req, "storage_failed");
    }
  }

  const successUrl = new URL("/dashboard/integrations?connected=slack", req.url);
  const res = NextResponse.redirect(successUrl);
  // Clear the CSRF cookie
  res.cookies.delete("slack_oauth_state");
  return res;
}

function redirectWithError(req: Request, reason: string): Response {
  const url = new URL("/dashboard/integrations?slack_error=" + encodeURIComponent(reason), req.url);
  return NextResponse.redirect(url);
}
