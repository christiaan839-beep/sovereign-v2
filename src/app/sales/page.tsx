import type { Metadata } from "next";
import Link from "next/link";
import {
  slaUptimePercent,
  getPlan,
} from "@/lib/plans";

const BOOKING_URL = "https://cal.com/sovereign-matrix/15min";

export const metadata: Metadata = {
  title: "Talk to sales — Sovereign Matrix",
  description:
    "Enterprise and Sovereign-tier contracts: audit log export, 99.95–99.99% SLA, dedicated CSM, white-label dashboard. Talk to the founder.",
  openGraph: {
    title: "Sovereign Matrix — Enterprise contracts",
    description:
      "Audit log export, white-label, dedicated CSM, 99.99% SLA. Book a call.",
  },
};

/**
 * /sales — Contract-tier landing page.
 *
 * Two purchasable surfaces live here:
 *   - Enterprise ($499/mo self-serve via /pricing checkout)
 *   - Sovereign (price-on-application, this page is the entry point)
 *
 * Pure server component — no JS, no client state, no analytics widgets.
 * The page itself is the pitch.
 */
export default function SalesPage() {
  const enterprise = getPlan("enterprise");
  const sovereign = getPlan("sovereign");
  const enterpriseSla = slaUptimePercent("enterprise");
  const sovereignSla = slaUptimePercent("sovereign");

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-4xl mx-auto">
        {/* Editorial header */}
        <div className="mb-16">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
            CONTRACT TIER · ENTERPRISE + SOVEREIGN
          </p>
          <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
            When &quot;production-ready&quot;
            <br />
            <span className="text-[#B5532C]">isn&apos;t enough.</span>
          </h1>
          <p className="text-[18px] text-neutral-400 leading-[1.6] max-w-2xl">
            Self-serve plans run on the shared cluster with a standard support
            queue. Some teams can&apos;t. If you need a signed audit-log
            export, a white-label deployment on your own domain, a named
            contact, or a contractual SLA — talk to me.
          </p>
        </div>

        {/* Two-tier comparison */}
        <div className="grid md:grid-cols-2 gap-px bg-white/[0.06] border border-white/[0.06] rounded-[6px] overflow-hidden mb-16">
          {/* Enterprise */}
          <div className="bg-[#030303] p-8">
            <p className="font-mono text-[10px] text-[#7dd3fc] tracking-[0.25em] mb-3">
              ENTERPRISE
            </p>
            <p className="font-serif text-4xl text-white mb-2">
              {enterprise.priceDisplayUsd}
            </p>
            <p className="text-[13px] text-neutral-500 mb-6">
              {enterprise.priceDisplayZar} · self-serve via /pricing
            </p>
            <ul className="space-y-2.5 text-[14px] text-neutral-400">
              <Feature on={enterprise.enterprise.auditLogExport}>
                Signed audit-log evidence bundle
              </Feature>
              <Feature on={!!enterpriseSla}>
                {enterpriseSla ?? "Best-effort"} uptime SLA
              </Feature>
              <Feature on={enterprise.enterprise.dedicatedSupport}>
                Dedicated Slack channel + named CSM
              </Feature>
              <Feature on={enterprise.enterprise.whiteLabel}>
                White-label dashboard (custom domain)
              </Feature>
              <Feature on={enterprise.enterprise.byok}>
                BYOK encryption keys
              </Feature>
            </ul>
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[#7dd3fc] hover:text-white tracking-tight"
              >
                See pricing
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          {/* Sovereign */}
          <div className="bg-[#030303] p-8 relative">
            <p className="font-mono text-[10px] text-[#B5532C] tracking-[0.25em] mb-3">
              SOVEREIGN · CONTRACT
            </p>
            <p className="font-serif text-4xl text-white mb-2">
              {sovereign.priceDisplayUsd}
            </p>
            <p className="text-[13px] text-neutral-500 mb-6">
              Price-on-application · invoice billing
            </p>
            <ul className="space-y-2.5 text-[14px] text-neutral-400">
              <Feature on={sovereign.enterprise.auditLogExport}>
                Signed audit-log evidence bundle
              </Feature>
              <Feature on={!!sovereignSla}>
                {sovereignSla ?? "Best-effort"} uptime SLA
              </Feature>
              <Feature on={sovereign.enterprise.dedicatedSupport}>
                Named architect engagement
              </Feature>
              <Feature on={sovereign.enterprise.whiteLabel}>
                Full white-label + custom branding
              </Feature>
              <Feature on={sovereign.enterprise.byok}>
                BYOK encryption (KMS / HSM)
              </Feature>
            </ul>
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#B5532C] text-white text-[13px] font-mono tracking-tight rounded-[3px] hover:bg-[#C96234] transition-colors"
              >
                Book 15 minutes
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>

        {/* What's negotiable */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            01 · WHAT&apos;S NEGOTIABLE
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-[14px] text-neutral-400 leading-[1.6]">
            <p>· Custom SLA with service credits</p>
            <p>· Regional data pinning (EU / US / ZA)</p>
            <p>· BYOK encryption (AWS KMS / GCP KMS)</p>
            <p>· Custom audit log retention (1–10 years)</p>
            <p>· On-prem agent runtime (limited beta)</p>
            <p>· Custom rate limits + run quotas</p>
            <p>· Source-code escrow</p>
            <p>· DPA / BAA / MSA signed counter-parties</p>
            <p>· Annual prepay discount (10–20%)</p>
            <p>· Multi-year commits (12 / 24 / 36 months)</p>
          </div>
        </section>

        {/* Compliance */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            02 · COMPLIANCE EVIDENCE PROVIDED
          </h2>
          <div className="grid sm:grid-cols-2 gap-3 text-[12px]">
            {["SBOM (CycloneDX, every build)", "Sub-processor list"].map(
              (item) => (
                <div
                  key={item}
                  className="px-4 py-3 border border-white/[0.08] rounded-[3px] text-neutral-400"
                >
                  {item}
                </div>
              ),
            )}
          </div>
        </section>

        {/* Who this is for */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            03 · WHO THIS IS FOR
          </h2>
          <ul className="space-y-3 text-[14px] text-neutral-400 leading-[1.7]">
            <li>
              <span className="text-white">Insurance carriers</span> running
              underwriting narratives, claims triage, or complaint handling
              under FCA / NAIC / FSCA oversight.
            </li>
            <li>
              <span className="text-white">Pharma + clinical research</span>{" "}
              teams generating pharmacovigilance signals or trial-protocol
              drafts that need 25-year retention.
            </li>
            <li>
              <span className="text-white">Banks + asset managers</span> under
              SR 11-7 / EBA / SARB model-risk regimes who need an auditable
              trail for every AI-assisted decision.
            </li>
            <li>
              <span className="text-white">CSRD / ESG reporting</span> teams who
              file ESRS datapoints and need a verifiable receipt for every
              figure.
            </li>
            <li>
              <span className="text-white">Defense + intelligence</span>{" "}
              programs running classified-adjacent workloads that require
              dedicated regions and BYOK.
            </li>
          </ul>
        </section>

        {/* CTA */}
        <section className="mt-20 pt-10 border-t border-white/[0.06]">
          <h2 className="font-serif text-3xl text-white mb-4">
            Email the founder directly.
          </h2>
          <p className="text-[15px] text-neutral-400 mb-8 leading-[1.6] max-w-2xl">
            No SDR funnel. No discovery-call gauntlet.{" "}
            <a
              href="mailto:christiaan@sovereignmatrix.agency"
              className="text-[#7dd3fc] hover:underline"
            >
              christiaan@sovereignmatrix.agency
            </a>{" "}
            · +27 79 162 3348 · Cape Town, ZA (UTC+2). First reply within 24h on
            weekdays, 48h on weekends.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-6 py-3 bg-[#B5532C] text-white text-[13px] font-mono tracking-tight rounded-[3px] hover:bg-[#C96234] transition-colors"
            >
              Book 15 minutes with the founder
              <span aria-hidden="true">→</span>
            </a>
            <Link
              href="/trust"
              className="inline-flex items-center gap-1.5 px-6 py-3 border border-white/[0.12] text-neutral-400 hover:text-white hover:border-white/25 text-[13px] font-mono tracking-tight rounded-[3px] transition-colors"
            >
              Review compliance evidence first
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-1.5 inline-block h-[5px] w-[5px] rounded-full shrink-0 ${
          on ? "bg-[#B5532C]" : "bg-neutral-700"
        }`}
      />
      <span className={on ? "text-neutral-300" : "text-neutral-600"}>
        {children}
        {!on && <span className="sr-only"> — not included</span>}
      </span>
    </li>
  );
}
