/**
 * GET /api/admin/audit/verify-chain — walk the audit_log hash chain and
 * return the first break, if any.
 *
 * Response:
 *   { valid: true,  checked: 4231, brokenAt: null,  ... }
 *   { valid: false, checked:  812, brokenAt: "uuid", ... }
 *
 * 404s for non-admins (no endpoint-existence leak). Internal-only
 * tooling — not linked from any public surface.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { verifyAuditChain } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse | Response> {
  // requireAdmin returns either the admin context (success) or a Response
  // with 401/404 (failure). The 404 path is deliberate — non-admins must
  // not be able to confirm this endpoint exists.
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const result = await verifyAuditChain({ limit: 10_000 });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
