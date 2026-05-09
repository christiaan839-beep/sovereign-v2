/**
 * SOVEREIGN MATRIX — Agent Route Factory (v2)
 *
 * Eliminates boilerplate across 100+ agent routes.
 * Every agent shares: auth → rate limit → jailbreak check → validate → execute → PII scan → quality score → respond.
 *
 * Safety pipeline (automatic for all agents):
 *   1. Jailbreak Detection — blocks prompt injection before execution
 *   2. Content Safety    — pre-flight check on user input
 *   3. PII Detection     — post-flight scan on AI output
 *   4. Quality Scoring   — grades output quality, rejects low-quality
 *
 * Usage:
 *   import { createAgentRoute } from "@/lib/agent-factory";
 *
 *   export const POST = createAgentRoute({
 *     name: "seo-dominator",
 *     requiredFields: ["url"],
 *     handler: async ({ input, email }) => {
 *       return { result: "..." };
 *     },
 *   });
 */

import { NextResponse } from "next/server";
import { guardRoute, sanitizeString, errorResponse } from "@/lib/api-guard";
import { detectJailbreak } from "@/lib/jailbreak-detect";
import { checkContentSafety } from "@/lib/content-safety";
import { incrementUsage, getSmartUpgradeInfo } from "@/lib/free-tier";
import { checkPlanLimits } from "@/lib/plan-enforcement";
import { scoreOutput, type QualityScore } from "@/lib/quality-scorer";
import { createLogger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";
import { getAntiSlopRules } from "@/lib/system-prompts";
import { trackAgentExecution } from "@/lib/analytics";
import { getMemoryContext, saveMemory } from "@/lib/tenant-memory";
import {
  getActionTier,
  buildConfirmResponse,
  buildRestrictedResponse,
  type ActionTier,
} from "@/lib/action-tiers";
import { resolveTenantId } from "@/lib/tenant-resolver";
import {
  isAgentAvailable,
  recordAgentSuccess,
  recordAgentFailure,
} from "@/lib/agent-circuit-breaker";
import { persistAgentActivity } from "@/lib/activity-persist";
import { notifyAgentComplete } from "@/lib/notify";
import { evaluatePolicy } from "@/lib/policy-engine";
import { checkBudget, recordSpend } from "@/lib/budget-controls";
import { startReplay, type ReplayBuilder } from "@/lib/agent-replay";
import { checkAgentAccess } from "@/lib/paywall";
import type { ZodObject, ZodRawShape } from "zod";

const log = createLogger("agent-factory");

/** Maximum number of quality-score retries before accepting the output as-is.
 *  Prevents theoretical infinite regeneration loops (flagged by Gemma 4 audit). */
const MAX_QUALITY_RETRIES = 1;

/** Maximum tokens a single request can consume across all AI calls.
 *  Prevents "Denial of Wallet" attacks where a malicious playbook
 *  chains consensus + regeneration to drain unlimited tokens.
 *  10,000 tokens ≈ ~7,500 words — enough for any single agent task. */
/** @see Phase 2 implementation — will be enforced in the AI router */
export const MAX_TOKENS_PER_REQUEST = 10000;

/** Anti-slop rules injected into agent context */
export const ANTI_SLOP_RULES = getAntiSlopRules();

export interface AgentConfig {
  /** Agent name for logging and telemetry */
  name: string;

  /** Fields required in the request body (legacy — prefer `schema` for type-safe validation) */
  requiredFields?: string[];

  /** Zod schema for input validation. When provided, input is validated before the handler runs.
   *  Falls back to `requiredFields` check if not provided. */
  schema?: ZodObject<ZodRawShape>;

  /** Skip authentication (for public demo endpoints) */
  public?: boolean;

  /** Maximum request body size in characters (default: 50000) */
  maxInputSize?: number;

  /** Skip jailbreak detection (for safety agents themselves) */
  skipJailbreakCheck?: boolean;

  /** Skip content safety pre-flight (for safety agents themselves) */
  skipSafetyCheck?: boolean;

  /** Skip PII scanning on output (for PII agents themselves) */
  skipPiiScan?: boolean;

  /** Skip quality scoring on output (for scoring/safety agents themselves) */
  skipQualityCheck?: boolean;

  /** Action tier override (1=autonomous, 2=confirm, 3=restricted). Auto-detected if omitted. */
  actionTier?: ActionTier;

  /** Enable/disable Critic Agent QA gate (default: true for all agents) */
  useCritic?: boolean;

  /** Quality score threshold — output below this triggers regeneration (default: 0.6) */
  qualityThreshold?: number;

  /** Allowed topics — agent will refuse off-topic requests (NeMo Guardrails pattern) */
  allowedTopics?: string[];

  /** The agent's core logic */
  /**
   * Handler may return a plain object (the factory will JSON-wrap it
   * with the standard response envelope) OR an already-built
   * NextResponse / Response (returned as-is). Widened to accept
   * Response so legacy handlers that call NextResponse.json() inline
   * still type-check.
   */
  handler: (ctx: AgentContext) => Promise<Record<string, unknown> | Response>;
}

export interface AgentContext {
  /** Parsed and sanitized request body */
  input: Record<string, unknown>;
  /** Raw request object */
  request: Request;
  /** Authenticated user email (empty string if public route) */
  email: string;
  /** Authenticated user ID (empty string if public route) */
  userId: string;
  /** Tenant ID for multi-tenant isolation (resolved from userId → tenants table) */
  tenantId?: string;
  /** Organization ID if the user scoped the request to an org */
  orgId?: string;
}

export function createAgentRoute(config: AgentConfig) {
  return async function POST(req: Request) {
    const startTime = Date.now();
    let email = "";
    let userId = "";
    let replay: ReplayBuilder | null = null;

    try {
      // ─── Auth & Rate Limiting ───

      if (!config.public) {
        const guard = await guardRoute();
        if (!guard.authorized) return guard.response;
        email = guard.email;
        userId = guard.userId;
      }

      // ─── Plan Limit Enforcement ───
      // checkPlanLimits counts BOTH agent runs and playbook runs against the
      // user's plan quota (single rolled-up counter). Without this, a user
      // can effectively double their quota by alternating endpoints.
      if (userId) {
        const planCheck = await checkPlanLimits(userId);
        if (!planCheck.allowed) {
          const upgradeInfo = await getSmartUpgradeInfo(userId);
          return new NextResponse(
            JSON.stringify({
              error: "Usage limit reached",
              message:
                planCheck.message ??
                `You've used all ${planCheck.limit} runs this month on the ${planCheck.planName} plan.`,
              upgrade: {
                currentPlan: planCheck.plan,
                currentLimit: planCheck.limit,
                used: planCheck.used,
                nextPlan: upgradeInfo.nextPlan,
                nextLimit: upgradeInfo.nextLimit,
                nextPrice: upgradeInfo.nextPrice,
                upgradeUrl: planCheck.upgradeUrl ?? upgradeInfo.upgradeUrl,
                resetDate: upgradeInfo.resetDate,
              },
              code: "USAGE_LIMIT_REACHED",
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-Plan": planCheck.plan,
                "X-Plan-Remaining": "0",
              },
            },
          );
        }
      }

      // ─── Parse & Validate Body ───
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return errorResponse("Invalid JSON body", 400, "INVALID_BODY");
      }

      // Validate input with Zod schema (preferred) or required fields (legacy fallback)
      if (config.schema) {
        const validation = config.schema.safeParse(body);
        if (!validation.success) {
          const issues = validation.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
          return errorResponse(
            `Validation failed: ${issues}`,
            400,
            "VALIDATION_ERROR",
          );
        }
      } else if (config.requiredFields) {
        for (const field of config.requiredFields) {
          if (
            body[field] === undefined ||
            body[field] === null ||
            body[field] === ""
          ) {
            return errorResponse(
              `Missing required field: ${field}`,
              400,
              "MISSING_FIELD",
            );
          }
        }
      }

      // ─── Action Tier Gate ───
      const tierInfo = getActionTier(config.name);
      const effectiveTier = config.actionTier ?? tierInfo.tier;

      if (effectiveTier >= 2 && !body.confirmed) {
        if (effectiveTier === 3) {
          log.info("Tier 3 agent blocked — admin approval required", {
            agent: config.name,
          });
          return NextResponse.json(buildRestrictedResponse(config.name), {
            status: 403,
          });
        }
        // Tier 2: return a preview asking for confirmation
        log.info("Tier 2 agent — confirmation required", {
          agent: config.name,
        });
        return NextResponse.json(
          buildConfirmResponse(config.name, {
            agent: config.name,
            input: Object.fromEntries(
              Object.entries(body).filter(([k]) => k !== "confirmed"),
            ),
          }),
          { status: 200 },
        );
      }

      // Sanitize string fields
      const sanitized: Record<string, unknown> = {};
      const maxSize = config.maxInputSize ?? 50000;
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string") {
          sanitized[key] = sanitizeString(value, maxSize);
        } else {
          sanitized[key] = value;
        }
      }

      // ─── Safety Pre-flight: Jailbreak Detection ───
      if (!config.skipJailbreakCheck) {
        const primaryInput = getFirstStringValue(sanitized);
        if (primaryInput && primaryInput.length > 10) {
          const jailbreakResult = await detectJailbreak(primaryInput);
          if (jailbreakResult.blocked) {
            log.warn("Jailbreak blocked", {
              agent: config.name,
              category: jailbreakResult.category,
            });
            return errorResponse(
              "Request blocked by safety system. Your input was flagged as a potential prompt injection.",
              403,
              "JAILBREAK_BLOCKED",
            );
          }
        }
      }

      // ─── Safety Pre-flight: Topic Control (NeMo Guardrails pattern) ───
      if (config.allowedTopics && config.allowedTopics.length > 0) {
        const primaryInput = getFirstStringValue(sanitized);
        if (primaryInput) {
          const inputLower = primaryInput.toLowerCase();
          const onTopic = config.allowedTopics.some((topic) =>
            inputLower.includes(topic.toLowerCase()),
          );
          // Only block if input is long enough to be a real request (not just a URL or short param)
          if (!onTopic && primaryInput.length > 50) {
            log.info("Off-topic request filtered", {
              agent: config.name,
              topics: config.allowedTopics,
            });
            return errorResponse(
              `This agent handles: ${config.allowedTopics.join(", ")}. Your request seems off-topic. Try the Sovereign Assistant for general queries.`,
              400,
              "OFF_TOPIC",
            );
          }
        }
      }

      // ─── Safety Pre-flight: Content Safety ───
      if (!config.skipSafetyCheck) {
        const primaryInput = getFirstStringValue(sanitized);
        if (primaryInput && primaryInput.length > 20) {
          const safetyResult = await checkContentSafety(primaryInput);
          if (!safetyResult.safe) {
            log.warn("Content safety blocked", {
              agent: config.name,
              category: safetyResult.category,
            });
            return errorResponse(
              `Content blocked by safety filter: ${safetyResult.reason}`,
              403,
              "CONTENT_UNSAFE",
            );
          }
        }
      }

      // ─── Inject Tenant Memory Context ───
      if (userId) {
        const memoryCtx = getMemoryContext(userId, config.name);
        if (memoryCtx) {
          sanitized._memoryContext = memoryCtx;
        }
      }

      // ─── Resolve Tenant ID for Multi-Tenant Isolation ───
      let tenantId: string | undefined;
      if (userId) {
        tenantId = await resolveTenantId(userId);
      }

      // Extract orgId from request body if provided (for org-scoped operations)
      const orgId =
        typeof sanitized.orgId === "string" ? sanitized.orgId : undefined;

      // ─── Circuit Breaker Check ───
      if (!isAgentAvailable(config.name)) {
        log.warn(`Agent circuit open: ${config.name} — temporarily disabled`);
        return NextResponse.json(
          {
            error: `Agent "${config.name}" is temporarily unavailable due to repeated failures. Please try again shortly.`,
          },
          { status: 503 },
        );
      }

      // ─── Pre-execution governance (each layer is independently fault-tolerant) ───

      // Paywall: blocks if plan doesn't include this agent
      if (userId && !config.public) {
        try {
          const { getUserTier } = await import("@/lib/free-tier");
          const userTier = await getUserTier(userId);
          const access = checkAgentAccess(config.name, userTier);
          if (!access.allowed) {
            return NextResponse.json(
              {
                error: access.reason,
                requiredPlan: access.requiredPlan,
                upgradeUrl: access.upgradeUrl,
              },
              { status: 403 },
            );
          }
        } catch (paywallErr) {
          log.warn("Paywall check failed — allowing execution", {
            agent: config.name,
            error: String(paywallErr),
          });
          // Fail-open: if paywall check crashes, allow execution (better than blocking everyone)
        }
      }

      // Replay: records execution steps (non-blocking — never prevents execution)
      try {
        if (userId) {
          replay = startReplay(config.name, userId);
          replay.addStep("input_received", {
            fields: Object.keys(body),
            inputSize: JSON.stringify(body).length,
          });
        }
      } catch {
        /* replay failure must never block agent execution */
      }

      // Policy: blocks if rules deny this action
      if (userId) {
        try {
          const policyResult = evaluatePolicy(config.name, "agent.execute", {
            userId,
            role: "member",
          });
          if (!policyResult.allowed) {
            log.warn("Policy denied agent execution", {
              agent: config.name,
              policy: policyResult.policyId,
              reason: policyResult.reason,
            });
            return NextResponse.json(
              { error: policyResult.reason || "Action denied by policy" },
              { status: 403 },
            );
          }
        } catch (policyErr) {
          log.warn("Policy check failed — allowing execution", {
            agent: config.name,
            error: String(policyErr),
          });
        }
      }

      // Budget: blocks if today's AI spend has hit the user's plan cap.
      // Reads from the Postgres `usage` table — survives cold starts.
      if (userId) {
        try {
          const { getUserTier } = await import("@/lib/free-tier");
          const tier = await getUserTier(userId);
          const budgetResult = await checkBudget(userId, tier);
          if (!budgetResult.allowed) {
            return NextResponse.json(
              {
                error: budgetResult.reason || "Daily budget exceeded",
                spendCents: budgetResult.dailyCents,
                limitCents: budgetResult.dailyLimitCents,
                dailyPercent: budgetResult.dailyPercent,
                plan: budgetResult.plan,
                resetsAt: "00:00 UTC",
              },
              { status: 429 },
            );
          }
        } catch (budgetErr) {
          log.warn("Budget check failed — allowing execution", {
            agent: config.name,
            error: String(budgetErr),
          });
        }
      }

      // ─── Execute Agent Handler ───
      replay?.addStep("handler_start", { agent: config.name });
      const handlerReturn = await config.handler({
        input: sanitized,
        request: req,
        email,
        userId,
        tenantId,
        orgId,
      });
      // Legacy handlers may return an already-built NextResponse / Response
      // (e.g. when they want to set a non-200 status). Pass it through
      // unchanged — skipping the safety post-flight + envelope wrap is the
      // intended escape hatch.
      if (handlerReturn instanceof Response) {
        return handlerReturn;
      }
      const result: Record<string, unknown> = handlerReturn;
      replay?.addStep("handler_complete", {
        outputKeys: Object.keys(result),
        outputSize: JSON.stringify(result).length,
      });

      // ─── Safety Post-flight: PII Scan on Output ───
      let piiWarning: string | undefined;
      if (!config.skipPiiScan) {
        const outputText = getFirstStringValue(result);
        if (outputText && outputText.length > 50) {
          const piiEntities = scanForPiiPatterns(outputText);
          if (piiEntities.length > 0) {
            piiWarning = `Output contains ${piiEntities.length} potential PII item(s): ${piiEntities.map((e) => e.type).join(", ")}`;
            log.warn("PII detected in output", {
              agent: config.name,
              count: piiEntities.length,
            });
          }
        }
      }

      // ─── Quality Scoring & Auto-Regeneration ───
      let qualityScore: QualityScore | undefined;
      let finalResult = result;

      if (!config.skipQualityCheck) {
        const outputText = getFirstStringValue(result);
        const promptText = getFirstStringValue(sanitized);

        if (outputText && promptText && outputText.length >= 20) {
          const threshold = config.qualityThreshold ?? 0.6;

          try {
            qualityScore = await scoreOutput(promptText, outputText, threshold);

            if (!qualityScore.passed) {
              // ─── Loop Guard: skip regeneration if we already retried ───
              const alreadyRetried = sanitized._qualityRetry === true;
              if (alreadyRetried) {
                log.info(
                  "Quality below threshold but MAX_QUALITY_RETRIES reached — accepting output",
                  {
                    agent: config.name,
                    score: qualityScore.overall,
                    maxRetries: MAX_QUALITY_RETRIES,
                  },
                );
              } else {
                log.info("Quality below threshold — regenerating", {
                  agent: config.name,
                  score: qualityScore.overall,
                  threshold,
                });

                // Re-run handler with a refinement hint injected into the input
                const refinedInput: Record<string, unknown> = {
                  ...sanitized,
                  _qualityRetry: true,
                  _refinementHint:
                    `Previous response scored ${qualityScore.overall}/1.0. ` +
                    `Improve: helpfulness=${qualityScore.helpfulness}, coherence=${qualityScore.coherence}, ` +
                    `correctness=${qualityScore.correctness}, verbosity=${qualityScore.verbosity}. ` +
                    `Be more precise, accurate, and concise.`,
                };

                const retryReturn = await config.handler({
                  input: refinedInput,
                  request: req,
                  email,
                  userId,
                  tenantId,
                  orgId,
                });
                // If the handler escaped to a Response on retry, surface
                // it directly — the original result is discarded.
                if (retryReturn instanceof Response) {
                  return retryReturn;
                }
                const retryResult: Record<string, unknown> = retryReturn;

                // Score the retry attempt
                const retryText = getFirstStringValue(retryResult);
                if (retryText && retryText.length >= 20) {
                  const retryScore = await scoreOutput(
                    promptText,
                    retryText,
                    threshold,
                  );
                  // Use whichever attempt scored higher
                  if (retryScore.overall >= qualityScore.overall) {
                    finalResult = retryResult;
                    qualityScore = retryScore;
                    log.info("Retry improved quality", {
                      agent: config.name,
                      newScore: retryScore.overall,
                    });
                  } else {
                    log.info("Retry did not improve — keeping original", {
                      agent: config.name,
                      originalScore: qualityScore.overall,
                      retryScore: retryScore.overall,
                    });
                  }
                } else {
                  finalResult = retryResult;
                }
              } // end else (retry allowed)
            }
          } catch (scoringError) {
            // Fail-safe: if scorer breaks, return the original response untouched
            log.warn("Quality scoring failed — returning original response", {
              agent: config.name,
              error: String(scoringError),
            });
          }
        }
      }

      // ─── Critic Agent — QA gate for high-value outputs ───
      if (
        config.useCritic !== false &&
        finalResult.output &&
        typeof finalResult.output === "string" &&
        finalResult.output.length > 100
      ) {
        try {
          const { criticReview } = await import("@/lib/critic");
          const review = await criticReview(
            typeof body.prompt === "string" ? body.prompt : config.name,
            finalResult.output as string,
            config.name,
            { threshold: 0.7, autoCorrect: true },
          );
          if (review.correctedOutput && !review.approved) {
            finalResult.output = review.correctedOutput;
            (finalResult as Record<string, unknown>)._criticFeedback =
              review.feedback;
            (finalResult as Record<string, unknown>)._criticScore =
              review.score;
          }
        } catch (criticErr) {
          log.warn("Critic review skipped", {
            agent: config.name,
            error: String(criticErr),
          });
        }
      }

      // ─── Save to Tenant Memory ───
      if (userId) {
        const inputText = getFirstStringValue(sanitized);
        const outputText = getFirstStringValue(finalResult);
        if (inputText && outputText) {
          try {
            saveMemory(userId, config.name, inputText, outputText);
          } catch (memErr) {
            log.warn("Tenant memory save failed", {
              agent: config.name,
              error: String(memErr),
            });
          }
        }
      }

      // ─── Track Usage, Audit Log & Return Response ───
      if (userId) {
        await incrementUsage(userId, config.name);
        // Track spend for budget controls. Most agents route to free
        // models (NIM / Cerebras / Ollama) so this is a no-op cost-wise,
        // but we still record the row so the analytics dashboards can
        // count calls. Real per-model costs flow in via cost-ledger
        // from src/lib/ai.ts when paid providers fire.
        recordSpend(userId, "nim-default", 500, 0, config.name).catch(() => {});
        // Audit every agent execution (SOC 2 compliance)
        auditLog({
          userId,
          action: "agent.execute",
          resource: config.name,
          details: { durationMs: Date.now() - startTime, success: true },
        }).catch(() => {}); // Non-blocking
      }
      const durationMs = Date.now() - startTime;
      trackAgentExecution(config.name, durationMs, true);
      recordAgentSuccess(config.name);

      // ─── Evolution: Record quality for prompt self-improvement ───
      if (qualityScore) {
        try {
          const { recordStrategyOutcome } =
            await import("@/lib/evolution-engine");
          recordStrategyOutcome({
            goalType: config.name,
            // @ts-expect-error — `strategy` is a recorded extension field; current type omits it
            strategy: config.name,
            success: qualityScore.passed ?? true,
            score: Math.round(qualityScore.overall * 100),
            context: { durationMs, agent: config.name },
          });
        } catch {} // Evolution must never block responses
      }

      // ─── Persist to agentActivity table (fire-and-forget) ───
      if (userId) {
        const outputSummary =
          getFirstStringValue(finalResult)?.slice(0, 200) || "";
        persistAgentActivity({
          userId,
          agentName: config.name,
          agentType: config.name,
          action: "completed",
          summary: outputSummary,
          metadata: JSON.stringify({
            durationMs,
            qualityScore: qualityScore?.overall,
            qualityPassed: qualityScore?.passed,
            piiWarning: !!piiWarning,
          }),
        }).catch(() => {}); // Non-blocking

        // ─── Notify user (Slack + email if configured) ───
        notifyAgentComplete(
          userId,
          config.name,
          outputSummary,
          email || undefined,
        ).catch(() => {});

        // ─── Auto-learn: Extract relationships for knowledge graph (fire-and-forget) ───
        autoLearnGraph(
          userId,
          config.name,
          getFirstStringValue(sanitized)?.slice(0, 500) || "",
          outputSummary,
          durationMs,
        ).catch(() => {}); // Graph learning must never block or fail the response

        // ─── Graph Writer: Record structured entities from execution (fire-and-forget) ───
        recordGraphExecution(
          userId,
          config.name,
          getFirstStringValue(sanitized)?.slice(0, 500) || "",
          outputSummary,
          durationMs,
        ).catch(() => {}); // Graph writing must never block or fail the response
      }

      // ─── Complete Replay Recording ───
      if (replay) {
        replay.addStep("quality_score", {
          score: qualityScore?.overall,
          passed: qualityScore?.passed,
          piiWarning: !!piiWarning,
        });
        replay.complete({ durationMs, agent: config.name, success: true });
      }

      const remainingCheck = userId ? await checkPlanLimits(userId) : undefined;
      const remaining = remainingCheck?.remaining;
      const response = NextResponse.json({
        ...finalResult,
        _meta: {
          agent: config.name,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          ...(piiWarning ? { piiWarning } : {}),
          ...(qualityScore
            ? {
                qualityScore: qualityScore.overall,
                qualityPassed: qualityScore.passed,
              }
            : {}),
        },
      });

      if (remaining !== undefined) {
        response.headers.set("X-Plan-Remaining", String(remaining));
      }
      if (remainingCheck?.plan) {
        response.headers.set("X-Plan", remainingCheck.plan);
      }

      return response;
    } catch (error: unknown) {
      const failDurationMs = Date.now() - startTime;
      trackAgentExecution(config.name, failDurationMs, false);
      recordAgentFailure(config.name);
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error("Agent execution failed", {
        agent: config.name,
        error: message,
      });
      replay?.fail(message);

      // ─── Persist failure to agentActivity table ───
      if (userId) {
        persistAgentActivity({
          userId,
          agentName: config.name,
          agentType: config.name,
          action: "failed",
          summary: message.slice(0, 200),
          metadata: JSON.stringify({
            durationMs: failDurationMs,
            error: message.slice(0, 500),
          }),
        }).catch(() => {});
      }

      // Persist error for monitoring dashboard
      const { reportError } = await import("@/lib/error-reporter");
      reportError(error, `agent:${config.name}`, {
        agentId: config.name,
        userId: userId ?? undefined,
        severity: "high",
      });

      const userMessage =
        "Something went wrong while running this agent. Our team has been notified. Try again or contact support.";
      return errorResponse(userMessage, 500, "AGENT_ERROR");
    }
  };
}

