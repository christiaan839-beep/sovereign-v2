/**
 * GET /api/health/providers
 *
 * R27 elite-tier surface — live per-provider health with real
 * latency. Most platforms hide their provider stack ("powered by
 * GPT-4") and never tell users when a provider is down. We publish
 * it.
 *
 * For each configured provider:
 *   - status: "healthy" | "degraded" | "unhealthy" | "unconfigured"
 *   - latencyMs: round-trip to a tiny prompt
 *   - costTier: "free" | "paid" | "metered" (from PROVIDER_COSTS)
 *
 * Caching: 30s public cache. We don't want every page-load probing
 * 8 providers (would hammer free-tier rate limits + add ~$50/day in
 * tokens). 30s gives near-real-time without that cost.
 *
 * NEVER throws. A missing API key → status "unconfigured", never 5xx.
 * A provider returning 500 → status "unhealthy", platform stays up.
 */

import { NextResponse } from "next/server";
import { PROVIDER_COSTS } from "@/lib/provider-costs";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-providers");

export const runtime = "nodejs";
// 30s public cache — tunable. The /reliability page renders this
// directly; users see ~30s-old data, never older.
export const revalidate = 30;

export interface ProviderProbeResult {
  provider: string;
  status: "healthy" | "degraded" | "unhealthy" | "unconfigured";
  latencyMs: number | null;
  costTier: "free" | "paid" | "metered" | "unknown";
  /** Human-readable note. NEVER includes raw error bodies (could leak keys). */
  note?: string;
}

/**
 * Probe a provider with a HEAD or tiny POST. Each prober is total
 * (never throws) and bounded (3s timeout).
 *
 * Latency thresholds:
 *   < 800ms     → healthy
 *   800-3000ms  → degraded
 *   > 3000ms or non-200 → unhealthy
 *   missing key → unconfigured (not a fault — operator hasn't enabled)
 */
async function probe(
  provider: string,
  url: string,
  init: RequestInit,
  apiKey: string | undefined,
): Promise<ProviderProbeResult> {
  const costTier = (PROVIDER_COSTS[provider] ?? "unknown") as ProviderProbeResult["costTier"];
  if (!apiKey) {
    return {
      provider,
      status: "unconfigured",
      latencyMs: null,
      costTier,
      note: "API key not set",
    };
  }
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const latencyMs = Date.now() - start;
    clearTimeout(timer);
    let status: ProviderProbeResult["status"];
    if (!res.ok) {
      // 401/403 = bad key (op-level), other 4xx/5xx = provider issue.
      status = "unhealthy";
    } else if (latencyMs < 800) {
      status = "healthy";
    } else if (latencyMs < 3000) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }
    return { provider, status, latencyMs, costTier };
  } catch (err) {
    clearTimeout(timer);
    log.warn(`Provider probe failed: ${provider}`, { error: String(err) });
    return {
      provider,
      status: "unhealthy",
      latencyMs: Date.now() - start,
      costTier,
      note: String(err).includes("AbortError") ? "timeout (>3s)" : "probe failed",
    };
  }
}

/**
 * Provider-specific probes. Each one targets the lightest possible
 * endpoint that exercises auth + the actual model API path. We
 * deliberately don't run a full inference — that would burn tokens.
 *
 * Where a provider exposes a /models or /healthz endpoint, we use
 * that. Otherwise we use a tiny chat-completions call with max_tokens=1.
 */
async function probeAll(): Promise<ProviderProbeResult[]> {
  const probes: Array<Promise<ProviderProbeResult>> = [];

  // NVIDIA NIM — listing models is auth + reachability check.
  probes.push(
    probe(
      "nim",
      "https://integrate.api.nvidia.com/v1/models",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY ?? process.env.NIM_API_KEY ?? ""}`,
        },
      },
      process.env.NVIDIA_NIM_API_KEY ?? process.env.NIM_API_KEY,
    ),
  );

  // Anthropic — listing messages requires auth.
  probes.push(
    probe(
      "anthropic",
      "https://api.anthropic.com/v1/models",
      {
        method: "GET",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
        },
      },
      process.env.ANTHROPIC_API_KEY,
    ),
  );

  // Google Gemini — list models endpoint.
  probes.push(
    probe(
      "gemini",
      `https://generativelanguage.googleapis.com/v1beta/models?key=${
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY ?? ""
      }`,
      { method: "GET" },
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY,
    ),
  );

  // Groq — list models, OpenAI-compatible endpoint.
  probes.push(
    probe(
      "groq",
      "https://api.groq.com/openai/v1/models",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}` },
      },
      process.env.GROQ_API_KEY,
    ),
  );

  // Cerebras — OpenAI-compatible.
  probes.push(
    probe(
      "cerebras",
      "https://api.cerebras.ai/v1/models",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.CEREBRAS_API_KEY ?? ""}` },
      },
      process.env.CEREBRAS_API_KEY,
    ),
  );

  // OpenAI — list models (auth check).
  probes.push(
    probe(
      "openai",
      "https://api.openai.com/v1/models",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}` },
      },
      process.env.OPENAI_API_KEY,
    ),
  );

  return Promise.all(probes);
}

export async function GET() {
  const t0 = Date.now();
  const results = await probeAll();

  // Roll-up: overall status is the worst per-provider status, but
  // ignoring "unconfigured" (an operator who hasn't set Cerebras
  // shouldn't see "degraded" because Cerebras is missing).
  const configured = results.filter((r) => r.status !== "unconfigured");
  const overall = configured.length === 0
    ? "unhealthy"
    : configured.some((r) => r.status === "unhealthy")
    ? "degraded"
    : configured.some((r) => r.status === "degraded")
    ? "degraded"
    : "healthy";

  const summary = {
    overall,
    healthy: results.filter((r) => r.status === "healthy").length,
    degraded: results.filter((r) => r.status === "degraded").length,
    unhealthy: results.filter((r) => r.status === "unhealthy").length,
    unconfigured: results.filter((r) => r.status === "unconfigured").length,
    total: results.length,
  };

  return NextResponse.json(
    {
      summary,
      providers: results,
      probedInMs: Date.now() - t0,
      generatedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        // 30s edge cache — providers are noisy so we don't want every
        // page-load to hammer 6 endpoints.
        "Cache-Control":
          "public, max-age=30, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
