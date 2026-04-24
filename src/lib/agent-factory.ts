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
import { checkFreeUsage, incrementUsage, getSmartUpgradeInfo } from "@/lib/free-tier";
import { scoreOutput, type QualityScore } from "@/lib/quality-scorer";
import { createLogger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";
import { getAntiSlopRules } from "@/lib/system-prompts";
import { trackAgentExecution } from "@/lib/analytics";
import { getMemoryContext, saveMemory } from "@/lib/tenant-memory";
import { buildMemoryContext, rememberExecution } from "@/lib/semantic-memory";
import { getActionTier, buildConfirmResponse, buildRestrictedResponse, type ActionTier } from "@/lib/action-tiers";
import { resolveTenantId } from "@/lib/tenant-resolver";
import { isAgentAvailable, recordAgentSuccess, recordAgentFailure } from "@/lib/agent-circuit-breaker";
import { recordSloEvent } from "@/lib/slo-tracker";
import { persistAgentActivity } from "@/lib/activity-persist";
import { notifyAgentComplete } from "@/lib/notify";
import { evaluatePolicy } from "@/lib/policy-engine";
import { checkBudget, recordSpend } from "@/lib/budget-controls";
import { startReplay, type ReplayBuilder } from "@/lib/agent-replay";
import { checkAgentAccess } from "@/lib/paywall";
import { recordSample } from "@/lib/slo-tracking";
import { payoutCreatorIfApplicable } from "@/lib/creator-payout";
import {
  runWithAttribution,
  getModelsConsulted,
  getProvidersConsulted,
} from "@/lib/model-attribution";
import {
  runWithRequestContext,
  generateRequestId,
  setUserId as setRequestUserId,
} from "@/lib/request-context";
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

  /**
   * Request that the NemoGuard safety pipeline be skipped. IGNORED unless
   * the caller is on a Sovereign+ tier (node/sovereign/enterprise/founder).
   * Free/Starter/Growth users always go through the full pipeline
   * regardless of this flag.
   */
  skipSafetyChecks?: boolean;

  /** Action tier override (1=autonomous, 2=confirm, 3=restricted). Auto-detected if omitted. */
  actionTier?: ActionTier;

  /** Enable/disable Critic Agent QA gate (default: true for all agents) */
  useCritic?: boolean;

  /** Quality score threshold — output below this triggers regeneration (default: 0.6) */
  qualityThreshold?: number;

  /** Allowed topics — agent will refuse off-topic requests (NeMo Guardrails pattern) */
  allowedTopics?: string[];

  /** The agent's core logic.
   *  Return type is `object` (not `Record<string, unknown>`) so that
   *  agents returning typed result shapes (e.g. `AgentResult` from
   *  content-factory, or response-literal types from NextResponse-less
   *  handlers) are assignable without `as Record<string, unknown>`
   *  casts everywhere. The factory internally treats the result as a
   *  JSON-serializable blob — any object shape is acceptable. */
  handler: (ctx: AgentContext) => Promise<object>;
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
    // Respect an incoming X-Request-Id header if the caller already
    // generated one (useful for cross-service tracing). Otherwise mint
    // our own. Format check prevents log injection via a malicious
    // client sending "..\n\nEVIL" as the ID.
    const incomingRid = req.headers.get("x-request-id") ?? "";
    const requestId = /^[A-Za-z0-9-]{1,64}$/.test(incomingRid)
      ? incomingRid
      : generateRequestId();

    // Every agent call runs inside its own request + attribution
    // context. This is the outermost scope; everything below inherits.
    return runWithRequestContext(
      { requestId, agentName: config.name, path: new URL(req.url).pathname },
      () => handleAgentRoute(req, config, requestId),
    );
  };
}

