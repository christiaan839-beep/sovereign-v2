import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { tenants, customerDeliveries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import {
  CheckCircle2,
  Calendar,
  ExternalLink,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import {
  mondayOfWeek,
  nextMonday,
  daysBetween,
  formatYYYYMMDD,
} from "@/lib/delivery-week";

/**
 * /portal/[id]/deliveries — customer-facing delivery history.
 *
 * Access model: UUID is the secret, same pattern as /welcome/[id].
 * No Clerk gate, no sign-in. The URL itself is unguessable; the
 * tenants.id column is uuid v4 with 122 bits of entropy. We surface
 * non-PII customer data: their first name, the dates of their past
 * deliveries, lead counts, the operator who hand-reviewed each batch,
 * and (when present) a deep link to the Slack message that delivered
 * it.
 *
 * The page is the customer-side mirror of /admin/customers — same
 * data, same DB, same source of truth. If a customer's row says they
 * got 50 leads on May 4, the operator's dashboard says it too.
 *
 * Why this page exists:
 *   - STANDARDS.md §03 (Monday delivery is sacred) becomes verifiable
 *     by the customer themselves. They don't need to ask "did the
 *     batch ship?" — the URL says so.
 *   - Trust compounds when customers can show this URL to their
 *     cofounder ("see, here's the actual delivery log").
 *   - When a customer eventually opts in to a public showcase at
 *     /customers/[slug], the data already lives in the same shape.
 *
 * 404s when:
 *   - The id is not a tenant UUID (FK lookup returns null)
 *   - The tenant exists but has not been welcomed (welcomeFirstName
 *     is null) — we don't expose data for placeholder tenants
 *   - The customer_deliveries table is missing (migration 0020 not
 *     yet applied) — fail closed rather than render zeros
 */

interface CustomerSummary {
  firstName: string;
  nodeId: string;
  firstDelivery: string | null;
}

interface DeliveryRow {
  id: string;
  deliveryDate: string;
  leadCount: number;
  handReviewedBy: string;
  slackMessageUrl: string | null;
  notes: string | null;
}

async function loadPortalData(
  id: string,
): Promise<{ customer: CustomerSummary; deliveries: DeliveryRow[] } | null> {
  try {
    const [customer] = await db
      .select({
        firstName: tenants.welcomeFirstName,
        nodeId: tenants.nodeId,
        firstDelivery: tenants.welcomeFirstDelivery,
      })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!customer || !customer.firstName) return null;

    const deliveries = await db
      .select({
        id: customerDeliveries.id,
        deliveryDate: customerDeliveries.deliveryDate,
        leadCount: customerDeliveries.leadCount,
        handReviewedBy: customerDeliveries.handReviewedBy,
        slackMessageUrl: customerDeliveries.slackMessageUrl,
        notes: customerDeliveries.notes,
      })
      .from(customerDeliveries)
      .where(eq(customerDeliveries.tenantId, id))
      .orderBy(desc(customerDeliveries.deliveryDate));

    return {
      customer: {
        firstName: customer.firstName,
        nodeId: customer.nodeId,
        firstDelivery: customer.firstDelivery,
      },
      deliveries,
    };
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01" || pgCode === "42703") {
      // Required tables/columns missing. Fail closed — better the
      // customer 404s than sees a broken page.
      return null;
    }
    throw err;
  }
}

