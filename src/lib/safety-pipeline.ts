/**
 * SAFETY PIPELINE — unified input + output NemoGuard with audit logging.
 *
 * Every user-facing agent call flows through:
 *   inputCheck(prompt, userId, agentId)   → pass | block
 *   (agent runs)
 *   outputCheck(output, userId, agentId)  → pass | block
 *
 * Each block is logged to safety_events (with SHA-256 prompt hash, not
 * the raw prompt — sovereignty mandate: we never hold content flagged
 * as unsafe).
 *
 * Skip behavior:
 *   - agent.skipSafetyChecks = true AND user is on Sovereign+ tier → skipped
 *   - Anything else → runs unconditionally
 *
 * This module wraps the existing jailbreak-detect + content-safety helpers
 * so the factory pipeline gets a single "safetyCheck()" entry point.
 */

import { createHash } from "node:crypto";
import { db } from "@/db";
import { safetyEvents } from "@/db/schema";
import { detectJailbreak } from "@/lib/jailbreak-detect";
import { checkContentSafety } from "@/lib/content-safety";
import { createLogger } from "@/lib/logger";

const log = createLogger("safety-pipeline");

/**
 * Plan tiers that are allowed to opt out of safety checks via the
 * `skipSafetyChecks` flag. Free/Starter/Growth users have safety
 * checks enforced regardless of agent config.
 */
const SOVEREIGN_TIERS = new Set(["node", "sovereign", "enterprise", "founder"]);

export function canSkipSafety(tier: string | undefined | null): boolean {
  if (!tier) return false;
  return SOVEREIGN_TIERS.has(tier.toLowerCase());
}

export interface SafetyCheckResult {
  passed: boolean;
  stage?: "jailbreak" | "content_in" | "content_out" | "pii" | "topic";
  reason?: string;
  category?: string;
}

export interface SafetyCheckOptions {
  agentId: string;
  userId?: string;
  userTier?: string | null;
  /** If true AND userTier is Sovereign+, skip the check entirely. */
  skipIfSovereign?: boolean;
}

/**
 * SHA-256 hash used as the safety_events.prompt_hash. We store hashes
 * rather than raw content so blocked PII/secrets never land in our
 * audit table. 64-char hex is comparable across platforms.
 */
export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

/**
 * Pre-flight INPUT safety check: jailbreak detection + content safety.
 * Returns passed=true only if BOTH pass. Logs any block to safety_events.
 */
export async function checkInputSafety(
  prompt: string,
  options: SafetyCheckOptions,
): Promise<SafetyCheckResult> {
  // Sovereign-tier override — only honored when both flag AND tier match
  if (options.skipIfSovereign && canSkipSafety(options.userTier)) {
    await recordSafetyEvent({
      userId: options.userId,
      agentId: options.agentId,
      stage: "content_in",
      reason: "Skipped — Sovereign tier with skipSafetyChecks flag",
      outcome: "skipped",
      promptHash: hashPrompt(prompt),
      promptLen: prompt.length,
    });
    return { passed: true };
  }

  // Too-short prompts aren't meaningful — skip (but log passed)
  if (prompt.length < 10) return { passed: true };

  // 1. Jailbreak detection (NemoGuard Jailbreak)
  try {
    const jb = await detectJailbreak(prompt);
    if (jb.blocked) {
      await recordSafetyEvent({
        userId: options.userId,
        agentId: options.agentId,
        stage: "jailbreak",
        reason: jb.reason ?? "Jailbreak attempt detected",
        category: jb.category,
        outcome: "blocked",
        promptHash: hashPrompt(prompt),
        promptLen: prompt.length,
      });
      return {
        passed: false,
        stage: "jailbreak",
        reason: "Request blocked by safety system. Your input was flagged as a potential prompt injection.",
        category: jb.category,
      };
    }
  } catch (err) {
    // Jailbreak detector unreachable → fail OPEN (pass). Safer to serve
    // than to block every request when NIM is down. Other layers still
    // run; this is defense-in-depth, not the only line.
    log.warn("Jailbreak detect unavailable — falling through", {
      error: (err as Error).message,
    });
  }

  // 2. Content safety (NemoGuard Content Safety 8B)
  if (prompt.length >= 20) {
    try {
      const cs = await checkContentSafety(prompt);
      if (!cs.safe) {
        await recordSafetyEvent({
          userId: options.userId,
          agentId: options.agentId,
          stage: "content_in",
          reason: cs.reason,
          category: cs.category,
          outcome: "blocked",
          promptHash: hashPrompt(prompt),
          promptLen: prompt.length,
        });
        return {
          passed: false,
          stage: "content_in",
          reason: `Content blocked by safety filter: ${cs.reason}`,
          category: cs.category,
        };
      }
    } catch (err) {
      log.warn("Content safety unavailable — falling through", {
        error: (err as Error).message,
      });
    }
  }

  return { passed: true };
}

/**
 * Post-flight OUTPUT safety check. Runs NemoGuard Content Safety on the
 * agent's response before it's delivered to the user. Critical for
 * catching cases where the agent produced unsafe content despite a
 * clean input (model drift, jailbreak via tool use, etc.).
 *
 * Unlike input, output blocks are RARE — we log but return passed=true
 * with a warning flag when uncertain, so the factory can decide whether
 * to redact or refuse. Only hard-category violations (PII leak, illegal
 * content) block delivery.
 */
export async function checkOutputSafety(
  output: string,
  options: SafetyCheckOptions,
): Promise<SafetyCheckResult> {
  if (options.skipIfSovereign && canSkipSafety(options.userTier)) {
    return { passed: true };
  }

  if (output.length < 50) return { passed: true }; // trivial outputs skip

  try {
    const cs = await checkContentSafety(output);
    if (!cs.safe) {
      await recordSafetyEvent({
        userId: options.userId,
        agentId: options.agentId,
        stage: "content_out",
        reason: cs.reason,
        category: cs.category,
        outcome: "blocked",
        promptHash: hashPrompt(output),
        promptLen: output.length,
      });
      return {
        passed: false,
        stage: "content_out",
        reason: `Response blocked by output safety filter: ${cs.reason}`,
        category: cs.category,
      };
    }
  } catch (err) {
    log.warn("Output content safety unavailable — falling through", {
      error: (err as Error).message,
    });
  }

  return { passed: true };
}

/**
 * Low-level event writer. Fire-and-forget from the caller — we never
 * want a failed audit write to fail the user's request. All fields are
 * sized for the schema (indexed text columns, jsonb metadata).
 */
async function recordSafetyEvent(event: {
  userId?: string;
  agentId: string;
  stage: "jailbreak" | "content_in" | "content_out" | "pii" | "topic" | "quality";
  reason: string;
  category?: string;
  outcome: "blocked" | "warned" | "skipped" | "passed";
  promptHash: string;
  promptLen: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(safetyEvents).values({
      userId: event.userId,
      agentId: event.agentId,
      stage: event.stage,
      reason: event.reason.slice(0, 500),
      category: event.category,
      promptHash: event.promptHash,
      promptLen: event.promptLen,
      outcome: event.outcome,
      metadata: event.metadata ?? {},
    });
  } catch (err) {
    // Table missing (pre-migration) or DB unreachable — log but don't
    // break the user's request. Sentry captures the error if wired.
    log.warn("Failed to write safety_events row", {
      error: (err as Error).message,
      stage: event.stage,
    });
  }
}
