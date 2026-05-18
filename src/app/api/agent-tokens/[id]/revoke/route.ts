/**
 * SOVEREIGN MATRIX — /api/agent-tokens/[id]/revoke (Wave 16)
 *
 * Admin-only one-click revoke. Pairs with the /dashboard/governance
 * page (Wave 20) and the operator CLI. Idempotent — revoking an
 * already-revoked token returns 200 with `{ ok: true, alreadyRevoked: true }`.
 *
 * Audit logs every revoke for SOC 2 CC7 (incident response). The
 * subsequent Bitcoin anchor (Wave 9) makes the revoke record
 * tamper-evident across the long-term retention horizon.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { revokeAgentToken, getTokenStatus } from "@/lib/agent-tokens";
import { auditLog } from "@/lib/audit-log";

const limiter = rateLimit({ interval: 60, limit: 30 });

const BODY = z.object({
  reason: z.string().min(3).max(200),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await params;
  if (!/^[0-9a-f-]{20,64}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = BODY.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body must be { reason: string }" },
      { status: 400 },
    );
  }

  const existing = await getTokenStatus(id);
  if (!existing.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.revokedAt) {
    return NextResponse.json(
      { ok: true, alreadyRevoked: true, revokedAt: existing.revokedAt },
      { status: 200 },
    );
  }

  const out = await revokeAgentToken(id, parsed.data.reason);
  await auditLog({
    userId: admin.userId,
    action: "agent_token.revoked",
    resource: `agent_token:${id}`,
    details: { reason: parsed.data.reason, byAdmin: admin.userId },
  });
  return NextResponse.json(out, { status: out.ok ? 200 : 500 });
}
