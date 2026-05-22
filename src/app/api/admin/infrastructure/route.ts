/**
 * GET /api/admin/infrastructure
 *
 * Admin-only — returns the configuration + reachability status of
 * every self-host integration point (OSS inference endpoint, NeMo
 * Retriever, GCP BigQuery export, etc.) so the operator can see at a
 * glance which infra is wired vs which is still hosted-managed.
 *
 * Auth: Clerk session + email allowlist via isAdmin(). Anyone else
 * gets 403.
 *
 * Caching: no cache. Probes return live latency numbers and that's
 * the whole point — a 60s cache would mask outages.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import {
  isOssInferenceConfigured,
  getOssEndpoint,
  probeOssEndpoint,
} from "@/lib/oss-inference";
import { isGcpExportConfigured } from "@/lib/bigquery-export";

const log = createLogger("admin-infrastructure");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const limiter = rateLimit({ interval: 60, limit: 30 });

async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    return ADMIN_EMAILS.has(email);
  } catch (err) {
    log.warn("admin check failed", { error: String(err) });
    return false;
  }
}

interface InfraEntry {
  /** Stable id, e.g. "oss-inference". */
  id: string;
  /** Friendly label. */
  label: string;
  /** What this service does for the platform. */
  description: string;
  /** "self-hosted" | "managed" | "not-configured". */
  mode: "self-hosted" | "managed" | "not-configured";
  /** Optional env vars the operator should set to flip mode. */
  envVars: string[];
  /** Endpoint hostname, when known. */
  endpoint?: string;
  /** Probe result, when available. */
  probe?: {
    ok: boolean;
    latencyMs: number;
    error?: string;
  };
  /** Estimated savings note for marketing/operator awareness. */
  savingsNote?: string;
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "admin-only" },
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const entries: InfraEntry[] = [];

  // ─── OSS Inference (vLLM / NIM Microservices / Triton) ──────────
  const ossEndpoint = getOssEndpoint();
  if (isOssInferenceConfigured()) {
    const probe = await probeOssEndpoint();
    entries.push({
      id: "oss-inference",
      label: "OSS Inference",
      description:
        "Self-hosted OpenAI-compatible endpoint for LLM calls. Routed by smartAi() before NIM-managed.",
      mode: "self-hosted",
      envVars: ["OSS_INFERENCE_ENDPOINT", "OSS_INFERENCE_API_KEY"],
      endpoint: ossEndpoint ?? undefined,
      probe: {
        ok: probe.ok,
        latencyMs: probe.latencyMs,
        error: probe.error,
      },
      savingsNote:
        "On a single A100/H100, marginal cost-per-call ≈ $0. Pays back vs hosted NIM at ~100K calls/day.",
    });
  } else {
    entries.push({
      id: "oss-inference",
      label: "OSS Inference",
      description: "Self-hosted vLLM / NIM / Triton — not yet configured.",
      mode: "not-configured",
      envVars: ["OSS_INFERENCE_ENDPOINT", "OSS_INFERENCE_API_KEY"],
      savingsNote: "Set the env var to route smartAi() to your own GPU.",
    });
  }

  // ─── NIM Managed (always on — fallback path) ─────────────────────
  const nimKey = !!(
    process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY
  );
  entries.push({
    id: "nim-managed",
    label: "NVIDIA NIM (managed)",
    description:
      "Hosted NIM models — 39+ Nemotron / GLM / DeepSeek / Llama variants. Default fallback when OSS isn't up.",
    mode: nimKey ? "managed" : "not-configured",
    envVars: ["NVIDIA_NIM_API_KEY"],
    endpoint: nimKey ? "integrate.api.nvidia.com" : undefined,
  });

  // ─── NeMo Retriever ─────────────────────────────────────────────
  const retrieverOss = !!process.env.OSS_RETRIEVER_ENDPOINT?.trim();
  entries.push({
    id: "nemo-retriever",
    label: "NeMo Retriever",
    description:
      "Embed + rerank stack with diversity-aware re-ranking. Falls back to NIM-managed retriever endpoints.",
    mode: retrieverOss ? "self-hosted" : nimKey ? "managed" : "not-configured",
    envVars: ["OSS_RETRIEVER_ENDPOINT"],
    endpoint: retrieverOss
      ? process.env.OSS_RETRIEVER_ENDPOINT
      : "integrate.api.nvidia.com",
  });

  // ─── BigQuery export ────────────────────────────────────────────
  const bqOk = isGcpExportConfigured();
  entries.push({
    id: "bigquery-export",
    label: "BigQuery export",
    description:
      "Delta export of agent_runs receipts to BigQuery for analytics at >5M-row scale. NDJSON-based, idempotent on row hash.",
    mode: bqOk ? "self-hosted" : "not-configured",
    envVars: [
      "GCP_BIGQUERY_DATASET",
      "GCP_BIGQUERY_TABLE",
      "GCP_GCS_BUCKET",
      "GCP_SERVICE_ACCOUNT_JSON",
    ],
    savingsNote:
      "Off-loads cohort + extended-metrics queries from Neon. Flat $5/TB scan cost; sub-second on 100M rows.",
  });

  // ─── Riva voice (self-host placeholder) ─────────────────────────
  const rivaOss = !!process.env.OSS_RIVA_ENDPOINT?.trim();
  entries.push({
    id: "riva-voice",
    label: "NVIDIA Riva (voice)",
    description:
      "Self-hosted ASR + TTS. Cuts voice-call round-trip from ~800ms to sub-200ms. Wires into voice-closer + voicechat agents when enabled.",
    mode: rivaOss
      ? "self-hosted"
      : process.env.TWILIO_ACCOUNT_SID
        ? "managed"
        : "not-configured",
    envVars: ["OSS_RIVA_ENDPOINT", "TWILIO_ACCOUNT_SID"],
  });

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      entries,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
