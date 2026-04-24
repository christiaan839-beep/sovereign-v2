"use client";

/**
 * BattleClient — runs /api/agents/battle and renders the
 * side-by-side comparison.
 *
 * State:
 *   idle      → user hasn't clicked Battle yet
 *   running   → fetch in flight (no streaming — we await the whole result)
 *   done      → results rendered; Winner highlighted
 *   error     → message surfaced; buttons re-enabled
 */

import Link from "next/link";
import { useState } from "react";

interface BattleResult {
  agent: {
    id: string;
    slug: string | null;
    name: string;
    pricingCents: number;
  } | null;
  output: string | null;
  confidence: number;
  latencyMs: number;
  sla: {
    enforced: boolean;
    breached: boolean;
    confidence: number;
  } | null;
  error: string | null;
  errorCode: string | null;
}

interface BattleResponse {
  ok: boolean;
  error?: string;
  code?: string;
  results?: BattleResult[];
  winner?: {
    slug: string | null;
    score: number;
    method: "confidence" | "latency_fallback";
  };
}

function formatCents(cents: number): string {
  if (cents === 0) return "Free";
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

interface Props {
  initialA: string;
  initialB: string;
  initialC: string;
}

export function BattleClient({ initialA, initialB, initialC }: Props) {
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [c, setC] = useState(initialC);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [results, setResults] = useState<BattleResult[]>([]);
  const [winner, setWinner] = useState<BattleResponse["winner"] | null>(null);
  const [err, setErr] = useState<string>("");

  async function battle() {
    const agents = [a, b, c].map((s) => s.trim()).filter(Boolean);
    if (agents.length < 2) {
      setErr("Enter at least two agent slugs");
      setPhase("error");
      return;
    }
    if (!input.trim()) {
      setErr("Enter input");
      setPhase("error");
      return;
    }

    setPhase("running");
    setErr("");
    setResults([]);
    setWinner(null);

    try {
      const res = await fetch("/api/agents/battle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agents, input: input.trim() }),
      });
      const body = (await res.json()) as BattleResponse;
      if (!res.ok || body.ok === false) {
        setErr(body.error ?? `HTTP ${res.status}`);
        setPhase("error");
        return;
      }
      setResults(body.results ?? []);
      setWinner(body.winner ?? null);
      setPhase("done");
    } catch {
      setErr("Network error");
      setPhase("error");
    }
  }

  return (
    <div>
      {/* Input row: three agent slugs + the shared input */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {[
          { label: "Agent A", value: a, setter: setA, placeholder: "slug or UUID" },
          { label: "Agent B", value: b, setter: setB, placeholder: "slug or UUID" },
          { label: "Agent C (optional)", value: c, setter: setC, placeholder: "slug or UUID" },
        ].map((field) => (
          <div key={field.label}>
            <label className="ed-label block mb-2" style={{ color: "var(--ed-ink-soft)" }}>
              {field.label}
            </label>
            <input
              type="text"
              value={field.value}
              onChange={(e) => field.setter(e.target.value)}
              placeholder={field.placeholder}
              className="w-full ed-mono text-sm bg-transparent p-3 outline-none"
              style={{
                border: "1px solid var(--ed-rule)",
                color: "var(--ed-ink)",
                borderRadius: "2px",
              }}
              disabled={phase === "running"}
            />
          </div>
        ))}
      </div>

      <div className="mb-4">
        <label className="ed-label block mb-2" style={{ color: "var(--ed-ink-soft)" }}>
          Shared input
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="The single input both agents will receive"
          rows={4}
          className="w-full ed-mono text-sm bg-transparent p-4 outline-none"
          style={{
            border: "1px solid var(--ed-rule)",
            color: "var(--ed-ink)",
            borderRadius: "2px",
          }}
          disabled={phase === "running"}
        />
      </div>

      <div className="flex items-center justify-between gap-4 mb-8">
        <p className="ed-caption">
          Runs in parallel. Confidence from SLA heuristic. Latency measured per-agent.
        </p>
        <button
          type="button"
          onClick={battle}
          disabled={phase === "running"}
          className="px-6 py-2.5 ed-mono text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{
            background: "var(--ed-copper)",
            color: "var(--ed-bg)",
            borderRadius: "2px",
          }}
        >
          {phase === "running" ? "Running…" : "Battle →"}
        </button>
      </div>

      {phase === "error" && err && (
        <div
          className="p-4 mb-6 ed-caption"
          style={{
            border: "1px solid var(--ed-copper)",
            background: "var(--ed-copper-wash)",
            color: "var(--ed-ink)",
            borderRadius: "2px",
          }}
        >
          <span className="ed-label mr-2" style={{ color: "var(--ed-copper)" }}>ERROR</span>
          {err}
        </div>
      )}

      {winner && (
        <div
          className="p-5 mb-6 ed-body"
          style={{
            border: "1px solid var(--ed-copper)",
            background: "var(--ed-copper-wash)",
            color: "var(--ed-ink)",
            borderRadius: "2px",
          }}
        >
          <p className="ed-label mb-1" style={{ color: "var(--ed-copper)" }}>
            Winner · {winner.method === "confidence" ? "by confidence" : "latency tiebreak"}
          </p>
          <p className="ed-display text-2xl">
            {winner.slug ?? "—"}{" "}
            <span className="ed-mono text-base" style={{ color: "var(--ed-ink-soft)" }}>
              score {winner.score.toFixed(2)}
            </span>
          </p>
        </div>
      )}

      {/* Results grid */}
      {phase === "done" && results.length > 0 && (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${results.length}, minmax(0, 1fr))`,
          }}
        >
          {results.map((r, i) => (
            <div
              key={i}
              className="p-5"
              style={{
                border:
                  winner?.slug && r.agent?.slug === winner.slug
                    ? "1px solid var(--ed-copper)"
                    : "1px solid var(--ed-rule)",
                background: "var(--ed-bg-raised)",
                borderRadius: "2px",
              }}
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span
                  className="ed-mono text-sm"
                  style={{ color: "var(--ed-ink)" }}
                >
                  {r.agent?.name ?? "—"}
                </span>
                {r.agent && (
                  <Link
                    href={`/marketplace/${r.agent.slug ?? r.agent.id}`}
                    className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
                  >
                    view →
                  </Link>
                )}
              </div>
              <dl className="grid grid-cols-3 gap-2 mb-4 ed-caption">
                <div>
                  <dt style={{ color: "var(--ed-ink-soft)" }}>Confidence</dt>
                  <dd
                    className="ed-mono"
                    style={{ color: "var(--ed-copper)" }}
                  >
                    {(r.confidence * 100).toFixed(0)}%
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "var(--ed-ink-soft)" }}>Latency</dt>
                  <dd className="ed-mono">{r.latencyMs} ms</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--ed-ink-soft)" }}>Price</dt>
                  <dd className="ed-mono">
                    {r.agent ? formatCents(r.agent.pricingCents) : "—"}
                  </dd>
                </div>
              </dl>
              {r.error ? (
                <p
                  className="ed-caption"
                  style={{ color: "var(--ed-copper)" }}
                >
                  {r.error}
                </p>
              ) : (
                <pre
                  className="ed-mono text-[12px] whitespace-pre-wrap"
                  style={{
                    color: "var(--ed-ink)",
                    maxHeight: "400px",
                    overflow: "auto",
                  }}
                >
                  {r.output}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
