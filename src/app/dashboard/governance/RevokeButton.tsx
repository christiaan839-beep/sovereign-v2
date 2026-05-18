"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * RevokeButton — Wave 20 governance dashboard.
 *
 * One-click revoke for a Wave-16 agent token. Hits
 * /api/agent-tokens/[id]/revoke with a structured reason; the route
 * audits the action so the Bitcoin anchor sweeps it on the next cron
 * cycle. Optimistic local UI: button flips to "revoked" instantly,
 * then refreshes the page on success.
 *
 * The prompted "reason" is intentionally a soft constraint (default
 * "operator-revoked" if the user dismisses). The audit log captures
 * the operator's userId via the route's requireAdmin guard regardless.
 */
export function RevokeButton({ tokenId }: { tokenId: string }) {
  const [state, setState] = useState<"idle" | "revoking" | "revoked" | "error">(
    "idle",
  );
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function onClick() {
    if (state !== "idle") return;
    const reason =
      window.prompt(
        "Reason for revoking this token? (audited, min 3 chars)",
        "operator-revoked",
      ) ?? "operator-revoked";
    if (reason.trim().length < 3) {
      setState("error");
      setTimeout(() => setState("idle"), 1500);
      return;
    }
    setState("revoking");
    try {
      const res = await fetch(
        `/api/agent-tokens/${encodeURIComponent(tokenId)}/revoke`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      if (!res.ok) {
        setState("error");
        setTimeout(() => setState("idle"), 1500);
        return;
      }
      setState("revoked");
      // Refresh the server component so the row drops from the list.
      startTransition(() => router.refresh());
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 1500);
    }
  }

  const label =
    state === "revoked"
      ? "revoked"
      : state === "revoking"
        ? "revoking…"
        : state === "error"
          ? "retry"
          : "revoke";
  const cls =
    state === "revoked"
      ? "text-neutral-500 border-white/[0.06] cursor-default"
      : state === "error"
        ? "text-rose-300 border-rose-500/40 hover:bg-rose-500/10"
        : "text-[#E08558] border-[#B5532C]/40 hover:bg-[#B5532C]/10 hover:border-[#B5532C]/70";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "revoking" || state === "revoked"}
      className={`shrink-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] border rounded-[3px] transition-colors ${cls} disabled:opacity-70`}
    >
      {label}
    </button>
  );
}
