/**
 * POST /api/portal/share-link — mint a signed portal share URL.
 *
 * Lets an authenticated user (typically an agency owner) generate a
 * link they can hand out to a client who doesn't have a Sovereign
 * account. The link includes an HMAC-SHA256 token over the clientId
 * so it can't be forged or modified.
 *
 * Request:
 *   POST /api/portal/share-link
 *   Body: { "clientId": "client@example.com" }
 *
 * Response:
 *   200 { url, token, clientId }       — token + ready-to-share URL
 *   400 { error }                       — clientId missing/invalid
 *   401 { error }                       — caller not authenticated
 *   500 { error }                       — PORTAL_SHARE_SECRET missing
 *
 * SECURITY MODEL
 *   The caller must be signed in. We don't enforce ownership of the
 *   clientId at mint time because the typical caller is an agency
 *   admin minting links for their clients (the agency knows the
 *   clientId, the client doesn't have an account). If the bar needs
 *   to rise — e.g., only allow minting if the caller has a
 *   client-relationship row in DB — add that check here.
 *
 *   The shared link itself is unrestricted: anyone with the URL can
 *   hit /api/portal/metrics and see the client's metrics. That's
 *   the intended UX (the agency vouched for the client by giving
 *   them the link). To revoke a leaked link, rotate
 *   PORTAL_SHARE_SECRET and re-mint.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { signShareToken } from "@/lib/portal-share-link";
import { getBaseUrl } from "@/lib/base-url";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

// node:crypto via portal-share-link → must run on Node.
export const runtime = "nodejs";

const log = createLogger("portal/share-link");

const RequestSchema = z.object({
  clientId: z.string().min(1).max(200),
});

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const callerUserId = auth.userId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { clientId } = parsed.data;

  let token: string;
  try {
    token = signShareToken(clientId);
  } catch (err) {
    log.error("Share-link minting failed — PORTAL_SHARE_SECRET missing or too short", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error:
          "Share-link signing is not configured. Set PORTAL_SHARE_SECRET to enable.",
        code: "share_signing_unconfigured",
      },
      { status: 500 },
    );
  }

  // Build the URL. Use the public dashboard portal route, NOT the
  // /api/portal/metrics path directly — the API route is consumed by
  // a page at /portal/[clientId] (or wherever the front-end renders).
  const baseUrl = getBaseUrl();
  const url = new URL(`/portal/${encodeURIComponent(clientId)}`, baseUrl);
  url.searchParams.set("token", token);

  // Audit-log the mint so we have a record of who shared what + when.
  // Goes through the SHA-256 hash chain so revoking a leaked link is
  // forensically traceable.
  await auditLog({
    userId: callerUserId,
    action: "settings.update",
    resource: "portal_share_link",
    details: {
      kind: "portal_share_link.mint",
      clientId,
      // NEVER log the raw token — it's an access credential. Just
      // record that a link was issued. If forensics need the exact
      // token later, re-mint and compare.
    },
  });

  return NextResponse.json({
    success: true,
    url: url.toString(),
    token,
    clientId,
  });
}
