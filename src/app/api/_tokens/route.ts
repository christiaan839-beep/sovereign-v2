import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { apiKeys, subscriptions } from "@/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("tokens");

/**
 * Platform API token management (customer-facing, authenticates
 * requests to the Sovereign REST API).
 *
 *   GET    /api/_tokens        — list caller's active tokens
 *   POST   /api/_tokens        — mint a new token
 *   DELETE /api/_tokens?id=X   — revoke via revokedAt
 *
 * Separate from /api/_settings/api-keys which manages customer-supplied
 * third-party keys (Gemini, Tavily, etc.) via the `settings.apiKeys`
 * encrypted blob. THIS endpoint manages the `api_keys` table — tokens
 * we issue for authenticating to us.
 *
 * Token format:  sk_{plan}_{32-char-base64url}
 * Storage:       we store SHA-256 hash only (never the raw token)
 * Return path:   raw token is returned ONCE on creation — the dashboard
 *                shows a copy-to-clipboard one-shot after which the
 *                value is unrecoverable. Same pattern as GitHub PATs,
 *                AWS access keys, Stripe restricted keys.
 *
 * To rotate without downtime:
 *   1. POST to mint a new token
 *   2. Deploy the new token to your receivers
 *   3. DELETE the old token once confirmed
 *
 * Limits:
 *   - 10 active tokens per user (prevents exhaust-attack from session
 *     hijack minting unlimited keys before the user notices)
 *   - Optional expiresInDays (default: never)
 */

const KEY_BYTE_LENGTH = 24; // → 32 char base64url, Stripe-compatible length

function generateRawToken(plan: string): string {
  const random = randomBytes(KEY_BYTE_LENGTH).toString("base64url");
  return `sk_${plan}_${random}`;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function tokenPrefix(raw: string): string {
  // "sk_pro_ab12" — enough to identify in the dashboard, not enough
  // to compromise on its own.
  return raw.slice(0, 12);
}

async function getCallerPlan(userId: string): Promise<string> {
  const [sub] = await db
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return sub?.plan ?? "free";
}

// ─── GET: list tokens ─────────────────────────────────────────────
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        label: apiKeys.label,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt))
      .limit(50);

    return NextResponse.json({ tokens: rows });
  } catch (err) {
    log.error("token list failed", { error: String(err) });
    return NextResponse.json({ error: "List failed" }, { status: 500 });
  }
}

// ─── POST: mint new token ─────────────────────────────────────────
const createSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown = {};
  if (req.headers.get("content-length") !== "0") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { label, expiresInDays } = parsed.data;

  try {
    // Atomic count-and-insert — prevents TOCTOU where two concurrent
    // POSTs both see count=9 and both insert, yielding 11 tokens.
    // The transaction locks the user's existing rows via SELECT ... FOR
    // UPDATE so the second request blocks until the first commits.
    const plan = await getCallerPlan(userId);
    const rawToken = generateRawToken(plan);
    const hashed = hashToken(rawToken);
    const keyPrefix = tokenPrefix(rawToken);
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const txResult = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
        .for("update");

      if (existing.length >= 10) return { limitReached: true as const };

      const [inserted] = await tx
        .insert(apiKeys)
        .values({
          userId,
          key: hashed,
          keyPrefix,
          plan,
          label: label ?? null,
          expiresAt,
        })
        .returning({
          id: apiKeys.id,
          keyPrefix: apiKeys.keyPrefix,
          label: apiKeys.label,
          expiresAt: apiKeys.expiresAt,
          createdAt: apiKeys.createdAt,
        });
      return { limitReached: false as const, created: inserted };
    });

    if (txResult.limitReached) {
      return NextResponse.json(
        { error: "Active token limit reached (10). Revoke unused tokens first." },
        { status: 429 },
      );
    }
    const created = txResult.created;

    // Never log the raw token, even at debug level.
    log.info("token minted", { userId, keyPrefix, label: label ?? null });

    return NextResponse.json({
      token: { ...created, value: rawToken },
      warning:
        "Copy this token now — this is the only time it will be shown in full. " +
        "Store it in a secret manager (1Password, Vercel env, AWS Secrets Manager). " +
        "If lost, rotate by creating a new token and revoking this one.",
    });
  } catch (err) {
    log.error("token create failed", { error: String(err) });
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

// ─── DELETE: revoke (soft) ───────────────────────────────────────
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const result = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(apiKeys.id, id),
        eq(apiKeys.userId, userId), // ownership check
        isNull(apiKeys.revokedAt),
      ))
      .returning({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix });

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Token not found or already revoked" },
        { status: 404 },
      );
    }

    log.info("token revoked", { userId, keyPrefix: result[0].keyPrefix });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("token revoke failed", { error: String(err) });
    return NextResponse.json({ error: "Revoke failed" }, { status: 500 });
  }
}
