/**
 * Deployment profile — the single boolean that flips the platform
 * between public-cloud-shaped, BYO-GPU-shaped, and air-gapped.
 *
 * Background:
 *
 *   The "managed-service GaaS" pitch only buys us SMB and mid-market.
 *   Enterprise procurement asks "where does our prompt data live?"
 *   on every call. The answer can't be "Vercel + NVIDIA + Portkey
 *   + Anthropic + Google" — that's five vendors to red-line.
 *
 *   This module is the answer. Each tenant carries one of three
 *   profiles in `tenants.deployment_profile`:
 *
 *     cloud       Default. Inference may go to build.nvidia.com,
 *                 Anthropic, Google, OpenAI — whatever the cascade
 *                 in `src/lib/ai.ts` selects. Fastest to deploy.
 *
 *     byo-gpu     Inference is pinned to `NIM_LOCAL_BASE_URL`
 *                 (e.g. an internal vLLM/SGLang/NIM container on
 *                 the customer's own H100s). External paid
 *                 providers (Claude, Gemini, GPT) refuse to fire.
 *                 Free NIM API on build.nvidia.com is permitted —
 *                 but the customer can disable that too via env.
 *
 *     air-gapped  Hardest mode. Only Ollama on localhost. No
 *                 outbound network for inference. Any provider
 *                 that requires an internet round-trip is refused.
 *
 *   The profile is read on every AI call inside `src/lib/ai.ts`
 *   and the cascade trims providers that don't satisfy the
 *   profile. The check is fail-CLOSED: an unknown profile string
 *   maps to the strictest mode (air-gapped) so a typo can't
 *   silently leak data offsite.
 *
 * Usage:
 *
 *   const profile = await getDeploymentProfile(tenantId);
 *   if (!isProviderAllowed("anthropic", profile)) { ... }
 *
 * Failure modes:
 *
 *   - tenantId missing  → profile defaults to "cloud" (legacy paths
 *                         that don't carry tenant context — public
 *                         lead-form generation, marketing copy).
 *   - tenants table missing (42P01) → "cloud", logged once.
 *   - row not found     → "cloud" (new tenant, not yet inserted).
 */

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("deployment-profile");

export type DeploymentProfile = "cloud" | "byo-gpu" | "air-gapped";

export const DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = [
  "cloud",
  "byo-gpu",
  "air-gapped",
] as const;

/**
 * Provider buckets the cost-ledger and router agree on. Kept as a
 * literal union so `isProviderAllowed` can't be called with a
 * string outside this set without a type error.
 */
export type ProviderBucket =
  | "ollama"
  | "nvidia-nim"
  | "nvidia-nim-local"
  | "cerebras"
  | "anthropic"
  | "gemini"
  | "openai"
  | "groq"
  | "mistral"
  | "portkey";

/** Smallest tenant-cache TTL — keeps the read off the hot path. */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: DeploymentProfile; at: number }>();

function fromCache(id: string): DeploymentProfile | null {
  const hit = cache.get(id);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(id);
    return null;
  }
  return hit.value;
}

function toCache(id: string, value: DeploymentProfile): void {
  cache.set(id, { value, at: Date.now() });
}

function coerce(raw: string | null | undefined): DeploymentProfile {
  if (raw === "cloud" || raw === "byo-gpu" || raw === "air-gapped") {
    return raw;
  }
  // Fail-closed on unknown strings — a typo in a customer-side
  // migration script must NOT silently widen the platform.
  return "air-gapped";
}

/**
 * Read the deployment profile for a tenant. Caller must already
 * have authenticated the tenantId — this function does not
 * validate ownership.
 */
export async function getDeploymentProfile(
  tenantId: string | null | undefined,
): Promise<DeploymentProfile> {
  if (!tenantId) return "cloud";
  const cached = fromCache(tenantId);
  if (cached) return cached;

  try {
    const [row] = await db
      .select({ deploymentProfile: tenants.deploymentProfile })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const value = coerce(row?.deploymentProfile);
    toCache(tenantId, value);
    return value;
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01" || pgCode === "42703") {
      // Migration 0023 not yet applied. Cloud is the safe default
      // for existing tenants in this state.
      toCache(tenantId, "cloud");
      return "cloud";
    }
    log.warn("deployment-profile lookup failed; defaulting to cloud", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return "cloud";
  }
}

/**
 * Provider allow-list per profile.
 *
 *   cloud      → all providers permitted. The router still chooses
 *                cost-optimally (Ollama → Cerebras → NIM → Claude).
 *
 *   byo-gpu    → external paid providers blocked. NIM-on-prem +
 *                Ollama + free NIM API are fine. Portkey is
 *                allowed because it's a routing proxy that the
 *                customer can self-host.
 *
 *   air-gapped → Ollama and on-prem NIM only. Anything that needs
 *                outbound internet is rejected.
 */
const ALLOWED: Record<DeploymentProfile, ReadonlySet<ProviderBucket>> = {
  cloud: new Set<ProviderBucket>([
    "ollama",
    "nvidia-nim",
    "nvidia-nim-local",
    "cerebras",
    "anthropic",
    "gemini",
    "openai",
    "groq",
    "mistral",
    "portkey",
  ]),
  "byo-gpu": new Set<ProviderBucket>([
    "ollama",
    "nvidia-nim",
    "nvidia-nim-local",
    "portkey",
  ]),
  "air-gapped": new Set<ProviderBucket>(["ollama", "nvidia-nim-local"]),
};

export function isProviderAllowed(
  provider: ProviderBucket,
  profile: DeploymentProfile,
): boolean {
  return ALLOWED[profile].has(provider);
}

/**
 * Test-only — flush the in-process cache. Production callers should
 * never need this; the 60s TTL is sized so manual profile changes
 * propagate within a minute.
 */
export function _resetDeploymentProfileCache(): void {
  cache.clear();
}
