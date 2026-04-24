/**
 * POST /api/agents/battle
 *
 * Runs two marketplace agents against the same input in parallel and
 * returns both outputs side-by-side with confidence scores and
 * latency numbers. Gives buyers a live A/B test before they commit
 * to one agent for a workflow.
 *
 * Body: {
 *   "agents": ["invoice-ocr", "invoice-extractor"],  // 2..3 slugs/UUIDs
 *   "input":  "extract fields from https://..."
 * }
 *
 * Response: {
 *   "ok": true,
 *   "input": "...",
 *   "results": [
 *     {
 *       "agent": { id, slug, name, pricingCents },
 *       "output": "...",
 *       "confidence": 0.87,
 *       "latencyMs": 1245,
 *       "sla": { enforced, breached, ... },
 *       "error": null
 *     },
 *     ...
 *   ],
 *   "winner": {
 *     "slug": "invoice-ocr",
 *     "score": 0.87,
 *     "method": "confidence"   // | "latency_fallback"
 *   }
 * }
 *
 * Why no other marketplace does this:
 *   - It requires per-agent confidence scoring (Sovereign has this via
 *     the SLA-heuristic from src/lib/agent-sla.ts)
 *   - It requires parallel multi-agent execution (Sovereign has this
 *     via the invoke library)
 *   - It requires honest quality comparison (most marketplaces only
 *     show reviews, not head-to-head)
 *
 * This turns the marketplace from a catalog into an arena.
 *
 * Rate-limited aggressively (5/min/IP) because each battle fires
 * up to 3 LLM calls — we don't want this to be the cost vector.
 */

import { NextResponse } from "next/server";
import {
  checkIpRateLimit,
  extractClientIp,
} from "@/lib/api-guard";
import { scoreConfidence } from "@/lib/agent-sla";
import {
  invokeMarketplaceAgent,
  type InvokeResult,
} from "@/lib/marketplace-invoke";

const MAX_BATTLE_AGENTS = 3;
const INPUT_CHAR_CAP = 8000;

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

async function runOne(
  slug: string,
  input: string,
): Promise<BattleResult> {
  const t0 = Date.now();
  const r: InvokeResult = await invokeMarketplaceAgent({
    agentIdOrSlug: slug,
    input,
  });
  const latencyMs = Date.now() - t0;

  if (!r.ok) {
    return {
      agent: null,
      output: null,
      confidence: 0,
      latencyMs,
      sla: null,
      error: r.message,
      errorCode: r.code,
    };
  }

  // Use the SLA confidence if enforced; otherwise derive a score
  // from the output so we always have a comparable number.
  const confidence = r.sla.enforced
    ? r.sla.confidence
    : scoreConfidence({ output: r.result });

  return {
    agent: r.agent,
    output: r.result,
    confidence,
    latencyMs,
    sla: {
      enforced: r.sla.enforced,
      breached: r.sla.breached,
      confidence: r.sla.confidence,
    },
    error: null,
    errorCode: null,
  };
}

function pickWinner(results: BattleResult[]): {
  slug: string | null;
  score: number;
  method: "confidence" | "latency_fallback";
} | null {
  const successes = results.filter((r) => r.output && r.agent);
  if (successes.length === 0) return null;

  // Sort by confidence descending, with latency as tie-breaker.
  successes.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.latencyMs - b.latencyMs;
  });

  const top = successes[0];
  const secondConfidence = successes[1]?.confidence ?? 0;
  const method =
    Math.abs(top.confidence - secondConfidence) > 0.01
      ? "confidence"
      : "latency_fallback";

  return {
    slug: top.agent?.slug ?? null,
    score: top.confidence,
    method,
  };
}

export async function POST(request: Request): Promise<Response> {
  // Aggressive rate limit — each battle fires up to 3 LLM calls.
  const ip = extractClientIp(request.headers);
  const gate = checkIpRateLimit(ip, {
    bucket: "marketplace-battle",
    windowMs: 60_000,
    max: 5,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limited", code: "rate_limited" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(gate.resetIn / 1000)),
        },
      },
    );
  }

  let body: { agents?: unknown; input?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON", code: "bad_input" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!Array.isArray(body.agents) || body.agents.length < 2) {
    return NextResponse.json(
      { ok: false, error: "'agents' must be an array of at least 2 slugs", code: "bad_input" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const slugs = body.agents
    .slice(0, MAX_BATTLE_AGENTS)
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  if (slugs.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Need at least 2 valid agent slugs", code: "bad_input" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const input = typeof body.input === "string" ? body.input.slice(0, INPUT_CHAR_CAP) : "";
  if (!input.trim()) {
    return NextResponse.json(
      { ok: false, error: "'input' is required", code: "bad_input" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Run all agents in PARALLEL — that's the whole point of a battle,
  // buyers see near-equivalent latency for comparable comparison.
  const results = await Promise.all(slugs.map((s) => runOne(s, input)));
  const winner = pickWinner(results);

  return NextResponse.json(
    {
      ok: true,
      input,
      results,
      winner,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
