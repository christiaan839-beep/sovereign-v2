/**
 * /affiliate — public landing page for the affiliate program.
 *
 * Server-rendered (no JS needed to read). Pure marketing surface:
 * value prop, terms, FAQ, signup CTA.
 *
 * Copper accent here (marketing surface per the dual-accent rule —
 * see docs/design-system/brand-colors.md). The downstream
 * /dashboard/affiliate page (authenticated, shows live referral code
 * + earnings) would use cyan.
 *
 * The signup link routes to /signup?intent=affiliate. The Clerk
 * webhook + onboarding flow creates an `affiliates` row with the
 * default referralCode when this intent is detected.
 */

import Link from "next/link";
import {
  Share2,
  Wallet,
  Calendar,
  Infinity as InfinityIcon,
  ArrowRight,
  CheckCircle2,
  Globe,
  Coins,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

const TERMS = [
  {
    icon: Coins,
    title: "30% recurring commission",
    body: "On every paid subscription you refer, for as long as that customer is paying. Pro ($49/mo) = $14.70/mo per active referral. Team ($199/mo) = $59.70/mo. Compounds.",
  },
  {
    icon: Calendar,
    title: "90-day attribution window",
    body: "Cookie + click-ID tracked for 90 days. If your referred visitor signs up any time in that window, the commission is yours — even if they convert later.",
  },
  {
    icon: Wallet,
    title: "Monthly payouts, ZAR or USD",
    body: "Net-30 from the end of the calendar month. Minimum payout ZAR 500 / USD 30. Stripe + PayPal supported; Payoneer for emerging markets on request.",
  },
  {
    icon: InfinityIcon,
    title: "No cap, no exclusivity",
    body: "Bring 1 referral or 1,000. Run other partner programs alongside. The only thing we ask: don't run paid Google Ads on our brand keywords (cannibalises organic).",
  },
];

const FAQ = [
  {
    q: "Who is this designed for?",
    a: "Compliance consultants, audit firms, fractional CFOs, developer-tooling YouTubers, AI newsletter publishers, RegTech advisors. Anyone whose audience needs audit-grade AI infrastructure.",
  },
  {
    q: "What can I share?",
    a: "Anything we publish publicly: the /spec page (VAOS 1.0), the /verified live demo, the /explorer receipt feed, any specific /r/<id> receipt URL, the /badge builder. Every page renders well as a link unfurl — full OG cards on Twitter, LinkedIn, Slack.",
  },
  {
    q: "How is attribution tracked?",
    a: "Click on your referral link sets a cookie (?ref=<code>) + writes a click-event row server-side. On signup, the user's record is bound to your affiliate ID for the lifetime of the subscription.",
  },
  {
    q: "Can I be both a customer and an affiliate?",
    a: "Yes. We even refund the equivalent of your first month's commission once you have one active referral — net-positive on entry.",
  },
  {
    q: "What's the dashboard like?",
    a: "Inside the platform, /dashboard/affiliate shows your referral code, click count, signup conversion rate, MRR you've generated, and next payout amount. Everything in real time.",
  },
];

export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* Copper ambient — marketing surface */}
      <div
        className="fixed inset-x-0 top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#B5532C]/[0.05] rounded-full blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          ← Sovereign Matrix
        </Link>

        {/* Header */}
        <header className="mb-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#B5532C]/30 bg-[#B5532C]/10 px-3 py-1 font-mono text-[11px] text-[#E08558]">
            <Share2 className="h-3 w-3" />
            AFFILIATE PROGRAM · OPEN
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Refer audit-grade AI.{" "}
            <span className="text-[#B5532C]">
              Earn for as long as it sticks.
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            30% recurring commission, 90-day attribution window, monthly payouts
            in ZAR or USD, no cap. Built for compliance consultants, audit
            firms, dev-tool publishers, and anyone whose audience needs
            cryptographically-signed AI receipts.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup?intent=affiliate"
              className="inline-flex items-center gap-2 rounded-lg bg-[#B5532C] px-6 py-3 font-mono text-xs uppercase tracking-wider text-white transition hover:bg-[#C96235]"
            >
              Apply now — 60 seconds
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/spec"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-6 py-3 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-white/20 hover:text-white"
            >
              See what you&apos;d be sharing
            </Link>
          </div>
        </header>

        {/* Terms grid */}
        <section className="mb-14 grid grid-cols-1 gap-4 md:grid-cols-2">
          {TERMS.map((t) => (
            <SpotlightCard
              as="article"
              accent="copper"
              radius={320}
              key={t.title}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl"
            >
              <t.icon
                className="mb-3 h-5 w-5 text-[#E08558]"
                aria-hidden="true"
              />
              <h3 className="mb-2 text-sm font-semibold text-white">
                {t.title}
              </h3>
              <p className="text-xs leading-relaxed text-neutral-400">
                {t.body}
              </p>
            </SpotlightCard>
          ))}
        </section>

        {/* Math block */}
        <section className="mb-14 overflow-hidden rounded-2xl border border-[#B5532C]/20 bg-gradient-to-br from-[#B5532C]/[0.05] to-transparent p-8 backdrop-blur-xl">
          <h2 className="mb-4 font-serif text-3xl tracking-tight text-white">
            The math
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <MathRow referrals="10" tier="Pro" monthly="$147" annual="$1,764" />
            <MathRow
              referrals="10"
              tier="Team"
              monthly="$597"
              annual="$7,164"
            />
            <MathRow
              referrals="50"
              tier="Mixed (avg Pro)"
              monthly="$735"
              annual="$8,820"
            />
          </div>
          <p className="mt-6 text-xs text-neutral-500">
            Recurring. Compounds with every retention month. No cap, no clawback
            past day 14 of any individual signup.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="mb-6 font-serif text-3xl tracking-tight text-white">
            Frequently asked
          </h2>
          <div className="space-y-4">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
              >
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-white transition group-hover:bg-white/[0.02]">
                  <span className="inline-flex w-full items-center justify-between gap-3">
                    {f.q}
                    <span className="text-neutral-500 group-open:rotate-90">
                      ▸
                    </span>
                  </span>
                </summary>
                <p className="border-t border-white/[0.04] px-5 py-4 text-sm leading-relaxed text-neutral-400">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#B5532C]/[0.04] to-transparent p-8 text-center backdrop-blur-xl">
          <CheckCircle2 className="mx-auto mb-3 h-6 w-6 text-[#E08558]" />
          <h2 className="mb-2 font-serif text-3xl tracking-tight text-white">
            Sign up takes 60 seconds.
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-neutral-400">
            Get your referral link + dashboard the moment you confirm your
            email. No application review.
          </p>
          <Link
            href="/signup?intent=affiliate"
            className="inline-flex items-center gap-2 rounded-lg bg-[#B5532C] px-8 py-3.5 font-mono text-xs uppercase tracking-wider text-white transition hover:bg-[#C96235]"
          >
            Apply now
            <ArrowRight className="h-3 w-3" />
          </Link>
        </section>

        <p className="mt-10 text-center text-[11px] text-neutral-600">
          Questions?{" "}
          <a
            href="mailto:partnerships@sovereignmatrix.agency"
            className="text-neutral-400 underline-offset-2 hover:text-[#E08558] hover:underline"
          >
            partnerships@sovereignmatrix.agency
          </a>{" "}
          ·{" "}
          <Link
            href="/trust"
            className="text-neutral-400 underline-offset-2 hover:text-[#E08558] hover:underline"
          >
            See the trust posture
          </Link>{" "}
          <Globe className="inline h-2.5 w-2.5" />
        </p>
      </div>
    </div>
  );
}

function MathRow({
  referrals,
  tier,
  monthly,
  annual,
}: {
  referrals: string;
  tier: string;
  monthly: string;
  annual: string;
}) {
  return (
    <div className="border-l-2 border-[#B5532C]/40 pl-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {referrals} referrals on {tier}
      </div>
      <div className="mt-1 font-serif text-3xl tracking-tight text-white tabular-nums">
        {monthly}
      </div>
      <div className="text-[11px] text-neutral-500">
        per month · <span className="text-[#E08558]">{annual}</span> / year
      </div>
    </div>
  );
}
