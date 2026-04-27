import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { apiKeys, subscriptions } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";

// Force Node runtime — uses node:crypto for randomBytes (token mint)
// and createHash (key fingerprint). Both are unavailable in Edge.
export const runtime = "nodejs";

const log = createLogger("tokens:rotate");

function getClientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || undefined;
}

/**
 * POST /api/_tokens/rotate
 *
 * Atomic rotation: mint a new token, schedule the old one for
 * revocation, all inside a single transaction. The old token keeps
 * working for a grace period (default 1 hour) so deployed code can
 * roll over without simultaneous env-var updates.
 *
 * Body:
 *   oldTokenId:     string (required) — the UUID of the token to rotate out
 *   label:          string (optional) — copied to the new token if omitted
 *   gracePeriodMin: number (optional, default 60) — how long the old
 *                   token keeps working after rotation. 0 = immediate.
 *
 * Response:
 *   {
 *     oldTokenId,
 *     oldTokenRevokesAt,  — ISO timestamp; old token stops working then
 *     newToken: { id, keyPrefix, value, ... }  — value shown ONCE
 *   }
 *
 * The grace period is implemented by setting `expiresAt` on the old
 * row (a new column semantic — expires = revoke at this time) rather
 * than immediate `revokedAt`. This lets us reuse the expiration-check
 * middleware that already exists for expiring tokens.
 */

const KEY_BYTE_LENGTH = 24;

function generateRawToken(plan: string): string {
  const random = randomBytes(KEY_BYTE_LENGTH).toString("base64url");
  return `sk_${plan}_${random}`;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

const rotateSchema = z.object({
  oldTokenId: z.string().uuid(),
  label: z.string().min(1).max(200).optional(),
  gracePeriodMin: z.number().int().min(0).max(7 * 24 * 60).default(60),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = rotateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { oldTokenId, label: labelOverride, gracePeriodMin } = parsed.data;

  try {
    // Verify the old token exists, is owned by caller, and isn't already revoked.
    const [old] = await db
      .select({
        id: apiKeys.id,
        plan: apiKeys.plan,
        label: apiKeys.label,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(and(
        eq(apiKeys.id, oldTokenId),
        eq(apiKeys.userId, userId),
        isNull(apiKeys.revokedAt),
      ))
      .limit(1);

    if (!old) {
      return NextResponse.json(
        { error: "Old token not found or already revoked" },
        { status: 404 },
      );
    }

    // Get the user's current plan — new token should use the current
    // plan, not the plan the old token was minted with (user may have
    // upgraded in the meantime).
    const [sub] = await db
      .select({ plan: subscriptions.plan })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    const plan = sub?.plan ?? old.plan;

    const rawToken = generateRawToken(plan);
    const hashed = hashToken(rawToken);
    const keyPrefix = rawToken.slice(0, 12);
    const newLabel = labelOverride ?? old.label ?? null;

    // Old token's effective-revoke time — either immediate (grace=0)
    // or `now + gracePeriodMin`. We set this via `expiresAt` so the
    // existing expiration check handles the cutover.
    const oldRevokesAt = gracePeriodMin === 0
      ? new Date()
      : new Date(Date.now() + gracePeriodMin * 60 * 1000);

    // Transaction — either both rows change or neither does.
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(apiKeys)
        .values({
          userId,
          key: hashed,
          keyPrefix,
          plan,
          label: newLabel,
          expiresAt: null,
        })
        .returning({
          id: apiKeys.id,
          keyPrefix: apiKeys.keyPrefix,
          label: apiKeys.label,
          createdAt: apiKeys.createdAt,
        });

      if (gracePeriodMin === 0) {
        // Immediate revoke
        await tx
          .update(apiKeys)
          .set({ revokedAt: oldRevokesAt })
          .where(eq(apiKeys.id, oldTokenId));
      } else {
        // Grace period — set expiration; revoke remains null so the
        // token is still listed as "active" in UI (with expiry shown).
        await tx
          .update(apiKeys)
          .set({ expiresAt: oldRevokesAt })
          .where(eq(apiKeys.id, oldTokenId));
      }

      return created;
    });

    log.info("token rotated", {
      userId,
      oldTokenId,
      newKeyPrefix: keyPrefix,
      gracePeriodMin,
    });

    // Audit — rotation is two distinct events (mint + revoke-or-expire).
    // Recording both keeps the SOC-2 timeline accurate: an investigator
    // sees a continuous "key X retired at Y, key Z minted at W" trail
    // rather than a single "rotation" event that obscures the structure.
    const ip = getClientIp(req);
    await auditLog({
      userId,
      action: "api_key.create",
      resource: result.id,
      details: {
        keyPrefix,
        label: newLabel,
        plan,
        rotatedFrom: oldTokenId,
        gracePeriodMin,
      },
      ipAddress: ip,
    });
    await auditLog({
      userId,
      action: "api_key.delete",
      resource: oldTokenId,
      details: {
        rotatedTo: result.id,
        gracePeriodMin,
        revokesAt: oldRevokesAt.toISOString(),
      },
      ipAddress: ip,
    });

    return NextResponse.json({
      oldTokenId,
      oldTokenRevokesAt: oldRevokesAt.toISOString(),
      gracePeriodMin,
      newToken: {
        ...result,
        value: rawToken,
      },
      warning:
        "Copy the new token now — this is the only time it will be shown. " +
        `The old token (${old.id.slice(0, 8)}…) will stop working at ${oldRevokesAt.toISOString()}.`,
    });
  } catch (err) {
    log.error("token rotate failed", { error: String(err) });
    return NextResponse.json({ error: "Rotation failed" }, { status: 500 });
  }
}
