/**
 * GET /api/admin/creator-submissions
 *
 * List SAM v1.0 submissions for the admin review UI.
 *
 * Auth: requireAdmin() — Clerk login + ADMIN_USER_IDS allowlist.
 * Non-admins get a 404 (not 403) to avoid revealing that the
 * endpoint exists.
 *
 * Query parameters:
 *   status  one of pending (default) | verified | rejected | in_review
 *           | suspended | all
 *   limit   1..200 (default 50)
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  listSamSubmissions,
  type AdminSubmissionFilter,
} from "@/lib/admin-submissions";

const ALLOWED_STATUSES: NonNullable<AdminSubmissionFilter["status"]>[] = [
  "pending",
  "verified",
  "rejected",
  "in_review",
  "suspended",
  "all",
];

function parseStatus(raw: string | null): AdminSubmissionFilter["status"] {
  if (raw && ALLOWED_STATUSES.includes(raw as AdminSubmissionFilter["status"] as "pending")) {
    return raw as AdminSubmissionFilter["status"];
  }
  return "pending";
}

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(Math.floor(n), 200);
}

export async function GET(request: Request): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  const limit = parseLimit(url.searchParams.get("limit"));

  const rows = await listSamSubmissions({ status, limit });

  return NextResponse.json(
    {
      status,
      limit,
      count: rows.length,
      submissions: rows,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
