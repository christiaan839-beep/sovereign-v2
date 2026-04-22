/**
 * SOVEREIGN MATRIX — Agent-to-Agent Spawn (A2E spawn helper)
 *
 * Purpose
 * -------
 * Lets one agent call another agent as a sub-task *inside* a parent
 * handler, with:
 *
 *   1. Recursion depth cap     — prevents infinite agent fan-out.
 *   2. Per-parent spend cap    — one parent run can only spawn a bounded
 *                                amount of child agents, guarded at the
 *                                process level via an in-memory map keyed
 *                                on the parent hold id.
 *   3. Ledger attribution      — every child run carries metadata pointing
 *                                back at the parent agent slug, parent hold
 *                                id, and A2E depth, so transaction history
 *                                can reconstruct the call tree.
 *   4. Hold → capture/release  — the parent user's credit balance is the
 *                                source of funds. Failures release, successes
 *                                capture (same pattern as main agent factory).
 *   5. Registry validation     — only slugs present in AGENT_REGISTRY can
 *                                be spawned, so a typo or injection cannot
 *                                invoke an arbitrary HTTP endpoint.
 *
 * Design Notes
 * ------------
 * - The child agent is called via an *internal HTTP POST* to
 *   /api/agents/<slug>. That's the simplest way to reuse the full factory
 *   pipeline (auth → safety → tier gates → quality) without reconstructing
 *   the agent-factory request context in-process.
 *
 * - Internal calls authenticate with `X-Sovereign-Internal-Secret`
 *   (== CRON_SECRET) and carry the acting `X-Sovereign-User-Id`. Child
 *   agents rely on this pair to decide they are running on behalf of a
 *   human caller rather than a public/anonymous one.
 *
 * - The per-parent A2E spend ledger is in-memory (see `A2E_PARENT_SPEND`).
 *   This is adequate for the MVP single-region deployment because a
 *   parent agent always executes in a single serverless invocation, so the
 *   ledger lives for the parent's lifetime and is garbage-collected when
 *   the process scales down. For the multi-region / background job case
 *   the per-parent cap should move to Redis — flagged as Phase 2.
 *
 * - Spawn failures are recoverable at the caller level. The parent agent
 *   can catch the exception and choose to continue without the child's
 *   output; this is intentional and documented at the function boundary.
 */

import {
  placeHold,
  captureHold,
  releaseHold,
  InsufficientCreditsError,
} from "@/lib/credits";
import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { getBaseUrl } from "@/lib/base-url";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-spawn");

// ── Configuration ─────────────────────────────────────────────────────────

/**
 * Hard cap on recursion depth for A2E spawn. A depth of 0 means the caller
 * is the human-initiated parent; 1 means a child; 2 is a grandchild; 3 is
 * the maximum allowed descendant before spawn() throws.
 */
export const MAX_A2E_DEPTH = 3;

/**
 * Per-parent A2E spend cap in cents. Reads A2E_MAX_SPEND_CENTS_PER_PARENT
 * once at module load; falls back to 150 cents ($1.50) if unset. This is
 * a *defense-in-depth* bound, layered on top of the per-run user-level
 * budget controls in src/lib/budget-controls.ts.
 */
function getParentSpendCapCents(): number {
  const raw = process.env.A2E_MAX_SPEND_CENTS_PER_PARENT;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 150;
}

/**
 * Estimated cost in cents for spawning a given child agent. This is the
 * "hold" that gets placed before the child is invoked. Real usage is
 * reconciled to the hold on capture; if the child crashes, the hold is
 * released.
 *
 * Kept intentionally conservative — 10c covers typical NIM-backed agents,
 * 50c covers paid-model agents like Claude Sonnet or GPT-4o. When the
 * full src/lib/pricing-costs.ts helper lands (see TODO in credits.ts),
 * this can be swapped for the shared estimator.
 */
export function estimatedHoldCents(slug: string): number {
  const PAID_AGENTS = new Set([
    "god-brain",
    "claude-think",
    "computer-use",
    "digital-human",
    "deep-think",
  ]);
  if (PAID_AGENTS.has(slug)) return 50;
  return 10;
}

// ── Per-Parent Spend Ledger (in-memory) ──────────────────────────────────

/**
 * Tracks how much has already been spent (in cents) against each parent
 * hold id. A Map<string, number>. This is cleared lazily — in practice a
 * single serverless invocation's memory gets reclaimed at shutdown, so a
 * long-lived cluster will accumulate stale entries bounded by traffic.
 *
 * Phase 2 TODO: migrate to Redis keyed by parentHoldId with TTL matching
 * the longest expected parent agent run (e.g., 15 minutes).
 */
