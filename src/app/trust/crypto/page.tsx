/**
 * SOVEREIGN MATRIX — /trust/crypto (Wave 153).
 *
 * Public-facing cryptographic trust page. Shows the latest Merkle
 * root, 7-day cohort claim, and verifier spec — everything an
 * investor / auditor / skeptic needs to verify the platform's
 * signed-receipt fabric without logging in.
 *
 * Server component, 5-minute route-level cache. Inert HTML so the
 * proof lives forever in browser archives + search caches.
 */

import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";

interface TrustSnapshot {
  generatedAt: string;
  date: string;
  merkle: {
    spec: string;
    root: string;
    leafCount: number;
    firstLeafId?: string;
    lastLeafId?: string;
  };
  cohort: {
    window: { start: string; end: string };
    countBracket: { floor: number; ceiling: number };
    approvalBracket: { low: number; high: number };
    publicClaim: string;
  };
  verifier: {
    spec: string;
    leafPrefix: string;
    internalNodePrefix: string;
    hash: string;
    repoPath: string;
  };
  conformance: { publicKeyFingerprint: string | null };
}

export const metadata: Metadata = {
  title:
    "Cryptographic trust · Daily Merkle root + 7-day cohort claim · Sovereign Matrix",
  description:
    "Sovereign Matrix publishes a daily Merkle root over every signed agent run + a 7-day selective-disclosure cohort claim. Verifiable without trusting our servers. Post-quantum dual-signed (Ed25519 + ML-DSA-65).",
  alternates: { canonical: "/trust/crypto" },
};

export const dynamic = "force-dynamic";
export const revalidate = 300;

