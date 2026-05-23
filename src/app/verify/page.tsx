"use client";

/**
 * SOVEREIGN MATRIX — Public `/verify` (Wave 120).
 *
 * The single front-door URL for ANY receipt verification. Procurement,
 * VC diligence, customer compliance — all paste a receipt ID here and
 * watch the cryptographic check land in <60 seconds.
 *
 * What the page does (client-side):
 *   1. Visitor pastes a receipt ID (UUID-ish hex shape).
 *   2. Fetch /api/agent-runs/{id}  — gets `canonical` + `signature`.
 *   3. POST to /api/verify          — server runs HMAC-SHA256 verify
 *      against the per-tenant secret it holds. Returns
 *      `{ valid, agent, createdAt }`.
 *   4. Render: pass/fail badge, canonical body, hash, signature,
 *      verdict, latency. Every field copyable.
 *   5. Optional: derive the SHA-256 of the canonical client-side via
 *      Web Crypto — shows the visitor THEIR browser computed the same
 *      hash the server compared against.
 *
 * Trust property:
 *   - Verification never leaves the browser + the publicly-readable
 *     server. No login, no API key, no friction.
 *   - The signing secret stays on the server (HMAC-SHA256 requires the
 *     secret to verify; future ML-DSA-65 verification will be 100%
 *     client-side via the published public key at
 *     /.well-known/sovereign-receipts/mldsa65.b64).
 *
 * Cross-links:
 *   - /transparency/verify  — inclusion-proof verifier (deeper)
 *   - /demo/verify-receipt  — server-rendered worked example
 *   - /spec                 — receipt schema
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Hash,
  FileSignature,
  Copy,
  Check,
} from "lucide-react";

interface VerifyResponse {
  valid: boolean;
  agent?: string;
  createdAt?: string;
  error?: string;
}

interface RunResponse {
  id?: string;
  canonical?: string;
  signature?: string;
  agentName?: string;
  modelUsed?: string;
  createdAt?: string;
  error?: string;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[10px] text-neutral-400 transition hover:border-cyan-500/30 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-500/40"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "copied" : "copy"}
    </button>
  );
}

export default function VerifyPage() {
  const [receiptId, setReceiptId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [clientHash, setClientHash] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const run_verify = useCallback(async () => {
    const trimmed = receiptId.trim().replace(/^["']|["']$/g, "");
    if (!trimmed) {
      setError("Paste a receipt ID first.");
      return;
    }
    setLoading(true);
    setError(null);
    setVerifyResult(null);
    setRun(null);
    setClientHash(null);
    setElapsedMs(null);

    const t0 = performance.now();
    try {
      // Step 1: fetch the receipt
      const runRes = await fetch(
        `/api/agent-runs/${encodeURIComponent(trimmed)}`,
      );
      if (!runRes.ok) {
        if (runRes.status === 404) {
          throw new Error(
            "No public receipt with that ID. Either it's private/unlisted or the ID is wrong.",
          );
        }
        throw new Error(`Receipt fetch failed (${runRes.status}).`);
      }
      const runData = (await runRes.json()) as RunResponse;
      if (!runData.canonical || !runData.signature) {
        throw new Error("Receipt is missing the canonical body or signature.");
      }
      setRun(runData);

      // Step 2: client-side SHA-256 of the canonical (transparency proof)
      const hash = await sha256Hex(runData.canonical);
      setClientHash(hash);

      // Step 3: server-side HMAC verify
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonical: runData.canonical,
          signature: runData.signature,
        }),
      });
      const verifyData = (await verifyRes.json()) as VerifyResponse;
      setVerifyResult(verifyData);
      setElapsedMs(Math.round(performance.now() - t0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  const isPass = verifyResult?.valid === true;
  const isFail = verifyResult && verifyResult.valid === false;

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

      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 sm:py-20">
        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300">
            <ShieldCheck className="h-3 w-3" />
            Public verifier · no login
          </div>
          <h1 className="font-serif text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
            Verify a Sovereign receipt
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Paste any public receipt ID. Your browser fetches it, computes the
            SHA-256 of the canonical body, and asks the server to HMAC-verify.
            Pass/fail in under a second. Every field is copyable so a compliance
            team can re-run the math offline.
          </p>
        </div>

        {/* Input */}
        <div className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-xl">
          <label
            htmlFor="receiptId"
            className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500"
          >
            Receipt ID
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="receiptId"
              type="text"
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void run_verify();
              }}
              placeholder="e.g. a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6"
              className="flex-1 rounded-xl border border-white/[0.08] bg-[#030303] px-4 py-3 font-mono text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => void run_verify()}
              disabled={loading || !receiptId.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/[0.12] px-5 py-3 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/[0.18] focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {loading ? "Verifying…" : "Verify"}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-neutral-500">
            Don&apos;t have one? Try a real public receipt from{" "}
            <Link
              href="/explorer"
              className="text-cyan-300 underline-offset-4 hover:underline"
            >
              the explorer
            </Link>{" "}
            or use the worked example at{" "}
            <Link
              href="/demo/verify-receipt"
              className="text-cyan-300 underline-offset-4 hover:underline"
            >
              /demo/verify-receipt
            </Link>
            .
          </p>
        </div>

        {error && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {verifyResult && (
          <>
            {/* Verdict banner */}
            <div
              className={`mb-8 flex flex-col gap-4 rounded-2xl border p-6 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between ${
                isPass
                  ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                  : "border-red-500/30 bg-red-500/[0.06]"
              }`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-4">
                {isPass ? (
                  <ShieldCheck className="h-10 w-10 text-emerald-300" />
                ) : (
                  <ShieldAlert className="h-10 w-10 text-red-300" />
                )}
                <div>
                  <div
                    className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                      isPass ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {isPass ? "Verified · authentic" : "Verification failed"}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {isPass
                      ? "HMAC-SHA256 matches the canonical body"
                      : "Signature does not match — receipt may be forged or corrupted"}
                  </div>
                  {verifyResult.agent && (
                    <div className="mt-1 text-[12px] text-neutral-400">
                      Agent:{" "}
                      <span className="font-mono">{verifyResult.agent}</span>
                      {verifyResult.createdAt
                        ? ` · ${new Date(verifyResult.createdAt).toLocaleString()}`
                        : ""}
                    </div>
                  )}
                </div>
              </div>
              {elapsedMs !== null && (
                <div className="font-mono text-[11px] text-neutral-500">
                  total: {elapsedMs}ms
                </div>
              )}
            </div>

            {/* Detail tiles */}
            {run && (
              <div className="grid gap-6 lg:grid-cols-2">
                {clientHash && (
                  <DetailCard
                    icon={<Hash className="h-4 w-4" />}
                    label="SHA-256 (browser-computed)"
                    sub="Your browser hashed the canonical body via Web Crypto. The server's HMAC check uses the same hash internally."
                    value={clientHash}
                  />
                )}
                {run.signature && (
                  <DetailCard
                    icon={<FileSignature className="h-4 w-4" />}
                    label="HMAC-SHA256 signature"
                    sub="The signature the server compared against. Constant-time comparison; no timing leak on bad input."
                    value={run.signature}
                  />
                )}
                {run.canonical && (
                  <div className="lg:col-span-2">
                    <DetailCard
                      icon={<FileSignature className="h-4 w-4" />}
                      label="Canonical body"
                      sub="The exact bytes the signature was computed over. Re-hash this with SHA-256 in any language and you'll get the value above."
                      value={run.canonical}
                      multiline
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer cross-links */}
        <div className="mt-16 grid gap-6 border-t border-white/[0.06] pt-8 text-sm sm:grid-cols-3">
          <Link
            href="/transparency/verify"
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-cyan-500/20 hover:bg-cyan-500/[0.04]"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              Deeper proof
            </div>
            <div className="mt-1 font-medium text-white">
              Inclusion-proof verifier →
            </div>
            <div className="mt-1 text-[12px] text-neutral-500">
              Browser-local SHA-256 fold against the published Signed Tree Head.
              Confirms the receipt is in the log.
            </div>
          </Link>
          <Link
            href="/spec"
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-cyan-500/20 hover:bg-cyan-500/[0.04]"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              Receipt schema
            </div>
            <div className="mt-1 font-medium text-white">
              VAOS receipt spec →
            </div>
            <div className="mt-1 text-[12px] text-neutral-500">
              Open Apache-2.0 schema. Build your own verifier in any language.
            </div>
          </Link>
          <Link
            href="/metrics"
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-cyan-500/20 hover:bg-cyan-500/[0.04]"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              Live numbers
            </div>
            <div className="mt-1 font-medium text-white">
              Platform metrics →
            </div>
            <div className="mt-1 text-[12px] text-neutral-500">
              Block rate, cost savings, model distribution — all live from the
              same receipt fabric.
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}

function DetailCard({
  icon,
  label,
  sub,
  value,
  multiline,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 text-cyan-300">
          {icon}
          <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
            {label}
          </span>
        </div>
        <CopyButton value={value} />
      </div>
      <div
        className={`break-all font-mono text-[11px] leading-relaxed text-neutral-300 ${
          multiline ? "max-h-48 overflow-auto" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-3 text-[11px] leading-snug text-neutral-500">
        {sub}
      </div>
    </div>
  );
}
