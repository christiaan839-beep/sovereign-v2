/**
 * POST /api/agent-commerce/authorize
 *   Create a new agent spend authorization.
 *
 * GET /api/agent-commerce/authorize
 *   List the current user's authorizations (most recent first).
 *
 * DELETE /api/agent-commerce/authorize?id=...
 *   Revoke an authorization.
 *
 * Auth: requireMutatingAuth (CSRF + Clerk) on POST/DELETE; requireAuth on GET.
 *
 * Round 30 — agentic commerce. The user-facing half: a user
 * grants their agent a bounded, scoped, time-limited spend cap.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireMutatingAuth } from "@/lib/auth-guard";
import {
  createAuthorization,
  listAuthorizations,
  revokeAuthorization,
} from "@/lib/agent-spend";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-commerce-authorize");

export const runtime = "nodejs";

const CreateAuthSchema = z.object({
  agentName: z.string().min(1).max(200),
  // Cap: $20,000 per single authorization. Operators who need more
  // can issue multiple authorizations or contact support.
  maxCents: z.number().int().min(1).max(2_000_000),
  expiresInHours: z.number().int().min(1).max(8760), // 1 year max
  categoryLimits: z.record(z.string(), z.number().int().min(0)).optional(),
  allowedMerchants: z.array(z.string().min(1)).optional(),
  hitlThresholdCents: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const auth = await requireMutatingAuth(req);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateAuthSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createAuthorization({
    userId: auth.userId,
    ...parsed.data,
  });

  if (!result.ok) {
    log.warn("createAuthorization rejected", { userId: auth.userId, reason: result.reason });
    return NextResponse.json(
      { error: result.message, code: result.reason },
      { status: result.reason === "db_unavailable" ? 503 : 400 },
    );
  }

  return NextResponse.json(
    {
      authorizationId: result.authorizationId,
      expiresAt: result.expiresAt.toISOString(),
    },
    { status: 201 },
  );
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const rows = await listAuthorizations(auth.userId);
  return NextResponse.json({ authorizations: rows });
}

export async function DELETE(req: Request) {
  const auth = await requireMutatingAuth(req);
  if (auth.error) return auth.error;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing ?id=" }, { status: 400 });
  }
  const reason = url.searchParams.get("reason") ?? undefined;
  const result = await revokeAuthorization({
    authorizationId: id,
    userId: auth.userId,
    reason,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: "Authorization not found or not yours" },
      { status: 404 },
    );
  }
  return NextResponse.json({ revoked: true });
}
