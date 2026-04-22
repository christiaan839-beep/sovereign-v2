"use client";

/**
 * CostOptimizerLiveDemo — pricing-transparency money shot (landing §11).
 *
 * Third in the live-demo chain after agent-builder (§09) and
 * playbook-builder (§10). Where those demonstrate COMPOSITION, this
 * one demonstrates ECONOMICS — we route to the cheapest model that
 * clears the quality floor, not the most expensive one by default.
 *
 * The savings-vs-Claude-Opus line is the concrete anti-gouging story:
 * 'if you naively defaulted to Opus for everything, here's what you'd
 * burn. Here's what we do instead.'
 *
 * Cheapest of the three live demos (~\$0.025/call at 5/hour/IP,
 * max \$0.125/hour/IP). Generous cap because 'what if I need verified
 * quality' is exploratory — we want people to poke at it.
 */

import { useState, useRef } from "react";
import Link from "next/link";

type Phase = "idle" | "loading" | "success" | "error";
type Quality = "basic" | "verified" | "premium";

interface AltModel {
  name: string;
  costCentsPerMillion: number;
  latencyMs: number;
  rationale: string;
}

interface Recommendation {
  recommendedModel: string;
  estimatedCostCentsPerMillion: number;
  estimatedLatencyMs: number;
  alternativeModels: AltModel[];
  rationale: string;
  savingsVsClaudeOpus: { percent: number; absolute: string };
}

const SAMPLE_TASKS = [
  "Extract structured data from 10,000 invoice PDFs with vendor and line items",
  "Generate 500 product descriptions from feature lists in my catalog",
  "Summarize 200-page legal contracts into 3-paragraph executive briefings",
  "Classify customer support emails into 8 categories with priority labels",
];

const QUALITY_LABELS: Record<Quality, { label: string; sub: string }> = {
  basic: { label: "Basic", sub: "cheapest option that produces usable output" },
  verified: { label: "Verified", sub: "5-layer-verified output, Claude Sonnet or equiv" },
  premium: { label: "Premium", sub: "highest quality, defaults to Claude Sonnet+" },
};

function formatPrice(centsPerMillion: number): string {
  const dollars = centsPerMillion / 100;
  if (dollars >= 1) return `$${dollars.toFixed(2)} / 1M tokens`;
  return `${centsPerMillion.toFixed(1)}¢ / 1M tokens`;
}

