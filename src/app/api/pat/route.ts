/**
 * SOVEREIGN MATRIX — /api/pat (Cook 88 API)
 *
 * Personal Access Token management for extension + CLI usage.
 *
 * GET     → list the caller's PATs (hash-only, no cleartext)
 * POST    → issue a new PAT, return cleartext ONCE
 * DELETE  → revoke by id
 *
 * Auth: Clerk session only (PAT auth doesn't bootstrap PAT auth).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { issue, listFor, revoke } from "@/lib/pat-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("api/pat");

const POST_SCHEMA = z.object({
  label: z.string().min(1).max(80),
  ttlDays: z.number().int().min(1).max(365).optional(),
});

const DELETE_SCHEMA = z.object({
  id: z.string().min(1).max(64),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";
  // Strip the hash before returning. The cleartext was never stored;
  // the hash is sensitive (offline-attack target) so don't expose it.
  const items = listFor(userId).map((p) => ({
    id: p.id,
    label: p.label,
    prefix: p.prefix,
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt,
    expiresAt: p.expiresAt,
  }));
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";
  try {
    const body = await req.json();
    const parsed = POST_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { label, ttlDays } = parsed.data;
    const result = issue({
      userId,
      label,
      ttlMs: ttlDays ? ttlDays * 86_400_000 : undefined,
    });
    await auditLog({
      userId,
      action: "api_key.create",
      resource: `pat:${result.record.id}`,
      details: { label },
    });
    // Cleartext returned ONCE — UI surfaces a copy-button modal and
    // never persists it after the user dismisses.
    return NextResponse.json(
      {
        id: result.record.id,
        label: result.record.label,
        prefix: result.record.prefix,
        cleartext: result.cleartext,
        createdAt: result.record.createdAt,
        expiresAt: result.record.expiresAt,
      },
      { status: 201 },
    );
  } catch (err) {
    log.error("POST /api/pat failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";
  try {
    const body = await req.json();
    const parsed = DELETE_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const ok = revoke(parsed.data.id, userId);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await auditLog({
      userId,
      action: "api_key.delete",
      resource: `pat:${parsed.data.id}`,
      details: {},
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("DELETE /api/pat failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
