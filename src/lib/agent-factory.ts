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
import { checkFreeUsage, incrementUsage, getSmartUpgradeInfo, getUserTier } from "@/lib/free-tier";
import { checkTenantCostCap, recordCost } from "@/lib/cost-runaway";
import { onCostCapHit } from "@/lib/cost-cap-alert";
import { withA2eDepthCheck, A2eDepthExceededError, currentA2eDepth, getA2eMaxDepth, readA2eDepthHeader } from "@/lib/a2e-depth";
import { withTrace, withSpan } from "@/lib/agent-trace";
import { persistTrace } from "@/lib/agent-trace-persist";
import { selectApprovalStages } from "@/lib/hitl-routing-rules";
import { createMultiStageRequest, getRequestWithStages } from "@/lib/multi-stage-hitl";
import {
  withRequestTokenBudget,
  RequestTokenBudgetExceededError,
} from "@/lib/per-request-token-budget";
import { scoreOutput, type QualityScore } from "@/lib/quality-scorer";
import { createLogger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";
import { evaluatePolicyGate } from "@/lib/agent-factory-policy-gate";
import {
  consultGovernance,
  isGovernanceLoopEnabled,
  buildGovernanceAuditEntry,
  type GovernanceRule,
} from "@/lib/control-plane/governance";
import {
  routeToHITL,
  isHITLRoutingEnabled,
  buildHITLRoutingAuditEntry,
} from "@/lib/control-plane/hitl-routing";
import type { AgentActionClass } from "@/lib/control-plane/viability";
import type { PolicyRule } from "@/lib/control-plane/policy-engine";
import { getAntiSlopRules } from "@/lib/system-prompts";
import { trackAgentExecution } from "@/lib/analytics";
import { getMemoryContext, saveMemory } from "@/lib/tenant-memory";
import { buildMemoryContext, rememberExecution } from "@/lib/semantic-memory";
import { getActionTier, buildConfirmResponse, buildRestrictedResponse, type ActionTier } from "@/lib/action-tiers";
import { AGENT_MANIFESTS } from "@/lib/agent-manifests.generated";
import { getAgentOverride, applyOverride } from "@/lib/agent-manifest-overrides";
import { scoreConfidence, computeInputOutputOverlap } from "@/lib/agent-confidence";
import { signAttestation } from "@/lib/response-attestation";
import { evaluateTenantPolicy } from "@/lib/tenant-agent-policy";
import { resolveTenantPolicy } from "@/lib/tenant-policy-resolver";
import { getAgentEvalPassRate } from "@/lib/eval-pass-rate";
import { checkTokenBudget, recordTokenUsage, type BudgetPlan } from "@/lib/token-budget";
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
import type { ZodObject, ZodRawShape, ZodTypeAny } from "zod";

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

  /**
   * Zod schema for OUTPUT validation (R31 — Best in Category).
   *
   * When provided, the handler's return value is validated against
   * the schema BEFORE being sent to the user. Validation failure:
   *   - Returns 502 BAD_AGENT_OUTPUT to the user (not 200 — the
   *     output didn't meet the agent's own contract)
   *   - Logs the failure as a span in the active trace
   *   - Logs the failure to the audit log (data integrity event)
   *
   * Use this for any agent that returns structured data: prevents
   * hallucinated JSON shapes, missing fields, wrong types from
   * leaking to callers. Critic re-runs are NOT auto-triggered here
   * (would compound cost); operators can replay the failed trace
   * to investigate.
   */
  outputSchema?: ZodTypeAny;

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

  /**
   * PII output-guard mode (defense-in-depth alongside the prompt-level
   * rules each agent carries).
   *   "mask"  — DEFAULT. Scan output, mask SSN/CC/phone/email in place.
   *             Recipient names + addresses pass through — only numeric
   *             identifiers are scrubbed.
   *   "flag"  — Scan + log findings, don't modify output. Useful for
   *             agents where PII is the desired output (resume-normalizer
   *             should KEEP contact info; flag-mode gives us telemetry
   *             without breaking function).
   *   "skip"  — Bypass the output guard entirely. Use only when you
   *             own the output contract (e.g., synthetic data generators
   *             that emit fake SSNs for testing).
   *
   * See src/lib/pii-guard.ts for the underlying scanner.
   */
  piiGuardMode?: "mask" | "flag" | "skip";

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

  /**
   * R100 Policy Engine gate (Move 2 of the proof-conversion arc).
   *
   * When provided AND the SOVEREIGN_POLICY_GATE_ENABLED env var is set
   * to "true", these policies are evaluated BEFORE the handler runs.
   * Default-deny semantics — if no policy matches, the request is
   * blocked and audit-logged.
   *
   * The gate is per-agent opt-in: 222 existing agents that don't
   * declare policies see no behavior change. Agents that DO declare
   * policies must also have the env flag enabled.
   *
   * The decision composes with R37 ACT presence, R40 reputation,
   * R42 credit headroom, R91 ACAT scope, agent tier, time windows,
   * and resource tags. See src/lib/control-plane/policy-engine.ts.
   */
  policies?: PolicyRule[];

  /**
   * R142 PAGRL governance rules — pre-action 4-layer ruleset
   * consultation (global → workflow → agent → situational).
   *
   * Runs AFTER R100 policy gate (so policy denials short-circuit
   * before governance is consulted) but BEFORE handler dispatch.
   * Verdicts:
   *   - permit   → proceed silently
   *   - modify   → proceed (caller applies the matched rule's modifier)
   *   - escalate → 403 with rationale + reviewer context (HITL queue)
   *
   * Default-OFF unless SOVEREIGN_GOVERNANCE_LOOP_ENABLED=true is set
   * AND config.governanceRules is non-empty. Existing 222 agents are
   * byte-identical until both conditions hold.
   *
   * Fires `agent.governance_consult` audit entry on every consult,
   * regardless of verdict — SOC 2 / EU AI Act reviewers want every
   * decision on the record.
   */
  governanceRules?: ReadonlyArray<GovernanceRule>;

  /**
   * Coarse action class for R140 viability + R142 governance + future
   * IML telemetry. Defaults to "internal_read" if not specified.
   * See src/lib/control-plane/viability.ts for the canonical taxonomy.
   */
  actionClass?: AgentActionClass;

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

      // ─── A2E Recursion Depth Guard (R28 + R29 HTTP propagation) ───
      // Hard limit on agent-calling-agent depth. Reactive cost cap
      // catches recursion symptomatically (it bills tokens); this
      // catches it BEFORE any LLM call, bounding worst-case spend
      // to ~N × per-call instead of unbounded.
      //
      // 422 (not 429/402) because semantically this is "request shape
      // is wrong" — the recursion graph is malformed.
      //
      // R29: depth comes from MAX(in-process ALS, X-A2E-Depth header)
      // so cross-fetch recursion is also caught. The header is
      // clamped to A2E_HARD_CEILING — defeats spoofing.
      //
      // See: src/lib/a2e-depth.ts and Constitution Principle 7.
      try {
        const alsDepth = currentA2eDepth();
        const headerDepth = readA2eDepthHeader(req);
        const currentDepth = Math.max(alsDepth, headerDepth);
        if (currentDepth >= getA2eMaxDepth()) {
          // Fast-path reject without invoking the wrapper, so the error
          // comes back with the right metadata.
          throw new A2eDepthExceededError(
            config.name,
            currentDepth,
            getA2eMaxDepth(),
          );
        }
      } catch (err) {
        if (err instanceof A2eDepthExceededError) {
          return new NextResponse(
            JSON.stringify({
              error: "Agent call depth exceeded",
              message: err.message,
              code: "A2E_DEPTH_EXCEEDED",
              depthAtCall: err.depthAtCall,
              limit: err.limit,
            }),
            {
              status: 422,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        throw err;
      }

      // ─── Cost-Runaway Guard (R27) ───
      // Per-tenant per-day spend cap. Catches misconfigured agents,
      // recursive A2E loops, and abuse from stolen API keys BEFORE
      // they bankrupt the platform. Fail-OPEN on DB error: a Postgres
      // blip should not break the platform; the per-provider circuit
      // breaker is the hard gate, this is defence-in-depth.
      // See: src/lib/cost-runaway.ts and Constitution Principle 7.
      if (userId) {
        try {
          const planId = await getUserTier(userId);
          const cap = await checkTenantCostCap({ userId, planId });
          if (!cap.allowed) {
            return new NextResponse(
              JSON.stringify({
                error: "Daily cost cap reached",
                message: cap.reason ?? "You've hit today's spend cap. Resets at UTC midnight.",
                spentCents: cap.spentCents,
                capCents: cap.capCents,
                code: "DAILY_COST_CAP_REACHED",
              }),
              {
                status: 402, // Payment Required (semantic match for cost cap)
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        } catch (err) {
          // Fail-open: never break the platform on a cost-guard failure.
          log.warn("Cost-cap pre-check failed; allowing run", {
            userId,
            error: String(err),
          });
        }
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
      // Manifest is the source of truth (post-Sprint-F). Falls back to
      // the legacy `getActionTier()` enumeration only for agents not yet
      // covered by the static analyzer. The merged manifest reconciles
      // generated + override (see src/lib/agent-manifest-overrides.ts).
      const generatedManifest = AGENT_MANIFESTS[config.name];
      const manifestOverride = getAgentOverride(config.name);
      const mergedManifest = generatedManifest
        ? applyOverride(generatedManifest, manifestOverride)
        : null;

      // (Tenant policy gate fires AFTER tenantId is resolved below;
      // it's deferred so we can read the tenant's stored policy.)

      const tierInfo = getActionTier(config.name);
      const effectiveTier =
        config.actionTier ??
        (mergedManifest?.tier ?? tierInfo.tier);

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

      // ─── Multi-Stage HITL Gate (R33) ───
      // After tier-2 confirmation, check the routing rules.
      // If a rule matches, the request must pass through the
      // multi-stage approval flow before executing.
      //
      // The user can satisfy this by including
      //   { ..., approved_by_request_id: "<requestId>" }
      // in their body; if that request is fully approved (all stages
      // passed), the gate clears.
      //
      // Otherwise, we create a multi-stage request, persist it, and
      // return 202 with the request_id so callers can poll/track.
      //
      // Conservative integration: only fires for critical actions
      // (effectiveTier === 3 already 403'd above). For tier-2+ that
      // got past the confirmation, if rules match we route through
      // multi-stage HITL.
      if (userId && (effectiveTier >= 2 || mergedManifest)) {
        const routingCtx = {
          agentName: config.name,
          action: "execute",
          costCents: typeof body.costCents === "number" ? body.costCents : undefined,
          actionTier:
            effectiveTier === 3
              ? ("critical" as const)
              : effectiveTier === 2
                ? ("high" as const)
                : ("medium" as const),
          involvesSensitiveData:
            !!(mergedManifest as { dataExports?: boolean } | null)?.dataExports,
          involvesExternalSystem:
            ((mergedManifest as { externalApis?: string[] } | null)?.externalApis?.length ?? 0) > 0,
        };
        const { stages, matchedRule } = selectApprovalStages(routingCtx);

        if (stages.length > 0) {
          const approvedReqId =
            typeof body.approved_by_request_id === "string"
              ? body.approved_by_request_id
              : null;

          if (approvedReqId) {
            // Verify the cited approval belongs to this user + matches.
            const cited = await getRequestWithStages(approvedReqId);
            if (
              !cited ||
              cited.request.id !== approvedReqId ||
              cited.request.status !== "approved"
            ) {
              return new NextResponse(
                JSON.stringify({
                  error:
                    "approved_by_request_id does not reference a fully-approved request",
                  code: "HITL_APPROVAL_INVALID",
                }),
                { status: 403, headers: { "Content-Type": "application/json" } },
              );
            }
            // Approval cleared — fall through to execution.
          } else {
            // No prior approval — create a new multi-stage request.
            const requestId = `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            const totalExpiresAt = new Date(
              Date.now() + 24 * 60 * 60 * 1000 * stages.length, // expiry scales with stage count
            );
            const created = await createMultiStageRequest({
              requestId,
              userId,
              agentName: config.name,
              action: "execute",
              description: `Agent ${config.name} requires multi-stage HITL approval (${stages.length} stages: ${stages.map((s) => s.role).join(" → ")}).`,
              stages,
              routingContext: routingCtx,
              totalExpiresAt,
            });
            if (created.ok) {
              log.info("Multi-stage HITL request created", {
                requestId,
                agent: config.name,
                rule: matchedRule,
                stageCount: stages.length,
              });
              return new NextResponse(
                JSON.stringify({
                  status: "pending_approval",
                  code: "HITL_PENDING",
                  requestId,
                  matchedRule,
                  stages: stages.map((s, i) => ({
                    sequencePosition: i,
                    role: s.role,
                    status: "pending",
                  })),
                  description:
                    `This action requires ${stages.length}-stage approval (${stages.map((s) => s.role).join(" → ")}). ` +
                    `Once approved, re-submit with { approved_by_request_id: "${requestId}" }.`,
                  pollUrl: `/api/admin/hitl/${requestId}`,
                }),
                { status: 202, headers: { "Content-Type": "application/json" } },
              );
            }
            // If creation failed (DB unavailable etc.), fail-CLOSED:
            // the action does NOT proceed without HITL.
            return new NextResponse(
              JSON.stringify({
                error: "Multi-stage HITL gate failed to create request",
                code: "HITL_GATE_UNAVAILABLE",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            );
          }
        }
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

      // ─── Tenant Agent Policy Gate ───
      // Now that tenantId is resolved, check whether the tenant's
      // stored policy permits this agent. Denied → 403 with the
      // policyRule + reason so the client can show "ask your admin
      // to enable this agent". Falls open on lookup error so a
      // transient DB blip doesn't 403 paying customers.
      if (mergedManifest && tenantId) {
        try {
          const policy = await resolveTenantPolicy(tenantId);
          if (policy) {
            const verdict = evaluateTenantPolicy(mergedManifest, policy);
            if (!verdict.allowed) {
              log.info("Tenant policy denied agent", {
                agent: config.name,
                tenantId,
                rule: verdict.rule,
                reason: verdict.reason,
              });
              return NextResponse.json(
                {
                  success: false,
                  error: "This agent is disabled by your tenant policy.",
                  policyRule: verdict.rule,
                  policyReason: verdict.reason,
                  agent: config.name,
                },
                { status: 403 },
              );
            }
          }
        } catch (err) {
          log.warn("Tenant policy lookup failed — allowing request", {
            agent: config.name,
            tenantId,
            error: (err as Error).message,
          });
        }
      }

      // ─── Token Budget Pre-flight (OWASP LLM04 — Model DoS) ───
      // Cheap heuristic: estimate tokens at request time using
      // the input string length / 4 (rough chars-to-tokens ratio).
      // Plan tier comes from the user's subscription record;
      // primary model defaults to the registered manifest's first
      // declared provider, falling back to "default" when no
      // manifest is present.
      //
      // Soft warning at 80% (returned in _meta.tokenBudget for the
      // dashboard to surface). Hard block at 100% returns 429 with
      // a structured `tokenBudgetReason`.
      //
      // Fails open on storage error so a Redis flap doesn't 429
      // paying customers — the audit log captures the gap.
      let budgetCheck: Awaited<ReturnType<typeof checkTokenBudget>> | null = null;
      const inputForBudget = JSON.stringify(sanitized);
      const estimatedTokens = Math.ceil(inputForBudget.length / 4) * 2; // 2x for input+output round-trip
      const primaryModel =
        mergedManifest?.models[0]?.provider ?? "default";
      // Plan resolution — re-use the user's subscription plan when
      // available; default to "free" so the cap engages even before
      // billing is wired.
      const userPlan: BudgetPlan = (sanitized._userPlan as BudgetPlan) ?? "free";

      if (userId) {
        try {
          budgetCheck = await checkTokenBudget(
            userId,
            userPlan,
            primaryModel,
            estimatedTokens,
          );
          if (!budgetCheck.allowed) {
            log.info("Token budget exceeded — blocking", {
              agent: config.name,
              userId,
              plan: userPlan,
              model: primaryModel,
              usedToday: budgetCheck.usedToday,
              limit: budgetCheck.limit,
            });
            return NextResponse.json(
              {
                success: false,
                error: budgetCheck.reason,
                tokenBudgetReason: budgetCheck.reason,
                limit: budgetCheck.limit,
                usedToday: budgetCheck.usedToday,
                plan: userPlan,
                model: primaryModel,
              },
              { status: 429 },
            );
          }
        } catch (err) {
          log.warn("Token budget check failed — allowing request", {
            agent: config.name,
            error: (err as Error).message,
          });
        }
      }

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
      // Note: `result` is `let` (not `const`) because the PII output guard
      // below may swap in a scrubbed copy. The destructure binds an
      // initial value; re-assignment happens only inside the safe-mask
      // branch of the structural PII scrubber.
      // R28 — wrap handler in withA2eDepthCheck so any in-process
      // sub-agent calls during this handler see incremented depth.
      // R31 — wrap in withTrace too: every model/tool/sub-agent call
      // inside the handler can call addSpan() to record a flame-graph
      // step. The trace is persisted to agent_traces at the end.
      // R32 — wrap in withRequestTokenBudget: bounds the single-
      // request token blast radius (complements R27 day-cap + R28
      // depth-cap). Model-call sites consume budget via consumeTokens().

      // R100 Policy Gate (Move 2). Pure-function evaluation BEFORE
      // any heavy context wrappers — fail fast, zero token budget
      // consumed on policy denial. No-op unless:
      //   1. SOVEREIGN_POLICY_GATE_ENABLED=true is set, AND
      //   2. config.policies is a non-empty array.
      // The 222 existing agents that don't declare policies are
      // transparent here regardless of the flag.
      if (config.policies && config.policies.length > 0) {
        const gateVerdict = evaluatePolicyGate({
          agentName: config.name,
          policies: config.policies,
          userId: userId || "anonymous",
          tenantId,
          orgId,
          // Tier 1 default if not specified — least-privilege posture.
          // Agents that perform writes / external actions should set
          // actionTier explicitly in their AgentConfig.
          agentTier: (config.actionTier ?? 1) as 1 | 2 | 3,
          // Resource tags optionally surface from the request body —
          // agents needing tag-based gating include them in the
          // sanitized input under a `_resourceTags` field by convention.
          resourceTags:
            (sanitized as { _resourceTags?: Record<string, string> })
              ._resourceTags,
        });
        if (!gateVerdict.proceed) {
          // R26 audit chain entry. Fire-and-forget; we don't block
          // the response on the audit-log write succeeding (defense
          // in depth — the policy gate is the security boundary, the
          // audit log is the evidence trail).
          auditLog({
            userId: userId || "anonymous",
            action: gateVerdict.auditEntry.action,
            resource: gateVerdict.auditEntry.resource,
            details: gateVerdict.auditEntry.details,
          }).catch(() => {});
          return new NextResponse(
            JSON.stringify(gateVerdict.response),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      // R142 PAGRL — Pre-Action Governance Reasoning Loop (Move 17).
      //
      // Pure-function 4-layer ruleset consultation. Runs AFTER R100
      // policy gate (so policy denials short-circuit before governance
      // is consulted) but BEFORE handler dispatch. This is the
      // structured-trace layer SOC 2 / EU AI Act reviewers want — not
      // just "did this proceed?" but "which layer's rule fired and why?"
      //
      // No-op unless:
      //   1. SOVEREIGN_GOVERNANCE_LOOP_ENABLED=true is set, AND
      //   2. config.governanceRules is non-empty.
      // The 222 existing agents (none declare governance rules) are
      // byte-identical regardless of the flag.
      //
      // Every consultation fires agent.governance_consult on the audit
      // chain — that audit action is forward-declared in
      // src/lib/audit-log.ts and the firing module is this site.
      if (
        isGovernanceLoopEnabled() &&
        config.governanceRules &&
        config.governanceRules.length > 0
      ) {
        const govResult = consultGovernance(config.governanceRules, {
          agentName: config.name,
          agentTier: (config.actionTier ?? 1) as 1 | 2 | 3,
          actionClass: config.actionClass ?? "internal_read",
          resourceTags:
            (sanitized as { _resourceTags?: Record<string, string> })
              ._resourceTags,
        });

        // Always-fire audit entry. Permit / modify / escalate all
        // produce a record — silence here would hide the reasoning.
        const govAudit = buildGovernanceAuditEntry(config.name, govResult);
        auditLog({
          userId: userId || "anonymous",
          action: govAudit.action,
          resource: govAudit.resource,
          details: govAudit.details,
        }).catch(() => {});

        if (govResult.verdict === "escalate") {
          // Escalate is structurally distinct from policy-deny.
          // Routes to HITL queue with the matched-rule trace as
          // reviewer context. Status 403 + rationale; future
          // enhancement: 202 + queue-token to enable polling.
          return new NextResponse(
            JSON.stringify({
              error: "governance_escalation",
              rationale: govResult.rationale,
              regulatoryCitation: govResult.regulatoryCitation,
              matchedRuleId: govResult.matchedRuleId,
              finalLayer: govResult.finalLayer,
              guidance:
                "This action requires human-in-the-loop review. " +
                "See the matched governance rule and rationale above.",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        // permit / modify → proceed. Modifier application is left to
        // the caller since rewrite semantics are agent-specific. The
        // audit trail records that the modify happened either way.
      }

      // R155 HITL Confidence Routing (Move 21).
      //
      // Final trust-gate before handler dispatch. Composes signals
      // from R100 (policy decision), R140-R141 (viability), R143
      // (ODTA), and the always-HITL action-class procurement floor
      // into a calibrated routing decision: auto_proceed |
      // silent_approval | hitl_required | hard_deny.
      //
      // Default-OFF unless SOVEREIGN_HITL_ROUTING_ENABLED=true. When
      // disabled the gate is skipped entirely (existing fleet stays
      // byte-identical). When enabled but no upstream signals are
      // present, routeToHITL evaluates only the action-class floor
      // and produces auto_proceed for routine actions.
      //
      // Fires agent.governance_consult with phase=hitl-routing on
      // every routing decision — distinct from the R142 PAGRL
      // consultation by the phase discriminator in audit details.
      if (isHITLRoutingEnabled()) {
        const hitlDecision = routeToHITL({
          agentName: config.name,
          actionClass: config.actionClass ?? "internal_read",
          // Future: pass policyDecision, viabilityScore, odtaResult
          // when those upstream gates produce structured results.
        });

        const hitlAudit = buildHITLRoutingAuditEntry(
          config.name,
          hitlDecision,
        );
        auditLog({
          userId: userId || "anonymous",
          action: hitlAudit.action,
          resource: hitlAudit.resource,
          details: hitlAudit.details,
        }).catch(() => {});

        if (
          hitlDecision.kind === "hard_deny" ||
          hitlDecision.kind === "hitl_required"
        ) {
          return new NextResponse(
            JSON.stringify({
              error:
                hitlDecision.kind === "hard_deny"
                  ? "hitl_routing_hard_deny"
                  : "hitl_routing_required",
              kind: hitlDecision.kind,
              reason: hitlDecision.reason,
              rationale: hitlDecision.rationale,
              regulatoryCitation: hitlDecision.regulatoryCitation,
              guidance:
                hitlDecision.kind === "hard_deny"
                  ? "This action is structurally refused; no human override available."
                  : "This action requires human-in-the-loop review before proceeding.",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        // silent_approval / auto_proceed → continue; trace already
        // recorded in the audit entry above.
      }

      let budgetExceeded = false;
      const traceOutcome = await withTrace(config.name, async () =>
        withRequestTokenBudget(config.name, () =>
          withA2eDepthCheck(config.name, () =>
            Promise.resolve(
              runWithAttribution(async () =>
                withSpan(
                  { kind: "agent_call", name: `agent:${config.name}` },
                  async () => {
                    try {
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
                    } catch (err) {
                      if (err instanceof RequestTokenBudgetExceededError) {
                        budgetExceeded = true;
                      }
                      throw err;
                    }
                  },
                ),
              ),
            ),
          ),
        ),
      );
      // Persist the trace asynchronously — never block the user
      // response on trace persistence (best-effort).
      if (userId) {
        void persistTrace({
          trace: traceOutcome.trace,
          userId,
        }).catch(() => {});
      }
      // Re-throw the original error if the handler threw, AFTER
      // we've captured the trace.
      if ("error" in traceOutcome) {
        if (budgetExceeded) {
          // Translate the budget error to a 429 with a clear code
          // so callers can backoff/retry with smaller payloads.
          const e = traceOutcome.error as RequestTokenBudgetExceededError;
          return new NextResponse(
            JSON.stringify({
              error: e.message,
              code: "REQUEST_TOKEN_BUDGET_EXCEEDED",
              consumedTokens: e.consumedTokens,
              ceilingTokens: e.ceilingTokens,
            }),
            {
              status: 429,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        throw traceOutcome.error;
      }
      const handlerOutcome = traceOutcome.result;
      let result = handlerOutcome.result;
      const { modelsConsulted, providersConsulted } = handlerOutcome;
      replay?.addStep("handler_complete", { outputKeys: Object.keys(result), outputSize: JSON.stringify(result).length });

      // ─── Output Schema Validation (R31 — Best in Category) ───
      // If the agent declared an outputSchema, validate the handler's
      // return value BEFORE serving it. Hallucinated JSON shapes,
      // missing fields, wrong types: caught here, logged to trace
      // and audit, returned as 502 BAD_AGENT_OUTPUT (the agent
      // produced an output that doesn't meet its own contract).
      if (config.outputSchema) {
        const validation = config.outputSchema.safeParse(result);
        if (!validation.success) {
          const issues = validation.error.issues.map(i =>
            `${i.path.join(".") || "(root)"}: ${i.message}`,
          ).join("; ");
          // Log the failure as a trace span (the trace was already
          // captured but we add this as a coda).
          const { addSpan } = await import("@/lib/agent-trace");
          addSpan({
            kind: "decision",
            name: "output_schema_validation_failed",
            durationMs: 0,
            error: issues,
          });
          // Hash-chained audit record of the failure.
          auditLog({
            userId: userId ?? "anonymous",
            action: "agent.execute",
            resource: config.name,
            details: {
              outcome: "schema_validation_failed",
              issues: issues.slice(0, 1000),
            },
          }).catch(() => {});
          return new NextResponse(
            JSON.stringify({
              error: "Agent output failed its declared schema. The platform refuses to serve untrusted output shapes.",
              code: "BAD_AGENT_OUTPUT",
              issues: validation.error.issues.slice(0, 20),
            }),
            {
              status: 502,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        // result is now schema-validated; re-bind to the parsed value
        // (Zod may transform — e.g. coerce strings to numbers).
        result = validation.data as typeof result;
      }

      // ─── Safety Post-flight: PII Scan + Guard on Output ───
      //
      // Two layers, both defense-in-depth after the agent's own system-
      // prompt rules:
      //   1. `scanForPiiPatterns` (existing) — broad LLM-based detector,
      //      produces human-readable warning strings for telemetry.
      //   2. `scrubPiiDeep` (new, src/lib/pii-guard.ts) — regex+Luhn
      //      scrubber that MUTATES the result in place. Masks SSNs,
      //      credit cards, phone numbers, and emails. Walks the entire
      //      response object (not just a single string field) so
      //      structured JSON payloads are fully covered.
      //
      // Configurable via `piiGuardMode` (default "mask").
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

        // Structural guard — runs on the full response tree regardless
        // of whether the language-model-based scan flagged anything.
        // Regex+Luhn catches patterns the LLM scanner's model can miss.
        const guardMode = config.piiGuardMode ?? "mask";
        if (guardMode !== "skip") {
          try {
            const { scrubPiiDeep } = await import("@/lib/pii-guard");
            const guardResult = scrubPiiDeep(result, guardMode);
            if (guardResult.findings.length > 0) {
              log.warn("pii-guard: structural scrubber found patterns", {
                agent: config.name,
                count: guardResult.findings.length,
                types: [...new Set(guardResult.findings.map((f) => f.type))],
                mode: guardMode,
              });
              if (guardMode === "mask") {
                // Replace the result payload with the scrubbed tree.
                // Safe cast: scrubPiiDeep preserves shape.
                result = guardResult.scrubbed as typeof result;
              }
            }
          } catch (err) {
            // Fail-open — guard bugs must not block user responses.
            log.warn("pii-guard import/scan failed — passing through", {
              error: (err as Error).message,
            });
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

        // R27 — Per-tenant cost ledger update. The cost figure here is
        // a rough estimate; the platform-wide accounting (PROVIDER_COSTS
        // in provider-costs.ts) does fine-grained per-model billing.
        // We use ~$0.005/run (50 milli-cents) as the agent-level
        // estimate — coarse on purpose because the cost cap exists to
        // catch ABUSE (1000s of runs/day), not to bill correctly.
        try {
          const planId = await getUserTier(userId);
          const { getDailyCapCents } = await import("@/lib/cost-runaway");
          const capCents = getDailyCapCents(planId);
          // Estimate: 1 cent per run. Caps from $50 (5000 runs/day for free)
          // up to $2000 (200K runs/day for enterprise) — generous for
          // legitimate use, hard ceiling for runaway loops.
          const result = await recordCost({ userId, costCents: 1, capCents });
          if (result.paused) {
            // Tenant just crossed the cap. Fire the operator alert.
            // Implementation lives in src/lib/cost-cap-alert.ts so the
            // alerting strategy can evolve independently of the factory.
            void onCostCapHit({
              userId,
              planId,
              cumulativeCents: result.cumulativeCents,
              capCents,
              triggerAgentId: config.name,
            }).catch((err) =>
              log.warn("Cost-cap alert dispatch failed", { error: String(err) }),
            );
          }
        } catch (err) {
          log.warn("Cost ledger update failed", { error: String(err) });
        }

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

      // ─── Manifest drift detection ───
      // If the agent at runtime consulted models that ITS PUBLISHED
      // MANIFEST didn't declare, that's a transparency leak — the
      // agents.json endpoint says "this agent uses Claude" but the
      // request actually used Gemini. Log it loudly so ops can either
      // (a) update the manifest or (b) constrain the model selection.
      // Read-only check today; runtime blocking is deferred to A1.5.
      if (mergedManifest && modelsConsulted.length > 0) {
        const declaredProviders = new Set<string>(
          mergedManifest.models.map((m) => m.provider as string),
        );
        const actualProviders = new Set(providersConsulted);
        const undeclared: string[] = [];
        for (const p of actualProviders) {
          // Tolerate "google-gemini" vs "google" provider-bucket fuzzy match.
          const normalized = p.replace(/-.*$/, "");
          if (!declaredProviders.has(p) && !declaredProviders.has(normalized)) {
            undeclared.push(p);
          }
        }
        if (undeclared.length > 0) {
          log.warn("manifest drift — runtime providers exceed declared manifest", {
            agent: config.name,
            declared: [...declaredProviders],
            undeclared,
            modelsConsulted,
          });
        }
      }

      // ─── Confidence scoring (LLM09 — Overreliance) ───
      // Cheap structural inputs from the data we already computed
      // (consensus, safety, eval pass-rate placeholder). No extra
      // LLM call. Score lives in _meta so customers can wire UI off
      // it without parsing the safety pipeline internals.
      const promptForConfidence = getFirstStringValue(sanitized) ?? "";
      const outputForConfidence = getFirstStringValue(finalResult) ?? "";
      const overlap = computeInputOutputOverlap(promptForConfidence, outputForConfidence);
      // Real per-agent rolling 7d eval pass rate. Cached for 5 min so
      // we don't hammer the DB; null when no data, neutral
      // contribution.
      const evalPassRate = await getAgentEvalPassRate(config.name);
      const confidence = scoreConfidence({
        schemaMatch: config.schema ? "clean" : "no-schema",
        modelsConsulted: modelsConsulted.length,
        consensusAgreed:
          modelsConsulted.length >= 2 ? true : null, // best-effort; consensus engine doesn't surface disagreement yet
        safetyFlagged: piiWarning !== undefined,
        inputOutputOverlap: overlap,
        evalPassRate,
      });

      const timestampIso = new Date().toISOString();
      const remainingCheck = userId ? await checkFreeUsage(userId) : undefined;
      const remaining = remainingCheck?.remaining;

      // ─── Post-flight: record token usage against the budget ───
      // Same heuristic as pre-flight — input + output JSON length
      // / 4 ≈ tokens. The actual provider may report a different
      // number; we'd swap to the real value once provider responses
      // surface usage consistently. For now this is a conservative
      // upper bound that bounds DoS risk even on optimistic models.
      if (userId && budgetCheck?.allowed) {
        const outputLength = JSON.stringify(finalResult).length;
        const actualTokens = Math.ceil((inputForBudget.length + outputLength) / 4);
        try {
          await recordTokenUsage(userId, primaryModel, actualTokens);
        } catch (err) {
          log.warn("recordTokenUsage failed — counter not incremented", {
            error: (err as Error).message,
            userId,
            actualTokens,
          });
        }
      }

      const response = NextResponse.json({
        ...finalResult,
        _meta: {
          agent: config.name,
          durationMs: Date.now() - startTime,
          timestamp: timestampIso,
          // Anthropic Constitution §3: transparent provider selection.
          // Surface every model the handler consulted (and a coarse
          // provider bucket so customers can see "anthropic+nvidia"
          // without us exposing SKU-level internals).
          ...(modelsConsulted.length > 0
            ? { modelsConsulted, providersConsulted }
            : {}),
          ...(piiWarning ? { piiWarning } : {}),
          ...(qualityScore ? { qualityScore: qualityScore.overall, qualityPassed: qualityScore.passed } : {}),
          // Per-request manifest snapshot — auditor agents reading the
          // response can verify the platform's claims about THIS agent
          // match the public /api/_meta/agents.json document. Linkable.
          ...(mergedManifest
            ? {
                manifest: {
                  tier: mergedManifest.tier,
                  outputClass: mergedManifest.outputClass,
                  piiGuardMode: mergedManifest.pii.guardMode,
                  declaredProviders: [
                    ...new Set(mergedManifest.models.map((m) => m.provider)),
                  ],
                  ref: `https://sovereignmatrix.agency/api/_meta/agents.json#${config.name}`,
                },
              }
            : {}),
          // Token budget surface — LLM04 (Model DoS) defense. UI uses
          // this to render "you're at 84% of today's Claude budget"
          // banners before the cap engages.
          ...(budgetCheck
            ? {
                tokenBudget: {
                  pctUsed: budgetCheck.pctUsed,
                  softWarning: budgetCheck.softWarning,
                  limit: budgetCheck.limit,
                  model: budgetCheck.model,
                  plan: budgetCheck.plan,
                },
              }
            : {}),
          // Confidence scoring — LLM09 surface. Customers see a 0..1
          // score + a recommended action band, not just raw output.
          confidence: {
            score: confidence.score,
            band: confidence.band,
            recommendedAction: confidence.recommendedAction,
          },
        },
      });

      // ─── Response attestation (LLM05 — supply-chain proof) ───
      // HMAC-SHA256 over (agent, requestId, sha256(input), sha256(output),
      // providers, models, timestamp). Customers can verify the response
      // was produced by Sovereign + match the claimed model. Header
      // omitted gracefully when SOVEREIGN_ATTESTATION_SECRET isn't set.
      const attestation = signAttestation({
        agent: config.name,
        requestId,
        inputJson: JSON.stringify(sanitized),
        outputJson: JSON.stringify(finalResult),
        providers: providersConsulted,
        models: modelsConsulted,
        timestampIso,
      });
      if (attestation) {
        response.headers.set("X-Sovereign-Attestation", attestation);
      }

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
