import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { mintPortalToken } from "@/lib/portal-tokens";
import { getPublicUrl } from "@/lib/base-url";
import { auditLog } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("portal/link");

const limiter = rateLimit({ interval: 60, limit: 10 });

const MAX_TTL_DAYS = 90;

/**
 * POST /api/portal/link — mint a shareable, signed client-portal link.
 *
 * The caller (an agency operator, Clerk-authed) gets a link for THEIR OWN
 * identity only: `subject: "email"` (default — matches leads/generations/
 * bookings keyed on userEmail) or `subject: "userId"` (matches
 * agentActivity). Arbitrary clientIds are deliberately NOT accepted —
 * letting a signed-in user mint tokens for someone else's email would
 * recreate the exact IDOR this endpoint exists to close (BACKLOG H4).
 *
 * Body (all optional): { subject?: "email" | "userId", ttlDays?: number }
 * Response: { url, token, clientId, expiresAt }
 */
export async function POST(req: NextRequest) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const subject = body.subject === "userId" ? "userId" : "email";
    const ttlDays =
      typeof body.ttlDays === "number" && body.ttlDays > 0
        ? Math.min(MAX_TTL_DAYS, Math.ceil(body.ttlDays))
        : 30;

    let clientId: string;
    if (subject === "userId") {
      clientId = userId;
    } else {
      const user = await currentUser();
      const email =
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses?.[0]?.emailAddress;
      if (!email) {
        return NextResponse.json(
          { error: 'No email on account — use subject: "userId"' },
          { status: 400 },
        );
      }
      clientId = email;
    }

    const minted = mintPortalToken({
      clientId,
      ttlSeconds: ttlDays * 24 * 3600,
    });

    const url = `${getPublicUrl()}/portal/${encodeURIComponent(clientId)}?token=${encodeURIComponent(minted.token)}`;

    await auditLog({
      userId,
      action: "portal_link.issued",
      resource: clientId,
      details: { subject, ttlDays, expiresAt: minted.expiresAt },
    });

    return NextResponse.json({
      url,
      token: minted.token,
      clientId,
      expiresAt: minted.expiresAt,
    });
  } catch (err) {
    log.error("Portal link mint failed", { userId, error: String(err) });
    return NextResponse.json(
      { error: "Unable to mint portal link" },
      { status: 500 },
    );
  }
}
