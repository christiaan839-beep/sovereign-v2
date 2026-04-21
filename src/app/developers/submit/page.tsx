"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ALLOWED_CATEGORIES, normalizeSlug } from "@/lib/agent-submission";

/**
 * /developers/submit — 3-step wizard for 3rd-party agent submissions.
 *
 *   1. Define   — name, tagline, description, category, pricing
 *   2. Configure — system prompt OR hosted endpoint URL
 *   3. Submit   — confirms + POSTs to /api/developers/submit
 *
 * State lives in one object (draft) because every step reads and writes
 * into the same shape — splitting into per-step reducers would fragment
 * the same five fields across three components.
 *
 * Slug preview updates live as the user types the name — immediate
 * feedback for what the URL will be.
 */

type Step = 1 | 2 | 3 | "done";

type Category = (typeof ALLOWED_CATEGORIES)[number];

interface Draft {
  name: string;
  tagline: string;
  description: string;
  category: Category;
  pricingCents: number;
  systemPrompt: string;
  hostedEndpoint: string;
}

const INITIAL: Draft = {
  name: "",
  tagline: "",
  description: "",
  category: "general",
  pricingCents: 0,
  systemPrompt: "",
  hostedEndpoint: "",
};

export default function SubmitWizard() {
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<{ slug: string; previewUrl: string } | null>(null);

  const slug = normalizeSlug(draft.name);

  const canAdvanceFromStep1 =
    draft.name.trim().length >= 3 &&
    draft.tagline.trim().length >= 10 &&
    slug.length >= 3;

  const canAdvanceFromStep2 =
    draft.systemPrompt.trim().length >= 20 ||
    draft.hostedEndpoint.trim().length > 0;

  async function handleSubmit() {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/developers/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          tagline: draft.tagline.trim(),
          description: draft.description.trim() || null,
          category: draft.category,
          pricingCents: Math.round(draft.pricingCents),
          systemPrompt: draft.systemPrompt.trim() || null,
          hostedEndpoint: draft.hostedEndpoint.trim() || null,
        }),
      });

      if (res.status === 401) {
        window.location.href = "/signup?next=/developers/submit";
        return;
      }

      const body = await res.json();
      if (!res.ok) {
        setServerError(body.error ?? "Submission failed");
        setSubmitting(false);
        return;
      }

      setResult({ slug: body.slug, previewUrl: body.previewUrl });
      setStep("done");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased">
      <header className="border-b border-white/[0.05]">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-[13px] font-serif text-white hover:text-[#E8DDD0] transition-colors tracking-tight"
          >
            Sovereign Matrix
          </Link>
          <Link
            href="/developers/docs"
            className="text-[12px] font-mono text-neutral-500 hover:text-white transition-colors tracking-tight"
          >
            ← Developer docs
          </Link>
        </div>
      </header>

      <main className="px-6 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-3">
            Developers · Submit an agent
          </p>
          <h1 className="font-serif text-3xl md:text-5xl leading-[1.04] tracking-[-0.02em] mb-3">
            Ship an agent. <em className="not-italic text-[#B5532C]">Keep 80%.</em>
          </h1>
          <p className="text-[14px] text-neutral-400 leading-relaxed max-w-lg mb-10">
            Submissions enter the catalog as <code className="font-mono text-neutral-300">unlisted</code>.
            Admins review within 48h for promotion to public listing.
          </p>

          {/* Progress rail */}
          {step !== "done" && (
            <div className="mb-10 flex items-center gap-2 text-[11px] font-mono tracking-wide">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-[10px] ${
                      step === n
                        ? "bg-[#B5532C] border-[#B5532C] text-white"
                        : step > n
                        ? "border-emerald-500/40 text-emerald-400"
                        : "border-white/[0.1] text-neutral-600"
                    }`}
                  >
                    {step > n ? "✓" : n}
                  </span>
                  <span className={step === n ? "text-white" : "text-neutral-600"}>
                    {stepLabel(n as 1 | 2 | 3)}
                  </span>
                  {n < 3 && <span aria-hidden="true" className="w-8 h-px bg-white/[0.08] ml-2" />}
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <Panel key="1">
                <Field label="Name" hint="3-60 characters. Spaces become hyphens in the URL.">
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Lead Finder Pro"
                    className="input-style"
                  />
                  {slug && (
                    <p className="mt-1.5 text-[11px] font-mono text-neutral-600">
                      URL: <span className="text-[#B5532C]">/agents/{slug}</span>
                    </p>
                  )}
                </Field>

                <Field label="Tagline" hint="One line that explains the outcome. 10-140 chars.">
                  <input
                    type="text"
                    value={draft.tagline}
                    onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                    placeholder="Finds qualified leads in minutes"
                    className="input-style"
                  />
                  <p className="mt-1.5 text-[10px] font-mono text-neutral-700">
                    {draft.tagline.length} / 140
                  </p>
                </Field>

                <Field label="Description" hint="Optional. Full paragraph for the detail page.">
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    rows={4}
                    placeholder="What does it do, how does it work, what should users expect?"
                    className="input-style resize-none"
                  />
                </Field>

                <Field label="Category">
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
                    className="input-style"
                  >
                    {ALLOWED_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Pricing (per run)" hint="USD. Set to 0 for free agents.">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-neutral-500">$</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={(draft.pricingCents / 100).toFixed(2)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          pricingCents: Math.round(parseFloat(e.target.value || "0") * 100),
                        })
                      }
                      className="input-style flex-1"
                    />
                    <span className="font-mono text-neutral-500 text-[12px]">/ run</span>
                  </div>
                  <p className="mt-1.5 text-[10px] font-mono text-neutral-700">
                    You keep 80%.
                    {draft.pricingCents > 0 && (
                      <span>
                        {" "}Your share: <span className="text-emerald-400">
                          ${((draft.pricingCents * 0.8) / 100).toFixed(2)}
                        </span> per run.
                      </span>
                    )}
                  </p>
                </Field>

                <WizardNav
                  onNext={() => setStep(2)}
                  nextDisabled={!canAdvanceFromStep1}
                />
              </Panel>
            )}

            {step === 2 && (
              <Panel key="2">
                <p className="text-[13px] text-neutral-400 mb-6 leading-relaxed">
                  Agents run one of two ways — paste a system prompt (we&apos;ll
                  route it through our LLM stack) or point at your own hosted
                  endpoint. Fill whichever applies.
                </p>

                <Field label="System prompt" hint="Min 20 chars. We'll run this against the smart router.">
                  <textarea
                    value={draft.systemPrompt}
                    onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
                    rows={10}
                    placeholder={`You are a precision lead-finding agent.\n\nInputs: ICP description, target count.\nOutputs: ranked list with contact angles.\nConstraints: only verified emails, no fabrications.`}
                    className="input-style resize-none font-mono text-[12px]"
                  />
                  <p className="mt-1.5 text-[10px] font-mono text-neutral-700">
                    {draft.systemPrompt.length} chars
                  </p>
                </Field>

                <div className="text-center text-[11px] font-mono text-neutral-600 my-6">
                  — OR —
                </div>

                <Field label="Hosted endpoint URL" hint="HTTPS only. Must accept POST with JSON body.">
                  <input
                    type="url"
                    value={draft.hostedEndpoint}
                    onChange={(e) => setDraft({ ...draft, hostedEndpoint: e.target.value })}
                    placeholder="https://your-api.example.com/run"
                    className="input-style"
                  />
                </Field>

                <WizardNav
                  onBack={() => setStep(1)}
                  onNext={() => setStep(3)}
                  nextDisabled={!canAdvanceFromStep2}
                />
              </Panel>
            )}

            {step === 3 && (
              <Panel key="3">
                <h2 className="font-serif text-2xl text-white mb-4 tracking-tight">Confirm submission</h2>
                <p className="text-[13px] text-neutral-400 mb-6 leading-relaxed">
                  One last look. Submitting adds your agent to the catalog as
                  unlisted. You&apos;ll get a preview URL immediately.
                </p>

                <dl className="mb-6 p-4 rounded-[6px] border border-white/[0.06] bg-white/[0.02] space-y-3">
                  <Row k="Name" v={draft.name} />
                  <Row k="Slug" v={`/agents/${slug}`} />
                  <Row k="Tagline" v={draft.tagline} />
                  <Row k="Category" v={draft.category} />
                  <Row
                    k="Pricing"
                    v={draft.pricingCents === 0 ? "Free" : `$${(draft.pricingCents / 100).toFixed(2)} / run`}
                  />
                  <Row k="Runtime" v={draft.hostedEndpoint ? "Hosted endpoint" : "System prompt via smart router"} />
                </dl>

                {serverError && (
                  <div className="mb-4 p-3 rounded-[4px] border border-red-500/30 bg-red-500/10 text-[12px] font-mono text-red-400">
                    {serverError}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setStep(2)}
                    disabled={submitting}
                    className="text-[12px] font-mono text-neutral-500 hover:text-white tracking-wide disabled:opacity-50"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B5532C] text-white font-medium text-[13px] tracking-tight rounded-[3px] hover:bg-[#C96234] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Submitting…" : "Submit for review"}
                    {!submitting && <span aria-hidden="true">→</span>}
                  </button>
                </div>
              </Panel>
            )}

            {step === "done" && result && (
              <Panel key="done">
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 mb-6">
                    <span className="text-emerald-400 text-xl">✓</span>
                  </div>
                  <h2 className="font-serif text-3xl text-white mb-3 tracking-tight">Submitted.</h2>
                  <p className="text-[14px] text-neutral-400 mb-8 max-w-sm mx-auto leading-relaxed">
                    Your agent is live at its unlisted URL. Admin review for public promotion within 48 hours.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link
                      href={result.previewUrl}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B5532C] text-white font-medium text-[13px] tracking-tight rounded-[3px] hover:bg-[#C96234] transition-colors"
                    >
                      View agent page →
                    </Link>
                    <Link
                      href="/developers/submit"
                      className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/[0.1] text-neutral-400 font-mono text-[12px] tracking-wide rounded-[3px] hover:border-white/[0.25] hover:text-white transition-colors"
                      onClick={() => {
                        setStep(1);
                        setDraft(INITIAL);
                        setResult(null);
                      }}
                    >
                      Submit another
                    </Link>
                  </div>
                </div>
              </Panel>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Inline styles for inputs — avoids a bespoke components file */}
      <style jsx>{`
        :global(.input-style) {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          padding: 8px 12px;
          color: white;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        }
        :global(.input-style:focus) {
          border-color: rgba(181, 83, 44, 0.5);
        }
        :global(.input-style::placeholder) {
          color: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </div>
  );
}

function stepLabel(n: 1 | 2 | 3): string {
  return ({ 1: "Define", 2: "Configure", 3: "Submit" } as const)[n];
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="p-6 rounded-[6px] border border-white/[0.06] bg-white/[0.015]"
    >
      {children}
    </motion.div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <label className="block font-mono text-[11px] text-neutral-400 tracking-wide mb-1.5 uppercase">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] font-mono text-neutral-600">{hint}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[10px] font-mono text-neutral-500 tracking-[0.15em] uppercase flex-shrink-0">{k}</dt>
      <dd className="text-[12px] text-white font-mono text-right truncate">{v}</dd>
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      {onBack ? (
        <button
          onClick={onBack}
          className="text-[12px] font-mono text-neutral-500 hover:text-white tracking-wide"
        >
          ← Back
        </button>
      ) : (
        <span />
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B5532C] text-white font-medium text-[13px] tracking-tight rounded-[3px] hover:bg-[#C96234] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
