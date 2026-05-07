import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { customerDeliveries, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-record-delivery");

/**
 * POST /api/_admin/record-delivery
 *
 * Operator-only. Marks a Monday delivery as shipped for a given
 * tenant. Writing to this endpoint is the ONLY way for the system
 * to know a delivery happened — STANDARDS.md §03's watchdog cron
 * reads this table to decide who's missed their Monday.
 *
 * Inputs validated:
 *   - tenantId (UUID, must exist)
 *   - deliveryDate (YYYY-MM-DD, MUST be a Monday — anything else is
 *     a bookkeeping error and we reject it)
 *   - leadCount (1..500, sanity range — alerts on abnormally low
 *     counts so operators don't accidentally record a partial)
 *   - handReviewedBy (free-form name; required so STANDARDS.md §01
 *     hand-review is non-skippable at write time)
 *   - slackMessageUrl (optional, lets the customer's Slack receipt
 *     be linked from /admin/customers)
 *   - notes (optional)
 *
 * Idempotency: the unique index on (tenant_id, delivery_date) means
 * a duplicate POST returns 409, never silently double-records.
 */

const recordSchema = z.object({
  tenantId: z.string().uuid(),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    // Same rationale as publish-letter: the regex permits impossible
    // dates like 2026-13-45. Reject them at the schema boundary
    // rather than letting them pass through as NaN to the
    // Monday-check, which would surface a misleading error.
    .refine(
      (d) => !Number.isNaN(new Date(d + "T00:00:00Z").getTime()),
      "Date is not a valid calendar date",
    ),
  leadCount: z.number().int().min(1).max(500),
  handReviewedBy: z.string().min(1).max(120),
  slackMessageUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

function isMonday(yyyyMmDd: string): boolean {
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  return d.getUTCDay() === 1;
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = recordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const data = parsed.data;

  if (!isMonday(data.deliveryDate)) {
    return NextResponse.json(
      {
        error: `deliveryDate must be a Monday — STANDARDS.md §03. Got ${data.deliveryDate}.`,
      },
      { status: 422 },
    );
  }

  try {
    // Verify the tenant exists before inserting; surfaces a clearer
    // error than the FK violation.
    const [tenantRow] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, data.tenantId))
      .limit(1);
    if (!tenantRow) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const [inserted] = await db
      .insert(customerDeliveries)
      .values({
        tenantId: data.tenantId,
        deliveryDate: data.deliveryDate,
        leadCount: data.leadCount,
        handReviewedBy: data.handReviewedBy,
        slackMessageUrl: data.slackMessageUrl || null,
        notes: data.notes || null,
      })
      .returning({ id: customerDeliveries.id });

    // Bust the public proof caches so the homepage delivery-receipt
    // strip and /proof reflect the new delivery within seconds, not
    // the full 5-minute revalidate window. revalidatePath fails
    // silently in some test environments — wrap in try/catch so a
    // missing context never fails the operator's POST.
    try {
      revalidatePath("/");
      revalidatePath("/proof");
      revalidatePath("/api/proof/stats");
    } catch {
      /* revalidate isn't always available; never block the write */
    }

    log.info("Delivery recorded", {
      deliveryId: inserted.id,
      tenantId: data.tenantId,
      deliveryDate: data.deliveryDate,
      leadCount: data.leadCount,
      adminUserId: gate.userId,
    });

    return NextResponse.json({
      ok: true,
      deliveryId: inserted.id,
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") {
      return NextResponse.json(
        {
          error: `A delivery for this tenant on ${data.deliveryDate} is already recorded.`,
        },
        { status: 409 },
      );
    }
    if (pgCode === "42P01") {
      log.error("customer_deliveries table missing — apply migration 0020");
      return NextResponse.json(
        {
          error:
            "Database migration 0020 is not applied. Paste MIGRATIONS-RUNME.sql into Neon Console and try again.",
        },
        { status: 503 },
      );
    }
    log.error("Record-delivery failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
