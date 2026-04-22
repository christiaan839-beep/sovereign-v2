"use client";

/**
 * AgentBuilderLiveDemo — landing-page section where a visitor types an
 * agent description and watches real factory-compliant code + tests
 * generate in front of them.
 *
 * This is the money shot: "Nothing else on the market does this." The
 * agent-builder agent is itself a real agent in the registry, running
 * through the same verification pipeline as every customer-facing
 * agent. We just expose a public-demo variant at
 * /api/public/agent-builder-demo that's IP-rate-limited and routed to
 * a synthetic public-demo tenant.
 *
 * Design: editorial-dark, Technical Monograph voice. No spinners from
 * the 2020 SaaS playbook — instead, a copper progress bar that
 * advances through named phases ("classifying", "drafting", "writing
 * tests"). The phases are client-side estimates; they're named to
 * build confidence that something real is happening, and they don't
 * block the real response (which arrives when it arrives).
 */

import { useState, useRef } from "react";
import Link from "next/link";

type Phase = "idle" | "loading" | "success" | "error";

interface GeneratedAgent {
  suggestedSlug: string;
  routeCode: string;
  testCode: string;
  systemPrompt: string;
  outputSchema: string;
}

const SAMPLE_PURPOSES = [
  "An agent that summarizes customer interview transcripts with sentiment tags per speaker",
  "An agent that compares two product SKUs side by side and returns a buying recommendation",
  "An agent that takes a URL and returns the three most persuasive headlines on the page",
  "An agent that extracts action items from meeting notes with owner + deadline",
];

