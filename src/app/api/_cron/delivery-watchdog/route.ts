import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { db } from "@/db";
import { tenants, customerDeliveries } from "@/db/schema";
import { isNotNull, eq, and } from "drizzle-orm";
import { mondayOfWeek } from "@/lib/delivery-week";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("delivery-watchdog");

/**
 * GET /api/_cron/delivery-watchdog
 *
 * Runs Monday 8:30am UTC. The single point of enforcement for
 * STANDARDS.md §03 ("Monday 9am delivery is sacred").
 *
 * Algorithm:
 *   1. Find every welcomed customer (welcome_first_name IS NOT NULL)
 *      whose first_delivery_date is today or earlier.
 *   2. For each, check whether `customer_deliveries` has a row for
 *      THIS week's Monday.
 *   3. Anyone missing is in the "unshipped" set.
 *   4. Post a Slack ping with the punch list — names, customer IDs,
 *      welcome URLs, expected first delivery — so the operator has
 *      30 minutes to ship before the 9am bar.
 *
 * If everyone's shipped, posts a positive heartbeat ("All N
 * customers shipped for week of X") so the operator gets weekly
 * confirmation the system is alive.
 *
 * Idempotency: the cron is read-only against the DB. Safe to run
 * multiple times. Slack will receive one ping per run, which is the
 * desired behaviour — Vercel Cron only fires it at 8:30 Mon, and
 * manual reruns from the operator are intentional.
 *
 * Failure mode: if the SLACK_OPS_WEBHOOK_URL env var is unset, the
 * cron still computes the report and returns it via JSON so an
 * operator hitting the URL manually still gets visibility.
 */

interface MissedCustomer {
  tenantId: string;
  firstName: string;
  nodeId: string;
  welcomeUrl: string;
  firstDelivery: string | null;
}

export async function GET(req: Request) {
  const authErr = requireCronAuth(req);
  if (authErr) return authErr;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://sovereignmatrix.agency";
  const thisMonday = mondayOfWeek();
  const today = new Date().toISOString().slice(0, 10);

  let allActive: {
    id: string;
    firstName: string | null;
    nodeId: string;
    firstDelivery: string | null;
  }[];
  try {
    allActive = await db
      .select({
        id: tenants.id,
        firstName: tenants.welcomeFirstName,
        nodeId: tenants.nodeId,
        firstDelivery: tenants.welcomeFirstDelivery,
      })
      .from(tenants)
      .where(isNotNull(tenants.welcomeFirstName));
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01" || pgCode === "42703") {
      // Migrations 0019/0020 not applied. Don't ping Slack — there
      // are no real customers to miss yet.
      log.warn("Watchdog skipped — migrations not applied", { pgCode });
      return NextResponse.json(
        {
          ok: true,
          skipped: "Migrations 0019/0020 are not applied yet.",
        },
        { status: 200 },
      );
    }
    throw err;
  }

  // Filter to customers whose first delivery has reached today
  const dueCustomers = allActive.filter(
    (c) => c.firstDelivery !== null && c.firstDelivery <= today,
  );

  const missed: MissedCustomer[] = [];
  let shippedCount = 0;

  for (const c of dueCustomers) {
    const [row] = await db
      .select({ id: customerDeliveries.id })
      .from(customerDeliveries)
      .where(
        and(
          eq(customerDeliveries.tenantId, c.id),
          eq(customerDeliveries.deliveryDate, thisMonday),
        ),
      )
      .limit(1);

    if (row) {
      shippedCount += 1;
    } else {
      missed.push({
        tenantId: c.id,
        firstName: c.firstName ?? "(unset)",
        nodeId: c.nodeId,
        welcomeUrl: `${appUrl}/welcome/${c.id}`,
        firstDelivery: c.firstDelivery,
      });
    }
  }

  const summary = {
    ok: missed.length === 0,
    thisMonday,
    activeCustomers: dueCustomers.length,
    shipped: shippedCount,
    missed: missed.length,
    missedDetails: missed,
  };

  void notifySlack({
    thisMonday,
    missed,
    shippedCount,
    activeCount: dueCustomers.length,
    appUrl,
  });

  log.info("Watchdog complete", summary);

  return NextResponse.json(summary);
}

async function notifySlack(args: {
  thisMonday: string;
  missed: MissedCustomer[];
  shippedCount: number;
  activeCount: number;
  appUrl: string;
}): Promise<void> {
  const webhook = process.env.SLACK_OPS_WEBHOOK_URL;
  if (!webhook) return;

  const lines: string[] = [];

  if (args.activeCount === 0) {
    lines.push(
      `📅 *Monday delivery watchdog — week of ${args.thisMonday}*`,
      "No active customers due for delivery this week.",
    );
  } else if (args.missed.length === 0) {
    lines.push(
      `✅ *Monday delivery watchdog — week of ${args.thisMonday}*`,
      `All ${args.shippedCount}/${args.activeCount} active customers have a delivery recorded for today.`,
    );
  } else {
    lines.push(
      `🚨 *MONDAY DELIVERY MISSING — week of ${args.thisMonday}*`,
      `*${args.missed.length}/${args.activeCount}* customer${args.missed.length === 1 ? "" : "s"} unshipped. STANDARDS.md §03 fires at 9am.`,
      "",
    );
    for (const m of args.missed) {
      lines.push(
        `• *${m.firstName}* (${m.nodeId}) — first delivery scheduled ${m.firstDelivery}`,
      );
      lines.push(`   Welcome: ${m.welcomeUrl}`);
    }
    lines.push("");
    lines.push(`👉 Record deliveries at ${args.appUrl}/admin/customers`);
  }

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
  } catch {
    // Slack outage cannot fail the cron.
  }
}
