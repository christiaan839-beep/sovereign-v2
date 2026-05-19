import type { Metadata } from "next";
import Link from "next/link";
import { Radio, Globe2, ArrowRight, Github } from "lucide-react";
import { WitnessLiveFeed } from "./WitnessLiveFeed";

export const metadata: Metadata = {
  title: "Witness Federation — Transparency Log — Sovereign Matrix",
  description:
    "The public registry of independent witnesses cosigning the Sovereign Matrix transparency log. Universities, NGOs, regulators, and security researchers each run a witness node and co-sign every Signed Tree Head — Byzantine-fault-tolerant accountability for autonomous AI.",
};

// 60s ISR — the witness federation evolves slowly.
export const revalidate = 60;

const SUPPORTED_REGIONS: Array<{
  region: string;
  flag: string;
  status: "active" | "pending" | "wanted";
  notes: string;
}> = [
  {
    region: "EU · Berlin",
    flag: "🇪🇺",
    status: "wanted",
    notes:
      "Looking for an EU-based university or NGO to operate the first EU witness. Public-interest mandate, ~$5/month VPS cost.",
  },
  {
    region: "EU · Brussels",
    flag: "🇪🇺",
    status: "wanted",
    notes:
      "EU AI Office adjacent. Witness operated by an AI-policy think tank would make the federation regulator-credible.",
  },
  {
    region: "US East · DC",
    flag: "🇺🇸",
    status: "wanted",
    notes:
      "Witness near US federal procurement orbit (NIST / OMB / GSA contractors).",
  },
  {
    region: "US West · Bay Area",
    flag: "🇺🇸",
    status: "wanted",
    notes:
      "Independent AI-safety org (e.g. ARC Evals, METR-style group) ideal here.",
  },
  {
    region: "Africa · Cape Town",
    flag: "🇿🇦",
    status: "active",
    notes:
      "Sovereign Matrix founder-operator witness. Cosigns every STH but COUNTS AS THE ISSUER — does not contribute to the trust threshold.",
  },
  {
    region: "South America · São Paulo",
    flag: "🇧🇷",
    status: "wanted",
    notes: "LATAM AI-governance NGO opportunity. Spans GDPR-LGPD interop.",
  },
  {
    region: "Asia · Singapore",
    flag: "🇸🇬",
    status: "wanted",
    notes:
      "MAS-AI-governance-adjacent witness. Bridges PDPA + EU AI Act compliance evidence.",
  },
  {
    region: "Asia · Tokyo",
    flag: "🇯🇵",
    status: "wanted",
    notes:
      "AI Safety Institute Japan candidate witness — strong public-mandate alignment.",
  },
];