// The real handler body — extracted so the ALS-wrapping wrapper stays
// thin and obvious.
async function handleAgentRoute(
  req: Request,
  config: AgentConfig,
  requestId: string,
): Promise<Response> {
  const startTime = Date.now();
  let email = "";
  let userId = "";
  let replay: ReplayBuilder | null = null;
  // Hoisted so the catch block can release an orphaned hold on crash.
  // Declared null and assigned after the credit-gate fires (line ~500).
  let creditHoldId: string | null = null;

    try {
      // ─── Auth & Rate Limiting ───

      if (!config.public) {
        // ── Cron / internal-service bypass ──
        // When the scheduler, Stripe webhook, or other trusted backend
        // calls an agent, there's no Clerk session. We authorize the
        // request via a shared-secret header instead. The internal caller
        // MUST provide BOTH headers — the secret alone doesn't identify
        // who the agent is running for, the user-id alone isn't trusted.
        const internalUserId = req.headers.get("x-sovereign-user-id");
        const internalSecret = req.headers.get("x-sovereign-internal-secret");
        const cronSecret = process.env.CRON_SECRET;

        if (internalSecret && cronSecret && internalUserId) {
          // Constant-time compare via hash+compare (same pattern as
          // cron-auth.ts). Never accept if CRON_SECRET is unset or
          // weak — weak secrets aren't a security hole (attackers
          // still need to match them), but they're a misconfiguration
          // footgun that would silently disable the scheduler. We
          // log loudly so the operator sees it in Sentry.
          if (cronSecret.length < 16) {
            log.error("CRON_SECRET is set but shorter than 16 chars — internal-auth bypass disabled", {
              length: cronSecret.length,
            });
          } else {
            const { createHash, timingSafeEqual } = await import("node:crypto");
            const a = createHash("sha256").update(internalSecret).digest();
            const b = createHash("sha256").update(cronSecret).digest();
            if (timingSafeEqual(a, b)) {
              // Also require a well-formed userId
              if (/^[A-Za-z0-9_-]+$/.test(internalUserId)) {
                userId = internalUserId;
                email = ""; // not needed on this path
              }
            }
          }
        }

        // Fall through to Clerk auth if no valid internal bypass
        if (!userId) {
          const guard = await guardRoute();
          if (!guard.authorized) return guard.response;
          email = guard.email;
          userId = guard.userId;
        }

        // Sync to request context for log correlation
        if (userId) setRequestUserId(userId);
      }

      // ─── Free Tier Usage Check ───
      if (userId) {
        const usageCheck = await checkFreeUsage(userId);
        if (!usageCheck.allowed) {
          const upgradeInfo = await getSmartUpgradeInfo(userId);
          return new NextResponse(
            JSON.stringify({
              error: "Usage limit reached",
              message: `You've used all ${upgradeInfo.currentLimit} runs this month on the ${upgradeInfo.currentPlan.charAt(0).toUpperCase() + upgradeInfo.currentPlan.slice(1)} plan.`,
              upgrade: {
                currentPlan: upgradeInfo.currentPlan,
                currentLimit: upgradeInfo.currentLimit,
                used: upgradeInfo.used,
                nextPlan: upgradeInfo.nextPlan,
                nextLimit: upgradeInfo.nextLimit,
                nextPrice: upgradeInfo.nextPrice,
                upgradeUrl: upgradeInfo.upgradeUrl,
                resetDate: upgradeInfo.resetDate,
              },
              code: "USAGE_LIMIT_REACHED",
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-Free-Remaining": "0",
              },
            }
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
          const issues = validation.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
          return errorResponse(`Validation failed: ${issues}`, 400, "VALIDATION_ERROR");
        }
      } else if (config.requiredFields) {
        for (const field of config.requiredFields) {
          if (body[field] === undefined || body[field] === null || body[field] === "") {
            return errorResponse(`Missing required field: ${field}`, 400, "MISSING_FIELD");
          }
        }
      }

      // ─── Action Tier Gate ───
      const tierInfo = getActionTier(config.name);
      const effectiveTier = config.actionTier ?? tierInfo.tier;

      if (effectiveTier >= 2 && !body.confirmed) {
        if (effectiveTier === 3) {
          log.info("Tier 3 agent blocked — admin approval required", { agent: config.name });
          return NextResponse.json(buildRestrictedResponse(config.name), { status: 403 });
        }
        // Tier 2: return a preview asking for confirmation
        log.info("Tier 2 agent — confirmation required", { agent: config.name });
        return NextResponse.json(
          buildConfirmResponse(config.name, {
            agent: config.name,
            input: Object.fromEntries(
              Object.entries(body).filter(([k]) => k !== "confirmed")
            ),
          }),
          { status: 200 }
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
            log.warn("Jailbreak blocked", { agent: config.name, category: jailbreakResult.category });
            return errorResponse(
              "Request blocked by safety system. Your input was flagged as a potential prompt injection.",
              403,
              "JAILBREAK_BLOCKED"
            );
          }
        }
      }

      // ─── Safety Pre-flight: Topic Control (NeMo Guardrails pattern) ───
      if (config.allowedTopics && config.allowedTopics.length > 0) {
        const primaryInput = getFirstStringValue(sanitized);
        if (primaryInput) {
          const inputLower = primaryInput.toLowerCase();
          const onTopic = config.allowedTopics.some(topic =>
            inputLower.includes(topic.toLowerCase())
          );
          // Only block if input is long enough to be a real request (not just a URL or short param)
          if (!onTopic && primaryInput.length > 50) {
            log.info("Off-topic request filtered", { agent: config.name, topics: config.allowedTopics });
            return errorResponse(
              `This agent handles: ${config.allowedTopics.join(", ")}. Your request seems off-topic. Try the Sovereign Assistant for general queries.`,
              400,
              "OFF_TOPIC"
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
            log.warn("Content safety blocked", { agent: config.name, category: safetyResult.category });
            return errorResponse(
              `Content blocked by safety filter: ${safetyResult.reason}`,
              403,
              "CONTENT_UNSAFE"
            );
          }
        }
      }

      // ─── Inject Tenant Memory Context ───
      // Semantic (vector) memory for Growth+ tiers; keyword fallback for Starter/Free.
      // Memory is a real upgrade reason — Starter users see no recall, Growth+
      // users get agents that remember every relevant past interaction.
      if (userId) {
        let memoryTier: string | null = null;
        try {
          const { getUserTier } = await import("@/lib/free-tier");
          memoryTier = await getUserTier(userId);
        } catch { /* best-effort tier resolution */ }

        const isSemanticTier =
          !!memoryTier &&
          ["array", "growth", "node", "sovereign", "enterprise", "founder"].includes(
            memoryTier.toLowerCase(),
          );

        if (isSemanticTier) {
          // Vector recall (top-k semantically similar) — Growth+
          try {
            const primaryInput = getFirstStringValue(sanitized);
            if (primaryInput) {
              const ctx = await buildMemoryContext(userId, config.name, primaryInput);
              if (ctx) {
                // Budget the injection to ~1500 tokens (~6000 chars).
                sanitized._memoryContext = ctx.slice(0, 6000);
              }
            }
          } catch (err) {
            log.info("semantic memory recall failed, falling through to keyword", {
              error: String(err),
            });
            const keywordCtx = getMemoryContext(userId, config.name);
            if (keywordCtx) sanitized._memoryContext = keywordCtx;
          }
        } else {
          // Keyword-only recall for Starter / Free — cheap, no upgrade gate
          const keywordCtx = getMemoryContext(userId, config.name);
          if (keywordCtx) sanitized._memoryContext = keywordCtx;
        }
      }

      // ─── Resolve Tenant ID for Multi-Tenant Isolation ───
      let tenantId: string | undefined;
      if (userId) {
        tenantId = await resolveTenantId(userId);
      }

      // Extract orgId from request body if provided (for org-scoped operations)
      const orgId = typeof sanitized.orgId === "string" ? sanitized.orgId : undefined;

      // ─── Circuit Breaker Check ───
      if (!isAgentAvailable(config.name)) {
        log.warn(`Agent circuit open: ${config.name} — temporarily disabled`);
        return NextResponse.json(
          { error: `Agent "${config.name}" is temporarily unavailable due to repeated failures. Please try again shortly.` },
          { status: 503 }
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
              { error: access.reason, requiredPlan: access.requiredPlan, upgradeUrl: access.upgradeUrl },
              { status: 403 }
            );
          }
        } catch (paywallErr) {
          log.warn("Paywall check failed — allowing execution", { agent: config.name, error: String(paywallErr) });
          // Fail-open: if paywall check crashes, allow execution (better than blocking everyone)
        }
      }

      // Replay: records execution steps (non-blocking — never prevents execution)
      try {
        if (userId) {
          replay = startReplay(config.name, userId);
          replay.addStep("input_received", { fields: Object.keys(body), inputSize: JSON.stringify(body).length });
        }
      } catch { /* replay failure must never block agent execution */ }

      // Policy: blocks if rules deny this action
      if (userId) {
        try {
          const policyResult = evaluatePolicy(config.name, "agent.execute", { userId, role: "member" });
          if (!policyResult.allowed) {
            log.warn("Policy denied agent execution", { agent: config.name, policy: policyResult.policyId, reason: policyResult.reason });
            return NextResponse.json(
              { error: policyResult.reason || "Action denied by policy" },
              { status: 403 }
            );
          }
        } catch (policyErr) {
          log.warn("Policy check failed — allowing execution", { agent: config.name, error: String(policyErr) });
        }
      }

      // Budget: blocks if spend limits exceeded
      if (userId) {
        try {
          const budgetResult = checkBudget(userId);
          if (!budgetResult.allowed) {
            return NextResponse.json(
              { error: budgetResult.reason || "Budget limit exceeded", dailyPercent: budgetResult.dailyPercent, monthlyPercent: budgetResult.monthlyPercent },
              { status: 429 }
            );
          }
        } catch (budgetErr) {
          log.warn("Budget check failed — allowing execution", { agent: config.name, error: String(budgetErr) });
        }
      }

      // ─── Credits: place a hold for this run (plan 1.6) ───
      // Conservatively reserves enough credit to cover a 2000-token run
      // on the cheapest sovereignty-safe model. The actual amount is
      // captured after success (or released on failure). Runs charged
      // against a monthly plan allocation; pay-per-run users spend
      // from their topped-up balance.
      //
      // Free-tier users with zero balance get a 402 Payment Required
      // with a top-up URL — NOT a 403 (paywall) or 429 (rate limit).
      // The client-side UpgradeNudge component keys on 402 to show the
      // "Top up credits" modal specifically.
      // creditHoldId is declared at function scope (see let above) so the
      // catch block can release it on crash.
      if (userId && !config.public) {
        try {
          const { placeHold } = await import("@/lib/credits");
          const { estimatedHoldCents } = await import("@/lib/pricing-costs");
          const holdCents = estimatedHoldCents("nvidia/nemotron-3-nano-30b-a3b", 2000);
          // L1.4 — tag the hold's ledger row with agentSlug via metadata
          // (NOT via runId, which is a UUID column). captureHold carries
          // this forward onto the hold_capture row so the nightly rollup
          // (Phase 3) can attribute cost to the right agent.
          creditHoldId = await placeHold(userId, holdCents, {
            ttlMs: 5 * 60_000,
            extraMetadata: { agentSlug: config.name },
          });
        } catch (holdErr) {
          const { InsufficientCreditsError } = await import("@/lib/credits");
          if (holdErr instanceof InsufficientCreditsError) {
            return NextResponse.json(
              {
                error: "Insufficient credits",
                required: holdErr.required,
                available: holdErr.available,
                topUpUrl: "/dashboard/billing?topup=true",
              },
              { status: 402 },
            );
          }
          // Any other error — log and fail-open to protect revenue.
          // A broken credits service must not block all runs.
          log.warn("Credit hold failed — allowing execution without hold", {
            agent: config.name,
            error: String(holdErr),
          });
        }
      }

      // ─── Execute Agent Handler ───
      // Wrap in model-attribution context so every AI call made inside
      // the handler (ai(), nimChat(), consensus, research_ai, nested
      // agent invocations) records which model it consulted. We read
      // the trace from INSIDE the wrap (before the context exits) and
      // surface it alongside the result — honoring the "transparent
      // provider selection" principle (Anthropic Constitution §3).
      replay?.addStep("handler_start", { agent: config.name });
      const { result, modelsConsulted, providersConsulted } = await runWithAttribution(async () => {
        const r = await config.handler({
          input: sanitized,
          request: req,
          email,
          userId,
          tenantId,
          orgId,
        });
        return {
          result: r,
          modelsConsulted: getModelsConsulted(),
          providersConsulted: getProvidersConsulted(),
        };
      });
      replay?.addStep("handler_complete", { outputKeys: Object.keys(result), outputSize: JSON.stringify(result).length });

      // ─── Safety Post-flight: PII Scan on Output ───
      let piiWarning: string | undefined;
      if (!config.skipPiiScan) {
        const outputText = getFirstStringValue(result);
        if (outputText && outputText.length > 50) {
          const piiEntities = scanForPiiPatterns(outputText);
          if (piiEntities.length > 0) {
            piiWarning = `Output contains ${piiEntities.length} potential PII item(s): ${piiEntities.map(e => e.type).join(", ")}`;
            log.warn("PII detected in output", { agent: config.name, count: piiEntities.length });
          }
        }
      }

      // ─── Safety Post-flight: NemoGuard Content Safety on Output ───
      // Runs on the agent's response before delivery. Critical for cases
      // where agents drift or produce unsafe content via tool use even
      // with a clean input.
      if (!config.skipSafetyCheck) {
        const outputText = getFirstStringValue(result);
        if (outputText) {
          // Resolve user tier once for the Sovereign-tier skip override.
          let userTier: string | null = null;
          if (userId) {
            try {
              const { getUserTier } = await import("@/lib/free-tier");
              userTier = await getUserTier(userId);
            } catch { /* tier resolution best-effort */ }
          }
          const { checkOutputSafety } = await import("@/lib/safety-pipeline");
          const outSafety = await checkOutputSafety(outputText, {
            agentId: config.name,
            userId,
            userTier,
            skipIfSovereign: config.skipSafetyChecks,
          });
          if (!outSafety.passed) {
            // Output safety blocked — compute was consumed, so capture
            // the hold. The user paid for the run; we blocked the
            // delivery. A release here would be unfair to the platform.
            if (creditHoldId) {
              try {
                const { captureHold } = await import("@/lib/credits");
                void captureHold(creditHoldId).catch(() => {});
              } catch { /* ignore */ }
            }
            return errorResponse(
              outSafety.reason ?? "Response blocked by output safety filter.",
              403,
              "OUTPUT_UNSAFE",
            );
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
                log.info("Quality below threshold but MAX_QUALITY_RETRIES reached — accepting output", {
                  agent: config.name,
                  score: qualityScore.overall,
                  maxRetries: MAX_QUALITY_RETRIES,
                });
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

                const retryResult = await config.handler({
                  input: refinedInput,
                  request: req,
                  email,
                  userId,
                  tenantId,
                  orgId,
                });

                // Score the retry attempt
                const retryText = getFirstStringValue(retryResult);
                if (retryText && retryText.length >= 20) {
                  const retryScore = await scoreOutput(promptText, retryText, threshold);
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
      // We read `output` off the result as a loose field — handlers that
      // return `{ output: "…" }` (most of them) get QA'd; handlers that
      // return other shapes (e.g. `{ result: … }`) skip the critic naturally.
      const criticScoped = finalResult as Record<string, unknown>;
      if (
        config.useCritic !== false &&
        criticScoped.output &&
        typeof criticScoped.output === "string" &&
        criticScoped.output.length > 100
      ) {
        try {
          const { criticReview } = await import("@/lib/critic");
          const review = await criticReview(
            typeof body.prompt === "string" ? body.prompt : config.name,
            criticScoped.output as string,
            config.name,
            { threshold: 0.7, autoCorrect: true }
          );
          if (review.correctedOutput && !review.approved) {
            criticScoped.output = review.correctedOutput;
            criticScoped._criticFeedback = review.feedback;
            criticScoped._criticScore = review.score;
          }
        } catch (criticErr) {
          log.warn("Critic review skipped", { agent: config.name, error: String(criticErr) });
        }
      }

      // ─── Save to Tenant Memory ───
      // Always record via keyword memory (cheap, useful for analytics).
      // ALSO embed into semantic memory for Growth+ tiers — this is what
      // makes agents compound (recalled into future runs' system prompts).
      if (userId) {
        const inputText = getFirstStringValue(sanitized);
        const outputText = getFirstStringValue(finalResult);
        if (inputText && outputText) {
          try {
            saveMemory(userId, config.name, inputText, outputText);
          } catch (memErr) {
            log.warn("Tenant memory save failed", { agent: config.name, error: String(memErr) });
          }

          // Semantic memory — fire-and-forget; never block delivery on it.
          // Gated by tier same as the recall side so the write/read sides
          // stay symmetric: Growth+ gets embedding, Starter gets keyword only.
          try {
            const { getUserTier } = await import("@/lib/free-tier");
            const tier = await getUserTier(userId);
            const shouldEmbed =
              !!tier &&
              ["array", "growth", "node", "sovereign", "enterprise", "founder"].includes(
                tier.toLowerCase(),
              );
            if (shouldEmbed) {
              void rememberExecution(userId, config.name, inputText, outputText).catch(
                (e) =>
                  log.info("semantic memory embed skipped", {
                    agent: config.name,
                    error: String(e),
                  }),
              );
            }
          } catch { /* tier lookup best-effort */ }
        }
      }

      // ─── Track Usage, Audit Log & Return Response ───
      if (userId) {
        await incrementUsage(userId, config.name);
        // Track spend for budget controls (estimates token cost by model)
        recordSpend(userId, "nim-default", 500); // ~500 tokens per agent call average
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
      // Plan 4 SLO — agent latency p95 < 8s. Pass if under target.
      void recordSample("agent_latency_p95", durationMs, durationMs <= 8000);
      // SLO tracker — per-endpoint rolling uptime + latency for the
      // public /api/_health/slo and /api/_health/performance dashboards.
      recordSloEvent(`/api/agents/${config.name}`, { success: true, ms: durationMs });

      // ─── Persist to agentActivity table (fire-and-forget) ───
      if (userId) {
        const outputSummary = getFirstStringValue(finalResult)?.slice(0, 200) || "";
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
        notifyAgentComplete(userId, config.name, outputSummary, email || undefined).catch(() => {});

        // ─── Auto-learn: Extract relationships for knowledge graph (fire-and-forget) ───
        autoLearnGraph(userId, config.name, getFirstStringValue(sanitized)?.slice(0, 500) || "", outputSummary, durationMs)
          .catch(() => {}); // Graph learning must never block or fail the response
      }

      // ─── Complete Replay Recording ───
      if (replay) {
        replay.addStep("quality_score", { score: qualityScore?.overall, passed: qualityScore?.passed, piiWarning: !!piiWarning });
        replay.complete({ durationMs, agent: config.name, success: true });
      }

      const remainingCheck = userId ? await checkFreeUsage(userId) : undefined;
      const remaining = remainingCheck?.remaining;
      const response = NextResponse.json({
        ...finalResult,
        _meta: {
          agent: config.name,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          // Anthropic Constitution §3: transparent provider selection.
          // Surface every model the handler consulted (and a coarse
          // provider bucket so customers can see "anthropic+nvidia"
          // without us exposing SKU-level internals).
          ...(modelsConsulted.length > 0
            ? { modelsConsulted, providersConsulted }
            : {}),
          ...(piiWarning ? { piiWarning } : {}),
          ...(qualityScore ? { qualityScore: qualityScore.overall, qualityPassed: qualityScore.passed } : {}),
        },
      });

      if (remaining !== undefined) {
        response.headers.set("X-Free-Remaining", String(remaining));
      }
      // Per-request correlation — customer support can give us this
      // ID when reporting an issue and we grep it in our logs + Sentry.
      response.headers.set("X-Request-Id", requestId);

      // ─── Credits: capture the hold on success (plan 1.7) ───
      // Fire-and-forget — a capture failure logs but never fails the
      // response (the user has their output already). The sweep cron
      // will retry / expire if capture didn't land.
      if (creditHoldId) {
        const heldCents = (await import("@/lib/pricing-costs")).estimatedHoldCents(
          "nvidia/nemotron-3-nano-30b-a3b",
          2000,
        );
        const holdIdForCapture = creditHoldId;
        void (async () => {
          try {
            const { captureHold } = await import("@/lib/credits");
            await captureHold(holdIdForCapture);
            // L1.5 — creator payout (80% of capturedCents) to the agent's
            // creator_user_id if the agent has one. Fire-and-forget.
            await payoutCreatorIfApplicable({
              agentSlug: config.name,
              capturedCents: heldCents,
              holdId: holdIdForCapture,
              sourceUserId: userId ?? "",
            });
          } catch (e) {
            log.warn("captureHold or creator payout failed post-response", {
              holdId: holdIdForCapture,
              error: String(e),
            });
          }
        })();
      }

      return response;
    } catch (error: unknown) {
      const failDurationMs = Date.now() - startTime;
      trackAgentExecution(config.name, failDurationMs, false);
      recordAgentFailure(config.name);
      // Plan 4 SLO — failure is always a miss for the availability part
      // of the latency objective, regardless of how fast it failed.
      void recordSample("agent_latency_p95", failDurationMs, false);
      // SLO tracker — per-endpoint failure event with its error code
      // aggregated into topErrorCodes for the status dashboard.
      const errCode = error instanceof Error ? error.name || "Error" : "unknown";
      recordSloEvent(`/api/agents/${config.name}`, {
        success: false,
        ms: failDurationMs,
        errorCode: errCode,
      });
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error("Agent execution failed", { agent: config.name, error: message });
      replay?.fail(message);

      // ─── Credits: release the hold on failure (plan 1.7) ───
      // Refund the reserved credit. Best-effort; the sweep cron will
      // reclaim the hold if this release fails.
      if (creditHoldId) {
        try {
          const { releaseHold } = await import("@/lib/credits");
          void releaseHold(creditHoldId).catch((e) =>
            log.warn("releaseHold failed in error path", { holdId: creditHoldId, error: String(e) }),
          );
        } catch { /* never compound failures by throwing in the catch */ }
      }

      // ─── Persist failure to agentActivity table ───
      if (userId) {
        persistAgentActivity({
          userId,
          agentName: config.name,
          agentType: config.name,
          action: "failed",
          summary: message.slice(0, 200),
          metadata: JSON.stringify({ durationMs: failDurationMs, error: message.slice(0, 500) }),
        }).catch(() => {});
      }

      // Persist error for monitoring dashboard
      const { reportError } = await import("@/lib/error-reporter");
      reportError(error, `agent:${config.name}`, { agentId: config.name, userId: userId ?? undefined, severity: "high" });

      const userMessage = "Something went wrong while running this agent. Our team has been notified. Try again or contact support.";
      return errorResponse(userMessage, 500, "AGENT_ERROR");
    }
}

// ─── Helpers ───

/** Extract the first meaningful string value from an object (for safety scanning) */
function getFirstStringValue(obj: object): string | null {
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/** Fast regex-based PII scan (no API call needed) */
function scanForPiiPatterns(text: string): Array<{ type: string; match: string }> {
  const findings: Array<{ type: string; match: string }> = [];
  const patterns: Array<{ type: string; regex: RegExp }> = [
    { type: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { type: "PHONE", regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
    { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    { type: "CREDIT_CARD", regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g },
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
 * Auto-learn: extract relationships from agent execution and store in knowledge graph.
 * Single async function with one try/catch — replaces the 7-level nested .then() chain.
 * Fire-and-forget: caller should .catch(() => {}) this.
 */
async function autoLearnGraph(userId: string, agentName: string, inputText: string, outputText: string, durationMs: number): Promise<void> {
  try {
    const { extractFromAgentExecution } = await import("@/lib/graph/relationship-extractor");
    const { triples } = await extractFromAgentExecution(agentName, inputText, outputText, durationMs);
    if (triples.length === 0) return;

    const { db } = await import("@/db");
    const { graphNodes, graphEdges } = await import("@/db/schema");

    for (const triple of triples.slice(0, 3)) {
      const [src] = await db.insert(graphNodes).values({
        userId, nodeType: triple.subject.type, label: triple.subject.label, properties: "{}", confidence: triple.confidence,
      }).returning();
      const [tgt] = await db.insert(graphNodes).values({
        userId, nodeType: triple.object.type, label: triple.object.label, properties: "{}", confidence: triple.confidence,
      }).returning();
      await db.insert(graphEdges).values({
        userId, sourceId: src.id, targetId: tgt.id, edgeType: triple.predicate, confidence: triple.confidence, weight: 100,
      });
    }
  } catch {
    // Graph learning failure must never surface — it's a background enhancement
  }
}