async function fetchSnapshot(): Promise<TrustSnapshot | null> {
  try {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    const res = await fetch(`${proto}://${host}/api/trust/snapshot`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as TrustSnapshot;
  } catch {
    return null;
  }
}

export default async function TrustCryptoPage() {
  const snap = await fetchSnapshot();

  return (
    <main className="relative min-h-screen bg-[#030303] text-neutral-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <nav className="relative z-10 border-b border-white/5 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-wide text-white">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/trust"
              className="text-xs text-neutral-400 transition-colors hover:text-white"
            >
              Compliance
            </Link>
            <Link
              href="/spec"
              className="text-xs text-neutral-400 transition-colors hover:text-white"
            >
              Spec
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-neutral-200"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 sm:py-24">
        <div className="mb-12">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300">
            Public · cryptographic trust
          </div>
          <h1 className="font-serif text-[clamp(2rem,5vw,3.6rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
            Trust, not promises.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Every Sovereign Matrix agent run produces a cryptographically signed
            receipt. Every UTC day, a Merkle root over that day&apos;s receipts
            is published below — anyone holding a receipt can independently
            verify membership without trusting our servers. This page is
            auto-generated from the live receipt fabric.
          </p>
        </div>

        {!snap ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-6 text-sm text-amber-300">
            Snapshot temporarily unavailable. The receipt fabric is still
            recording; this page will populate on the next render.
          </div>
        ) : (
          <>
            {/* ─── Merkle root card ─────────────────────────────── */}
            <section className="mb-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-cyan-500/[0.05] via-cyan-500/[0.01] to-transparent p-7 backdrop-blur-xl">
              <div className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-cyan-300">
                Daily Merkle root · {snap.date}
              </div>
              <div className="break-all rounded-lg border border-white/[0.06] bg-black/40 px-4 py-3 font-mono text-[12px] leading-relaxed text-cyan-200">
                {snap.merkle.root || "(no receipts on this day)"}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-[11px] sm:grid-cols-3">
                <Cell label="Spec" value={snap.merkle.spec} />
                <Cell
                  label="Leaf count"
                  value={snap.merkle.leafCount.toLocaleString()}
                />
                <Cell
                  label="Hash"
                  value={`${snap.verifier.hash} · leaf ${snap.verifier.leafPrefix} / node ${snap.verifier.internalNodePrefix}`}
                />
              </div>
              {snap.merkle.firstLeafId && (
                <div className="mt-4 text-[11px] text-neutral-500">
                  Day spans receipts{" "}
                  <code className="font-mono text-neutral-300">
                    {snap.merkle.firstLeafId.slice(0, 12)}…
                  </code>{" "}
                  →{" "}
                  <code className="font-mono text-neutral-300">
                    {snap.merkle.lastLeafId?.slice(0, 12)}…
                  </code>
                </div>
              )}
            </section>

            {/* ─── 7-day cohort claim ───────────────────────────── */}
            <section className="mb-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-amber-500/[0.05] via-amber-500/[0.01] to-transparent p-7 backdrop-blur-xl">
              <div className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-300">
                7-day cohort claim · {snap.cohort.window.start} →{" "}
                {snap.cohort.window.end}
              </div>
              <p className="text-[15px] leading-relaxed text-white">
                {snap.cohort.publicClaim}
              </p>
              <p className="mt-4 text-[11px] leading-relaxed text-neutral-500">
                Buckets shown are order-of-magnitude (counts) and decile
                (approval rate) — the platform commits to exact numbers
                privately and reveals them at audit time. Selective- disclosure
                proof, not zero-knowledge, but unforgeable once committed.
              </p>
            </section>

            {/* ─── Verification instructions ─────────────────────── */}
            <section className="mb-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 backdrop-blur-xl">
              <div className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                Verify a receipt yourself
              </div>
              <ol className="space-y-3 text-[13px] leading-relaxed text-neutral-300">
                <li>
                  <span className="text-neutral-500">1.</span> Obtain any
                  receipt you hold (returned in <code>_receipt.id</code> +{" "}
                  <code>_receipt.signature</code> on every signed run).
                </li>
                <li>
                  <span className="text-neutral-500">2.</span> Reconstruct the
                  canonical leaf string:{" "}
                  <code className="font-mono text-neutral-200">
                    id|agentName|modelUsed|durationMs|trustDecision|signature|createdAt
                  </code>
                </li>
                <li>
                  <span className="text-neutral-500">3.</span> Compute{" "}
                  <code className="font-mono text-neutral-200">
                    leafHash = sha256(0x00 || canonical)
                  </code>{" "}
                  and verify your Merkle path against the day&apos;s root using
                  the verifier in{" "}
                  <code className="font-mono text-neutral-200">
                    {snap.verifier.repoPath}
                  </code>
                  .
                </li>
                <li>
                  <span className="text-neutral-500">4.</span> Compare the
                  per-receipt Ed25519 signature against the public key
                  fingerprint:{" "}
                  <code className="font-mono text-neutral-200">
                    {snap.conformance.publicKeyFingerprint
                      ? `${snap.conformance.publicKeyFingerprint}…`
                      : "(not provisioned in this deployment)"}
                  </code>
                </li>
              </ol>
              <div className="mt-5 grid grid-cols-1 gap-3 text-[11px] sm:grid-cols-2">
                <Cell label="Verifier spec" value={snap.verifier.spec} />
                <Cell
                  label="Conformance key SHA-256"
                  value={
                    snap.conformance.publicKeyFingerprint
                      ? `${snap.conformance.publicKeyFingerprint}…`
                      : "not provisioned"
                  }
                />
              </div>
            </section>

            {/* ─── Crypto stack ────────────────────────────────── */}
            <section className="mb-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 backdrop-blur-xl">
              <div className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-300">
                Crypto stack
              </div>
              <ul className="space-y-2 text-[13px] leading-relaxed text-neutral-300">
                <li>
                  • <span className="text-white">HMAC-SHA256</span> on every
                  receipt — fast tamper detection
                </li>
                <li>
                  • <span className="text-white">Ed25519</span> signature —
                  production-grade asymmetric proof
                </li>
                <li>
                  •{" "}
                  <span className="text-white">
                    ML-DSA-65 (Dilithium3, NIST post-quantum)
                  </span>{" "}
                  dual-sig — receipts stay verifiable across the 7–25 year
                  retention horizons regulated industries require
                </li>
                <li>
                  • <span className="text-white">Daily Merkle root</span> (this
                  page) — publishable, independently verifiable
                </li>
                <li>
                  • <span className="text-white">7-day cohort claim</span> (this
                  page) — selective-disclosure proof of operating scale
                </li>
              </ul>
            </section>
          </>
        )}

        <div className="mt-16 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {snap
              ? `snapshot generated ${new Date(snap.generatedAt).toUTCString()}`
              : "—"}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/api/trust/snapshot"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              raw JSON
            </Link>
            <Link
              href="/trust"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              compliance posture →
            </Link>
            <Link
              href="/metrics"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              live metrics →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.04] bg-white/[0.01] px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </div>
      <div
        className="mt-1 truncate font-mono text-[12px] text-neutral-200"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
