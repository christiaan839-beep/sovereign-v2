import type { Metadata } from "next";
import Link from "next/link";
import { getSignedLedger, type MilestoneAttestation } from "@/lib/built-ledger";
import { ShieldCheck, Hash, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Built — Sovereign Matrix",
  description:
    "Cryptographically-anchored ledger of every shipped milestone. Each line carries a SHA-256 content hash and a signature you can independently verify.",
  openGraph: {
    title: "Sovereign Matrix — What's actually shipped",
    description:
      "Append-only log of shipped work. Every line signed. Verify any of them.",
  },
};

// ISR — append-only ledger; regenerate hourly so newly-shipped waves
// surface without redeploy.
export const revalidate = 3600;

/**
 * /built — Cryptographically-anchored shipped-work ledger.
 *
 * Counterweight to /roadmap (forward-looking marketing). This page is
 * the inverse: an append-only log of what's already shipped, each
 * milestone pinned to the commit it landed in and signed with the
 * same primitive that signs every receipt. Visitors can verify any
 * row without holding any secret.
 *
 * Pure server component — renders the ledger at build / revalidate
 * time so the signatures shown ARE the bytes a verifier would compute.
 */
export default function BuiltPage() {
  const { digest, count, entries } = getSignedLedger();

  // Order shipped-first descending for editorial purposes.
  const ordered = [...entries].reverse();

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-4xl mx-auto">
        {/* Editorial header */}
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          BUILT · APPEND-ONLY · {count} ENTRIES
        </p>
        <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-[-0.02em] text-white mb-5">
          What&apos;s actually shipped.
          <br />
          <span className="text-[#B5532C]">Cryptographically signed.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-10">
          Every entry below is signed with the same Ed25519 / HMAC primitive
          every Sovereign receipt uses. Hash any line, hand it to your auditor,
          or fetch <code className="text-cyan-300">/api/built/ledger</code> for
          the machine-readable version. Append-only — no edits, ever.
        </p>

        {/* Ledger digest */}
        <div className="mb-12 px-5 py-4 border border-cyan-500/20 bg-cyan-500/[0.04] rounded-[3px]">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.2em] uppercase mb-2">
            <Hash className="w-3 h-3" /> Ledger digest (SHA-256)
          </p>
          <code className="block font-mono text-[12px] text-cyan-300 break-all leading-[1.6]">
            {digest}
          </code>
          <p className="text-[11px] text-neutral-500 mt-2">
            Re-hash by fetching the JSON ledger and computing SHA-256 over its
            canonical concatenation. Any append produces a new digest.
          </p>
        </div>

        {/* Entries */}
        <div className="space-y-5">
          {ordered.map((m) => (
            <MilestoneCard key={m.entry.slug} m={m} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            Forward-looking roadmap →{" "}
            <Link
              href="/roadmap"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /roadmap
            </Link>
            . Verify any receipt by id at{" "}
            <Link
              href="/auditor/replay"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /auditor/replay
            </Link>
            . Raw machine-readable ledger at{" "}
            <code className="text-neutral-300">/api/built/ledger</code>.
          </p>
        </div>
      </div>
    </main>
  );
}

function MilestoneCard({ m }: { m: MilestoneAttestation }) {
  const dateLabel = new Date(m.entry.shippedAt).toISOString().slice(0, 10);
  const categoryTone =
    m.entry.category === "security" || m.entry.category === "compliance"
      ? "text-cyan-300 border-cyan-500/25 bg-cyan-500/[0.04]"
      : "text-[#E08558] border-[#B5532C]/25 bg-[#B5532C]/[0.04]";
  return (
    <article className="border border-white/[0.06] rounded-[3px] p-6 bg-white/[0.015]">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="font-mono text-[10px] text-neutral-500 tracking-[0.15em]">
              W{m.entry.wave.toString().padStart(2, "0")} · {dateLabel}
            </span>
            <span
              className={`font-mono text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-[2px] border ${categoryTone}`}
            >
              {m.entry.category}
            </span>
            <code className="font-mono text-[10px] text-neutral-600">
              {m.entry.commit}
            </code>
          </div>
          <h2 className="font-serif text-2xl text-white tracking-[-0.01em] leading-tight">
            {m.entry.title}
          </h2>
        </div>
        {m.entry.verifyHref && (
          <Link
            href={m.entry.verifyHref}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 tracking-tight"
          >
            verify
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <p className="text-[14px] text-neutral-400 leading-[1.6] mb-5">
        {m.entry.description}
      </p>

      <details className="border-t border-white/[0.04] pt-3">
        <summary className="flex items-center gap-2 font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase cursor-pointer hover:text-neutral-300">
          <ShieldCheck className="w-3 h-3" />
          Show cryptographic attestation
        </summary>
        <div className="mt-3 space-y-3 text-[11px] font-mono leading-[1.6]">
          <div>
            <p className="text-neutral-500 mb-1">Content hash (SHA-256):</p>
            <code className="block text-cyan-300 break-all">
              {m.contentHash}
            </code>
          </div>
          <div>
            <p className="text-neutral-500 mb-1">Signature:</p>
            <code className="block text-[#E08558] break-all">
              {m.signature}
            </code>
          </div>
          <div>
            <p className="text-neutral-500 mb-1">Canonical projection:</p>
            <code className="block text-neutral-400 break-all">
              {m.canonical}
            </code>
          </div>
        </div>
      </details>
    </article>
  );
}
