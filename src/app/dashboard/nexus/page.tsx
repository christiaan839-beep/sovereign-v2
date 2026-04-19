"use client";

/**
 * NEXUS — Technical Monograph
 *
 * Four frontier models, racing in parallel, rendered like a technical journal
 * entry. Instrument Serif display, JetBrains Mono for data, Inter Tight body.
 * Bone on near-black, burnt copper as the sole accent.
 *
 * Explicit design choices:
 *  - Asymmetric column split (prompt on the left, live output on the right)
 *  - Models indexed as 01–04 in mono, like a table of contents
 *  - Serif italic for the thinking state — "thinking" should feel human
 *  - No glassmorphism. No glow. No neon. Rules, margins, mono numerics.
 */

import { useState, useRef, useEffect, useCallback } from "react";

const AGENTS = [
  { id: "nemotron", n: "01", name: "Nemotron Ultra",     role: "Strategic Analyst", params: "253B" },
  { id: "qwen",     n: "02", name: "Qwen 3",             role: "Deep Reasoner",     params: "235B" },
  { id: "mistral",  n: "03", name: "Mistral Nemotron",   role: "Devil's Advocate",  params: "70B"  },
  { id: "deepseek", n: "04", name: "DeepSeek V3",        role: "Pragmatist",        params: "685B" },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];
type Phase = "idle" | "racing" | "consensus" | "done";

interface AgentState {
  text: string;
  done: boolean;
  latencyMs: number | null;
  error: string | null;
}

const DEFAULT: AgentState = { text: "", done: false, latencyMs: null, error: null };

const PROMPTS = [
  "What's the biggest hidden risk in raising VC funding vs staying bootstrapped?",
  "How can a 5-person startup beat a 500-person company?",
  "What separates a $1M company from a $100M company?",
  "Is AI replacing founders, or making them more powerful?",
];

/* Safe bold renderer — splits **bold** without injecting HTML */
function renderBold(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <em key={i} className="ed-copper not-italic font-medium">{part.slice(2, -2)}</em>
      : <span key={i}>{part}</span>,
  );
}

/* ─── ModelRow ───────────────────────────────────────────────
 *   Each model occupies a horizontal band with:
 *     [ 01 ]  Name — role                           latency
 *             running copy streams here.....
 */

