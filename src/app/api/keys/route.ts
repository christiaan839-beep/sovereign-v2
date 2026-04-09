import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-keys");

// ─────────────────────────────────────────────
// GET  /api/keys — List user's API keys
// ─────────────────────────────────────────────
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        label: apiKeys.label,
        plan: apiKeys.plan,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ keys: rows });
  } catch (err: unknown) {
    if (isTableMissing(err)) {
      log.warn("api_keys table does not exist yet — returning empty list");
      return NextResponse.json({ keys: [] });
    }
    log.error("Failed to list API keys", { error: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/keys — Generate a new API key
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const label = typeof body.label === "string" ? body.label.slice(0, 100) : null;

    // Generate key: sk_sovereign_ + 32 random hex chars
    const raw = `sk_sovereign_${randomBytes(16).toString("hex")}`;
    const hashed = createHash("sha256").update(raw).digest("hex");
    const prefix = raw.slice(0, 12);

    const [inserted] = await db
      .insert(apiKeys)
      .values({
        userId,
        key: hashed,
        keyPrefix: prefix,
        plan: "free",
        label,
      })
      .returning({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        label: apiKeys.label,
        plan: apiKeys.plan,
        createdAt: apiKeys.createdAt,
      });

    log.info("API key created", { userId, keyId: inserted.id, prefix });

    // Return the full key ONLY on creation — user must save it now
    return NextResponse.json({
      key: raw,
      ...inserted,
    }, { status: 201 });
  } catch (err: unknown) {
    if (isTableMissing(err)) {
      log.warn("api_keys table does not exist — run migration first");
      return NextResponse.json(
        { error: "API keys table not provisioned. Run the migration to enable this feature." },
        { status: 503 },
      );
    }
    log.error("Failed to create API key", { error: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// DELETE /api/keys — Revoke a key (soft delete)
// ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { keyId } = body as { keyId?: string };

    if (!keyId) {
      return NextResponse.json({ error: "keyId is required" }, { status: 400 });
    }

    const result = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .returning({ id: apiKeys.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });
    }

    log.info("API key revoked", { userId, keyId });

    return NextResponse.json({ success: true, keyId });
  } catch (err: unknown) {
    if (isTableMissing(err)) {
      log.warn("api_keys table does not exist — run migration first");
      return NextResponse.json(
        { error: "API keys table not provisioned. Run the migration to enable this feature." },
        { status: 503 },
      );
    }
    log.error("Failed to revoke API key", { error: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// Utility: detect PostgreSQL "table does not exist" (42P01)
// ─────────────────────────────────────────────
function isTableMissing(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code: string }).code === "42P01";
  }
  return false;
}
