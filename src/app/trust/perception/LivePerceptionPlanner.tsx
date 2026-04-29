"use client";

import { useState } from "react";

/**
 * Live perception-mesh planner UI for /trust/perception.
 *
 * Three pre-built scenarios that exercise the substrate. Each
 * scenario hits POST /api/perception/plan which runs the SAME
 * pure function (composePerceptionMesh) shipped in
 * @sovereign/inspector — same plan the platform would build at
 * agent-execution time.
 */

const SCENARIOS = {
  boardroom_watch: {
    label: "Boardroom Watch — video + audio + screen with compliance keywords",
    description:
      "Three nodes monitor a board meeting; cross-modal correlation flags 'earnings' or 'guidance' if it appears in any 2 modalities together.",
    spec: {
      nodes: [
        { nodeId: "boardroom-video", kind: "video-monitor" },
        { nodeId: "boardroom-audio", kind: "audio-transcriber" },
        { nodeId: "boardroom-screen", kind: "screenshot-analyzer" },
      ],
    },
    inputs: {
      context: "Q3 earnings call — confidential",
      perNode: {
        "boardroom-video": [
          { kind: "video", videoUrl: "https://example.com/boardroom.mp4" },
        ],
        "boardroom-audio": [
          { kind: "audio", audioUrl: "https://example.com/boardroom.wav" },
        ],
        "boardroom-screen": [
          { kind: "image", imageUrl: "https://example.com/slide.png" },
        ],
      },
    },
    rules: [
      {
        name: "earnings-leak-watch",
        kind: "keyword-overlap",
        keywords: ["earnings", "guidance", "Q3", "revenue"],
        severity: "warn",
      },
    ],
  },
  duplicate_invoice: {
    label: "Duplicate Invoice Detector — cross-document JSON match",
    description:
      "Two document-extractor nodes parse incoming invoices; correlation flags any invoice ID appearing in both with severity 'alert'.",
    spec: {
      nodes: [
        { nodeId: "doc-stream-1", kind: "document-extractor" },
        { nodeId: "doc-stream-2", kind: "document-extractor" },
      ],
    },
    inputs: {
      context: "Accounts payable inbox — duplicate invoice scan",
      perNode: {
        "doc-stream-1": [
          { kind: "image", imageUrl: "https://example.com/invoice-a.png" },
        ],
        "doc-stream-2": [
          { kind: "image", imageUrl: "https://example.com/invoice-b.png" },
        ],
      },
    },
    rules: [
      {
        name: "duplicate-invoice",
        kind: "json-field-match",
        jsonField: "invoice.id",
        severity: "alert",
      },
    ],
  },
  computer_use_swarm: {
    label: "Computer Use Swarm — screenshot + freeform synthesis",
    description:
      "Screenshot-analyzer extracts GUI elements; freeform-synthesizer plans actions. Both share global context (the user's goal).",
    spec: {
      nodes: [
        { nodeId: "screen-1", kind: "screenshot-analyzer" },
        { nodeId: "synth-1", kind: "freeform-synthesizer" },
      ],
    },
    inputs: {
      context:
        "Goal: complete the expense report and submit to Concur. Use the screenshot to identify the next action.",
      perNode: {
        "screen-1": [
          { kind: "image", imageUrl: "https://example.com/expense-app.png" },
        ],
        "synth-1": [
          {
            kind: "text",
            text: "Plan the next 3 actions based on the screenshot analysis from screen-1.",
          },
        ],
      },
    },
    rules: [],
  },
} as const;

type ScenarioKey = keyof typeof SCENARIOS;

interface PlanResult {
  plan: {
    nodePlans: Array<{
      nodeId: string;
      kind: string;
      systemPrompt: string;
      partKindsRouted: string[];
    }>;
    rationale: string;
    estimatedMaxTokens: number;
  };
  rulesEcho: unknown[];
  verifierNote: string;
}
interface ErrResp {
  error: string;
  details?: string;
}
type Result = PlanResult | ErrResp;

