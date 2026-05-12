/**
 * /insurance — AI E&O underwriting positioning surface.
 *
 * Target ICP: actuaries + AI-risk underwriters at carriers writing AI
 * Errors & Omissions policies (Munich Re, Beazley, AXA XL, Lloyd's
 * syndicates). Procurement language: signals, risk-pricing inputs,
 * recoveries, subrogation evidence.
 *
 * Server-rendered. Cyan accent (audit/infrastructure surface).
 */

import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  Database,
  ArrowRight,
  Calculator,
  Anchor,
  GitBranch,
  FileLock,
  ExternalLink,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface Block {
  icon: typeof Shield;
  title: string;
  body: string;
}

const SIGNALS: Block[] = [
  {
    icon: GitBranch,
    title: "Per-tenant Merkle chain root",
    body: "Each Sovereign customer's receipt history rolls up to a single 256-bit root. A snapshot of last week's root detects ANY change to that tenant's historical receipts — deletions, mutations, insertions — at constant verification cost.",
  },
  {
    icon: FileLock,
    title: "Tamper-evidence at O(log N)",
    body: "Inclusion proofs let an underwriter verify whether a specific receipt is in the tenant's official chain in 20 hashes (for 1M receipts). Drop subrogation cost on AI-incident claims by an order of magnitude.",
  },
  {
    icon: Anchor,
    title: "Bitcoin-anchored attestation (OpenTimestamps)",
    body: "Team-tier customers' chain roots are notarized to the Bitcoin blockchain via OpenTimestamps. Third-party timestamp the carrier cannot replay or backdate — admissible in court.",
  },
  {
    icon: Database,
    title: "API-first risk integration",
    body: "GET /api/me/audit-root returns the signed chain envelope. POST /api/verify validates any single receipt. Drop these into your existing actuarial pipeline; no on-premise install, no contracts with the insured's stack.",
  },
];

const HOW: Block[] = [
  {
    icon: Calculator,
    title: "Tier the premium on chain-integrity score",
    body: "Customers with continuous receipt coverage + zero gaps + OpenTimestamps notarization on the chain root price differently than customers with sparse coverage. Same way SOC 2 II tiers vs untimed I in cyber insurance today.",
  },
  {
    icon: CheckCircle2,
    title: "Subrogation evidence on every claim",
    body: "AI does X, customer sues vendor, vendor sues their AI tool. Every step in the chain has an HMAC-signed canonical projection — the receipt IS the evidence. Recovery rates jump because the timeline of who-knew-what-when is cryptographically pinned.",
  },
  {
    icon: ArrowRight,
    title: "B2B2B distribution",
    body: "Carrier mandates Sovereign Verified on policies above a threshold; vendors adopt to maintain coverage; their customers see the badge. Three-sided network effect for the carrier.",
  },
];

export default function InsurancePage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div
        className="fixed inset-x-0 top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          ← Sovereign Matrix
        </Link>

        <header className="mb-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <Shield className="h-3 w-3" />
            AI INSURANCE · UNDERWRITING LAYER
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Price AI risk with cryptographic signals.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Sovereign&apos;s receipt-chain integrity score is the audit signal
            AI E&amp;O underwriters have been missing. Per-tenant Merkle chain
            root, tamper-evidence at O(log N), Bitcoin-anchored notarization.
            Embed as a risk-pricing input.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="mailto:partnerships@sovereignmatrix.agency?subject=AI%20Insurance%20Integration%20—%20Sovereign%20Matrix"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
            >
              Schedule a call →
            </Link>
            <Link
              href="/api-docs"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
            >
              See the API contract
            </Link>
          </div>
        </header>

        <section className="mb-14">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            The signals
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {SIGNALS.map((b) => (
              <SpotlightCard
                key={b.title}
                as="article"
                accent="cyan"
                radius={300}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl"
              >
                <b.icon
                  className="mb-3 h-5 w-5 text-cyan-300"
                  aria-hidden="true"
                />
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {b.title}
                </h3>
                <p className="text-xs leading-relaxed text-neutral-400">
                  {b.body}
                </p>
              </SpotlightCard>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            How carriers use it
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {HOW.map((b) => (
              <SpotlightCard
                key={b.title}
                as="article"
                accent="cyan"
                radius={280}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl"
              >
                <b.icon
                  className="mb-3 h-5 w-5 text-cyan-300"
                  aria-hidden="true"
                />
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {b.title}
                </h3>
                <p className="text-xs leading-relaxed text-neutral-400">
                  {b.body}
                </p>
              </SpotlightCard>
            ))}
          </div>
        </section>

        <section className="mb-10 overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.05] to-transparent p-6 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <h2 className="mb-2 text-sm font-semibold text-white">
                For underwriting + actuarial teams
              </h2>
              <p className="text-sm leading-relaxed text-neutral-300">
                We work directly with Lloyd&apos;s syndicates, AI E&amp;O MGAs,
                and reinsurance carriers building the next generation of
                AI-specific policies.{" "}
                <a
                  href="mailto:partnerships@sovereignmatrix.agency"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  partnerships@sovereignmatrix.agency
                </a>{" "}
                — NDA + sample data within 48h.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/industries"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
          >
            All industries
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href="/compliance"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
          >
            For compliance teams
          </Link>
        </div>
      </div>
    </div>
  );
}
