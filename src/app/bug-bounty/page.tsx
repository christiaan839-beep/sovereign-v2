import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bug bounty — Sovereign Matrix",
  description:
    "Coordinated-disclosure rewards for security researchers who find real vulnerabilities in Sovereign Matrix. Scope, rewards, and rules of engagement.",
  openGraph: {
    title: "Sovereign Matrix — Bug bounty program",
    description:
      "Find a real vulnerability in our verifiable AI infrastructure, get paid.",
  },
};

/**
 * /bug-bounty — Public bug bounty program page (SOC 2 CC7.4).
 *
 * Pure server component — no JS, no client state. The page IS the policy.
 *
 * Pairs with:
 *   - /.well-known/security.txt (RFC 9116)
 *   - SECURITY.md (repo root + /docs/SECURITY.md)
 *   - /security (full disclosure policy)
 */
export default function BugBountyPage() {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        {/* Editorial header */}
        <div className="mb-12">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
            BUG BOUNTY · COORDINATED DISCLOSURE
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-[-0.02em] text-white mb-4">
            Find a real vulnerability.
            <br />
            <span className="text-[#B5532C]">Get paid.</span>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl">
            Sovereign Matrix ships verifiable AI receipts to teams that cannot
            tolerate ambiguity. Our security claims must hold under adversarial
            review — so we pay researchers who find real issues in scope.
          </p>
        </div>

        {/* Scope */}
        <Section title="01 · In scope">
          <ul className="space-y-2 text-neutral-400 leading-[1.7]">
            <li>
              <code className="text-[#7dd3fc]">sovereignmatrix.agency</code> +
              all subdomains except clearly-marked staging
            </li>
            <li>
              Verifiable-receipt cryptographic primitives — HMAC, Ed25519,
              Merkle proofs, OpenTimestamps anchoring, audit-log hash chain
            </li>
            <li>
              All <code className="text-[#7dd3fc]">/api/*</code> routes — auth,
              payments, webhooks, agent invocation, data export
            </li>
            <li>Multi-tenant isolation — cross-tenant data access</li>
            <li>
              Webhook signature handlers — Stripe, PayPal, MoonPay, HubSpot,
              Clerk, Telegram, Twilio, Slack, GitHub
            </li>
            <li>
              CSP / cookie / CSRF / XSS / SSRF / prompt-injection that escapes
              the 5-layer output verifier
            </li>
          </ul>
        </Section>

        {/* Out of scope */}
        <Section title="02 · Out of scope">
          <ul className="space-y-2 text-neutral-400 leading-[1.7]">
            <li>
              DoS, volumetric, or rate-limit-exhaustion testing — we run real
              customer traffic; please don&apos;t
            </li>
            <li>Social engineering of staff or customers</li>
            <li>Physical attacks against infrastructure we don&apos;t own</li>
            <li>
              Self-XSS or attacks requiring physical access to a victim&apos;s
              unlocked device
            </li>
            <li>
              Issues in third-party services (Clerk, Stripe, Neon, Vercel) —
              report those to the vendor directly
            </li>
            <li>
              Best-practice findings without a concrete exploit (e.g. missing
              security header on a page that handles no user data)
            </li>
          </ul>
        </Section>

        {/* Rewards */}
        <Section title="03 · Rewards">
          <p className="text-neutral-400 mb-6">
            Paid in USD via bank transfer or stablecoin. We reward by real-world
            impact, not theoretical severity.
          </p>
          <div className="border border-white/[0.08] rounded-[6px] overflow-hidden">
            <RewardRow
              tier="Critical"
              range="$2,500 – $10,000"
              examples="account takeover, signing-key compromise, cross-tenant data leak, fraudulent receipt minting"
            />
            <RewardRow
              tier="High"
              range="$500 – $2,500"
              examples="auth bypass, SSRF, stored XSS in dashboard, webhook signature forgery"
            />
            <RewardRow
              tier="Medium"
              range="$100 – $500"
              examples="IDOR with limited impact, reflected XSS, sensitive info disclosure"
            />
            <RewardRow
              tier="Low"
              range="acknowledgement + Sovereign credit"
              examples="hardening recommendations, low-impact misconfig, missing headers"
              isLast
            />
          </div>
          <p className="text-[13px] text-neutral-500 mt-6 leading-[1.6]">
            First valid report on a duplicate wins the reward. Chained issues
            are paid as the highest-severity component plus 25%.
          </p>
        </Section>

        {/* Rules */}
        <Section title="04 · Rules of engagement">
          <ul className="space-y-2 text-neutral-400 leading-[1.7]">
            <li>
              Report privately to{" "}
              <a
                href="mailto:security@sovereignmatrix.agency"
                className="text-[#7dd3fc] hover:underline"
              >
                security@sovereignmatrix.agency
              </a>{" "}
              before any public disclosure
            </li>
            <li>
              Use only test accounts you own; never access another
              customer&apos;s data
            </li>
            <li>
              Stop the moment you confirm a vulnerability — don&apos;t pivot,
              don&apos;t exfiltrate, don&apos;t pivot further
            </li>
            <li>
              90-day coordinated-disclosure clock starts on our triage
              acknowledgement
            </li>
            <li>
              We will not pursue legal action against good-faith researchers who
              operate within these rules. This is binding.
            </li>
          </ul>
        </Section>

        {/* Acknowledgement */}
        <Section title="05 · Hall of fame">
          <p className="text-neutral-400 leading-[1.7]">
            With consent, we publish the names of researchers whose reports led
            to a fix. Email{" "}
            <a
              href="mailto:security@sovereignmatrix.agency"
              className="text-[#7dd3fc] hover:underline"
            >
              security@sovereignmatrix.agency
            </a>{" "}
            with your handle if you want to be listed. No retroactive edits —
            what shipped, shipped.
          </p>
        </Section>

        {/* Closing */}
        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[13px] font-mono text-neutral-500 leading-[1.7]">
            See{" "}
            <Link
              href="/security"
              className="text-neutral-300 hover:text-white"
            >
              /security
            </Link>{" "}
            for the full disclosure policy,{" "}
            <a
              href="/.well-known/security.txt"
              className="text-neutral-300 hover:text-white"
            >
              /.well-known/security.txt
            </a>{" "}
            for the RFC 9116 contact card, and{" "}
            <Link href="/trust" className="text-neutral-300 hover:text-white">
              /trust
            </Link>{" "}
            for procurement-grade compliance evidence.
          </p>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-4">
        {title.toUpperCase()}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function RewardRow({
  tier,
  range,
  examples,
  isLast = false,
}: {
  tier: string;
  range: string;
  examples: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-baseline gap-1 md:gap-6 p-5 ${
        isLast ? "" : "border-b border-white/[0.06]"
      }`}
    >
      <div className="md:w-32 shrink-0">
        <p className="text-[11px] font-mono text-neutral-500 tracking-[0.15em] uppercase">
          {tier}
        </p>
        <p className="text-[#B5532C] font-mono text-[13px] mt-1">{range}</p>
      </div>
      <p className="text-[14px] text-neutral-400 leading-[1.6]">{examples}</p>
    </div>
  );
}
