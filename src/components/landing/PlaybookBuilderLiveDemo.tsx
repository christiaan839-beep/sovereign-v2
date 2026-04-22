"use client";

/**
 * PlaybookBuilderLiveDemo — the second-level money shot on the landing.
 *
 * Paired with AgentBuilderLiveDemo one section up:
 *   §09 — type ONE agent description, watch ONE agent get generated
 *   §10 — type ONE goal, watch a CHAIN of real agents get composed
 *         with a checkable guarantee and a cost estimate.
 *
 * Where the agent-builder demo showed code, this demo shows a *flow*:
 * numbered steps, agent names, wired inputs, output keys, arrows between.
 *
 * Same cost posture as agent-builder-demo (3/hour/IP, ~\$0.04/call), same
 * refusal-friendly error paths (503 with a friendly 'try rephrasing'
 * instead of 500).
 */

import { useState, useRef } from "react";
import Link from "next/link";

type Phase = "idle" | "loading" | "success" | "error";

interface PlaybookStep {
  agent: string;
  inputs: Record<string, string>;
  outputKey: string;
}

interface Playbook {
  playbookName: string;
  description: string;
  steps: PlaybookStep[];
  guarantee: string;
  estimatedCostCents: number;
}

const SAMPLE_GOALS = [
  "Find 10 qualified fintech SaaS leads in Europe and draft personalized outreach for each",
  "Monitor mentions of my brand across 20 review sites and draft responses to negative reviews",
  "Onboard a new employee: generate an offer letter, welcome email, first-week plan, and Slack intro",
  "Research a competitor's product launch and produce a response brief with messaging angles",
];

function formatCents(cents: number): string {
  if (cents < 10) return `~\$${(cents / 100).toFixed(3)}`;
  return `~\$${(cents / 100).toFixed(2)}`;
}

