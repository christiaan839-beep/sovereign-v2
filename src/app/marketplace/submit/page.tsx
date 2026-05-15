"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

/**
 * /marketplace/submit — Developer-facing listing submission UI (Cook 70).
 *
 * Captures the fields the Cook 62 `validateListing` rule set checks.
 * Submits to /api/marketplace/listings as a draft.
 *
 * The validation regexes here MATCH the server-side Zod / regex in
 * `marketplace-core.ts`. Keep them in sync if either changes.
 */

const SAFETY_LAYERS = [
  "jailbreak",
  "content-safety",
  "pii",
  "quality",
  "critic",
  "hallucination",
] as const;

type Safety = (typeof SAFETY_LAYERS)[number];

const SLUG_RE = /^[a-z][a-z0-9-]{1,63}$/;

export default function MarketplaceSubmitPage() {
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerRunDollars, setPriceDollars] = useState("0.25");
  const [safetyLayers, setSafetyLayers] = useState<Safety[]>([
    "jailbreak",
    "content-safety",
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    { ok: true; id: string } | { ok: false; error: string } | null
  >(null);

  function toggleSafety(s: Safety) {
    setSafetyLayers((current) =>
      current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
    );
  }

  function clientValidate(): string | null {
    if (!SLUG_RE.test(slug)) {
      return "Slug must match /^[a-z][a-z0-9-]{1,63}$/";
    }
    if (!displayName || displayName.length > 80) {
      return "Display name is required and must be ≤ 80 chars";
    }
    if (description.length > 280) {
      return "Description must be ≤ 280 chars";
    }
    const cents = Math.round(parseFloat(pricePerRunDollars || "0") * 100);
    if (!Number.isFinite(cents) || cents < 0 || cents > 100_000_000) {
      return "Price must be in [$0, $1,000,000]";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const err = clientValidate();
    if (err) {
      setResult({ ok: false, error: err });
      return;
    }
    setSubmitting(true);
    try {
      const cents = Math.round(parseFloat(pricePerRunDollars) * 100);
      const res = await fetch("/api/marketplace/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          displayName,
          description,
          pricePerRunCents: cents,
          safetyLayers,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setResult({ ok: false, error: body.error ?? `HTTP ${res.status}` });
        return;
      }
      const body = (await res.json()) as { id: string };
      setResult({ ok: true, id: body.id });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Marketplace
          </Link>
          <span className="text-sm font-bold text-white">Sovereign Matrix</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-4">
          Submit an Agent
        </p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-3">
          List your agent in the Sovereign Marketplace.
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl mb-10">
          Your listing lives in the same registry as the 145 built-in agents.
          You set the per-run price; Sovereign takes a 30% platform fee. All
          listings must declare ≥ 1 safety layer + be priced &gt; $0 before
          publication.
        </p>

        <form onSubmit={onSubmit} className="space-y-6">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400">
              Slug
            </span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-niche-agent"
              className="mt-1 block w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-400/60"
            />
            <span className="block text-[10px] text-neutral-600 mt-1">
              Lowercase letters, digits, hyphens. 2–64 chars. Must be globally
              unique.
            </span>
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Niche Agent"
              className="mt-1 block w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-400/60"
            />
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="One short sentence about what this agent does for whom."
              className="mt-1 block w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-400/60"
            />
            <span className="block text-[10px] text-neutral-600 mt-1">
              {description.length} / 280
            </span>
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400">
              Price per run (USD)
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={pricePerRunDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              className="mt-1 block w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-400/60"
            />
            <span className="block text-[10px] text-neutral-600 mt-1">
              Platform fee 30%. Earn $
              {(parseFloat(pricePerRunDollars || "0") * 0.7).toFixed(2)} per
              run.
            </span>
          </label>

          <div>
            <span className="text-[11px] uppercase tracking-wider text-neutral-400">
              Safety layers your agent relies on
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAFETY_LAYERS.map((s) => {
                const on = safetyLayers.includes(s);
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggleSafety(s)}
                    className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
                      on
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-white/[0.03] border-white/10 text-neutral-400 hover:border-white/20"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <span className="block text-[10px] text-neutral-600 mt-2">
              At least one is required before your listing can be published.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit for review"}
            <ArrowRight className="w-4 h-4" />
          </button>

          {result && (
            <div
              className={`text-xs p-3 rounded-xl border ${
                result.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-300"
              }`}
            >
              {result.ok ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Submitted —{" "}
                  <code>{result.id}</code> is in <b>submitted</b> state.
                  Sovereign review takes ≤ 48 hours.
                </div>
              ) : (
                <span>Error: {result.error}</span>
              )}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