function ModelRow({ agent, state, active }: {
  agent: (typeof AGENTS)[number];
  state: AgentState;
  active: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.text]);

  return (
    <article className="grid grid-cols-[40px_1fr] gap-5 md:gap-8 py-6 border-t" style={{ borderColor: "var(--ed-rule-soft)" }}>
      {/* Index */}
      <div className="pt-1">
        <div className="ed-mono text-[11px]" style={{ color: state.done ? "var(--ed-copper)" : "var(--ed-ink-dim)" }}>
          {agent.n}
        </div>
      </div>

      {/* Body */}
      <div>
        {/* Header row */}
        <header className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h3 className="ed-display text-2xl md:text-[28px]" style={{ lineHeight: 1 }}>
              {agent.name}
            </h3>
            <span className="ed-display-italic text-[15px]" style={{ color: "var(--ed-ink-soft)" }}>
              — {agent.role}
            </span>
            <span className="ed-mono text-[10px]" style={{ color: "var(--ed-ink-dim)" }}>
              {agent.params}
            </span>
          </div>
          <div className="ed-mono text-[10px] tabular-nums" style={{ color: state.done ? "var(--ed-copper)" : "var(--ed-ink-dim)" }}>
            {state.error
              ? "error"
              : state.latencyMs !== null
                ? `${(state.latencyMs / 1000).toFixed(2)}s`
                : active ? "generating" : "idle"}
          </div>
        </header>

        {/* Copy */}
        <div
          ref={ref}
          className="ed-body text-[15px] max-h-40 overflow-y-auto pr-2"
          style={{ color: state.error ? "var(--ed-copper)" : "var(--ed-ink)" }}
        >
          {state.error ? (
            <span>{state.error}</span>
          ) : state.text ? (
            <>
              {state.text}
              {active && !state.done && (
                <span
                  aria-hidden
                  className="inline-block w-[2px] h-[14px] ml-0.5 align-middle"
                  style={{ background: "var(--ed-copper)", animation: "ed-fade 900ms steps(2) infinite alternate" }}
                />
              )}
            </>
          ) : active ? (
            <em className="ed-display-italic" style={{ color: "var(--ed-ink-soft)" }}>
              thinking…
            </em>
          ) : (
            <span style={{ color: "var(--ed-ink-dim)" }}>awaiting prompt</span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─── Consensus ─────────────────────────────────────────────── */

function Consensus({ text, done }: { text: string; done: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);

  return (
    <section className="pt-10 mt-10 border-t" style={{ borderColor: "var(--ed-copper)" }}>
      <div className="grid grid-cols-[40px_1fr] gap-5 md:gap-8">
        <div className="ed-mono text-[11px] pt-1 ed-copper">◆</div>
        <div>
          <header className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="ed-display text-3xl md:text-[34px]" style={{ lineHeight: 1 }}>
                Consensus
              </h3>
              <p className="ed-caption mt-1">Gemini 2.0 · four perspectives synthesized</p>
            </div>
            {done && (
              <button
                onClick={() => navigator.clipboard.writeText(text)}
                className="ed-label hover:underline"
                style={{ textUnderlineOffset: "4px" }}
              >
                Copy →
              </button>
            )}
          </header>
          <div
            ref={ref}
            className="ed-body text-[17px] leading-[1.65] max-h-64 overflow-y-auto pr-2"
          >
            {text ? (
              <>
                {renderBold(text)}
                {!done && (
                  <span
                    aria-hidden
                    className="inline-block w-[2px] h-4 ml-1 align-middle"
                    style={{ background: "var(--ed-copper)", animation: "ed-fade 900ms steps(2) infinite alternate" }}
                  />
                )}
              </>
            ) : (
              <em className="ed-display-italic" style={{ color: "var(--ed-ink-soft)" }}>
                synthesizing…
              </em>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function NexusPage() {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [states, setStates] = useState<Record<AgentId, AgentState>>(
    Object.fromEntries(AGENTS.map(a => [a.id, { ...DEFAULT }])) as Record<AgentId, AgentState>,
  );
  const [consensus, setConsensus] = useState("");
  const [consensusDone, setConsensusDone] = useState(false);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setStates(Object.fromEntries(AGENTS.map(a => [a.id, { ...DEFAULT }])) as Record<AgentId, AgentState>);
    setConsensus("");
    setConsensusDone(false);
    setTotalMs(null);
    setSubmittedPrompt("");
  }, []);

  const run = useCallback(async () => {
    if (!prompt.trim() || phase === "racing" || phase === "consensus") return;
    reset();
    await new Promise(r => setTimeout(r, 40));

    setSubmittedPrompt(prompt);
    setPhase("racing");
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/agents/nexus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: abort.signal,
      });
      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "token") {
              setStates(prev => ({ ...prev, [ev.model]: { ...prev[ev.model as AgentId], text: prev[ev.model as AgentId].text + ev.text } }));
            } else if (ev.type === "model_done") {
              setStates(prev => ({ ...prev, [ev.model]: { ...prev[ev.model as AgentId], done: true, latencyMs: ev.latencyMs } }));
            } else if (ev.type === "error") {
              setStates(prev => ({ ...prev, [ev.model]: { ...prev[ev.model as AgentId], error: ev.message, done: true } }));
            } else if (ev.type === "consensus_start") {
              setPhase("consensus");
            } else if (ev.type === "consensus_token") {
              setConsensus(c => c + ev.text);
            } else if (ev.type === "end") {
              setTotalMs(ev.latencyMs);
              setConsensusDone(true);
              setPhase("done");
            }
          } catch { /* malformed chunk */ }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") setPhase("done");
    }
  }, [prompt, phase, reset]);

  const isRunning = phase === "racing" || phase === "consensus";
  const canRun = prompt.trim().length > 0 && !isRunning;

  return (
    <div className="editorial-dark min-h-screen">
      {/* Page frame */}
      <div className="ed-page py-10 md:py-16">
        <div className="ed-max">

          {/* Masthead */}
          <header className="ed-grid-12 pb-10 border-b" style={{ borderColor: "var(--ed-rule)" }}>
            <div className="col-span-12 md:col-span-8">
              <p className="ed-label mb-5">Sovereign Matrix · Nexus Protocol · Issue 01</p>
              <h1 className="ed-display text-[56px] md:text-[88px]" style={{ lineHeight: 0.9, letterSpacing: "-0.02em" }}>
                Four frontier models,{" "}
                <em className="ed-display-italic ed-copper">thinking in parallel.</em>
              </h1>
              <p className="ed-body text-[17px] mt-6 max-w-xl" style={{ color: "var(--ed-ink-soft)" }}>
                Ask one question. Watch Nemotron, Qwen, Mistral and DeepSeek answer
                simultaneously. Then Gemini reads all four and writes the one answer
                that survives.
              </p>
            </div>

            <aside className="col-span-12 md:col-span-4 md:pl-8 md:border-l pt-6 md:pt-1" style={{ borderColor: "var(--ed-rule-soft)" }}>
              <dl className="space-y-4">
                <div>
                  <dt className="ed-label">Engine</dt>
                  <dd className="ed-body text-sm mt-1">True parallel SSE. Each model&apos;s tokens forward to the client as they arrive — not staged.</dd>
                </div>
                <div>
                  <dt className="ed-label">Synthesizer</dt>
                  <dd className="ed-body text-sm mt-1">Gemini 2.0 Flash. Reads all four transcripts, writes a single authoritative answer.</dd>
                </div>
                <div>
                  <dt className="ed-label">Models consulted</dt>
                  <dd className="ed-mono text-sm mt-1 tabular-nums">1,243 B total parameters</dd>
                </div>
              </dl>
            </aside>
          </header>

          {/* Input */}
          <section className="pt-10 pb-10">
            <label htmlFor="nexus-prompt" className="ed-label block mb-4">The question</label>
            <div className="relative">
              <textarea
                id="nexus-prompt"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    run();
                  }
                }}
                placeholder="Ask anything worth thinking hard about…"
                disabled={isRunning}
                rows={2}
                className="w-full bg-transparent ed-display text-[28px] md:text-[36px] leading-tight py-3 pr-24 border-0 border-b-2 focus:outline-none resize-none placeholder:ed-display-italic"
                style={{
                  borderColor: canRun ? "var(--ed-copper)" : "var(--ed-rule)",
                  color: "var(--ed-ink)",
                  letterSpacing: "-0.01em",
                  transition: "border-color 300ms ease",
                }}
              />
              <div className="absolute right-0 bottom-4 flex items-center gap-3">
                {phase !== "idle" && (
                  <button
                    onClick={reset}
                    className="ed-label hover:ed-copper transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={run}
                  disabled={!canRun}
                  className="ed-label px-4 py-2 border transition-all disabled:opacity-30"
                  style={{
                    borderColor: canRun ? "var(--ed-copper)" : "var(--ed-rule)",
                    color: canRun ? "var(--ed-copper)" : "var(--ed-ink-dim)",
                  }}
                >
                  {isRunning ? "Running" : "Run →"}
                </button>
              </div>
            </div>

            {/* Example prompts */}
            {phase === "idle" && (
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                {PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPrompt(p)}
                    className="ed-body text-[13px] text-left hover:ed-copper transition-colors"
                    style={{ color: "var(--ed-ink-dim)" }}
                  >
                    → {p.length > 70 ? p.slice(0, 70) + "…" : p}
                  </button>
                ))}
              </div>
            )}

            {/* Submitted prompt echo */}
            {submittedPrompt && (
              <div className="mt-4 flex items-baseline gap-3">
                <span className="ed-label">Asking</span>
                <span className="ed-display-italic text-[18px]">&ldquo;{submittedPrompt}&rdquo;</span>
              </div>
            )}
          </section>

          {/* Model ledger */}
          {phase !== "idle" && (
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="ed-label">The four responses</h2>
                {phase === "racing" && (
                  <span className="ed-caption ed-copper">generating simultaneously</span>
                )}
              </div>

              <div>
                {AGENTS.map(a => (
                  <ModelRow
                    key={a.id}
                    agent={a}
                    state={states[a.id]}
                    active={!states[a.id].done && phase === "racing"}
                  />
                ))}
              </div>

              {(phase === "consensus" || phase === "done") && (
                <Consensus text={consensus} done={consensusDone} />
              )}
            </section>
          )}

          {/* Footer */}
          <footer className="mt-16 pt-6 border-t grid grid-cols-[40px_1fr] gap-5 md:gap-8" style={{ borderColor: "var(--ed-rule-soft)" }}>
            <div className="ed-mono text-[10px]" style={{ color: "var(--ed-ink-dim)" }}>fin.</div>
            <div className="flex justify-between flex-wrap gap-3">
              <p className="ed-caption">
                Nexus Protocol — Sovereign Matrix
              </p>
              {totalMs !== null ? (
                <p className="ed-caption tabular-nums">
                  completed in <span className="ed-copper">{(totalMs / 1000).toFixed(2)}s</span>
                </p>
              ) : (
                <p className="ed-caption" style={{ color: "var(--ed-ink-dim)" }}>
                  ready
                </p>
              )}
            </div>
          </footer>

        </div>
      </div>
    </div>
  );
}
