import type { Metadata } from "next";
import Link from "next/link";
import {
  Terminal,
  ShieldCheck,
  Download,
  Clock,
  Mail,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Pilot — Sovereign Matrix",
  description:
    "Two weeks. One regulated workflow. Cryptographically-signed receipts on every decision. Verify the math yourself before you reply.",
  openGraph: {
    title: "Sovereign Matrix — Two-week pilot",
    description:
      "Sign a pilot in 14 days. Download a real signed receipt bundle, verify it locally, then email the founder.",
  },
};

export const revalidate = 3600;

/**
 * /pilot — the conversion surface for procurement-grade buyers.
 *
 * A CISO or QPPV or chief credit officer landing here has one
 * question: "is this real?" The answer is a downloadable signed
 * receipt bundle they can verify with the OSS CLI before they ever
 * email us. That two-command verification is the page's center of
 * gravity — every other section supports it.
 *
 * Brand-strict cyan (audit) / copper (action). No video. No popup.
 * No chat widget. One CTA at the bottom.
 */
export default function PilotPage() {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          PILOT · 14 DAYS · ONE REGULATED WORKFLOW
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          Verify the math
          <br />
          <span className="text-[#B5532C]">before you reply.</span>
        </h1>
        <p className="text-[18px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          Two weeks. One workflow on your data. Receipts on every decision —
          Ed25519-signed today, ML-DSA-65 dual-signed where post-quantum forward
          security matters. If the math doesn&apos;t hold at your auditor&apos;s
          desk, the pilot ends and you owe nothing.
        </p>

        {/* THE DEMONSTRATION — the page's center of gravity */}
        <section className="mb-16 border border-cyan-500/25 bg-cyan-500/[0.04] rounded-[3px] p-6">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-3">
            <ShieldCheck className="w-3 h-3" /> Demonstration
          </p>
          <h2 className="font-serif text-2xl text-white mb-3">
            Three receipts. Two commands. Zero accounts.
          </h2>
          <p className="text-[14px] text-neutral-300 leading-[1.65] mb-5">
            Below is a real signed receipt bundle — three regulated-vertical
            decisions (insurance FNOL, pharma ICSR, loan underwriting). The
            Ed25519 public key is published alongside it. Anyone can verify
            both, locally, without an account.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <a
              href="/sample-bundle.json"
              download
              className="inline-flex items-center justify-between gap-3 px-4 py-3 rounded-[3px] border border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-100 hover:bg-cyan-500/[0.10] transition-colors"
            >
              <span className="flex items-center gap-2 text-[13px]">
                <Download className="w-4 h-4" />
                sample-bundle.json
              </span>
              <span className="font-mono text-[10px] text-cyan-300/70">
                MANIFEST
              </span>
            </a>
            <a
              href="/sample-bundle.ed25519.pem"
              download
              className="inline-flex items-center justify-between gap-3 px-4 py-3 rounded-[3px] border border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-100 hover:bg-cyan-500/[0.10] transition-colors"
            >
              <span className="flex items-center gap-2 text-[13px]">
                <Download className="w-4 h-4" />
                sample-bundle.ed25519.pem
              </span>
              <span className="font-mono text-[10px] text-cyan-300/70">
                PUBLIC KEY
              </span>
            </a>
          </div>

          <p className="font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-2">
            Then in any terminal:
          </p>
          <pre className="bg-black/40 border border-white/[0.06] rounded-[3px] p-4 overflow-x-auto text-[12px] text-neutral-200 font-mono leading-[1.6]">
            <Terminal className="inline w-3 h-3 text-cyan-300 mr-2 -mt-0.5" />
            <code>
              npx @sovereign-matrix/verifiable-receipts verify \{"\n"}
              {"  "}--manifest ./sample-bundle.json \{"\n"}
              {"  "}--pubkey ./sample-bundle.ed25519.pem
            </code>
          </pre>
          <p className="text-[11px] text-neutral-500 mt-3 leading-[1.6]">
            Exit code <span className="font-mono text-cyan-300">0</span> means
            the math holds. Edit a single byte of the manifest and rerun — the
            CLI returns{" "}
            <span className="font-mono text-[#E08558]">hash-mismatch</span> and
            exit <span className="font-mono text-[#E08558]">1</span>. The
            verifier is{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/packages/verifiable-receipts/bin/verify.mjs"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              ~200 LoC of pure-Node code
            </a>{" "}
            with no network calls. Your security team can audit it before
            running it.
          </p>
        </section>

        {/* The pilot mechanics */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            01 · PILOT MECHANICS
          </h2>
          <ol className="space-y-4 text-[14px] text-neutral-400 leading-[1.7]">
            <li>
              <span className="font-mono text-[#E08558] mr-3">DAY 0</span>
              <span className="text-white">Signed engagement letter.</span>{" "}
              Mutual NDA, scope locked to one workflow on one product line. IP
              terms: you own every receipt; we own the agent runtime.
              Kill-switch: 24h notice from either side, no penalty.
            </li>
            <li>
              <span className="font-mono text-[#E08558] mr-3">DAY 1–3</span>
              <span className="text-white">
                Read-only integration into your existing system of record.
              </span>{" "}
              We do not migrate your data. We do not touch your customers. The
              agent reads, writes a signed receipt to our chain, and hands the
              verdict back to your operator.
            </li>
            <li>
              <span className="font-mono text-[#E08558] mr-3">DAY 4–10</span>
              <span className="text-white">
                100–200 historical decisions replayed.
              </span>{" "}
              Your subject-matter expert dual-grades the verdicts side-by-side
              with the existing process. Discrepancies tune the Guardian rule
              set against your real exposure pattern.
            </li>
            <li>
              <span className="font-mono text-[#E08558] mr-3">DAY 11–14</span>
              <span className="text-white">
                Auditor walkthrough + go/no-go decision.
              </span>{" "}
              Your internal audit team verifies a sample of receipts using the
              same CLI shown above. If the math doesn&apos;t hold at their desk,
              we wind down — no invoice. If it does, we sign a 12-month contract
              at the production-tier price below.
            </li>
          </ol>
        </section>

        {/* Pricing — transparent */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            02 · PRICING
          </h2>
          <div className="border border-white/[0.06] rounded-[3px] overflow-hidden">
            <PriceRow
              tier="Pilot"
              monthly="$0"
              detail="14-day evaluation. No invoice issued. Limited to one workflow on one product line."
            />
            <PriceRow
              tier="Production"
              monthly="$10,000–$25,000 / mo"
              detail="12-month contract, single workflow, up to 100,000 signed receipts/month. Production SLA, 99.95% uptime, full audit-chain anchoring."
            />
            <PriceRow
              tier="Enterprise"
              monthly="custom"
              detail="Multi-workflow, dedicated CSM, 99.99% SLA, on-prem option. White-label dashboard and signed audit-log export included."
              last
            />
          </div>
          <p className="text-[11px] text-neutral-500 mt-3 leading-[1.6]">
            Pricing is fixed at signing. We do not bill per token, per decision,
            or per agent. We bill for the underwriting equivalent: access to the
            signed-receipt fabric for a defined workflow at a defined volume.
          </p>
        </section>

        {/* What we send back inside 24h */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            03 · WHAT ARRIVES IN YOUR INBOX WITHIN 24H
          </h2>
          <ul className="space-y-3 text-[14px] text-neutral-400 leading-[1.7]">
            <Bullet>
              Mutual NDA + engagement letter (3 pages, plain English, drafted
              against the Practising Law Institute fintech template).
            </Bullet>
            <Bullet>
              Workflow-specific Guardian rule pack pre-loaded with your
              vertical&apos;s citations (HIPAA / SR 11-7 / NAIC / DSCSA / CSRD /
              ICH E2B — whichever applies).
            </Bullet>
            <Bullet>
              A second sample receipt bundle scoped to{" "}
              <em className="not-italic text-neutral-300">your</em> product line
              — input/output fields drawn from your industry&apos;s standard
              data dictionary.
            </Bullet>
            <Bullet>
              A 30-minute video walking your security team through the verifier
              source code so the audit conversation is over before the kickoff
              call.
            </Bullet>
          </ul>
        </section>

        {/* CTA */}
        <section className="border-t border-white/[0.06] pt-12">
          <p className="flex items-center gap-2 font-mono text-[10px] text-[#E08558] tracking-[0.25em] uppercase mb-3">
            <Clock className="w-3 h-3" /> 24-hour response window
          </p>
          <h2 className="font-serif text-3xl text-white mb-4">
            Pilot a single workflow.
          </h2>
          <p className="text-[15px] text-neutral-400 mb-8 leading-[1.6] max-w-2xl">
            Email goes directly to the founder. No SDR, no marketing sequence.
            Include your industry, the workflow you have in mind, and the
            auditor / regulator you want to satisfy. A reply lands inside 24
            hours.
          </p>
          <a
            href="mailto:christiaan@sovereignmatrix.agency?subject=Pilot%20enquiry&body=Industry:%0AWorkflow:%0AAuditor%20or%20regulator:%0AExpected%20volume:%0ATimeline:"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#B5532C] text-white text-[13px] font-mono tracking-[0.1em] rounded-[3px] hover:bg-[#C96234] transition-colors"
          >
            <Mail className="w-4 h-4" />
            Email the founder
            <ArrowRight className="w-4 h-4" />
          </a>
        </section>

        {/* Footer trust strip */}
        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            See also{" "}
            <Link
              href="/spec"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /spec
            </Link>{" "}
            (VAOS 2.0 + 3.0 wire formats),{" "}
            <Link
              href="/security"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /security
            </Link>{" "}
            (compliance posture),{" "}
            <Link
              href="/auditor/replay"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /auditor/replay
            </Link>{" "}
            (live verifier UI),{" "}
            <Link
              href="/sales"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /sales
            </Link>{" "}
            (multi-workflow enterprise terms).
          </p>
        </div>
      </div>
    </main>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300 mt-1 shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  );
}

function PriceRow({
  tier,
  monthly,
  detail,
  last,
}: {
  tier: string;
  monthly: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[140px_180px_1fr] ${last ? "" : "border-b border-white/[0.06]"}`}
    >
      <div className="px-4 py-4 font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase md:border-r border-white/[0.06] bg-white/[0.015]">
        {tier}
      </div>
      <div className="px-4 py-4 font-mono text-[13px] text-[#E08558] md:border-r border-white/[0.06]">
        {monthly}
      </div>
      <div className="px-4 py-4 text-[13px] text-neutral-400 leading-[1.55]">
        {detail}
      </div>
    </div>
  );
}
