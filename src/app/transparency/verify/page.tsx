import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { InclusionVerifier } from "./InclusionVerifier";

export const metadata: Metadata = {
  title: "Verify an Inclusion Proof — Transparency Log — Sovereign Matrix",
  description:
    "Browser-local inclusion-proof verifier. Fetch a proof from /api/transparency/proof, run the SHA-256 fold via Web Crypto in your browser, confirm the recomputed root matches the published Signed Tree Head. No server-side verification trust.",
};

// 60s ISR — page chrome is static; the widget itself is fully client-side.
export const revalidate = 60;

/**
 * /transparency/verify — interactive proof verifier.
 *
 * The widget below fetches the inclusion proof from our public
 * endpoint, but runs every SHA-256 hash in the fold via the browser's
 * Web Crypto API. The user's browser is the verifier; our server is
 * only the source of the proof + the published root.
 *
 * Procurement-grade: a CISO can confirm the central claim
 * ("we can't lie about which receipts are in the log") in the time
 * it takes a button click to round-trip.
 */
export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          TRANSPARENCY · VERIFY · IN-BROWSER
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          Verify a proof
          <br />
          <span className="text-[#B5532C]">in your browser.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          Pick any leaf in the current transparency log. The widget below
          fetches the inclusion proof from the public endpoint, then runs every
          SHA-256 hash in the fold{" "}
          <em className="not-italic text-neutral-300">locally</em> via the
          browser&apos;s Web Crypto API. If the recomputed root matches the
          published Signed Tree Head, the leaf is provably in the log — and you
          didn&apos;t have to trust our server for the verification step.
        </p>

        <section className="mb-12">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-4">
            <ShieldCheck className="w-3 h-3" /> RUN THE PROOF
          </p>
          <InclusionVerifier />
        </section>

        <section className="mb-12 p-4 border border-white/[0.06] bg-white/[0.015] rounded-[3px]">
          <p className="font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-2">
            What this widget does NOT trust us for
          </p>
          <ul className="text-[13px] text-neutral-400 leading-[1.7] space-y-1.5 list-disc list-inside">
            <li>
              The SHA-256 algorithm (it&apos;s the browser&apos;s, not ours)
            </li>
            <li>
              The Merkle fold logic (it&apos;s ~50 LoC, visible in the page
              source)
            </li>
            <li>
              The expected root (it comes from the public STH endpoint, but you
              can independently fetch the STH yourself + paste it)
            </li>
          </ul>
          <p className="text-[12px] text-neutral-500 leading-[1.65] mt-3">
            What it DOES trust us for: that the proof we returned was
            constructed against the leaves we actually appended. Adding
            cross-witness signatures (see{" "}
            <Link
              href="/transparency#witness-protocol"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              the witness protocol
            </Link>
            ) reduces this last trust assumption to majority-of-witnesses.
          </p>
        </section>

        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            See also{" "}
            <Link
              href="/transparency"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /transparency
            </Link>{" "}
            (STH + witnesses),{" "}
            <Link
              href="/api/transparency/proof?kind=inclusion&index=0"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              raw proof endpoint
            </Link>
            ,{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/packages/verifiable-receipts/src/transparency.ts"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              reference verifier (Apache-2.0)
            </a>
            <ArrowRight className="inline w-3 h-3 ml-1" />
          </p>
        </div>
      </div>
    </main>
  );
}