// ─── Helpers ───

/** Extract the first meaningful string value from an object (for safety scanning) */
function getFirstStringValue(obj: Record<string, unknown>): string | null {
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/** Fast regex-based PII scan (no API call needed) */
function scanForPiiPatterns(
  text: string,
): Array<{ type: string; match: string }> {
  const findings: Array<{ type: string; match: string }> = [];
  const patterns: Array<{ type: string; regex: RegExp }> = [
    { type: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    {
      type: "PHONE",
      regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    },
    { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    {
      type: "CREDIT_CARD",
      regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    },
    { type: "IP_ADDRESS", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  ];

  for (const { type, regex } of patterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches.slice(0, 3)) {
        findings.push({ type, match: match.slice(0, 4) + "***" });
      }
    }
  }

  return findings;
}

/**
 * Record structured entities (emails, URLs, companies, mentions) from agent execution
 * into the knowledge graph using regex-based extraction (zero LLM cost).
 * Fire-and-forget: caller should .catch(() => {}) this.
 */
async function recordGraphExecution(
  userId: string,
  agentName: string,
  inputText: string,
  outputText: string,
  durationMs: number,
): Promise<void> {
  try {
    const { recordAgentExecution } = await import("@/lib/graph/graph-writer");
    await recordAgentExecution({
      userId,
      agentName,
      input: inputText,
      output: outputText,
      durationMs,
    });
  } catch {
    // Graph writing failure must never surface — it's a background enhancement
  }
}

/**
 * Auto-learn: extract relationships from agent execution and store in knowledge graph.
 * Single async function with one try/catch — replaces the 7-level nested .then() chain.
 * Fire-and-forget: caller should .catch(() => {}) this.
 */
async function autoLearnGraph(
  userId: string,
  agentName: string,
  inputText: string,
  outputText: string,
  durationMs: number,
): Promise<void> {
  try {
    const { extractFromAgentExecution } =
      await import("@/lib/graph/relationship-extractor");
    const { triples } = await extractFromAgentExecution(
      agentName,
      inputText,
      outputText,
      durationMs,
    );
    if (triples.length === 0) return;

    const { db } = await import("@/db");
    const { graphNodes, graphEdges } = await import("@/db/schema");

    for (const triple of triples.slice(0, 3)) {
      const [src] = await db
        .insert(graphNodes)
        .values({
          userId,
          nodeType: triple.subject.type,
          label: triple.subject.label,
          properties: "{}",
          confidence: triple.confidence,
        })
        .returning();
      const [tgt] = await db
        .insert(graphNodes)
        .values({
          userId,
          nodeType: triple.object.type,
          label: triple.object.label,
          properties: "{}",
          confidence: triple.confidence,
        })
        .returning();
      await db.insert(graphEdges).values({
        userId,
        sourceId: src.id,
        targetId: tgt.id,
        edgeType: triple.predicate,
        confidence: triple.confidence,
        weight: 100,
      });
    }
  } catch {
    // Graph learning failure must never surface — it's a background enhancement
  }
}
