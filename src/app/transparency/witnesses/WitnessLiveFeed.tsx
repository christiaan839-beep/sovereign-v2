"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";

interface WitnessCosignature {
  witnessId: string;
  signature: string;
  publicKeyUrl?: string;
  observedAt: string;
}

interface WitnessObservation {
  sthCanonical: string;
  sthHash: string;
  cosignatures: WitnessCosignature[];
}

interface ApiResponse {
  observations: WitnessObservation[];
  truncated?: boolean;
}

export function WitnessLiveFeed() {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [observations, setObservations] = useState<WitnessObservation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  async function load() {
    try {
      const res = await fetch(
        "/api/transparency/witness/observations?limit=20",
        {
          cache: "no-store",
        },
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as ApiResponse;
      setObservations(data.observations ?? []);
      setRefreshedAt(new Date());
      setPhase("ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (phase === "loading") {
    return (
      <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-5 py-12 flex items-center justify-center gap-3 text-neutral-400">
        <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
        <span className="text-[13px] font-mono">
          Fetching witness observations…
        </span>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div
        role="alert"
        className="rounded-[6px] border border-amber-500/30 bg-amber-500/[0.04] px-5 py-4 flex items-start gap-3"
      >
        <AlertTriangle
          className="w-4 h-4 text-amber-400 mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-[13px] font-medium text-amber-300 mb-1">
            Could not load witness observations
          </p>
          <p className="text-[12px] font-mono text-neutral-400 mb-3">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => {
              setPhase("loading");
              load();
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-amber-500/30 text-amber-300 font-mono text-[12px] rounded-[3px] hover:bg-amber-500/[0.06] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (observations.length === 0) {
    return (
      <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-5 py-10 text-center">
        <p className="text-[13px] text-neutral-400 mb-2">
          No witness cosignatures recorded yet.
        </p>
        <p className="text-[11px] text-neutral-500 leading-relaxed max-w-md mx-auto">
          The federation is bootstrapping. Once independent witnesses begin
          cosigning, each Signed Tree Head will show its witness set here. Be
          the first to operate one — see &quot;Operate a witness&quot; below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 text-[11px] font-mono text-neutral-500">
        <span>
          {observations.length} STH{observations.length === 1 ? "" : "s"} ·{" "}
          {observations.reduce((s, o) => s + o.cosignatures.length, 0)} total
          cosignatures
        </span>
        {refreshedAt && (
          <span>refreshed · {refreshedAt.toISOString().slice(11, 19)}Z</span>
        )}
      </div>
      <ul className="space-y-3">
        {observations.map((obs) => (
          <li
            key={obs.sthHash}
            className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-5 py-4"
          >
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-3">
              <code className="text-[11px] font-mono text-cyan-300/90">
                STH {obs.sthHash.slice(0, 16)}…
              </code>
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-neutral-500">
                {obs.cosignatures.length} cosig
                {obs.cosignatures.length === 1 ? "" : "s"}
              </span>
            </div>
            {obs.cosignatures.length === 0 ? (
              <p className="text-[12px] text-neutral-500 italic">
                No cosignatures recorded for this STH yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {obs.cosignatures.map((c) => (
                  <li
                    key={`${c.witnessId}-${c.signature.slice(0, 16)}`}
                    className="flex items-baseline justify-between gap-3 text-[12px]"
                  >
                    <span className="text-neutral-300">{c.witnessId}</span>
                    <span className="text-[10px] font-mono text-neutral-500">
                      {c.observedAt.slice(0, 19)}Z
                      {c.publicKeyUrl && (
                        <a
                          href={c.publicKeyUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="ml-3 text-cyan-300/80 hover:text-cyan-200 underline decoration-cyan-500/30"
                        >
                          pubkey
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
