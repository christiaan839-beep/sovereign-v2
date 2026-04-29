"use client";

import { useState } from "react";

/**
 * Live policy evaluator UI for /trust/control-plane.
 *
 * Three pre-built policy scenarios that procurement can run in
 * the browser. Each scenario is a real, useful policy that
 * exercises the predicate DSL.
 *
 * The UI POSTs to /api/control-plane/policy/evaluate which runs
 * the SAME pure function shipped in @sovereign/inspector. Same
 * decision the platform would make at agent-execution time.
 */

const SCENARIOS = {
  finance_read_only: {
    label: "Finance agent must be read-only (SOX 404)",
    description:
      "Deny any tier-2/3 agent that's tagged for the finance department. Break-glass-eligible for audit cycles.",
    policies: [
      {
        name: "finance_agent_can_read_customers_but_not_write",
        priority: 10,
        effect: "deny",
        predicates: [
          { kind: "resource-tag-eq", tag: "department", value: "finance" },
          { kind: "agent-tier-leq", tier: 1 },
        ],
        breakGlassEligible: true,
        regulatoryCitation: "SOX 404 (segregation of duties)",
      },
    ],
    context: {
      userId: "user_finance_clerk",
      agentId: "transaction-poster",
      agentTier: 2,
      reputationGrade: "A",
      resourceTags: { department: "finance", env: "prod" },
    },
  },
  prod_writes_hitl: {
    label: "Production writes require HITL (SOC 2 CC8.1)",
    description:
      "Tier-2 actions on prod-tagged resources route through HITL approval. Break-glass for genuine emergencies.",
    policies: [
      {
        name: "production_writes_require_hitl",
        priority: 5,
        effect: "require-hitl",
        predicates: [
          { kind: "resource-tag-eq", tag: "env", value: "prod" },
          { kind: "agent-tier-eq", tier: 2 },
        ],
        breakGlassEligible: true,
        regulatoryCitation: "SOC 2 CC8.1 (change management)",
      },
    ],
    context: {
      userId: "user_devops",
      agentId: "db-migrator",
      agentTier: 2,
      reputationGrade: "A+",
      resourceTags: { env: "prod" },
    },
  },
  acat_required: {
    label: "Commerce actions require an ACAT (R91)",
    description:
      "Any cart present must come with a valid Sovereign ACAT for offline verification. No break-glass — court-defensible.",
    policies: [
      {
        name: "agentic_commerce_requires_acat",
        priority: 1,
        effect: "require-acat",
        predicates: [{ kind: "max-amount-cents", cents: 100000000 }],
        breakGlassEligible: false,
        regulatoryCitation: "Sovereign R91",
      },
    ],
    context: {
      userId: "user_buyer",
      agentId: "shopping-agent",
      agentTier: 3,
      reputationGrade: "A+",
      cart: {
        amountCents: 7342,
        currency: "USD",
        merchantId: "acme-shop",
        category: "marketplace_b2c",
      },
    },
  },
} as const;

type ScenarioKey = keyof typeof SCENARIOS;

interface SuccessDecision {
  decision: {
    verdict:
      | "allow"
      | "deny"
      | "require-hitl"
      | "require-acat"
      | "require-attestation";
    matchedPolicyName: string;
    reason: string;
    breakGlassEligible?: boolean;
    regulatoryCitation?: string;
  };
  verifierNote: string;
}
interface ErrResponse {
  error: string;
  details?: string;
}
type Result = SuccessDecision | ErrResponse;

export function LivePolicyEvaluator() {
  const [scenarioKey, setScenarioKey] =
    useState<ScenarioKey>("finance_read_only");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const scenario = SCENARIOS[scenarioKey];

  async function handleEvaluate() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/control-plane/policy/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policies: scenario.policies,
          context: scenario.context,
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
            Policy
          </label>
          <pre className="mt-2 max-h-72 overflow-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
            {JSON.stringify(scenario.policies, null, 2)}
          </pre>
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            Context (the runtime snapshot)
          </label>
          <pre className="mt-2 max-h-72 overflow-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
            {JSON.stringify(scenario.context, null, 2)}
          </pre>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-serif text-sm italic text-[#5A4F3F]">
          Same pure function as <code>@sovereign/inspector</code>. No
          policy is stored. Result is the verdict + reason.
        </p>
        <button
          type="button"
          onClick={handleEvaluate}
          disabled={busy}
          className="rounded bg-[#1A1712] px-6 py-3 font-mono text-xs uppercase tracking-[0.18em] text-[#F4EFE6] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#3A3128]"
        >
          {busy ? "Evaluating…" : "Evaluate policy →"}
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
  const d = result.decision;
  const isAllow = d.verdict === "allow";
  const accent = isAllow
    ? "border-emerald-700 bg-emerald-50"
    : d.verdict === "deny"
    ? "border-rose-700 bg-rose-50"
    : "border-amber-700 bg-amber-50";
  const iconText = isAllow
    ? "✓ Allow"
    : d.verdict === "deny"
    ? "✗ Deny"
    : `⊝ ${d.verdict}`;
  return (
    <div className={`border-l-4 ${accent} p-5`}>
      <p
        className={`font-mono text-xs uppercase tracking-[0.14em] ${
          isAllow
            ? "text-emerald-800"
            : d.verdict === "deny"
            ? "text-rose-800"
            : "text-amber-800"
        }`}
      >
        {iconText} · {d.matchedPolicyName}
      </p>
      <p className="mt-2 font-serif text-lg text-[#1A1712]">{d.reason}</p>
      {d.regulatoryCitation && (
        <p className="mt-1 font-serif text-base text-[#5A4F3F]">
          Regulatory citation:{" "}
          <strong>{d.regulatoryCitation}</strong>
        </p>
      )}
      {!isAllow && d.breakGlassEligible && (
        <p className="mt-2 font-serif text-sm italic text-[#3A3128]">
          Break-glass override available with admin reason ≥ 10 chars.
          Override appended to R26 audit chain.
        </p>
      )}
      <p className="mt-3 font-serif text-xs italic text-[#5A4F3F]">
        {result.verifierNote}
      </p>
    </div>
  );
}
