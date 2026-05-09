"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Per-asset retry button on a partial-failure saved packet.
 *
 * POSTs to /api/packets/[id]/retry with the asset key. On success,
 * refreshes the server component to render the updated packet — the
 * retried asset replaces its previous failure row.
 *
 * Client component because it needs onClick + state. Kept tiny so the
 * detail page stays mostly server-rendered.
 */
export function RetryAssetButton({
  packetId,
  asset,
}: {
  packetId: string;
  asset: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function onClick() {
    if (phase === "running") return;
    setPhase("running");
    setErrMsg("");
    try {
      const res = await fetch(`/api/packets/${packetId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setErrMsg(body.message || body.error || `Retry failed (${res.status})`);
        setPhase("err");
        return;
      }
      setPhase("ok");
      // Server-component refresh — re-renders the detail page with the
      // updated packet from getPacketById.
      router.refresh();
    } catch {
      setErrMsg("Network error.");
      setPhase("err");
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={phase === "running"}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-neutral-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {phase === "running" ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin" />
            Retrying…
          </>
        ) : phase === "ok" ? (
          <>
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Retried
          </>
        ) : (
          <>
            <RefreshCw className="w-3 h-3" />
            Retry
          </>
        )}
      </button>
      {phase === "err" && errMsg ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-400/80 max-w-xs text-right">
          <AlertTriangle className="w-2.5 h-2.5" />
          {errMsg}
        </span>
      ) : null}
    </div>
  );
}