const A2E_PARENT_SPEND = new Map<string, number>();

/**
 * For tests + long-running servers: returns current accumulated spend for
 * a parent hold id, or 0 if none. Intentionally exported so instrumentation
 * can read it.
 */
export function _getParentSpendCents(parentHoldId: string): number {
  return A2E_PARENT_SPEND.get(parentHoldId) ?? 0;
}

/**
 * Test-only escape hatch. Allows unit tests to reset the in-memory cap
 * between cases. Not exported as part of the public contract.
 */
export function _resetParentSpend(): void {
  A2E_PARENT_SPEND.clear();
}

// ── Types ────────────────────────────────────────────────────────────────

/**
 * Describes the parent of a spawn call. `depth` is the parent's *own*
 * depth — so a top-level human-initiated agent passes `depth: 0`, and
 * spawnAgent will invoke the child with `a2eDepth: 1` in its metadata.
 */
export interface SpawnParent {
  /** Clerk user id funding the call. */
  userId: string;
  /** Slug of the agent spawning the child (for attribution + audit). */
  parentAgentSlug: string;
  /**
   * Identifier of the parent's own credit hold. Serves as the ledger
   * key for the per-parent spend cap and propagates into child metadata.
   */
  parentHoldId: string;
  /**
   * Depth of the parent in the A2E call tree. Root calls are depth 0.
   * `spawnAgent` enforces that parent.depth < MAX_A2E_DEPTH.
   */
  depth: number;
}

export interface SpawnOptions {
  /** Registry slug of the child agent to invoke. */
  slug: string;
  /** Request body to POST to the child agent route. */
  inputs: Record<string, unknown>;
  /** Parent attribution + guard context. */
  parent: SpawnParent;
  /** AbortSignal forwarded to the internal fetch (optional). */
  signal?: AbortSignal;
}

/**
 * The body shape returned from the child agent. Matches whatever the
 * /api/agents/<slug> route returns — we intentionally do not tighten
 * this beyond a generic object so we don't couple the spawn helper to
 * any individual agent's output contract.
 */
export type SpawnResult = Record<string, unknown>;

// ── Errors ───────────────────────────────────────────────────────────────

export class SpawnError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "SpawnError";
    this.code = code;
  }
}

// ── Main Entry Point ─────────────────────────────────────────────────────

/**
 * Spawn a child agent on behalf of a parent agent run.
 *
 * Throws `SpawnError` (or propagates the child's thrown error) on any
 * failure. On success returns the JSON body the child produced.
 *
 * Guarantees:
 *  - Rejects unknown slugs before any billing happens.
 *  - Rejects when parent.depth >= MAX_A2E_DEPTH.
 *  - Rejects when adding the next hold would exceed the per-parent cap.
 *  - Captures credit hold on success (child HTTP 2xx).
 *  - Releases credit hold on failure (child HTTP non-2xx or network error).
 */