export function LivePerceptionPlanner() {
  const [scenarioKey, setScenarioKey] =
    useState<ScenarioKey>("boardroom_watch");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const scenario = SCENARIOS[scenarioKey];

  async function handlePlan() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/perception/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spec: scenario.spec,
          inputs: scenario.inputs,
          rules: scenario.rules,
        }),
      });
      const data = (await res.json()) as Result;
      setResult(data);
    } catch (err) {
      setResult({
        error: "client_error",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 rounded border border-[#D8CFBE] bg-[#EFE8D7] p-6 lg:p-8">
      <div>
        <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
          Scenario
        </label>
        <select
          value={scenarioKey}
          onChange={(e) => {
            setScenarioKey(e.target.value as ScenarioKey);
            setResult(null);
          }}
          className="mt-2 w-full rounded border border-[#D8CFBE] bg-[#F4EFE6] p-3 font-mono text-sm text-[#1A1712] focus:border-[#5A4F3F] focus:outline-none"
        >
          {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
            <option key={k} value={k}>
              {SCENARIOS[k].label}
            </option>
          ))}
        </select>
        <p className="mt-3 font-serif text-base text-[#3A3128]">
          {scenario.description}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            Mesh spec
          </label>
          <pre className="mt-2 max-h-72 overflow-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
            {JSON.stringify(scenario.spec, null, 2)}
          </pre>
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            Inputs (per-node routing)
          </label>
          <pre className="mt-2 max-h-72 overflow-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
            {JSON.stringify(scenario.inputs, null, 2)}
          </pre>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-serif text-sm italic text-[#5A4F3F]">
          Same pure function as <code>@sovereign/inspector</code>. No
          model is invoked; planning is offline math.
        </p>
        <button
          type="button"
          onClick={handlePlan}
          disabled={busy}
          className="rounded bg-[#1A1712] px-6 py-3 font-mono text-xs uppercase tracking-[0.18em] text-[#F4EFE6] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#3A3128]"
        >
          {busy ? "Composing…" : "Compose plan →"}
        </button>
      </div>

      {result && <ResultBlock result={result} />}
    </div>
  );
}

function ResultBlock({ result }: { result: Result }) {
  if ("error" in result) {
    return (
      <div className="border-l-4 border-amber-700 bg-amber-50 p-5 font-serif text-base">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-amber-800">
          Bad request
        </p>
        <p className="mt-2">{result.details ?? result.error}</p>
      </div>
    );
  }
  return (
    <div className="border-l-4 border-emerald-700 bg-emerald-50 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-emerald-800">
        ✓ Plan composed · {result.plan.nodePlans.length} node
        {result.plan.nodePlans.length === 1 ? "" : "s"}
      </p>
      <p className="mt-2 font-serif text-base text-[#1A1712]">
        Estimated max-tokens budget:{" "}
        <strong>{result.plan.estimatedMaxTokens.toLocaleString()}</strong>
      </p>
      <p className="mt-1 font-serif text-base text-[#3A3128]">
        {result.plan.rationale}
      </p>
      <details className="mt-4">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
          Per-node plan details
        </summary>
        <ul className="mt-3 space-y-3">
          {result.plan.nodePlans.map((np) => (
            <li
              key={np.nodeId}
              className="rounded border border-emerald-200 bg-emerald-100/40 p-3"
            >
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#5A4F3F]">
                {np.nodeId} · {np.kind}
              </p>
              <p className="mt-1 font-serif text-sm text-[#3A3128]">
                Routed parts: {np.partKindsRouted.join(", ") || "—"}
              </p>
              <p className="mt-1 font-mono text-xs text-[#5A4F3F]">
                System prompt ({np.systemPrompt.length} chars)
              </p>
            </li>
          ))}
        </ul>
      </details>
      <p className="mt-3 font-serif text-xs italic text-[#5A4F3F]">
        {result.verifierNote}
      </p>
    </div>
  );
}
