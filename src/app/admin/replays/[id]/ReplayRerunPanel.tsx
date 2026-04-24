"use client";

/**
 * ReplayRerunPanel — client island inside /admin/replays/[id] that
 * lets an admin re-invoke the agent with either the original input
 * or a modified version. Uses the streaming /api/agents/invoke/stream
 * endpoint so the tokens appear live, same as the marketplace UX.
 *
 * Power-user flow: tune a prompt, watch output stream, compare with
 * the recorded output in the timeline above. No bouncing through
 * the buyer-facing marketplace page.
 */

import { useState } from "react";

type Phase = "idle" | "running" | "done" | "error";

interface Props {
  agentName: string;
  initialInput: string;
}

export function ReplayRerunPanel({ agentName, initialInput }: Props) {
  const [input, setInput] = useState(initialInput);
  const [output, setOutput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string>("");

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
    </section>
  );
}
