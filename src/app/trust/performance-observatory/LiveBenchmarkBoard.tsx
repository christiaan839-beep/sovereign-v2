"use client";

import { useState } from "react";

/**
 * Live benchmark board for /trust/performance-observatory.
 *
 * Three pre-built scenarios that exercise the gap-analysis pure
 * function. Each hits POST /api/performance/gap-analysis which runs
 * the SAME pure function (gapReport → status + linear-fit ETA) as
 * @sovereign/inspector.
 */

const SCENARIOS = {
  swe_pro_rising: {
    label: "SWE-bench Pro · rising trend (3 measurements over 60 days)",
    description:
      "Synthetic history showing steady improvement. The gap analysis returns a linear-fit ETA to target.",
    targetId: "swe-bench-pro",
    history: [
      {
        targetId: "swe-bench-pro",
        measuredValue: 38,
        measuredAt: "2026-03-01T12:00:00.000Z",
        runHash: "synth-1",
        source: {
          harnessCommit: "commit-A",
          datasetVersion: "swe-bench-pro-v1",
          modelId: "trae-agent-v0.9",
        },
        verification: "claimed-only" as const,
      },
      {
        targetId: "swe-bench-pro",
        measuredValue: 43,
        measuredAt: "2026-04-01T12:00:00.000Z",
        runHash: "synth-2",
        source: {
          harnessCommit: "commit-B",
          datasetVersion: "swe-bench-pro-v1",
          modelId: "trae-agent-v0.95",
        },
        verification: "claimed-only" as const,
      },
      {
        targetId: "swe-bench-pro",
        measuredValue: 47,
        measuredAt: "2026-04-30T12:00:00.000Z",
        runHash: "synth-3",
        source: {
          harnessCommit: "commit-C",
          datasetVersion: "swe-bench-pro-v1",
          modelId: "trae-agent-v1.0",
        },
        verification: "claimed-only" as const,
      },
    ],
  },
  long_mem_eval_already_met: {
    label: "LongMemEval · already at 92.5% (target met)",
    description:
      "Synthetic history showing the target is already achieved — gap report returns 'achieved' + 0 days ETA.",
    targetId: "long-mem-eval",
    history: [
      {
        targetId: "long-mem-eval",
        measuredValue: 92.5,
        measuredAt: "2026-04-30T12:00:00.000Z",
        runHash: "lme-1",
        source: {
          harnessCommit: "commit-X",
          datasetVersion: "long-mem-eval-v1",
          modelId: "cognee-graphiti-v1",
        },
        verification: "internal-only" as const,
      },
    ],
  },
  gateway_overhead_drifting: {
    label: "Gateway overhead · regressing (lower-is-better)",
    description:
      "Latency rising over 30 days — gap report flags wrong-direction trend. Time-to-target = null with a procurement-readable explanation.",
    targetId: "gateway-overhead-ms",
    history: [
      {
        targetId: "gateway-overhead-ms",
        measuredValue: 5,
        measuredAt: "2026-04-01T12:00:00.000Z",
        runHash: "gw-1",
        source: {
          harnessCommit: "commit-G1",
          datasetVersion: "gateway-bench-v1",
          modelId: "router-v1",
        },
        verification: "claimed-only" as const,
      },
      {
        targetId: "gateway-overhead-ms",
        measuredValue: 7,
        measuredAt: "2026-04-15T12:00:00.000Z",
        runHash: "gw-2",
        source: {
          harnessCommit: "commit-G2",
          datasetVersion: "gateway-bench-v1",
          modelId: "router-v1",
        },
        verification: "claimed-only" as const,
      },
      {
        targetId: "gateway-overhead-ms",
        measuredValue: 9,
        measuredAt: "2026-04-30T12:00:00.000Z",
        runHash: "gw-3",
        source: {
          harnessCommit: "commit-G3",
          datasetVersion: "gateway-bench-v1",
          modelId: "router-v1",
        },
        verification: "claimed-only" as const,
      },
    ],
  },
} as const;

type ScenarioKey = keyof typeof SCENARIOS;

interface Report {
  report: {
    targetId: string;
    status: { status: string; reason: string; driftPercentagePoints: number };
    timeToTarget: {
      estimatedDays: number | null;
      slope: number | null;
      rationale: string;
    };
    reproducibilityVerified: boolean;
    measurementCount: number;
    headline: string;
  };
  verifierNote: string;
}
interface ErrResp {
  error: string;
  details?: string;
}
type Result = Report | ErrResp;

export function LiveBenchmarkBoard() {
  const [scenarioKey, setScenarioKey] =
    useState<ScenarioKey>("swe_pro_rising");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const scenario = SCENARIOS[scenarioKey];

  async function handleAnalyze() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/performance/gap-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetId: scenario.targetId,
          history: scenario.history,
          asOf: "2026-04-30T12:00:00.000Z",
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
            Target id
          </label>
          <p className="mt-2 font-mono text-sm text-[#1A1712]">
            {scenario.targetId}
          </p>
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            History (count)
          </label>
          <p className="mt-2 font-mono text-sm text-[#1A1712]">
            {scenario.history.length} measurement
            {scenario.history.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <details>
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
          Inspect synthetic history
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
          {JSON.stringify(scenario.history, null, 2)}
        </pre>
      </details>

      <div className="flex items-center justify-between">
        <p className="font-serif text-sm italic text-[#5A4F3F]">
          Same pure function as <code>@sovereign/inspector</code>. Linear
          fit; replayable offline.
        </p>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={busy}
          className="rounded bg-[#1A1712] px-6 py-3 font-mono text-xs uppercase tracking-[0.18em] text-[#F4EFE6] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#3A3128]"
        >
          {busy ? "Analyzing…" : "Analyze gap →"}
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
  const r = result.report;
  const accent =
    r.status.status === "achieved"
      ? "border-emerald-700 bg-emerald-50"
      : r.status.status === "behind"
      ? "border-rose-700 bg-rose-50"
      : "border-amber-700 bg-amber-50";
  const head =
    r.status.status === "achieved"
      ? "text-emerald-800"
      : r.status.status === "behind"
      ? "text-rose-800"
      : "text-amber-800";
  return (
    <div className={`border-l-4 ${accent} p-5 space-y-3`}>
      <p className={`font-mono text-xs uppercase tracking-[0.14em] ${head}`}>
        {r.headline}
      </p>
      <p className="font-serif text-base text-[#1A1712]">{r.status.reason}</p>
      <p className="font-serif text-sm text-[#3A3128]">
        Measurements:{" "}
        <strong>{r.measurementCount}</strong> · Reproducibility verified:{" "}
        <strong>{r.reproducibilityVerified ? "yes" : "no"}</strong> · Drift:{" "}
        <strong>{r.status.driftPercentagePoints.toFixed(1)}%</strong>
      </p>
      <div className="rounded bg-[#1A1712]/5 p-3 font-serif text-sm text-[#3A3128]">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#5A4F3F]">
          Time-to-target
        </p>
        <p className="mt-1">
          {r.timeToTarget.estimatedDays === null
            ? "—"
            : r.timeToTarget.estimatedDays === 0
            ? "0 days (achievable now)"
            : `${r.timeToTarget.estimatedDays.toFixed(0)} days`}
        </p>
        <p className="mt-1 italic">{r.timeToTarget.rationale}</p>
      </div>
      <p className="font-serif text-xs italic text-[#5A4F3F]">
        {result.verifierNote}
      </p>
    </div>
  );
}