function formatDate(yyyymmdd: string): string {
  return new Date(yyyymmdd + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function CustomerDeliveriesPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const data = await loadPortalData(id);
  if (!data) notFound();

  const { customer, deliveries } = data;
  const totalLeads = deliveries.reduce((s, d) => s + d.leadCount, 0);
  const today = formatYYYYMMDD(new Date());
  const nextMon = nextMonday();
  const daysToNext = daysBetween(today, nextMon);
  const thisMonday = mondayOfWeek();
  const thisWeekShipped = deliveries.some((d) => d.deliveryDate === thisMonday);

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <Link
            href={`/welcome/${id}`}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-100 transition"
          >
            <ArrowLeft className="h-3 w-3" />
            Welcome page
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-500/60">
            Your deliveries
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Hi {customer.firstName}.
          </h1>
          <p className="mt-4 text-neutral-400 leading-relaxed">
            Every batch you&rsquo;ve received, every lead, every Monday. Pulled
            live from the same database the operator dashboard uses.
          </p>
        </header>

        {/* ── Top stats ── */}
        <section className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Tile
            label="Deliveries received"
            value={deliveries.length.toString()}
            sub="hand-reviewed batches"
          />
          <Tile
            label="Leads delivered"
            value={totalLeads.toLocaleString()}
            sub="total across all batches"
          />
          <Tile
            label={thisWeekShipped ? "This week" : "Next delivery"}
            value={
              thisWeekShipped
                ? "Shipped"
                : daysToNext === 0
                  ? "Today"
                  : `${daysToNext}d`
            }
            sub={
              thisWeekShipped
                ? `${formatDate(thisMonday)}`
                : `Monday ${formatDate(nextMon)}`
            }
            accent={thisWeekShipped}
          />
        </section>

        {/* ── Delivery list ── */}
        <h2 className="mt-16 text-lg font-semibold text-white">
          Delivery history
        </h2>

        {deliveries.length === 0 ? (
          <FirstDeliveryCard
            firstDelivery={customer.firstDelivery}
            firstName={customer.firstName}
          />
        ) : (
          <ol className="mt-6 space-y-3">
            {deliveries.map((d, i) => (
              <DeliveryCard
                key={d.id}
                delivery={d}
                isMostRecent={i === 0}
                customerName={customer.firstName}
              />
            ))}
          </ol>
        )}

        {/* ── Standards visible to customer ── */}
        <section className="mt-20 rounded-2xl border border-white/5 bg-white/[0.02] p-7">
          <h3 className="text-base font-semibold text-white">
            What we hold ourselves to
          </h3>
          <p className="mt-2 text-sm text-neutral-500">
            From{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
              STANDARDS.md
            </code>
            . If we miss any of these, we want you to call us on it.
          </p>
          <ul className="mt-5 space-y-3 text-sm text-neutral-300">
            <li className="flex gap-3">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 flex-shrink-0" />
              <span>
                Every lead in every batch is hand-reviewed before it ships. The
                reviewer&rsquo;s name appears on every row above.
              </span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 flex-shrink-0" />
              <span>
                Monday 9am delivery, every Monday. Miss it and the month is on
                us.
              </span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 flex-shrink-0" />
              <span>
                Reply within 1 hour during business hours, every Slack message.
              </span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 flex-shrink-0" />
              <span>
                Money back, no friction, same day — if your first month falls
                short of 50 qualified leads.
              </span>
            </li>
          </ul>
        </section>
      </div>

      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="mx-auto max-w-4xl px-6 text-center text-xs text-neutral-600">
          Sovereign Matrix &middot; Customer portal &middot;{" "}
          <Link href="/letters" className="hover:text-neutral-400">
            Friday Letter
          </Link>
        </div>
      </footer>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${
        accent
          ? "border-emerald-500/25 bg-emerald-500/[0.05]"
          : "border-white/5 bg-white/[0.02]"
      }`}
    >
      <div
        className={`text-3xl font-bold tracking-tight ${
          accent ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-sm font-semibold text-neutral-200">{label}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>
    </div>
  );
}

function DeliveryCard({
  delivery,
  isMostRecent,
  customerName,
}: {
  delivery: DeliveryRow;
  isMostRecent: boolean;
  customerName: string;
}) {
  return (
    <li
      className={`rounded-2xl border p-6 ${
        isMostRecent
          ? "border-emerald-500/25 bg-emerald-500/[0.04]"
          : "border-white/5 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar
              className={`h-4 w-4 ${
                isMostRecent ? "text-emerald-400" : "text-neutral-500"
              }`}
            />
            <time
              className="text-base font-semibold text-white"
              dateTime={delivery.deliveryDate}
            >
              {formatDate(delivery.deliveryDate)}
            </time>
            {isMostRecent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <Sparkles className="h-2.5 w-2.5" />
                Most recent
              </span>
            )}
          </div>
          <div className="mt-2 text-sm text-neutral-400">
            <span className="font-mono text-neutral-300">
              {delivery.leadCount}
            </span>{" "}
            qualified leads &middot; hand-reviewed by{" "}
            <span className="text-neutral-300">{delivery.handReviewedBy}</span>
          </div>
          {delivery.notes && (
            <p className="mt-3 text-sm text-neutral-400 leading-relaxed border-l border-white/10 pl-3">
              {delivery.notes}
            </p>
          )}
        </div>
        {delivery.slackMessageUrl && (
          <a
            href={delivery.slackMessageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/20 hover:text-white transition flex-shrink-0"
          >
            Open in Slack
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <span className="sr-only">
        Sovereign Matrix delivery for {customerName}
      </span>
    </li>
  );
}

function FirstDeliveryCard({
  firstDelivery,
  firstName,
}: {
  firstDelivery: string | null;
  firstName: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-8">
      <Sparkles className="h-5 w-5 text-emerald-400" />
      <h3 className="mt-4 text-lg font-semibold text-white">
        First batch is on the way
      </h3>
      <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
        {firstDelivery
          ? `Your first delivery is scheduled for Monday ${formatDate(firstDelivery)}. It'll land in your Slack at 9am your timezone, and a row will appear here within seconds of going out.`
          : `Your first delivery date will be set on the kickoff call. It'll land in your Slack at 9am your timezone the following Monday.`}
      </p>
      <p className="mt-4 text-sm text-neutral-500">
        Hang tight, {firstName}. We&rsquo;re sourcing right now.
      </p>
    </div>
  );
}
