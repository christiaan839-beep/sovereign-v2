import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";

/**
 * /pitch — 60-second narrative (Cook 157).
 *
 * The single URL the founder shares in a cold DM BEFORE a meeting.
 * Distinct from /investors (the full data room) — this is the
 * top-of-funnel hook that gets the reply.
 *
 * Designed for skim: 5 vertically-stacked sections, each readable
 * in under 10 seconds, ending with a single CTA.
 */

export const metadata: Metadata = {
  title: "60-Second Pitch · Sovereign Matrix",
  description:
    "Cryptographic verification for every AI agent decision. Read in 60 seconds. Book the call.",
  alternates: { canonical: "/pitch" },
  robots: { index: false, follow: false },
};

const PROOF = [
  "140 agent endpoints across 8 LLM providers",
  "2,400+ tests passing · 0 type errors · 0 lint errors",
  "7 cryptographic primitives nobody else has",
  "22 vertical landings mapped to specific regulators",
  "Live demo: verify a real receipt in your browser",
];

export default function PitchPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200 selection:bg-cyan-500/30">
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-3">
          60-Second Pitch
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
          Vanta sold for $2.45B without the crypto moat.{" "}
          <span className="text-cyan-400">We have it.</span>
        </h1>

        <section className="mt-12 space-y-3 text-base md:text-lg leading-relaxed text-neutral-300">
          <p>
            <span className="text-white font-semibold">The problem:</span>{" "}
            Auditors trust AI-generated outputs by squinting at a screenshot.
            CSRD, SR 11-7, NERC CIP, 21 CFR Part 11, NAIC — every regulator now
            demands &ldquo;decisional traceability&rdquo; nobody can actually
            ship.
          </p>
          <p>
            <span className="text-white font-semibold">What we built:</span>{" "}
            Every agent run produces a cryptographically signed receipt the
            auditor verifies in their own browser tab. HMAC + Ed25519 + Merkle
            inclusion proofs + ZK pass-rate proofs + anonymous- credential
            auditor seats — primitives Lindy, Clay, Manus, CrewAI categorically
            don&rsquo;t have.
          </p>
          <p>
            <span className="text-white font-semibold">Who buys:</span> Big-4
            sustainability practices for the CSRD wedge. Chief Model Risk
            Officers at regional banks. Heads of QA at top-20 pharma. $200-600K
            ACV per logo. Auditor Replay Seat add-on at $50K/seat on top.
          </p>
          <p>
            <span className="text-white font-semibold">Where we are:</span> Solo
            technical founder. 54 cooks shipped this month. Self-serve revenue
            surface live (`/starter-packs` $99-$999 SKUs). Stripe webhook →
            Auditor Replay Seat provisioning fully wired. Pre-revenue but the
            revenue loop is technically complete the moment the first customer
            pays.
          </p>
          <p>
            <span className="text-white font-semibold">The ask:</span>{" "}
            $500K-$1.5M seed extension. 9-month runway. 1 GTM partner hire. 2
            paid design-partner pilots close. AI Grant + DARPA SBIR applications
            in flight in parallel.
          </p>
        </section>

        <section className="mt-12">
          <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 mb-4">
            Verifiable proof (open codebase)
          </p>
          <ul className="space-y-2">
            {PROOF.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-neutral-300"
              >
                <Check className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 p-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04]">
          <p className="text-sm text-neutral-300 leading-relaxed mb-4">
            The full data room — comparable exits, capital plan, vertical ACVs,
            trajectory — at{" "}
            <Link
              href="/investors"
              className="text-cyan-400 underline font-semibold"
            >
              sovereignmatrix.agency/investors
            </Link>
            .
          </p>
          <p className="text-sm text-neutral-300 leading-relaxed mb-6">
            The 60-second moment that makes this real — verify a signed receipt
            in your browser — at{" "}
            <Link
              href="/demo/verify-receipt"
              className="text-cyan-400 underline font-semibold"
            >
              /demo/verify-receipt
            </Link>
            .
          </p>
          <a
            href="mailto:founder@sovereignmatrix.agency?subject=Sovereign%20Matrix%20-%2030%20min%20intro"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Book a 30-minute intro
            <ArrowRight className="w-4 h-4" />
          </a>
        </section>

        <p className="mt-12 text-[11px] text-neutral-500">
          founder@sovereignmatrix.agency &middot; sovereignmatrix.agency
        </p>
      </main>
    </div>
  );
}
