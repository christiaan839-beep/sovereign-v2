/**
 * SOVEREIGN MATRIX — Shadow-run drift detector (Cook 131).
 *
 * Every production agent run can be silently re-executed against
 * the PREVIOUS deployment version. The drift detector (Cook 35)
 * compares; any output regression flags BEFORE customers see it.
 *
 * Pure module: caller injects both runners + the comparator.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface ShadowRunRequest {
  agentSlug: string;
  input: unknown;
  /** Whether to actually run the shadow (callers can sample). */
  sampled: boolean;
}

export interface ShadowOutcome {
  ran: boolean;
  /** True iff shadow output matched live within tolerance. */
  matched?: boolean;
  /** Drift score 0..1 (1 = identical). */
  similarity?: number;
  /** Wall-clock delta — shadow can be slower without alarm. */
  liveMs?: number;
  shadowMs?: number;
  reason?: "sampled-out" | "shadow-error" | "live-error";
  message?: string;
}

export type AgentRunner = (
  agentSlug: string,
  input: unknown,
) => Promise<unknown>;

export type Comparator = (a: unknown, b: unknown) => { similarity: number };

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Run the live + shadow paths in parallel + compare. Always returns
 * the LIVE outcome to the caller; the shadow comparison is a side
 * channel for the platform's regression dashboard.
 */
export async function shadowRun(
  req: ShadowRunRequest,
  live: AgentRunner,
  shadow: AgentRunner | null,
  compare: Comparator,
): Promise<{ liveOutput: unknown; shadow: ShadowOutcome }> {
  if (!req.sampled || !shadow) {
    const liveOutput = await live(req.agentSlug, req.input);
    return {
      liveOutput,
      shadow: { ran: false, reason: "sampled-out" },
    };
  }
  const liveStart = Date.now();
  const shadowStart = Date.now();
  const [liveResult, shadowResult] = await Promise.allSettled([
    live(req.agentSlug, req.input),
    shadow(req.agentSlug, req.input),
  ]);
  const liveMs = Date.now() - liveStart;
  const shadowMs = Date.now() - shadowStart;

  if (liveResult.status === "rejected") {
    throw liveResult.reason;
  }
  if (shadowResult.status === "rejected") {
    return {
      liveOutput: liveResult.value,
      shadow: {
        ran: true,
        reason: "shadow-error",
        message:
          shadowResult.reason instanceof Error
            ? shadowResult.reason.message
            : String(shadowResult.reason),
        liveMs,
        shadowMs,
      },
    };
  }
  const cmp = compare(liveResult.value, shadowResult.value);
  return {
    liveOutput: liveResult.value,
    shadow: {
      ran: true,
      matched: cmp.similarity >= 0.95,
      similarity: cmp.similarity,
      liveMs,
      shadowMs,
    },
  };
}

/**
 * Decide whether to sample a given run for shadow comparison. Pure
 * function — same (tenant, agent, seed) → same verdict.
 */
export function shouldShadowSample(args: {
  tenantId: string;
  agentSlug: string;
  /** Percent in [0,100]. */
  rate: number;
  /** Caller-supplied seed (typically the request id). */
  seed: string;
}): boolean {
  if (args.rate <= 0) return false;
  if (args.rate >= 100) return true;
  // Stable hash → uniform [0,100).
  let hash = 0;
  const key = `${args.tenantId}|${args.agentSlug}|${args.seed}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const bucket = (hash % 10000) / 100;
  return bucket < args.rate;
}
