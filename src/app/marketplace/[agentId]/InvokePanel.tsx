"use client";

/**
 * InvokePanel — let the visitor run the agent right on the detail page.
 *
 * State machine:
 *   idle       → no input yet
 *   running    → POST /api/agents/invoke in flight
 *   success    → result rendered with earnings line
 *   error      → message shown, button re-enabled
 *
 * The panel is deliberately minimalist (one textarea + one button).
 * Richer input forms — structured fields from the SAM manifest,
 * file upload for vision agents — are follow-up work. This version
 * ships the flywheel: visitor types, clicks, sees output, creator
 * earnings ledger increments.
 */

import { useState } from "react";

type Phase = "idle" | "running" | "success" | "error";

interface Earnings {
  grossCents: number;
  creatorCents: number;
  creditRecorded: boolean;
}

interface Props {
  slugOrId: string;
  agentName: string;
  pricingCents: number;
}

function formatCents(cents: number): string {
  if (cents === 0) return "Free";
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

export function InvokePanel({ slugOrId, agentName, pricingCents }: Props) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<string>("");
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [errMsg, setErrMsg] = useState<string>("");

  async function run() {
    const trimmed = input.trim();
    if (!trimmed) {
      setErrMsg("Enter something to run the agent on");
      setPhase("error");
      return;
    }
    setPhase("running");
    setErrMsg("");

    try {
      const res = await fetch("/api/agents/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: slugOrId, input: trimmed }),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        setErrMsg(body.error ?? `HTTP ${res.status}`);
        setPhase("error");
        return;
      }
      setResult(String(body.result ?? ""));
      setEarnings({
        grossCents: body.earnings?.grossCents ?? 0,
        creatorCents: body.earnings?.creatorCents ?? 0,
        creditRecorded: Boolean(body.earnings?.creditRecorded),
      });
      setPhase("success");
    } catch {
      setErrMsg("Network error. Try again.");
      setPhase("error");
    }
  }

  const isRunning = phase === "running";

  return (
    <section className="mb-14">
      <h2 className="ed-label mb-5">Try it</h2>

      <div
        className="p-5 mb-4"
        style={{
          border: "1px solid var(--ed-rule)",
          background: "var(--ed-bg-raised)",
          borderRadius: "2px",
        }}
      >
        <label className="ed-label block mb-3" style={{ color: "var(--ed-ink-soft)" }}>
          Input for {agentName}
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste text, a URL, or your question…"
          rows={5}
          className="w-full ed-mono text-sm bg-transparent p-4 outline-none transition-colors"
          style={{
            border: "1px solid var(--ed-rule)",
            color: "var(--ed-ink)",
            borderRadius: "2px",
          }}
          disabled={isRunning}
        />
        <div className="flex items-center justify-between gap-4 mt-4 flex-wrap">
          <p className="ed-caption" style={{ color: "var(--ed-ink-soft)" }}>
            {pricingCents === 0
              ? "Free to run."
              : `Each run logs ${formatCents(pricingCents)} gross — ${formatCents(
                  Math.floor(pricingCents * 0.7),
                )} to the creator, ${formatCents(
                  pricingCents - Math.floor(pricingCents * 0.7),
                )} to Sovereign Matrix.`}
          </p>
          <button
            type="button"
            onClick={run}
            disabled={isRunning || !input.trim()}
            className="px-5 py-2.5 ed-mono text-sm transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "var(--ed-copper)",
              color: "var(--ed-bg)",
              borderRadius: "2px",
            }}
          >
            {isRunning ? "Running…" : "Run agent →"}
          </button>
        </div>
      </div>

      {/* Error */}
      {phase === "error" && errMsg && (
        <div
          className="p-4 ed-caption"
          style={{
            border: "1px solid var(--ed-copper)",
            background: "var(--ed-copper-wash)",
            color: "var(--ed-ink)",
            borderRadius: "2px",
          }}
        >
          <span className="ed-label mr-2" style={{ color: "var(--ed-copper)" }}>
            ERROR
          </span>
          {errMsg}
        </div>
      )}

      {/* Success */}
      {phase === "success" && (
        <div
          className="p-5"
          style={{
            border: "1px solid var(--ed-copper)",
            background: "var(--ed-copper-wash)",
            borderRadius: "2px",
          }}
        >
          <p className="ed-label mb-3" style={{ color: "var(--ed-copper)" }}>
            ✓ Result
          </p>
          <pre
            className="ed-mono text-sm whitespace-pre-wrap mb-4"
            style={{ color: "var(--ed-ink)" }}
          >
            {result}
          </pre>
          {earnings && earnings.grossCents > 0 && (
            <p className="ed-caption pt-3" style={{ borderTop: "1px solid var(--ed-rule)" }}>
              {earnings.creditRecorded
                ? `✓ ${formatCents(earnings.creatorCents)} credited to creator's pending earnings.`
                : "Earnings ledger offline — admin review pending."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