export function CostOptimizerLiveDemo() {
  const [task, setTask] = useState("");
  const [quality, setQuality] = useState<Quality>("verified");
  const [phase, setPhase] = useState<Phase>("idle");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  async function handleOptimize() {
    if (task.trim().length < 20) {
      setError("Describe the task in at least 20 characters.");
      setPhase("error");
      return;
    }
    setError(null);
    setPhase("loading");
    setRecommendation(null);

    try {
      const res = await fetch("/api/public/cost-optimizer-demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskDescription: task.trim(), qualityRequirement: quality }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
        setPhase("error");
        return;
      }
      setRecommendation(body.recommendation);
      setPhase("success");
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } catch {
      setError("Network error. Try again in a moment.");
      setPhase("error");
    }
  }

  function trySample(sample: string) {
    setTask(sample);
    setPhase("idle");
    setError(null);
  }

  const isLoading = phase === "loading";

  return (
    <section className="editorial-dark py-28 md:py-36 ed-page" id="cost-optimizer">
      <div className="ed-max">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 mb-12">
          <div className="col-span-12 md:col-span-5">
            <p className="ed-label mb-6" style={{ color: "var(--ed-copper)" }}>
              Section 11 · Cost Optimizer
            </p>
            <h2 className="ed-display text-5xl md:text-[4rem] leading-[0.95] mb-6"
                style={{ color: "var(--ed-ink)" }}>
              Cheapest model.
              <br />
              <span className="ed-display-italic" style={{ color: "var(--ed-ink-soft)" }}>
                Right quality floor.
              </span>
            </h2>
            <p className="ed-body max-w-md"
               style={{ color: "var(--ed-ink-soft)" }}>
              Most AI platforms default to Claude Opus for everything and bill you the
              Opus rate. Sovereign routes every task through the optimizer — Nemotron for
              structured work, Claude Sonnet for reasoning, Opus only when it earns it.
            </p>
          </div>

          <div className="col-span-12 md:col-span-7">
            <label className="ed-label block mb-3">
              Describe the task
            </label>
            <textarea
              value={task}
              onChange={(e) => {
                setTask(e.target.value);
                if (phase === "error") setPhase("idle");
              }}
              placeholder="e.g. Classify 5,000 support tickets by sentiment and priority every week…"
              rows={3}
              disabled={isLoading}
              maxLength={400}
              className="w-full ed-mono text-[15px] bg-transparent p-5 outline-none transition-colors resize-none"
              style={{
                border: `1px solid ${
                  phase === "error" ? "var(--ed-copper)" : "var(--ed-rule)"
                }`,
                color: "var(--ed-ink)",
                borderRadius: "2px",
              }}
            />

            {/* Quality floor selector */}
            <div className="mt-5">
              <label className="ed-label block mb-3">
                Quality floor
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(QUALITY_LABELS) as Quality[]).map((q) => {
                  const active = quality === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuality(q)}
                      disabled={isLoading}
                      className="p-3 text-left transition-all"
                      style={{
                        border: `1px solid ${active ? "var(--ed-copper)" : "var(--ed-rule)"}`,
                        background: active ? "var(--ed-copper-wash)" : "var(--ed-bg-raised)",
                        borderRadius: "2px",
                      }}
                    >
                      <div className={`ed-display text-lg ${active ? "" : ""}`}
                           style={{ color: active ? "var(--ed-copper)" : "var(--ed-ink)" }}>
                        {QUALITY_LABELS[q].label}
                      </div>
                      <div className="ed-caption mt-1 leading-tight">
                        {QUALITY_LABELS[q].sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <span className="ed-caption">
                {task.length}/400{task.length > 0 && task.length < 20 && (
                  <span className="ml-2" style={{ color: "var(--ed-copper)" }}>
                    need 20+ chars
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={handleOptimize}
                disabled={isLoading || task.trim().length < 20}
                className="group relative px-5 py-2.5 transition-all ed-mono text-sm disabled:opacity-40"
                style={{
                  background: "var(--ed-copper)",
                  color: "var(--ed-bg)",
                  borderRadius: "2px",
                  cursor: task.trim().length < 20 ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--ed-bg)" }} />
                    Optimizing
                  </span>
                ) : (
                  <>Recommend Model →</>
                )}
              </button>
            </div>

            {/* Sample chips */}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="ed-caption mr-1">or try:</span>
              {SAMPLE_TASKS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => trySample(s)}
                  disabled={isLoading}
                  className="ed-caption px-2.5 py-1 transition-colors hover:text-[var(--ed-copper)]"
                  style={{
                    border: "1px solid var(--ed-rule)",
                    borderRadius: "2px",
                    color: "var(--ed-ink-dim)",
                  }}
                >
                  {s.split(" ").slice(0, 6).join(" ")}…
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="mt-10">
            <div className="ed-caption mb-3">
              <span style={{ color: "var(--ed-copper)" }}>Classifying task</span>
              <span className="mx-2" style={{ color: "var(--ed-rule)" }}>·</span>
              <span>Filtering by quality</span>
              <span className="mx-2" style={{ color: "var(--ed-rule)" }}>·</span>
              <span>Ranking by cost</span>
            </div>
            <div className="h-[2px] w-full overflow-hidden" style={{ background: "var(--ed-rule)" }}>
              <div
                className="h-full"
                style={{
                  background: "var(--ed-copper)",
                  width: "30%",
                  animation: "ed-loading-bar 2.4s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        )}

        {phase === "error" && error && (
          <div className="mt-8 p-5 ed-body"
               style={{
                 border: "1px solid var(--ed-copper)",
                 borderRadius: "2px",
                 color: "var(--ed-ink)",
                 background: "var(--ed-copper-wash)",
               }}>
            <span className="ed-label mr-2" style={{ color: "var(--ed-copper)" }}>ERROR</span>
            {error}
          </div>
        )}

        {phase === "success" && recommendation && (
          <div ref={outputRef} className="mt-10 ed-fade-in">
            <RecommendationDossier rec={recommendation} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── RecommendationDossier — the model recommendation card ──────── */

function RecommendationDossier({ rec }: { rec: Recommendation }) {
  return (
    <div>
      <div className="border-t pt-6 mb-8" style={{ borderColor: "var(--ed-copper)" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
          <p className="ed-label" style={{ color: "var(--ed-copper)" }}>
            Recommended — cheapest model that clears your quality floor
          </p>
          <p className="ed-caption">
            p50 latency{" "}
            <span className="ed-mono" style={{ color: "var(--ed-ink)" }}>
              {rec.estimatedLatencyMs}ms
            </span>
          </p>
        </div>
        <h3 className="ed-display text-4xl md:text-5xl" style={{ color: "var(--ed-ink)" }}>
          <span className="ed-mono text-2xl md:text-3xl mr-3" style={{ color: "var(--ed-ink-dim)" }}>
            model:
          </span>
          <span>{rec.recommendedModel}</span>
        </h3>
        <p className="ed-display text-3xl md:text-4xl mt-3" style={{ color: "var(--ed-copper)" }}>
          {formatPrice(rec.estimatedCostCentsPerMillion)}
        </p>
      </div>

      {/* Rationale */}
      <div className="mb-10">
        <p className="ed-label mb-2">Why this model</p>
        <p className="ed-body text-[16px] leading-relaxed max-w-3xl"
           style={{ color: "var(--ed-ink-soft)" }}>
          {rec.rationale}
        </p>
      </div>

      {/* Savings comparison — the money line */}
      <div className="mb-10 p-6"
           style={{
             background: "var(--ed-copper-wash)",
             border: "1px solid var(--ed-copper)",
             borderRadius: "2px",
           }}>
        <p className="ed-label mb-3" style={{ color: "var(--ed-copper)" }}>
          Savings vs Claude Opus default
        </p>
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="ed-display text-6xl" style={{ color: "var(--ed-ink)" }}>
            −{rec.savingsVsClaudeOpus.percent.toFixed(1)}%
          </span>
          <span className="ed-mono text-sm" style={{ color: "var(--ed-ink-soft)" }}>
            {rec.savingsVsClaudeOpus.absolute}
          </span>
        </div>
        <p className="ed-caption mt-3">
          If another platform defaults every call to Claude Opus, they charge you this
          much for the same task. Sovereign defaults to the right-sized model.
        </p>
      </div>

      {/* Alternatives */}
      {rec.alternativeModels.length > 0 && (
        <div className="mb-10">
          <p className="ed-label mb-4">Alternative routes</p>
          <ul className="space-y-3">
            {rec.alternativeModels.map((alt) => (
              <li
                key={alt.name}
                className="p-4 flex flex-wrap items-baseline justify-between gap-3"
                style={{
                  background: "var(--ed-bg-raised)",
                  border: "1px solid var(--ed-rule)",
                  borderRadius: "2px",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="ed-mono text-[15px]" style={{ color: "var(--ed-ink)" }}>
                    {alt.name}
                  </div>
                  <div className="ed-caption mt-1 truncate">{alt.rationale}</div>
                </div>
                <div className="ed-mono text-sm flex gap-4">
                  <span style={{ color: "var(--ed-copper)" }}>
                    {formatPrice(alt.costCentsPerMillion)}
                  </span>
                  <span style={{ color: "var(--ed-ink-dim)" }}>
                    {alt.latencyMs}ms
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA */}
      <div className="border-t pt-8 flex flex-wrap items-baseline justify-between gap-4"
           style={{ borderColor: "var(--ed-rule)" }}>
        <p className="ed-body max-w-md" style={{ color: "var(--ed-ink-soft)" }}>
          Every Sovereign agent routes through the cost-optimizer automatically. You don&rsquo;t
          pay for Opus quality on a task Nemotron solves for 1% of the cost.
        </p>
        <Link
          href="/sign-up"
          className="ed-mono text-sm px-5 py-2.5 transition-opacity hover:opacity-90"
          style={{
            background: "var(--ed-ink)",
            color: "var(--ed-bg)",
            borderRadius: "2px",
          }}
        >
          Start routing smart →
        </Link>
      </div>
    </div>
  );
}
