import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { randomBytes } from "node:crypto";

/**
 * GET /api/_integrations/slack/authorize
 *
 * Starts the Slack OAuth handshake. See docs/adr/0003-slack-oauth-first-
 * integration.md.
 *
 * Flow:
 *   1. Require Clerk auth (Slack install must be tied to a user)
 *   2. Generate a random state token + store in HttpOnly cookie (CSRF)
 *   3. 302 to Slack's authorize URL with scope + state
 *
 * Slack will redirect to /api/_integrations/slack/callback on approval.
 *
 * Required env:
 *   SLACK_CLIENT_ID
 *   SLACK_CLIENT_SECRET (used in callback)
 *   NEXT_PUBLIC_APP_URL (where Slack redirects back)
 */

// Force Node runtime — uses node:crypto.randomBytes() for the OAuth
// state nonce (CSRF defense). Edge runtime would crash on the import.
export const runtime = "nodejs";

const SLACK_SCOPES = [
  "chat:write",
  "chat:write.public",
  "users:read",
  "team:read",
].join(",");

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Slack integration not configured", setup: "Set SLACK_CLIENT_ID in env" },
      { status: 503 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sovereignmatrix.agency";
  const redirectUri = `${appUrl}/api/_integrations/slack/callback`;

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SLACK_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString(), 302);
  // 10-minute CSRF cookie — scoped to /api/_integrations/slack/* so it's
  // only read by the callback. Secure + HttpOnly + SameSite=lax.
  res.cookies.set("slack_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/_integrations/slack",
    maxAge: 600,
  });
  return res;
}
