import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("admin-onboard-customer");

/**
 * POST /api/_admin/onboard-customer
 *
 * Operator-only. Writes the welcome-page columns on a tenant row so
 * /welcome/[id] surfaces the personalised kickoff. Replaces the
 * raw-SQL UPDATE pattern documented in src/app/welcome/[id]/page.tsx
 * comment with a real, validated, audited endpoint.
 *
 * Inputs are zod-validated. Slack notification is fire-and-forget so
 * a Slack outage never blocks the onboarding write.
 *
 * Response shape: { ok: true, welcomeUrl } so the admin page can
 * one-click copy the URL to send to the customer.
 */

const onboardSchema = z.object({
  tenantId: z.string().uuid(),
  firstName: z.string().min(1).max(80),
  loomUrl: z.string().url(),
  kickoffUrl: z.string().url(),
  slackUrl: z.string().url(),
  docUrl: z.string().url(),
  /** ISO date string YYYY-MM-DD */
  firstDelivery: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  /**
   * Optional. When provided, an immediate welcome email is sent via
   * Resend to this address. When omitted, the operator is expected
   * to share the welcome URL via another channel (Slack/SMS/etc).
   */
  customerEmail: z.string().email().optional().or(z.literal("")),
  /**
   * Optional. From-name used in the welcome email envelope. Defaults
   * to "Sovereign Matrix" — set to the operator's first name for the
   * personal touch the welcome page commits to.
   */
  fromName: z.string().min(1).max(80).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = onboardSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const data = parsed.data;

  try {
    const [updated] = await db
      .update(tenants)
      .set({
        welcomeFirstName: data.firstName,
        welcomeLoomUrl: data.loomUrl,
        welcomeKickoffUrl: data.kickoffUrl,
        welcomeSlackUrl: data.slackUrl,
        welcomeDocUrl: data.docUrl,
        welcomeFirstDelivery: data.firstDelivery,
      })
      .where(eq(tenants.id, data.tenantId))
      .returning({ id: tenants.id });

    if (!updated) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://sovereignmatrix.agency";
    const welcomeUrl = `${appUrl}/welcome/${updated.id}`;

    log.info("Customer welcome data set", {
      tenantId: updated.id,
      firstName: data.firstName,
      adminUserId: gate.userId,
    });

    // Fire-and-forget Slack ping so the operator has a paper trail.
    void notifySlack({
      firstName: data.firstName,
      welcomeUrl,
      firstDelivery: data.firstDelivery,
    });

    // Optional welcome email — if the operator pasted an email
    // address into the form, send the kickoff template via Resend
    // immediately. Failure here never blocks provisioning; the
    // operator can resend via a manual flow later.
    let emailResult:
      | { sent: true; id?: string }
      | { sent: false; reason: string }
      | undefined;
    if (data.customerEmail) {
      const { sendWelcomeEmail } = await import("@/lib/welcome-email");
      const result = await sendWelcomeEmail({
        to: data.customerEmail,
        firstName: data.firstName,
        welcomeUrl,
        kickoffUrl: data.kickoffUrl,
        firstDelivery: data.firstDelivery,
        fromName: data.fromName || undefined,
      });
      emailResult = result.ok
        ? { sent: true, id: result.id }
        : { sent: false, reason: result.reason ?? "unknown" };
    }

    return NextResponse.json({
      ok: true,
      welcomeUrl,
      tenantId: updated.id,
      email: emailResult,
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42703" || pgCode === "42P01") {
      // welcome_* columns or tenants table missing — migration 0019
      // hasn't been applied yet.
      log.error("Welcome columns missing — apply migration 0019", { pgCode });
      return NextResponse.json(
        {
          error:
            "Database migration 0019 is not applied. Paste MIGRATIONS-RUNME.sql into Neon Console and try again.",
        },
        { status: 503 },
      );
    }
    log.error("Onboard write failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function notifySlack(args: {
  firstName: string;
  welcomeUrl: string;
  firstDelivery: string;
}): Promise<void> {
  const webhook = process.env.SLACK_OPS_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🎉 New customer welcome page provisioned for *${args.firstName}*\n• Welcome URL: ${args.welcomeUrl}\n• First delivery: ${args.firstDelivery}`,
      }),
    });
  } catch {
    // Slack failures must never block the onboarding write.
  }
}