export default function WitnessFederationPage() {
  return (
    <main className="min-h-dvh bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <Link
            href="/transparency"
            className="text-[12px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors tracking-tight"
          >
            ← Transparency log
          </Link>
        </div>

        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6 flex items-center gap-2">
          <Radio className="w-3 h-3 text-[#B5532C]" aria-hidden="true" />
          WITNESS · FEDERATION · BYZANTINE FAULT TOLERANCE
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          Trust the math.
          <br />
          <span className="text-[#B5532C]">Not the issuer.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-3xl mb-6">
          The Sovereign Matrix transparency log doesn&apos;t ask you to trust
          us. It asks you to trust an open federation of independent witnesses —
          each cosigning every Signed Tree Head with their own Ed25519 key, each
          publishing their public key independently, each detecting log
          equivocation by gossip with peers.
        </p>
        <p className="text-[15px] text-neutral-500 leading-[1.6] max-w-3xl">
          When 5+ independent witnesses have cosigned the same STH, the issuer
          cannot have lied about the log&apos;s contents — they would have had
          to compromise every witness independently, which is the
          Byzantine-fault-tolerance model used by Certificate Transparency,
          Sigstore Rekor, and (in spirit) the proof-of-stake validator set of
          every modern blockchain.
        </p>

        {/* Live feed */}
        <section className="mt-16">
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-white">
              Live observations
            </h2>
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-[0.22em]">
              auto-refresh · 60s
            </span>
          </div>
          <p className="text-[13px] text-neutral-500 leading-relaxed max-w-2xl mb-6">
            Every Signed Tree Head this issuer has emitted, with every
            cosignature recorded against it. A monitor running this page in two
            tabs across geographic regions can detect a split-view attack within
            one refresh interval.
          </p>
          <WitnessLiveFeed />
        </section>

        {/* Geographic federation status */}
        <section className="mt-20">
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-white mb-3">
            Federation map
          </h2>
          <p className="text-[13px] text-neutral-500 leading-relaxed max-w-2xl mb-8">
            Where we have witness coverage today and where we are seeking it.
            The federation is intentionally global because log equivocation
            defenses degrade if all witnesses sit in one jurisdiction.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {SUPPORTED_REGIONS.map((r) => (
              <div
                key={r.region}
                className={`rounded-[6px] border p-4 ${
                  r.status === "active"
                    ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                    : r.status === "pending"
                      ? "border-amber-500/30 bg-amber-500/[0.04]"
                      : "border-white/[0.06] bg-white/[0.015]"
                }`}
              >
                <div className="flex items-baseline justify-between mb-2 gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[18px]" aria-hidden="true">
                      {r.flag}
                    </span>
                    <h3 className="font-serif text-[17px] tracking-tight text-white">
                      {r.region}
                    </h3>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded ${
                      r.status === "active"
                        ? "text-emerald-300 border border-emerald-500/30"
                        : r.status === "pending"
                          ? "text-amber-300 border border-amber-500/30"
                          : "text-neutral-400 border border-white/[0.08]"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="text-[12px] text-neutral-400 leading-[1.55]">
                  {r.notes}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How to operate a witness */}
        <section className="mt-20">
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-white mb-3">
            Operate a witness
          </h2>
          <p className="text-[13px] text-neutral-500 leading-relaxed max-w-2xl mb-6">
            Any independent party can become a witness. Cost: ~$5/mo VPS. Risk:
            zero — you cosign STHs the issuer has already published, so the
            worst failure is a false alarm if your local clock is wrong. Reward:
            you appear in the public registry, contributing to the trust
            threshold every regulated buyer measures the platform against.
          </p>
          <div className="rounded-[6px] border border-cyan-500/20 bg-black/40 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                Run a witness · Apache 2.0
              </p>
              <p className="text-[10px] font-mono text-neutral-600">
                @sovereign-matrix/verifiable-receipts
              </p>
            </div>
            <pre className="px-5 py-4 overflow-x-auto font-mono text-[13px] leading-[1.6] text-cyan-300/95">
              {`# 1. Generate an Ed25519 key pair
openssl genpkey -algorithm ed25519 -out witness.pem
openssl pkey -in witness.pem -pubout -out witness-pub.pem

# 2. Publish witness-pub.pem at a stable URL (GitHub raw works fine)
# 3. Run the witness daemon (polls every hour by default)
npx @sovereign-matrix/verifiable-receipts witness \\
  --url https://sovereignmatrix.agency \\
  --key ./witness.pem \\
  --witness-id "Your Org · City" \\
  --public-key-url https://your-domain.org/witness-pub.pem \\
  --interval 3600`}
            </pre>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/verifiable-receipts/bin"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              Witness CLI source
            </Link>
            <Link
              href="mailto:witness@sovereignmatrix.agency"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B5532C] text-white font-semibold text-[13px] rounded-[3px] hover:bg-[#C96234] transition-colors tracking-tight"
            >
              <Globe2 className="w-3.5 h-3.5" />
              Apply to operate a regional witness
            </Link>
          </div>
        </section>

        {/* Threat model */}
        <section className="mt-20">
          <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-white mb-3">
            Threat model
          </h2>
          <p className="text-[13px] text-neutral-500 leading-relaxed max-w-2xl mb-6">
            What this federation protects against, ranked by severity.
          </p>
          <div className="rounded-[8px] border border-white/[0.06] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-white/[0.02] text-neutral-500 font-mono uppercase tracking-[0.14em] text-[10px]">
                <tr>
                  <th className="text-left px-4 py-3">Attack</th>
                  <th className="text-left px-4 py-3">Defended by</th>
                  <th className="text-left px-4 py-3">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                <tr>
                  <td className="px-4 py-3 text-neutral-300">
                    Issuer signs two different rootHashes at the same treeSize
                    (log equivocation)
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    Independent witness gossip — any pair of witnesses with
                    different views immediately exposes the split
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-400">
                    2+ witnesses
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-neutral-300">
                    Issuer retroactively rewrites a Merkle leaf
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    Witness has the old root recorded with timestamp +
                    signature; the issuer cannot un-publish what was already
                    cosigned
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-400">
                    1+ witness
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-neutral-300">
                    Adversary compromises the issuer&apos;s signing key
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    Witnesses still record observations against the OLD key;
                    operators detect new signatures with a different key
                    immediately
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-400">
                    1+ witness
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-neutral-300">
                    Targeted split-view (issuer shows different STH to different
                    regions)
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    Geographic distribution of witnesses + gossip protocol
                  </td>
                  <td className="px-4 py-3 font-mono text-amber-400">
                    3+ witnesses in distinct jurisdictions
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-neutral-300">
                    Post-quantum adversary running Shor&apos;s algorithm
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    ML-DSA-65 (FIPS 204) dual-signing layer alongside Ed25519
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-400">
                    Built into every receipt
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-neutral-300">
                    ASI-class adversary compromising 90% of witnesses
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    Remaining 10% record contradictory observations → public
                    detection
                  </td>
                  <td className="px-4 py-3 font-mono text-amber-400">
                    100+ witnesses globally
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* References */}
        <section className="mt-20 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7] max-w-3xl">
            Same primitive as{" "}
            <a
              href="https://datatracker.ietf.org/doc/html/rfc9162"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              RFC 9162 Certificate Transparency v2
            </a>{" "}
            and{" "}
            <a
              href="https://docs.sigstore.dev/logging/overview/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              Sigstore Rekor
            </a>
            . Our submission to{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/specs/ietf-draft-vaos-00.md"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              IETF as an Internet-Draft
            </a>{" "}
            extends this pattern to AI agent operation receipts.
          </p>
          <p className="mt-3">
            <Link
              href="/transparency/verify"
              className="text-[12px] font-mono text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              Verify an inclusion proof in your browser{" "}
              <ArrowRight className="inline w-3 h-3 ml-1" />
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
