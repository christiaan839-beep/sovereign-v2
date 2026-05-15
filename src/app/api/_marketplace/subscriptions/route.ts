/**
 * SOVEREIGN MATRIX — /api/_marketplace/subscriptions (Cook 91 API).
 *
 * Audit-bundle subscription CRUD. Auth: requireAuth + admin for
 * cross-tenant ops; tenant-owner can manage their own subs.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/admin-auth";
import {
  createSubscription,
  deleteSubscription,
  listSubscriptionsForTenant,
  pauseSubscription,
  resumeSubscription,
} from "@/lib/audit-subscription-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("marketplace/subscriptions");

export const dynamic = "force-dynamic";

const CREATE_SCHEMA = z.object({
  tenantId: z.string().min(1).max(128),
  tenantDisplayName: z.string().min(1).max(160),
  deliverTo: z.array(z.string().email()).min(1).max(8),
  cadence: z.enum(["monthly", "quarterly"]),
  frameworks: z
    .array(z.enum(["eu-ai-act-annex-iv", "nist-ai-rmf", "iso-42001"]))
    .min(1),
});

const ACTION_SCHEMA = z.object({
  id: z.string().min(1).max(64),
  action: z.enum(["pause", "resume", "delete"]),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? auth.userId ?? "";
  // Only admins can view subs for tenants other than their own.
  if (tenantId !== auth.userId && !isAdmin(auth.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = listSubscriptionsForTenant(tenantId);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";
  try {
    const body = await req.json();
    const parsed = CREATE_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    // Non-admin callers can only create subs for themselves.
    if (parsed.data.tenantId !== userId && !isAdmin(userId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const sub = createSubscription({
      ...parsed.data,
      active: true,
    });
    await auditLog({
      userId,
      action: "data.audit-bundle",
      resource: `subscription:${sub.id}`,
      details: {
        cadence: sub.cadence,
        frameworks: sub.frameworks.length,
      },
    });
    return NextResponse.json({ subscription: sub }, { status: 201 });
  } catch (err) {
    log.error(
      "POST /api/_marketplace/subscriptions failed",
      err as Record<string, unknown>,
    );
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const parsed = ACTION_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { id, action } = parsed.data;
    let result;
    if (action === "pause") result = pauseSubscription(id);
    else if (action === "resume") result = resumeSubscription(id);
    else {
      const ok = deleteSubscription(id);
      result = ok ? { id, deleted: true } : undefined;
    }
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
