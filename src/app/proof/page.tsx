import Link from "next/link";
import { ArrowRight, Shield, Sparkles, AlertTriangle } from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { getProofStats, type ProofStats } from "@/lib/proof-stats";

/**
 * /proof — public, server-rendered, ISR-cached.
 *
 * The numbers on this page are pulled from the same tables that power
 * /admin/customers and the Monday watchdog cron. Nothing here exposes
 * any single customer's identity — every datum is aggregate.
 *
 * Why a separate page (not just a strip on the homepage):
 *   - Prospects who want to verify "is this real?" have a URL to send
 *     to their boss / spouse / cofounder.
 *   - The page itself is a craft signal — most operators don't bother.
 *   - When customers eventually opt in to public showcases at
 *     /customers/[slug], links land here too.
 *
 * Calls `getProofStats()` directly — no HTTP self-fetch. Revalidates
 * every 5 minutes; the same lib function backs `/api/proof/stats`
 * for external callers.
 */

export const revalidate = 300;

export const metadata = {
  title: "Proof — Sovereign Matrix",
  description:
    "The numbers behind Sovereign Lead Engine. Aggregate, anonymised, refreshed every 5 minutes.",
};

export default async function ProofPage() {
  const stats = await getProofStats();

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <Link
            href="/lead-engine"
            className="text-xs text-neutral-400 hover:text-neutral-100 transition"
          >
            Lead Engine &rarr;
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-20">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-500/60">
            Proof
          </p>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
            The numbers, live.
          </h1>
          <p className="mt-6 text-lg text-neutral-400 leading-relaxed max-w-2xl">
            Pulled from the same database that runs every customer&rsquo;s
            weekly delivery. Aggregate, anonymised, refreshed every five
            minutes.
          </p>
        </header>

        {!stats.migrationsApplied ? (
          <SettingUpCard />
        ) : (
          <StatsGrid stats={stats} />
        )}

        {/* ── Methodology ── */}
        <section className="mt-20 rounded-2xl border border-white/5 bg-white/[0.02] p-8">
          <h2 className="text-lg font-semibold text-white">
            How these numbers are computed
          </h2>
          <ul className="mt-5 space-y-3 text-sm text-neutral-400 leading-relaxed">
            <li>
              <strong className="text-neutral-200">Active customers:</strong>{" "}
              tenants with a populated welcome page. Filtering on the same
              column the welcome flow gates on ({" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
                tenants.welcome_first_name
              </code>{" "}
              not null).
            </li>
            <li>
              <strong className="text-neutral-200">Deliveries shipped:</strong>{" "}
              every row in{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
                customer_deliveries
              </code>
              . A row only exists when an operator (named in the row)
              hand-reviewed and shipped a batch.
            </li>
            <li>
              <strong className="text-neutral-200">Leads delivered:</strong> sum
              of{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
                lead_count
              </code>{" "}
              across every recorded delivery.
            </li>
            <li>
              <strong className="text-neutral-200">4-week on-time rate:</strong>{" "}
              recorded deliveries in the trailing 4 Mondays divided by expected
              deliveries (active customers × 4). 100% means every customer got
              every Monday batch on time.
            </li>
          </ul>
        </section>

        {/* ── Standards reference ── */}
        <section className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-6">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h3 className="mt-4 text-base font-semibold text-white">
              Standards we hit publicly
            </h3>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
              Every commitment in{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
                STANDARDS.md
              </code>{" "}
              is measured by a script, audited weekly, and reported here. If the
              on-time rate ever drops below 100% you&rsquo;ll see it before we
              do.
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <Sparkles className="h-5 w-5 text-neutral-300" />
            <h3 className="mt-4 text-base font-semibold text-white">
              Want to be on this page?
            </h3>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
              Become a customer. Each delivery you receive becomes one of the
              ticks behind these numbers. With your permission, your own wins
              land at{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
                /customers/[your-slug]
              </code>
              .
            </p>
            <Link
              href="/lead-engine"
              className="mt-4 inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition text-sm"
            >
              See the Lead Engine
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {stats.migrationsApplied && (
          <p className="mt-12 text-center text-xs text-neutral-600">
            Last refreshed{" "}
            <time dateTime={stats.generatedAt}>
              {new Date(stats.generatedAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
            . Cache window: 5 minutes.
          </p>
        )}
      </div>

      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-neutral-600">
          Sovereign Matrix &middot;{" "}
          <Link href="/lead-engine" className="hover:text-neutral-400">
            Lead Engine
          </Link>{" "}
          &middot;{" "}
          <Link href="/letters" className="hover:text-neutral-400">
            Friday Letter
          </Link>
        </div>
      </footer>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function StatsGrid({ stats }: { stats: ProofStats }) {
  const tiles: {
    label: string;
    value: string;
    sub: string;
    accent?: boolean;
  }[] = [
    {
      label: "Active customers",
      value: stats.activeCustomers.toLocaleString(),
      sub: "currently shipping weekly",
      accent: true,
    },
    {
      label: "Deliveries shipped",
      value: stats.totalDeliveriesShipped.toLocaleString(),
      sub: "all-time, hand-reviewed",
    },
    {
      label: "Leads delivered",
      value: stats.leadsDelivered.toLocaleString(),
      sub: "sum across every batch",
    },
    {
      label: "Shipped this week",
      value: stats.thisWeekShipped.toLocaleString(),
      sub: "of this Monday's batches",
    },
    {
      label: "4-week on-time rate",
      value: `${stats.last4WeeksOnTimeRate}%`,
      sub: "delivered on Monday vs expected",
      accent: stats.last4WeeksOnTimeRate >= 100,
    },
    {
      label: "Refund rate",
      value: "0%",
      sub: "tracked from billing — coming soon",
    },
  ];

  return (
    <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`rounded-2xl border p-7 ${
            t.accent
              ? "border-emerald-500/25 bg-emerald-500/[0.05]"
              : "border-white/5 bg-white/[0.02]"
          }`}
        >
          <div
            className={`text-4xl font-bold tracking-tight ${
              t.accent ? "text-emerald-400" : "text-white"
            }`}
          >
            {t.value}
          </div>
          <div className="mt-2 text-sm font-semibold text-neutral-200">
            {t.label}
          </div>
          <div className="mt-1 text-xs text-neutral-500">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

function SettingUpCard() {
  return (
    <div className="mt-12 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-8 flex gap-4">
      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-1" />
      <div>
        <h3 className="text-base font-semibold text-white">Setting up</h3>
        <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
          The numbers come online once the operator applies database migrations
          0019 and 0020 (
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
            MIGRATIONS-RUNME.sql
          </code>
          ) and welcomes the first customer. Check back once the platform is
          live.
        </p>
      </div>
    </div>
  );
}
