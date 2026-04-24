"use client";

/**
 * ReplayRerunPanel — client island inside /admin/replays/[id] that
 * lets an admin re-invoke the agent with either the original input
 * or a modified version. Uses the streaming /api/agents/invoke/stream
 * endpoint so the tokens appear live.
 *
 * Power-user flow: tune a prompt, watch output stream, then see the
 * word-level diff vs the recorded output — the closest thing to
 * git-blame for agent output. No bouncing through the marketplace UI.
 */

import { useMemo, useState } from "react";
import { diffWords, similarity } from "@/lib/text-diff";

type Phase = "idle" | "running" | "done" | "error";

interface Props {
  agentName: string;
  initialInput: string;
  /** Original output recorded in the replay trace — used for diff view. */
  originalOutput?: string;
}

export function ReplayRerunPanel({ agentName, initialInput, originalOutput }: Props) {
  const [input, setInput] = useState(initialInput);
  const [output, setOutput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string>("");
  const [showDiff, setShowDiff] = useState(true);

  // Compute diff only when we have both sides + the user wants it.
  // useMemo so tab-toggling doesn't re-run LCS on every render.
  const diffParts = useMemo(() => {
    if (!showDiff || phase !== "done") return null;
    const prev = (originalOutput ?? "").trim();
    if (!prev || !output.trim()) return null;
    return diffWords(prev, output);
  }, [showDiff, phase, originalOutput, output]);

  const similarityPct = useMemo(() => {
    if (!originalOutput || !output) return null;
    return Math.round(similarity(originalOutput, output) * 100);
  }, [originalOutput, output]);

  async function rerun() {
    const trimmed = input.trim();
    if (!trimmed) {
      setErr("Enter input to rerun with");
      setPhase("error");
      return;
    }
    setPhase("running");
    setOutput("");
    setErr("");

    try {
      const res = await fetch("/api/agents/invoke/stream", {
        method: "POST",
        headers: { "content-type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ agent: agentName, input: trimmed }),
      });
      if (!res.ok || !res.body) {
        setErr(`HTTP ${res.status}`);
        setPhase("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf("\n\n");
        while (idx !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          idx = buffer.indexOf("\n\n");
          const evMatch = frame.match(/^event:\s*(.+)$/m);
          const dataMatch = frame.match(/^data:\s*(.+)$/m);
          if (!evMatch || !dataMatch) continue;
          if (evMatch[1].trim() === "token") {
            try {
              const p = JSON.parse(dataMatch[1]) as { text?: string };
              if (typeof p.text === "string") {
                setOutput((prev) => prev + p.text);
              }
            } catch {
              /* skip malformed chunk */
            }
          } else if (evMatch[1].trim() === "error") {
            try {
              const p = JSON.parse(dataMatch[1]) as { message?: string };
              setErr(p.message ?? "stream error");
              setPhase("error");
              return;
            } catch {
              /* skip */
            }
          }
        }
      }
      setPhase("done");
    } catch {
      setErr("Network error");
      setPhase("error");
    }
  }

  return (
    <section
      className="p-5"
      style={{
        border: "1px solid var(--ed-copper)",
        background: "var(--ed-copper-wash)",
        borderRadius: "2px",
      }}
    >
      <p className="ed-label mb-3" style={{ color: "var(--ed-copper)" }}>
        Rerun
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste or edit input, then rerun"
        rows={3}
        className="w-full ed-mono text-sm bg-transparent p-3 outline-none"
        style={{
          border: "1px solid var(--ed-rule)",
          color: "var(--ed-ink)",
          borderRadius: "2px",
        }}
        disabled={phase === "running"}
      />
      <div className="flex items-center justify-between gap-4 mt-3 flex-wrap">
        <p className="ed-caption">
          Streams live via <span className="ed-mono">/api/agents/invoke/stream</span>.
          Compare against the recorded run above.
        </p>
        <button
          type="button"
          onClick={rerun}
          disabled={phase === "running" || !input.trim()}
          className="px-5 py-2 ed-mono text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{
            background: "var(--ed-copper)",
            color: "var(--ed-bg)",
            borderRadius: "2px",
          }}
        >
          {phase === "running" ? "Running…" : "Rerun →"}
        </button>
      </div>

      {err && (
        <p className="ed-caption mt-3" style={{ color: "var(--ed-copper)" }}>
          Error: <span className="ed-mono">{err}</span>
        </p>
      )}

      {(phase === "running" || phase === "done") && output && (
        <pre
          className="mt-4 p-4 ed-mono text-sm whitespace-pre-wrap"
          style={{
            border: "1px solid var(--ed-rule)",
            background: "var(--ed-bg)",
            color: "var(--ed-ink)",
            borderRadius: "2px",
            maxHeight: "300px",
            overflow: "auto",
          }}
        >
          {output}
        </pre>
      )}

      {/* Diff view — shown only when we have both sides of the compare. */}
      {phase === "done" && originalOutput && output && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2 ed-caption">
            <span>
              vs recorded output{" "}
              {similarityPct !== null && (
                <span className="ed-mono" style={{ color: "var(--ed-copper)" }}>
                  · {similarityPct}% similar
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setShowDiff(!showDiff)}
              className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
            >
              {showDiff ? "Hide diff" : "Show diff"}
            </button>
          </div>
          {showDiff && diffParts && (
            <pre
              className="p-4 ed-mono text-[12px] whitespace-pre-wrap"
              style={{
                border: "1px solid var(--ed-copper)",
                background: "var(--ed-bg)",
                borderRadius: "2px",
                maxHeight: "400px",
                overflow: "auto",
              }}
            >
              {diffParts.map((p, i) => {
                if (p.op === "eq") {
                  return (
                    <span key={i} style={{ color: "var(--ed-ink-soft)" }}>
                      {p.text}
                    </span>
                  );
                }
                if (p.op === "add") {
                  return (
                    <span
                      key={i}
                      style={{
                        color: "var(--ed-copper)",
                        background: "var(--ed-copper-wash)",
                      }}
                    >
                      {p.text}
                    </span>
                  );
                }
                return (
                  <span
                    key={i}
                    style={{
                      color: "var(--ed-ink-soft)",
                      textDecoration: "line-through",
                      opacity: 0.55,
                    }}
                  >
                    {p.text}
                  </span>
                );
              })}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
