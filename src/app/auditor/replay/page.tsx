"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ShieldCheck, AlertTriangle, FileWarning, Hash } from "lucide-react";

/**
 * /auditor/replay — Public auditor replay surface.
 *
 * Paste a receipt id. The page calls /api/auditor/replay/[id], renders
 * the reconstructed canonical projection, the recomputed SHA-256 hash,
 * the stored signature, the replay attestation, and a verdict — all in
 * a layout that's deliberately auditor-coded (mono fonts, no marketing
 * flourish, side-by-side hash comparison).
 *
 * Pure client component — the only state is the receipt id input + the
 * ReplayResult JSON returned by the API. No analytics. No tracking.
 */

interface ReplayResult {
  status: "ok" | "tampered" | "not-found" | "unsigned" | "no-key";
  storedSignature: string | null;
  canonical: string | null;
  canonicalHash: string | null;
  signatureVerified: boolean;
  replayAttestation: string;
  replayedAt: string;
  run: {
    id: string;
    agentName: string;
    modelUsed: string;
    durationMs: number;
    createdAt: string;
  } | null;
}

export default function AuditorReplayPage() {
  const [receiptId, setReceiptId] = useState("");
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setError(null);
    const trimmed = receiptId.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/auditor/replay/${encodeURIComponent(trimmed)}`,
          { headers: { accept: "application/json" } },
        );
        if (res.status === 404) {
          setError(
            "No public receipt matches that id. Private receipts are visible only to the issuing tenant.",
          );
          return;
        }
        if (!res.ok) {
          setError(`Replay failed with HTTP ${res.status}.`);
          return;
        }
        const data = (await res.json()) as ReplayResult;
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    });
  }

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-16">
      <div className="max-w-3xl mx-auto">
        {/* Editorial header */}
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          AUDITOR REPLAY · CRYPTOGRAPHIC RECONSTRUCTION
        </p>
        <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-[-0.02em] text-white mb-5">
          Recreate any
          <br />
          <span className="text-[#B5532C]">Sovereign receipt.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          Paste a receipt id. We&apos;ll re-derive the canonical projection from
          storage, recompute its SHA-256 hash, and check the stored signature
          against the recomputed bytes. Any mutation since the receipt was
          issued shows up as a verdict — not silently.
        </p>

        {/* Input */}
        <form onSubmit={onSubmit} className="mb-8">
          <label
            htmlFor="receipt-id"
            className="block font-mono text-[11px] text-neutral-500 tracking-[0.2em] uppercase mb-2"
          >
            Receipt id
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="receipt-id"
              type="text"
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
              placeholder="e.g. 01HXYZ..."
              autoComplete="off"
              spellCheck={false}
              className="flex-1 px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-[3px] text-[14px] font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus:border-cyan-500/40 transition-colors"
            />
            <button
              type="submit"
              disabled={isPending || !receiptId.trim()}
              className="px-6 py-3 bg-[#B5532C] text-white text-[13px] font-mono tracking-[0.1em] rounded-[3px] hover:bg-[#C96234] transition-colors disabled:opacity-50 disabled:hover:bg-[#B5532C] flex items-center justify-center gap-1.5"
            >
              {isPending ? "Replaying…" : "Replay receipt"}
              {!isPending && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-8 px-4 py-3 border border-amber-500/20 bg-amber-500/[0.04] rounded-[3px]">
            <p className="text-[13px] text-amber-400 leading-[1.6]">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && <ReplayResultView result={result} />}

        {/* Footer */}
        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            Looking for the API?{" "}
            <code className="text-neutral-300">
              GET /api/auditor/replay/&lt;id&gt;
            </code>{" "}
            returns the full ReplayResult JSON. Set{" "}
            <code className="text-neutral-300">Accept: text/plain</code> to get
            a workpaper-formatted text block you can paste into a PDF. See{" "}
            <Link
              href="/spec"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              the protocol spec
            </Link>{" "}
            for the canonical projection layout.
          </p>
        </div>
      </div>
    </main>
  );
}

function ReplayResultView({ result }: { result: ReplayResult }) {
  const verdictTone = {
    ok: {
      Icon: ShieldCheck,
      label: "Verified · stored signature reproduces over re-derived bytes",
      color: "text-cyan-300 border-cyan-500/30 bg-cyan-500/[0.05]",
      iconColor: "text-cyan-300",
    },
    tampered: {
      Icon: AlertTriangle,
      label:
        "TAMPERED · stored signature does not validate over the re-derived canonical",
      color: "text-rose-300 border-rose-500/40 bg-rose-500/[0.06]",
      iconColor: "text-rose-400",
    },
    unsigned: {
      Icon: FileWarning,
      label: "Historical unsigned run · replay informational only",
      color: "text-amber-300 border-amber-500/30 bg-amber-500/[0.04]",
      iconColor: "text-amber-300",
    },
    "no-key": {
      Icon: FileWarning,
      label:
        "Signing key not configured · canonical re-derived but no fresh attestation issued",
      color: "text-neutral-300 border-white/[0.08] bg-white/[0.02]",
      iconColor: "text-neutral-400",
    },
    "not-found": {
      Icon: AlertTriangle,
      label: "Receipt not found",
      color: "text-neutral-300 border-white/[0.08] bg-white/[0.02]",
      iconColor: "text-neutral-400",
    },
  }[result.status];

  const { Icon, label, color, iconColor } = verdictTone;

  return (
    <div className="space-y-5">
      {/* Verdict */}
      <div
        className={`flex items-start gap-3 px-5 py-4 rounded-[3px] border ${color}`}
      >
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
        <p className="text-[14px] leading-[1.5] font-medium">{label}</p>
      </div>

      {/* Run metadata */}
      {result.run && (
        <DataBlock label="Run metadata">
          <Row k="Receipt id" v={result.run.id} />
          <Row k="Agent" v={result.run.agentName} />
          <Row k="Model" v={result.run.modelUsed} />
          <Row k="Issued at" v={new Date(result.run.createdAt).toISOString()} />
          <Row k="Duration (ms)" v={String(result.run.durationMs)} />
        </DataBlock>
      )}

      {/* Canonical hash */}
      {result.canonicalHash && (
        <DataBlock label="SHA-256 of re-derived canonical" icon={Hash}>
          <code className="block font-mono text-[12px] text-cyan-300 break-all leading-[1.6]">
            {result.canonicalHash}
          </code>
        </DataBlock>
      )}

      {/* Stored signature */}
      {result.storedSignature && (
        <DataBlock label="Stored signature">
          <code className="block font-mono text-[12px] text-neutral-300 break-all leading-[1.6]">
            {result.storedSignature}
          </code>
        </DataBlock>
      )}

      {/* Replay attestation */}
      {result.replayAttestation && (
        <DataBlock label="Replay attestation (issued at replay time)">
          <code className="block font-mono text-[12px] text-[#E08558] break-all leading-[1.6]">
            {result.replayAttestation}
          </code>
          <p className="text-[11px] text-neutral-500 mt-2 leading-[1.6]">
            Paste this into your workpaper. It proves you independently
            re-derived these exact canonical bytes from the platform at{" "}
            {new Date(result.replayedAt).toISOString()}.
          </p>
        </DataBlock>
      )}

      {/* Canonical body */}
      {result.canonical && (
        <details className="border border-white/[0.06] rounded-[3px]">
          <summary className="px-4 py-3 font-mono text-[11px] text-neutral-500 tracking-[0.2em] uppercase cursor-pointer hover:text-neutral-300">
            Show re-derived canonical projection ({result.canonical.length}{" "}
            bytes)
          </summary>
          <pre className="px-4 py-3 border-t border-white/[0.06] bg-black/30 text-[11px] text-neutral-400 overflow-x-auto whitespace-pre-wrap break-words font-mono leading-[1.55]">
            {result.canonical}
          </pre>
        </details>
      )}
    </div>
  );
}

function DataBlock({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/[0.06] rounded-[3px] p-4 bg-white/[0.015]">
      <p className="flex items-center gap-2 font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-2">
        {Icon ? <Icon className="w-3 h-3" /> : null}
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-1">
      <span className="font-mono text-[11px] text-neutral-500 tracking-[0.1em] uppercase sm:w-32 shrink-0">
        {k}
      </span>
      <code className="font-mono text-[13px] text-neutral-200 break-all">
        {v}
      </code>
    </div>
  );
}
