import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { tenants, customerDeliveries } from "@/db/schema";
import { isNotNull, desc, eq } from "drizzle-orm";
import { mondayOfWeek, mondayWeeksAgo } from "@/lib/delivery-week";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-customers");

/**
 * GET /api/_admin/customers
 *
 * Operator-only. Returns the health summary that powers the
 * /admin/customers dashboard. One row per "welcomed" tenant
 * (a tenant becomes a customer the moment welcome_first_name is
 * set — that's the contract we already use across the app).
 *
 * For each customer:
 *   - identity (id, firstName, nodeId, createdAt)
 *   - their welcome page URL
 *   - the delivery_date of the most recent delivery (if any)
 *   - whether THIS week's Monday delivery has shipped
 *   - traffic-light status:
 *       green:  this week's delivery is recorded
 *       amber:  no delivery yet THIS week, but >0 prior deliveries
 *       red:    no delivery at all and first_delivery_date has passed
 *       grey:   onboarded but first delivery is in the future
 *
 * The amber / red / grey rules embed STANDARDS.md §03 directly into
 * the data model so the UI just renders status colours.
 */

/**
 * Per-week status cell for the 12-week SLO sparkline. The `date` is
 * the Monday the cell represents — never a real-time timestamp.
 *
 *   green → a delivery row exists for that Monday
 *   red   → the Monday has passed AND was on/after first_delivery
 *           AND no delivery row exists
 *   grey  → the Monday is before the customer's first_delivery date
 *           (they hadn't been onboarded yet)
 */
export interface SloCell {
  date: string;
  status: "green" | "red" | "grey";
  leadCount: number | null;
}

interface CustomerHealth {
  tenantId: string;
  firstName: string;
  nodeId: string;
  welcomeUrl: string;
  firstDelivery: string | null;
  lastDeliveryDate: string | null;
  thisWeekShipped: boolean;
  status: "green" | "amber" | "red" | "grey";
  totalDeliveries: number;
  /** 12 cells, oldest → newest. Last cell is this week's Monday. */
  last12Weeks: SloCell[];
  /** % of green cells out of all non-grey cells. 100 = perfect. */
  onTimeRatePct: number;
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://sovereignmatrix.agency";
  const thisMonday = mondayOfWeek();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const customers = await db
      .select({
        id: tenants.id,
        firstName: tenants.welcomeFirstName,
        nodeId: tenants.nodeId,
        firstDelivery: tenants.welcomeFirstDelivery,
      })
      .from(tenants)
      .where(isNotNull(tenants.welcomeFirstName));

    // Pre-compute the last 12 Mondays once (oldest → newest).
    const mondays = Array.from({ length: 12 }, (_, i) =>
      mondayWeeksAgo(11 - i),
    );

    const result: CustomerHealth[] = [];

    for (const c of customers) {
      const allDeliveries = await db
        .select({
          deliveryDate: customerDeliveries.deliveryDate,
          leadCount: customerDeliveries.leadCount,
        })
        .from(customerDeliveries)
        .where(eq(customerDeliveries.tenantId, c.id))
        .orderBy(desc(customerDeliveries.deliveryDate));

      const deliveryByDate = new Map<string, number>();
      for (const d of allDeliveries) {
        deliveryByDate.set(d.deliveryDate, d.leadCount);
      }

      const lastDeliveryDate = allDeliveries[0]?.deliveryDate ?? null;
      const thisWeekShipped = deliveryByDate.has(thisMonday);
      const totalDeliveries = allDeliveries.length;

      // Build the 12-cell sparkline.
      const last12Weeks: SloCell[] = mondays.map((monday) => {
        const leadCount = deliveryByDate.get(monday);
        if (leadCount !== undefined) {
          return { date: monday, status: "green", leadCount };
        }
        // No delivery for this Monday. If the customer wasn't yet
        // onboarded, that's a grey cell (not a miss). Otherwise red.
        if (c.firstDelivery && monday < c.firstDelivery) {
          return { date: monday, status: "grey", leadCount: null };
        }
        // Future Mondays (e.g. this week before delivery is recorded
        // would be `red` — but this loop only includes the most-recent
        // Monday as `monday <= thisMonday`, so future cells never appear
        // here; the `red` here means a real miss against §03.
        return { date: monday, status: "red", leadCount: null };
      });

      const nonGrey = last12Weeks.filter((cell) => cell.status !== "grey");
      const greens = nonGrey.filter((cell) => cell.status === "green").length;
      const onTimeRatePct =
        nonGrey.length === 0
          ? 100
          : Math.round((greens / nonGrey.length) * 100);

      let status: CustomerHealth["status"];
      if (thisWeekShipped) {
        status = "green";
      } else if (c.firstDelivery && c.firstDelivery > today) {
        status = "grey";
      } else if (totalDeliveries > 0) {
        status = "amber";
      } else {
        status = "red";
      }

      result.push({
        tenantId: c.id,
        firstName: c.firstName ?? "(unset)",
        nodeId: c.nodeId,
        welcomeUrl: `${appUrl}/welcome/${c.id}`,
        firstDelivery: c.firstDelivery,
        lastDeliveryDate,
        thisWeekShipped,
        status,
        totalDeliveries,
        last12Weeks,
        onTimeRatePct,
      });
    }

    // Sort: red → amber → grey → green so urgent ones land at the top.
    const order = { red: 0, amber: 1, grey: 2, green: 3 } as const;
    result.sort((a, b) => order[a.status] - order[b.status]);

    return NextResponse.json({
      ok: true,
      thisMonday,
      customers: result,
      counts: {
        total: result.length,
        green: result.filter((r) => r.status === "green").length,
        amber: result.filter((r) => r.status === "amber").length,
        red: result.filter((r) => r.status === "red").length,
        grey: result.filter((r) => r.status === "grey").length,
      },
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01" || pgCode === "42703") {
      return NextResponse.json(
        {
          error:
            "Database migrations 0019 + 0020 are required. Paste MIGRATIONS-RUNME.sql into Neon Console and try again.",
        },
        { status: 503 },
      );
    }
    log.error("Customers list failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