export async function spawnAgent(opts: SpawnOptions): Promise<SpawnResult> {
  const { slug, inputs, parent } = opts;

  // 1. Registry validation — MUST happen before we touch credits.
  if (!Object.prototype.hasOwnProperty.call(AGENT_REGISTRY, slug)) {
    throw new SpawnError(
      `Unknown agent slug: "${slug}"`,
      "UNKNOWN_AGENT",
    );
  }

  // 2. Recursion depth cap.
  if (parent.depth >= MAX_A2E_DEPTH) {
    throw new SpawnError(
      `A2E recursion limit reached (depth=${parent.depth}, max=${MAX_A2E_DEPTH})`,
      "A2E_DEPTH_EXCEEDED",
    );
  }

  // 3. Per-parent spend cap — block BEFORE the hold is placed.
  const holdCents = estimatedHoldCents(slug);
  const cap = getParentSpendCapCents();
  const alreadySpent = A2E_PARENT_SPEND.get(parent.parentHoldId) ?? 0;
  if (alreadySpent + holdCents > cap) {
    throw new SpawnError(
      `A2E per-parent spend cap reached (${alreadySpent}+${holdCents} > ${cap})`,
      "A2E_CAP_EXCEEDED",
    );
  }

  const childDepth = parent.depth + 1;

  // 4. Place the credit hold using the canonical credits.ts primitive.
  //    Uses extraMetadata to propagate the A2E attribution keys
  //    (agentSlug, parentHoldId, parentAgentSlug, a2eDepth). The
  //    credits.ts safelist carries these onto the hold_capture row
  //    automatically, so the billing/analytics surface can reconstruct
  //    the spawn tree without a separate schema change.
  //
  //    TTL: same 5 min default as the agent-factory's own holds. Capture
  //    or release happens on the same call so TTL is a safety net,
  //    not a runtime dependency.
  let childHoldId: string;
  try {
    childHoldId = await placeHold(parent.userId, holdCents, {
      ttlMs: 5 * 60_000,
      extraMetadata: {
        agentSlug: slug,
        parentHoldId: parent.parentHoldId,
        parentAgentSlug: parent.parentAgentSlug,
        a2eDepth: childDepth,
      },
    });
  } catch (err) {
    // InsufficientCreditsError is a specific subclass — preserve its
    // required/available fields via SpawnError.cause so route handlers
    // can surface a 402 upstream.
    if (err instanceof InsufficientCreditsError) {
      const spawnErr = new SpawnError(
        `Insufficient credits: need ${err.required}c, have ${err.available}c`,
        "INSUFFICIENT_CREDITS",
      );
      (spawnErr as SpawnError & { cause?: unknown }).cause = err;
      throw spawnErr;
    }
    throw new SpawnError(
      `Failed to place A2E hold: ${err instanceof Error ? err.message : String(err)}`,
      "HOLD_FAILED",
    );
  }

  // Reserve the ledger slot *after* the hold is actually placed.
  A2E_PARENT_SPEND.set(parent.parentHoldId, alreadySpent + holdCents);

  // 5. Fire the child agent via internal HTTP POST.
  let childBody: SpawnResult;
  try {
    const secret = process.env.CRON_SECRET || "";
    if (!secret) {
      // Fail-closed — if the internal secret is unset we cannot prove
      // this call is server-originated, so we refuse to call the child
      // agent at all. Same policy as the cron auth helper.
      throw new SpawnError(
        "CRON_SECRET not configured — refusing internal spawn",
        "INTERNAL_AUTH_UNCONFIGURED",
      );
    }

    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/agents/${slug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sovereign-Internal-Secret": secret,
        "X-Sovereign-User-Id": parent.userId,
        "X-A2E-Parent-Slug": parent.parentAgentSlug,
        "X-A2E-Parent-Hold-Id": parent.parentHoldId,
        "X-A2E-Depth": String(childDepth),
      },
      body: JSON.stringify({
        ...inputs,
        _a2eParentSlug: parent.parentAgentSlug,
        _a2eDepth: childDepth,
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      throw new SpawnError(
        `Child agent "${slug}" responded ${res.status}`,
        "CHILD_HTTP_ERROR",
      );
    }

    childBody = (await res.json()) as SpawnResult;
  } catch (err) {
    // Release the hold on any failure (network error, non-2xx, or
    // SpawnError we just threw above). releaseHold refunds the user's
    // balance + marks the hold row status=released — the sweep-expired
    // cron won't double-refund it later.
    try {
      await releaseHold(childHoldId);
    } catch (refundErr) {
      log.warn("A2E releaseHold failed after spawn error", {
        slug,
        parentHoldId: parent.parentHoldId,
        childHoldId,
        error: String(refundErr),
      });
    }
    // Give the per-parent ledger back so a recoverable failure doesn't
    // permanently eat the budget for this parent.
    A2E_PARENT_SPEND.set(
      parent.parentHoldId,
      Math.max(0, (A2E_PARENT_SPEND.get(parent.parentHoldId) ?? 0) - holdCents),
    );
    throw err;
  }

  // 6. Capture the hold on success. captureHold reads the hold-placed
  //    transaction's metadata and carries the A2E safelist keys
  //    (agentSlug, parentHoldId, parentAgentSlug, a2eDepth) onto the
  //    hold_capture row automatically.
  try {
    await captureHold(childHoldId);
  } catch (captureErr) {
    // Capture failure on a successful child call means ledger drift.
    // Log loudly — the sweep-expired-holds cron will NOT reconcile
    // this for us because the hold still looks "active." Surface to
    // ops so they can manually capture.
    log.error("A2E captureHold failed — ledger drift", {
      slug,
      parentHoldId: parent.parentHoldId,
      childHoldId,
      error: String(captureErr),
    });
  }

  log.info("A2E spawn captured", {
    slug,
    parentAgentSlug: parent.parentAgentSlug,
    parentHoldId: parent.parentHoldId,
    childHoldId,
    holdCents,
    a2eDepth: childDepth,
  });

  return childBody;
}
