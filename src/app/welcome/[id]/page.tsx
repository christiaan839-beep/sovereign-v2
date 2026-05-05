import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { Calendar, MessageCircle, FileText, Sparkles } from "lucide-react";

/**
 * /welcome/[id] — the first 60 seconds of trust.
 *
 * This is the URL the operator drops into a customer's inbox the
 * moment their setup payment lands. It's not a generic "thanks for
 * your purchase" page. It's a personally-crafted landing that says:
 * "You hired a person. Here's that person, looking you in the eye."
 *
 * Three elements stack the trust:
 *   1. A Loom embed of the founder welcoming the customer by name.
 *      The Loom URL is read from `tenants.welcome_loom_url` — set
 *      by the operator as soon as they record the welcome video
 *      (usually within 30 minutes of payment landing).
 *   2. The four next-step cards: kickoff call, Slack channel,
 *      kickoff doc, first delivery date. Every one is a concrete
 *      commitment the customer can hold us to.
 *   3. The four standards we hold ourselves to. These are not
 *      marketing claims — they're the internal bars from STANDARDS.md
 *      surfaced at the customer's eye level.
 *
 * Privacy: the page reads from `tenants` keyed by the tenant id
 * passed in the URL. No auth gate — the URL itself is the secret
 * (UUID, unguessable). The data shown is non-sensitive:
 * customer first name, kickoff call URL, Slack invite URL, kickoff
 * doc URL, first delivery date. If the tenant doesn't exist or has
 * no welcome data set, we 404.
 *
 * Adding the welcome data: until a proper admin UI ships, the
 * operator updates these columns in Neon directly:
 *   UPDATE tenants
 *      SET welcome_first_name      = 'Sarah',
 *          welcome_loom_url        = 'https://loom.com/share/abc123',
 *          welcome_kickoff_url     = 'https://calendly.com/.../kickoff',
 *          welcome_slack_url       = 'https://join.slack.com/...',
 *          welcome_doc_url         = 'https://notion.so/...',
 *          welcome_first_delivery  = '2026-05-12'::date
 *    WHERE id = '<the-tenant-uuid-from-the-url>';
 *
 * The columns are added in migration drizzle/0019_welcome_columns.sql
 * (also bundled into MIGRATIONS-RUNME.sql for first-time apply).
 */

interface WelcomeData {
  firstName: string | null;
  loomUrl: string | null;
  kickoffUrl: string | null;
  slackUrl: string | null;
  docUrl: string | null;
  firstDelivery: Date | null;
}

async function loadWelcome(id: string): Promise<WelcomeData | null> {
  try {
    const [row] = await db
      .select({
        firstName: tenants.welcomeFirstName,
        loomUrl: tenants.welcomeLoomUrl,
        kickoffUrl: tenants.welcomeKickoffUrl,
        slackUrl: tenants.welcomeSlackUrl,
        docUrl: tenants.welcomeDocUrl,
        firstDelivery: tenants.welcomeFirstDelivery,
      })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    if (!row || !row.loomUrl) return null;
    return row;
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01" || pgCode === "42703") {
      // tenants table missing OR welcome_* columns missing —
      // migration not applied. Page will 404 until it is.
      return null;
    }
    throw err;
  }
}

function loomEmbedUrl(shareUrl: string): string {
  // loom.com/share/<id> → loom.com/embed/<id>
  return shareUrl.replace("/share/", "/embed/");
}

function formatDeliveryDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function WelcomePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const data = await loadWelcome(id);
  if (!data) notFound();

  const firstName = data.firstName ?? "there";
  const loomEmbed = loomEmbedUrl(data.loomUrl!);

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
          <span className="text-xs text-neutral-500">Customer welcome</span>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Welcome, <span className="text-emerald-400">{firstName}</span>.
        </h1>
        <p className="mt-4 text-lg text-neutral-400 leading-relaxed">
          You bought a person, not a SaaS. Watch the 60-second video below —
          it&rsquo;ll tell you what happens next, in my own voice.
        </p>

        {/* Loom embed */}
        <div
          className="mt-10 relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40"
          style={{ aspectRatio: "16/9" }}
        >
          <iframe
            src={loomEmbed}
            allow="autoplay; fullscreen"
            className="absolute inset-0 h-full w-full"
            title={`Personal welcome for ${firstName}`}
          />
        </div>

        {/* Next steps */}
        <h2 className="mt-16 text-xl font-semibold text-white">
          What&rsquo;s next, in order
        </h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {data.kickoffUrl && (
            <NextStepCard
              n="01"
              icon={Calendar}
              title="Kickoff call (30 min)"
              detail="We define your ICP together. End of call: a brief I can act on tomorrow."
              cta="Book the call"
              href={data.kickoffUrl}
            />
          )}
          {data.slackUrl && (
            <NextStepCard
              n="02"
              icon={MessageCircle}
              title="Your private Slack channel"
              detail="Anything you need — questions, feedback, urgent fixes — lives here. I reply within 1 hour during business hours."
              cta="Join Slack"
              href={data.slackUrl}
            />
          )}
          {data.docUrl && (
            <NextStepCard
              n="03"
              icon={FileText}
              title="Live kickoff doc"
              detail="Shared workspace where we keep your ICP brief, sample profiles, voice + tone, and weekly delivery notes."
              cta="Open the doc"
              href={data.docUrl}
            />
          )}
          {data.firstDelivery && (
            <NextStepCard
              n="04"
              icon={Sparkles}
              title="First batch delivered"
              detail={`50 qualified leads + outreach drafts in your Slack at 9am ${formatDeliveryDate(data.firstDelivery)}, your timezone.`}
              cta="Mark on calendar"
              href={`/api/welcome/${id}/ics`}
            />
          )}
        </div>

        {/* Standards */}
        <h2 className="mt-20 text-xl font-semibold text-white">
          What I hold myself to
        </h2>
        <p className="mt-3 text-sm text-neutral-400">
          Not promises — bars. If I miss any of these, I want you to call me on
          it.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-neutral-300">
          <li className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <span className="font-mono text-xs text-emerald-400 mt-0.5">
              01
            </span>
            <span>
              <strong className="text-white">
                Every lead is hand-reviewed before it ships.
              </strong>{" "}
              No machine-only deliveries. Ever.
            </span>
          </li>
          <li className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <span className="font-mono text-xs text-emerald-400 mt-0.5">
              02
            </span>
            <span>
              <strong className="text-white">
                Every Slack message gets a reply within 1 hour
              </strong>{" "}
              during business hours, every weekday.
            </span>
          </li>
          <li className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <span className="font-mono text-xs text-emerald-400 mt-0.5">
              03
            </span>
            <span>
              <strong className="text-white">
                Monday 9am delivery is sacred.
              </strong>{" "}
              If I ever miss it, that month is on me — fully refunded.
            </span>
          </li>
          <li className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <span className="font-mono text-xs text-emerald-400 mt-0.5">
              04
            </span>
            <span>
              <strong className="text-white">Money-back, no friction.</strong>{" "}
              Fewer than 50 qualified leads in your first 30 days? Setup fee is
              back in your account same-day, no support ticket.
            </span>
          </li>
        </ul>

        <div className="mt-16 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-8 text-center">
          <p className="text-neutral-300 leading-relaxed">
            That&rsquo;s the whole pitch. The video&rsquo;s 60 seconds. The
            kickoff is 30 minutes. The first batch hits your inbox before next
            weekend.
          </p>
          <p className="mt-3 text-sm text-neutral-500">
            Talk soon, {firstName}.
          </p>
        </div>
      </div>

      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-neutral-600">
          Sovereign Matrix &middot; Customer welcome
        </div>
      </footer>
    </main>
  );
}

function NextStepCard({
  n,
  icon: Icon,
  title,
  detail,
  cta,
  href,
}: {
  n: string;
  icon: typeof Calendar;
  title: string;
  detail: string;
  cta: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.04]"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-neutral-600">{n}</span>
        <Icon className="h-5 w-5 text-emerald-400" />
      </div>
      <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{detail}</p>
      <span className="mt-4 inline-block text-sm text-emerald-400 group-hover:translate-x-0.5 transition">
        {cta} &rarr;
      </span>
    </a>
  );
}
