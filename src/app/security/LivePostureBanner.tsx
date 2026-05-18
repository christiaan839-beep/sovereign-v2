"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ShieldCheck, AlertTriangle } from "lucide-react";

/**
 * Live posture banner — embedded above the static SECTIONS grid on
 * the /security marketing page.
 *
 * Fetches /api/security/posture client-side and surfaces the values
 * that matter most to a procurement reviewer in the first scroll:
 *   • Which receipt schemes are ACTIVE on this deploy (v1/v2/v3)
 *   • The audit chain head + last anchor time
 *   • Whether the anchor is stale (operator-action signal)
 *
 * Falls back gracefully when the endpoint is unreachable. Never
 * blocks the page render; if the fetch fails, the marketing copy
 * below still gives the visitor a complete read.
 */

interface PosturePreview {
  schemes: {
    v1: boolean;
    v2: boolean;
    v3: boolean;
  };
  chainHead: string | null;
  lastAnchoredAt: string | null;
  stale: boolean;
  generatedAt: string;
}

interface PostureResponse {
  generatedAt: string;
  receipts: {
    schemes: {
      v1_hmac_sha256: { enabled: boolean };
      v2_ed25519: { enabled: boolean };
      v3_ed25519_mldsa65: { enabled: boolean };
    };
  };
  chainOfCustody: {
    auditChainHead: string | null;
    lastAnchoredAt: string | null;
    stale?: boolean;
  };
}

export function LivePostureBanner() {
  const [preview, setPreview] = useState<PosturePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/security/posture")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<PostureResponse>;
      })
      .then((body) => {
        if (cancelled) return;
        setPreview({
          schemes: {
            v1: body.receipts.schemes.v1_hmac_sha256.enabled,
            v2: body.receipts.schemes.v2_ed25519.enabled,
            v3: body.receipts.schemes.v3_ed25519_mldsa65.enabled,
          },
          chainHead: body.chainOfCustody.auditChainHead,
          lastAnchoredAt: body.chainOfCustody.lastAnchoredAt,
          stale: body.chainOfCustody.stale === true,
          generatedAt: body.generatedAt,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mb-10 p-5 rounded-xl border border-amber-500/15 bg-amber-500/[0.04]">
        <p className="flex items-center gap-2 font-mono text-[10px] text-amber-300 tracking-[0.2em] uppercase mb-2">
          <AlertTriangle className="w-3 h-3" /> Live posture unavailable
        </p>
        <p className="text-[13px] text-neutral-300 leading-[1.6]">
          The static evidence below still applies. For the machine-readable
          view, see{" "}
          <Link
            href="/security/live"
            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
          >
            /security/live
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="mb-10 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <p className="flex items-center gap-2 font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase">
          <Activity className="w-3 h-3 animate-pulse" /> Fetching live posture…
        </p>
      </div>
    );
  }

  return (
    <div className="mb-10 p-5 rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04]">
      <div className="flex flex-wrap items-baseline gap-3 mb-4">
        <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300 tracking-[0.25em] uppercase">
          <ShieldCheck className="w-3 h-3" /> Live posture
        </p>
        <span className="font-mono text-[10px] text-neutral-500">
          {preview.generatedAt}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] text-neutral-400">
          <span
            className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
            aria-hidden="true"
          />
          fetched client-side from /api/security/posture
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Cell
          label="Receipt schemes active"
          value={
            <span>
              {(["v1", "v2", "v3"] as const).map((k) => (
                <span
                  key={k}
                  className={`inline-block mr-1.5 px-2 py-0.5 rounded-[3px] font-mono text-[11px] ${
                    preview.schemes[k]
                      ? "text-cyan-300 border border-cyan-500/30 bg-cyan-500/[0.06]"
                      : "text-neutral-600 border border-white/[0.05] bg-white/[0.02]"
                  }`}
                >
                  {k}
                </span>
              ))}
            </span>
          }
        />
        <Cell
          label="Audit chain head"
          value={
            preview.chainHead ? (
              <code className="font-mono text-[11px] text-neutral-300 break-all">
                {preview.chainHead.slice(0, 20)}…
              </code>
            ) : (
              <span className="text-[12px] text-neutral-500">
                no anchor table on this deploy
              </span>
            )
          }
        />
        <Cell
          label="Last Bitcoin anchor"
          value={
            preview.lastAnchoredAt ? (
              <span
                className={`text-[12px] ${preview.stale ? "text-amber-300" : "text-neutral-300"}`}
              >
                {preview.lastAnchoredAt}
                {preview.stale && (
                  <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.15em] text-amber-300">
                    stale
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[12px] text-neutral-500">—</span>
            )
          }
        />
      </div>

      <p className="text-[11px] text-neutral-500 mt-4">
        Full machine-readable envelope at{" "}
        <a
          href="/api/security/posture"
          target="_blank"
          rel="noreferrer noopener"
          className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
        >
          /api/security/posture
        </a>
        {" · "}
        rendered as UI at{" "}
        <Link
          href="/security/live"
          className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
        >
          /security/live
        </Link>
      </p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 rounded-[3px] border border-white/[0.06] bg-white/[0.015]">
      <p className="font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase mb-1.5">
        {label}
      </p>
      <div>{value}</div>
    </div>
  );
}
