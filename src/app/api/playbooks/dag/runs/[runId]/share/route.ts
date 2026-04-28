/**
 * /api/playbooks/dag/runs/[runId]/share
 *
 *   GET   — list active+revoked shares for this run (owner only)
 *   POST  — create a new share token
 *
 * Tenant isolation:
 *   - getDagRun() with the requester's userId verifies ownership
 *     BEFORE any share is created. Hostile actors can't share a
 *     run they don't own (the upstream lookup returns null → 404).
 *   - The share row carries the same userId; the owner-facing list
 *     is scoped by it; the public resolver uses it to pull the run.
 *
 * Audit-log fires on POST (share creation is a state change worth
 * recording in the SHA-256 chain). Read-only GETs aren't logged.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { getDagRun } from "@/lib/playbook-dag-store";
import {
  createShareToken,
  listShareTokensForRun,
} from "@/lib/share-token-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";

const log = createLogger("playbooks/dag/runs/share");

const PostSchema = z
  .object({
    /** Owner-supplied label for the share. Optional but encouraged. */
    label: z.string().min(1).max(120).optional(),
    /** Lifetime in days. Default 7, max 90 (enforced by the store). */
    ttlDays: z.number().int().min(1).max(90).optional(),
  })
  .optional();

interface Ctx {
  params: Promise<{ runId: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { runId } = await ctx.params;
  if (!UUID_RE.test(runId)) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }

  // Verify ownership of the run before listing its shares — a
  // hostile actor with someone else's runId shouldn't be able to
  // enumerate shares.
  const run = await getDagRun({ id: runId, userId: auth.userId });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const { shares } = await listShareTokensForRun({
    runId,
    userId: auth.userId,
  });

  // Strip the actual `token` field from the response when the share
  // has been revoked OR expired — those URLs no longer work, so
  // there's no need to display them. Active shares show the full
  // share URL (the owner needs to be able to copy it).
  const baseUrl = getBaseUrl();
  const responseShares = shares.map((s) => ({
    id: s.id,
    label: s.label,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt,
    lastAccessedAt: s.lastAccessedAt,
    accessCount: s.accessCount,
    createdAt: s.createdAt,
    active: s.active,
    shareUrl: s.active ? `${baseUrl}/share/${s.token}` : null,
  }));

  return NextResponse.json({ success: true, shares: responseShares });
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;

  const { runId } = await ctx.params;
  if (!UUID_RE.test(runId)) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }

  // Body is optional. The endpoint accepts an empty POST and creates
  // a default share (no label, default TTL).
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Ownership check — same response as "doesn't exist" (no leak).
  const run = await getDagRun({ id: runId, userId });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const created = await createShareToken({
    runId,
    userId,
    label: parsed.data?.label,
    ttlDays: parsed.data?.ttlDays,
  });
  if (!created) {
    // Persistence failure. Don't lie to the user — share links must
    // not be silently dropped (they're a workflow gate for diligence).
    return NextResponse.json(
      { error: "Share service is temporarily unavailable; please retry" },
      { status: 503 },
    );
  }

  await auditLog({
    userId,
    action: "settings.update",
    resource: "dag_run_share",
    details: {
      kind: "dag_run_share.create",
      shareId: created.id,
      runId,
      ttlDays: parsed.data?.ttlDays ?? 7,
      hasLabel: Boolean(parsed.data?.label),
    },
  });

  log.info("dag run share created", {
    userId,
    runId,
    shareId: created.id,
    expiresAt: created.expiresAt,
  });

  const baseUrl = getBaseUrl();
  return NextResponse.json(
    {
      success: true,
      id: created.id,
      shareUrl: `${baseUrl}/share/${created.token}`,
      expiresAt: created.expiresAt,
    },
    { status: 201 },
  );
}