export function PlaybookBuilderLiveDemo() {
  const [goal, setGoal] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  async function handleCompose() {
    if (goal.trim().length < 20) {
      setError("Describe the goal in at least 20 characters.");
      setPhase("error");
      return;
    }
    setError(null);
    setPhase("loading");
    setPlaybook(null);

    try {
      const res = await fetch("/api/public/playbook-builder-demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
        setPhase("error");
        return;
      }
      setPlaybook(body.playbook);
      setPhase("success");
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } catch {
      setError("Network error. Try again in a moment.");
      setPhase("error");
    }
  }

  function trySample(sample: string) {
    setGoal(sample);
    setPhase("idle");
    setError(null);
  }

  const isLoading = phase === "loading";

  return (
    <section className="editorial-dark py-28 md:py-36 ed-page" id="playbook-builder">
      <div className="ed-max">
        {/* Header block */}
        <div className="grid grid-cols-12 gap-4 mb-12">
          <div className="col-span-12 md:col-span-5">
            <p className="ed-label mb-6" style={{ color: "var(--ed-copper)" }}>
              Section 10 · Playbook Builder
            </p>
            <h2 className="ed-display text-5xl md:text-[4rem] leading-[0.95] mb-6"
                style={{ color: "var(--ed-ink)" }}>
              Describe a goal.
              <br />
              <span className="ed-display-italic" style={{ color: "var(--ed-ink-soft)" }}>
                Watch it orchestrated.
              </span>
            </h2>
            <p className="ed-body max-w-md"
               style={{ color: "var(--ed-ink-soft)" }}>
              The playbook-builder composes real agents into a chain — each step wired
              to the next. You get a checkable guarantee clause and a cost estimate
              before the playbook ever runs.
            </p>
          </div>

          <div className="col-span-12 md:col-span-7">
            <label className="ed-label block mb-3">
              State the goal in plain English
            </label>
            <textarea
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                if (phase === "error") setPhase("idle");
              }}
              placeholder="e.g. Research a prospect company, find 3 decision-makers, draft personalized outreach to each…"
              rows={4}
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="ed-caption">
                {goal.length}/400{goal.length > 0 && goal.length < 20 && (
                  <span className="ml-2" style={{ color: "var(--ed-copper)" }}>
                    need 20+ chars
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={handleCompose}
                disabled={isLoading || goal.trim().length < 20}
                className="group relative px-5 py-2.5 transition-all ed-mono text-sm disabled:opacity-40"
                style={{
                  background: "var(--ed-copper)",
                  color: "var(--ed-bg)",
                  borderRadius: "2px",
                  cursor: goal.trim().length < 20 ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--ed-bg)" }} />
                    Composing
                  </span>
                ) : (
                  <>Compose Playbook →</>
                )}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="ed-caption mr-1">or try:</span>
              {SAMPLE_GOALS.map((s) => (
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
            <div className="ed-caption mb-3 flex items-baseline justify-between">
              <span>
                <span style={{ color: "var(--ed-copper)" }}>Analyzing goal</span>
                <span className="mx-2" style={{ color: "var(--ed-rule)" }}>·</span>
                <span>Selecting agents</span>
                <span className="mx-2" style={{ color: "var(--ed-rule)" }}>·</span>
                <span>Wiring steps</span>
                <span className="mx-2" style={{ color: "var(--ed-rule)" }}>·</span>
                <span>Guarantee clause</span>
              </span>
              <span className="ed-mono">Claude Sonnet</span>
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

        {phase === "success" && playbook && (
          <div ref={outputRef} className="mt-10 ed-fade-in">
            <PlaybookDossier playbook={playbook} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── PlaybookDossier — the composed playbook as a flow graphic ──── */

function PlaybookDossier({ playbook }: { playbook: Playbook }) {
  const hasSteps = playbook.steps.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="border-t pt-6 mb-8" style={{ borderColor: "var(--ed-copper)" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
          <p className="ed-label" style={{ color: "var(--ed-copper)" }}>
            {hasSteps ? "Composed playbook — ready to run" : "Composition gap — agent required"}
          </p>
          <p className="ed-caption">
            {playbook.steps.length} step{playbook.steps.length === 1 ? "" : "s"} ·{" "}
            estimated cost <span className="ed-mono" style={{ color: "var(--ed-ink)" }}>
              {formatCents(playbook.estimatedCostCents)}
            </span>
          </p>
        </div>
        <h3 className="ed-display text-4xl md:text-5xl" style={{ color: "var(--ed-ink)" }}>
          <span className="ed-mono text-2xl md:text-3xl mr-3" style={{ color: "var(--ed-ink-dim)" }}>
            playbook:
          </span>
          <span>{playbook.playbookName}</span>
        </h3>
        <p className="ed-body mt-3 max-w-3xl" style={{ color: "var(--ed-ink-soft)" }}>
          {playbook.description}
        </p>
      </div>

      {!hasSteps ? (
        <div className="p-6 mb-10 ed-body"
             style={{
               border: "1px solid var(--ed-copper)",
               borderRadius: "2px",
               color: "var(--ed-ink)",
               background: "var(--ed-copper-wash)",
             }}>
          <p className="mb-3">
            <span className="ed-label mr-2" style={{ color: "var(--ed-copper)" }}>GAP</span>
            This goal needs an agent the Sovereign catalog doesn&rsquo;t yet include.
          </p>
          <p className="mb-5 ed-caption">
            Build the missing agent with the Agent Builder above — paste the gap description
            into the prompt and watch it generate.
          </p>
          <Link
            href="#agent-builder"
            className="ed-mono text-sm px-4 py-2 transition-opacity hover:opacity-90 inline-block"
            style={{
              background: "var(--ed-copper)",
              color: "var(--ed-bg)",
              borderRadius: "2px",
            }}
          >
            Build that agent →
          </Link>
        </div>
      ) : (
        <>
          {/* Flow */}
          <ol className="space-y-0 mb-10">
            {playbook.steps.map((step, i) => (
              <li key={i} className="relative">
                <PlaybookStepCard step={step} index={i} />
                {i < playbook.steps.length - 1 && (
                  <div className="flex justify-center py-3" aria-hidden="true">
                    <svg width="14" height="24" viewBox="0 0 14 24" fill="none">
                      <line x1="7" y1="0" x2="7" y2="16" stroke="var(--ed-copper)" strokeWidth="1" />
                      <polyline
                        points="2,14 7,22 12,14"
                        stroke="var(--ed-copper)"
                        strokeWidth="1"
                        fill="none"
                      />
                    </svg>
                  </div>
                )}
              </li>
            ))}
          </ol>

          {/* Guarantee clause */}
          <div className="p-5 mb-8"
               style={{
                 background: "var(--ed-copper-wash)",
                 border: "1px solid var(--ed-copper)",
                 borderRadius: "2px",
               }}>
            <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
              Guarantee clause
            </p>
            <p className="ed-mono text-[15px]" style={{ color: "var(--ed-ink)" }}>
              {playbook.guarantee}
            </p>
            <p className="ed-caption mt-2">
              Machine-checkable: if the playbook run doesn&rsquo;t satisfy this clause, the run
              is marked failed and credits refunded.
            </p>
          </div>

          {/* CTA */}
          <div className="border-t pt-8 flex flex-wrap items-baseline justify-between gap-4"
               style={{ borderColor: "var(--ed-rule)" }}>
            <p className="ed-body max-w-md" style={{ color: "var(--ed-ink-soft)" }}>
              Run this playbook on your tenant and you pay{" "}
              <span className="ed-mono" style={{ color: "var(--ed-copper)" }}>
                {formatCents(playbook.estimatedCostCents)}
              </span>{" "}
              per execution — only if the guarantee clause passes.
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
              Run this playbook →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── PlaybookStepCard — single step in the flow ─────────────────── */

function PlaybookStepCard({ step, index }: { step: PlaybookStep; index: number }) {
  const inputEntries = Object.entries(step.inputs);

  return (
    <div className="p-5"
         style={{
           background: "var(--ed-bg-raised)",
           border: "1px solid var(--ed-rule)",
           borderRadius: "2px",
         }}>
      <div className="flex items-baseline justify-between mb-3">
        <span className="ed-caption">
          Step <span className="ed-mono" style={{ color: "var(--ed-ink)" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
        </span>
        <span className="ed-label" style={{ color: "var(--ed-copper)" }}>
          → {step.outputKey}
        </span>
      </div>

      <div className="flex items-baseline gap-3 mb-4">
        <span className="ed-display text-2xl" style={{ color: "var(--ed-ink)" }}>
          {step.agent}
        </span>
        <span className="ed-mono text-xs" style={{ color: "var(--ed-ink-dim)" }}>
          /api/agents/{step.agent}
        </span>
      </div>

      {inputEntries.length > 0 && (
        <ul className="space-y-1 pt-3 border-t" style={{ borderColor: "var(--ed-rule)" }}>
          {inputEntries.map(([key, value]) => (
            <li key={key} className="ed-mono text-[13px] flex items-baseline gap-3">
              <span style={{ color: "var(--ed-ink-dim)" }}>{key}:</span>
              <span className="truncate" style={{ color: "var(--ed-ink-soft)" }}>
                {value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
