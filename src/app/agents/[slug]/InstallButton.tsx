"use client";

import { useState } from "react";

/**
 * InstallButton — client island on the SEO page.
 *
 * Isolated so the rest of /agents/[slug] can stay a Server Component and
 * render statically (JSON-LD, OG tags, full content in the first HTML).
 * Only the install interaction needs useState + fetch.
 *
 * 401 → redirect to /signup (preserves intent).
 * 402 → redirect to billing top-up (paid agents with insufficient credits).
 */

interface Props {
  slug: string;
  pricingCents: number;
}

export function InstallButton({ slug, pricingCents }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "installed" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setState("busy");
    setMessage(null);
    try {
      const res = await fetch(`/api/catalog/${slug}/install`, { method: "POST" });
      if (res.status === 401) {
        window.location.href = `/signup?next=/agents/${slug}`;
        return;
      }
      if (res.status === 402) {
        const body = await res.json();
        window.location.href = body.topUpUrl ?? "/dashboard/billing?topup=true";
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setState("installed");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Install failed");
    }
  }

  if (state === "installed") {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[3px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono text-[12px] tracking-wide">
          <span aria-hidden="true">✓</span> Installed
        </span>
        <a
          href="/dashboard"
          className="text-[12px] font-mono text-[#B5532C] hover:text-white transition-colors tracking-tight"
        >
          Open dashboard →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={state === "busy"}
        className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#B5532C] text-white font-medium text-[13px] tracking-tight rounded-[3px] hover:bg-[#C96234] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {state === "busy" ? "Installing…" : pricingCents === 0 ? "Install free" : "Install"}
        {state !== "busy" && (
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        )}
      </button>
      {state === "error" && message && (
        <p className="text-[11px] font-mono text-red-400">{message}</p>
      )}
    </div>
  );
}
