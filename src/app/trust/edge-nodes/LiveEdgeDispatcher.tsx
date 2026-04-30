"use client";

import { useState } from "react";

/**
 * Live edge-node dispatch preview UI for /trust/edge-nodes.
 *
 * Three pre-built scenarios that exercise the framework. Each
 * scenario hits POST /api/edge-nodes/dispatch which runs the
 * SAME pure functions (resolveRouting + preflightDispatch) as
 * @sovereign/inspector.
 *
 * IMPORTANT: this endpoint is preview-only. No Edge Node is
 * actually invoked. The UI shows the routing decision + the
 * preflight verdict + the projected DispatchResult.
 */

const SCENARIOS = {
  fix_github_issue: {
    label: "Software Engineer · fix-github-issue (default stub)",
    description:
      "Dispatching to fix a GitHub issue. The default registry only has the stub Software Engineer Edge Node — the dispatcher will route to it AND surface that the upstream Trae Agent is not yet wired.",
    request: {
      userId: "user_alice",
      capability: "fix-github-issue",
      task: { issueUrl: "https://github.com/example/repo/issues/42" },
    },
    policy: { decision: "allow" },
    cost: { decision: "proceed" },
  },
  analyst_compliance_with_acat: {
    label: "Analyst · compliance-report (require ACAT in scope)",
    description:
      "Generating a SOX-bound compliance report. Policy demands an ACAT in scope (R91); the request omits it — dispatch refuses preflight with acat_required.",
    request: {
      userId: "user_finance",
      capability: "compliance-report",
      task: { quarter: "Q3-2026", framework: "SOX-404" },
    },
    policy: { decision: "require-acat" },
    cost: { decision: "proceed" },
  },
  operator_prod_denied: {
    label: "Operator · perform-data-migration (policy denies prod)",
    description:
      "Operator persona attempting a data migration on a prod-tagged resource. Policy denies — preflight short-circuits before any cost or routing decision.",
    request: {
      userId: "user_devops",
      capability: "perform-data-migration",
      task: { source: "legacy-erp", destination: "snowflake" },
      resourceTags: { env: "prod" },
    },
    policy: {
      decision: "deny",
      reason: "production_writes_require_hitl (SOC 2 CC8.1)",
    },
    cost: { decision: "proceed" },
  },
} as const;

type ScenarioKey = keyof typeof SCENARIOS;

interface DispatchPreview {
  decision: {
    kind: "route" | "no-match" | "all-stub";
    target?: { id: string };
    best?: { id: string };
    reason?: string;
    rationale?: string;
  };
  preflight:
    | { ok: true }
    | { ok: false; reason: string; details?: string };
  projectedDispatchResult:
    | { ok: true; edgeNodeId: string; receiptLine: string }
    | { ok: false; edgeNodeId: string; reason: string; details?: string; receiptLine: string };
  verifierNote: string;
}
interface ErrResp {
  error: string;
  details?: string;
}
type Result = DispatchPreview | ErrResp;

export function LiveEdgeDispatcher() {
  const [scenarioKey, setScenarioKey] =
    useState<ScenarioKey>("fix_github_issue");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const scenario = SCENARIOS[scenarioKey];

  async function handleDispatch() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/edge-nodes/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request: scenario.request,
          policy: scenario.policy,
          cost: scenario.cost,
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            DispatchRequest
          </label>
          <pre className="mt-2 max-h-72 overflow-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
            {JSON.stringify(scenario.request, null, 2)}
          </pre>
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            Policy decision
          </label>
          <pre className="mt-2 max-h-72 overflow-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
            {JSON.stringify(scenario.policy, null, 2)}
          </pre>
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            Cost decision
          </label>
          <pre className="mt-2 max-h-72 overflow-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
            {JSON.stringify(scenario.cost, null, 2)}
          </pre>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-serif text-sm italic text-[#5A4F3F]">
          Preview-only. No Edge Node is invoked. Same pure functions
          as <code>@sovereign/inspector</code>.
        </p>
        <button
          type="button"
          onClick={handleDispatch}
          disabled={busy}
          className="rounded bg-[#1A1712] px-6 py-3 font-mono text-xs uppercase tracking-[0.18em] text-[#F4EFE6] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#3A3128]"
        >
          {busy ? "Dispatching…" : "Preview dispatch →"}
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
  const projected = result.projectedDispatchResult;
  const accent = projected.ok
    ? "border-emerald-700 bg-emerald-50"
    : "border-rose-700 bg-rose-50";
  const headColor = projected.ok ? "text-emerald-800" : "text-rose-800";

  return (
    <div className={`border-l-4 ${accent} p-5 space-y-4`}>
      <div>
        <p className={`font-mono text-xs uppercase tracking-[0.14em] ${headColor}`}>
          {projected.ok ? "✓ Preview ok" : "✗ Preview refused"}
        </p>
        <p className="mt-2 font-serif text-base text-[#1A1712]">
          {projected.receiptLine}
        </p>
      </div>

      <details className="font-serif text-sm">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
          Routing decision
        </summary>
        <p className="mt-2 font-mono text-xs">
          kind: <strong>{result.decision.kind}</strong>
          {result.decision.target && (
            <>
              {" "}
              · target: {result.decision.target.id}
            </>
          )}
          {result.decision.best && (
            <>
              {" "}
              · best stub: {result.decision.best.id}
            </>
          )}
        </p>
        {result.decision.rationale && (
          <p className="mt-1 font-serif text-sm text-[#3A3128]">
            {result.decision.rationale}
          </p>
        )}
      </details>

      <details className="font-serif text-sm">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
          Preflight verdict
        </summary>
        <p className="mt-2 font-mono text-xs">
          {result.preflight.ok ? "ok" : `refused — ${result.preflight.reason}`}
          {!result.preflight.ok && result.preflight.details && (
            <>
              {" — "}
              {result.preflight.details}
            </>
          )}
        </p>
      </details>

      <p className="font-serif text-xs italic text-[#5A4F3F]">
        {result.verifierNote}
      </p>
    </div>
  );
}