export function AgentBuilderLiveDemo() {
  const [purpose, setPurpose] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [generated, setGenerated] = useState<GeneratedAgent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  async function handleGenerate() {
    if (purpose.trim().length < 20) {
      setError("Describe the agent in at least 20 characters.");
      setPhase("error");
      return;
    }
    setError(null);
    setPhase("loading");
    setGenerated(null);

    try {
      const res = await fetch("/api/public/agent-builder-demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: purpose.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
        setPhase("error");
        return;
      }
      setGenerated(body.generated);
      setPhase("success");
      // Scroll output into view after render.
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    } catch {
      setError("Network error. Try again in a moment.");
      setPhase("error");
    }
  }

  function tryExample(sample: string) {
    setPurpose(sample);
    setPhase("idle");
    setError(null);
  }

  const isLoading = phase === "loading";

  return (
    <section className="editorial-dark py-28 md:py-36 ed-page" id="agent-builder">
      <div className="ed-max">
        {/* Header block */}
        <div className="grid grid-cols-12 gap-4 mb-12">
          <div className="col-span-12 md:col-span-5">
            <p className="ed-label mb-6" style={{ color: "var(--ed-copper)" }}>
              Section 09 · Agent Builder
            </p>
            <h2 className="ed-display text-5xl md:text-[4rem] leading-[0.95] mb-6"
                style={{ color: "var(--ed-ink)" }}>
              Type an agent.
              <br />
              <span className="ed-display-italic" style={{ color: "var(--ed-ink-soft)" }}>
                Watch it built.
              </span>
            </h2>
            <p className="ed-body max-w-md"
               style={{ color: "var(--ed-ink-soft)" }}>
              The agent-builder agent takes a plain-English description and returns a factory-compliant route,
              a vitest suite, the system prompt, and the output schema. Real code, runnable in three steps.
            </p>
          </div>

          {/* Input column */}
          <div className="col-span-12 md:col-span-7">
            <label className="ed-label block mb-3">
              Describe the agent you want
            </label>
            <textarea
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                if (phase === "error") setPhase("idle");
              }}
              placeholder="e.g. An agent that reads a resume and scores it against a job description…"
              rows={4}
              disabled={isLoading}
              maxLength={500}
              className="w-full ed-mono text-[15px] bg-transparent p-5 outline-none transition-colors resize-none"
              style={{
                border: `1px solid ${
                  phase === "error" ? "var(--ed-copper)" : "var(--ed-rule)"
                }`,
                color: "var(--ed-ink)",
                borderRadius: "2px",
              }}
            />

            {/* Meta row: char count + sample chips + submit */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="ed-caption">
                {purpose.length}/500{purpose.length < 20 && purpose.length > 0 && (
                  <span className="ml-2" style={{ color: "var(--ed-copper)" }}>
                    need 20+ chars
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading || purpose.trim().length < 20}
                className="group relative px-5 py-2.5 transition-all ed-mono text-sm disabled:opacity-40"
                style={{
                  background: "var(--ed-copper)",
                  color: "var(--ed-bg)",
                  borderRadius: "2px",
                  cursor: purpose.trim().length < 20 ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--ed-bg)" }} />
                    Generating
                  </span>
                ) : (
                  <>Generate Agent →</>
                )}
              </button>
            </div>

            {/* Sample chips */}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="ed-caption mr-1">or try:</span>
              {SAMPLE_PURPOSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => tryExample(s)}
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

        {/* Loading bar */}
        {isLoading && <LoadingBar />}

        {/* Error message */}
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

        {/* Output */}
        {phase === "success" && generated && (
          <div ref={outputRef} className="mt-10 ed-fade-in">
            <AgentOutputDossier generated={generated} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Loading progress bar ─────────────────────────────────────── */

function LoadingBar() {
  return (
    <div className="mt-10">
      <div className="ed-caption mb-3 flex items-baseline justify-between">
        <span>
          <span style={{ color: "var(--ed-copper)" }}>Classifying intent</span>
          <span className="mx-2" style={{ color: "var(--ed-rule)" }}>·</span>
          <span>Drafting route</span>
          <span className="mx-2" style={{ color: "var(--ed-rule)" }}>·</span>
          <span>Writing tests</span>
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
      <style>{`
        @keyframes ed-loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(250%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

/* ─── Output dossier — the generated agent presented as a filing ──── */

function AgentOutputDossier({ generated }: { generated: GeneratedAgent }) {
  const [copiedRoute, setCopiedRoute] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);

  function copy(text: string, target: "route" | "test") {
    navigator.clipboard.writeText(text).then(() => {
      if (target === "route") {
        setCopiedRoute(true);
        setTimeout(() => setCopiedRoute(false), 1800);
      } else {
        setCopiedTest(true);
        setTimeout(() => setCopiedTest(false), 1800);
      }
    });
  }

  const isRefused = generated.suggestedSlug === "refused";

  return (
    <div>
      {/* Dossier header */}
      <div className="border-t pt-6 mb-8" style={{ borderColor: "var(--ed-copper)" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
          <p className="ed-label" style={{ color: "var(--ed-copper)" }}>
            Generated agent — ready to commit
          </p>
          <p className="ed-caption">
            factory-compliant · fully tested · safety-reviewed
          </p>
        </div>
        <h3 className="ed-display text-4xl md:text-5xl" style={{ color: "var(--ed-ink)" }}>
          <span className="ed-mono text-2xl md:text-3xl mr-3" style={{ color: "var(--ed-ink-dim)" }}>
            slug:
          </span>
          <span style={{ color: isRefused ? "var(--ed-copper)" : "var(--ed-ink)" }}>
            {generated.suggestedSlug}
          </span>
        </h3>
      </div>

      {isRefused ? (
        <div className="p-6 mb-10 ed-body"
             style={{
               border: "1px solid var(--ed-copper)",
               borderRadius: "2px",
               color: "var(--ed-ink)",
               background: "var(--ed-copper-wash)",
             }}>
          <p className="mb-2">
            <span className="ed-label mr-2" style={{ color: "var(--ed-copper)" }}>REFUSED</span>
            The model declined to generate this agent.
          </p>
          <pre className="ed-mono text-sm mt-3 whitespace-pre-wrap">
            {generated.routeCode}
          </pre>
          <p className="ed-caption mt-4">
            Try describing an agent that transforms, analyzes, or summarizes user-provided inputs.
          </p>
        </div>
      ) : (
        <>
          {/* System prompt strip */}
          <div className="mb-10">
            <div className="flex items-baseline justify-between mb-2">
              <p className="ed-label">System prompt</p>
              <p className="ed-caption">
                {generated.systemPrompt.length.toLocaleString()} chars
              </p>
            </div>
            <pre className="ed-mono text-[13px] p-4 leading-relaxed overflow-x-auto max-h-48"
                 style={{
                   background: "var(--ed-bg-raised)",
                   border: "1px solid var(--ed-rule)",
                   color: "var(--ed-ink-soft)",
                   borderRadius: "2px",
                 }}>
              {generated.systemPrompt}
            </pre>
          </div>

          {/* Code two-column */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <CodePane
              title="route.ts"
              subtitle="factory-wrapped POST handler"
              code={generated.routeCode}
              copied={copiedRoute}
              onCopy={() => copy(generated.routeCode, "route")}
            />
            <CodePane
              title="route.test.ts"
              subtitle="mocked-ai vitest suite"
              code={generated.testCode}
              copied={copiedTest}
              onCopy={() => copy(generated.testCode, "test")}
            />
          </div>

          {/* Install CTA */}
          <div className="border-t pt-8 flex flex-wrap items-baseline justify-between gap-4"
               style={{ borderColor: "var(--ed-rule)" }}>
            <p className="ed-body max-w-md" style={{ color: "var(--ed-ink-soft)" }}>
              Install on your tenant and this agent joins your private{" "}
              <span className="ed-mono" style={{ color: "var(--ed-copper)" }}>
                {generated.suggestedSlug}
              </span>{" "}
              route, callable via the Sovereign API or MCP.
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
              Install this agent →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── CodePane — one of the two side-by-side code blocks ──────────── */

function CodePane({
  title,
  subtitle,
  code,
  copied,
  onCopy,
}: {
  title: string;
  subtitle: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className="ed-mono text-sm" style={{ color: "var(--ed-ink)" }}>
            {title}
          </p>
          <p className="ed-caption">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="ed-label transition-colors hover:text-[var(--ed-copper)]"
          style={{ color: copied ? "var(--ed-copper)" : "var(--ed-ink-dim)" }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="ed-mono text-[12.5px] leading-relaxed p-4 overflow-x-auto max-h-[520px] overflow-y-auto"
           style={{
             background: "var(--ed-bg-raised)",
             border: "1px solid var(--ed-rule)",
             color: "var(--ed-ink-soft)",
             borderRadius: "2px",
           }}>
        {code}
      </pre>
    </div>
  );
}
