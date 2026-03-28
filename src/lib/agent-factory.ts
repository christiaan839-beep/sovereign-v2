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
import { checkFreeUsage, incrementUsage, getUpgradePrompt } from "@/lib/free-tier";
import { scoreOutput, type QualityScore } from "@/lib/quality-scorer";
import { createLogger } from "@/lib/logger";
import { getAntiSlopRules } from "@/lib/system-prompts";
import { trackAgentExecution } from "@/lib/analytics";

const log = createLogger("agent-factory");

/** Anti-slop rules injected into agent context */
export const ANTI_SLOP_RULES = getAntiSlopRules();

export interface AgentConfig {
  /** Agent name for logging and telemetry */
  name: string;

  /** Fields required in the request body */
  requiredFields?: string[];

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

  /** Quality score threshold — output below this triggers regeneration (default: 0.6) */
  qualityThreshold?: number;

  /** Allowed topics — agent will refuse off-topic requests (NeMo Guardrails pattern) */
  allowedTopics?: string[];

  /** The agent's core logic */
  handler: (ctx: AgentContext) => Promise<Record<string, unknown>>;
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
}

export function createAgentRoute(config: AgentConfig) {
  return async function POST(req: Request) {
    const startTime = Date.now();

    try {
      // ─── Auth & Rate Limiting ───
      let email = "";
      let userId = "";

      if (!config.public) {
        const guard = await guardRoute();
        if (!guard.authorized) return guard.response;
        email = guard.email;
        userId = guard.userId;
      }

      // ─── Free Tier Usage Check ───
      if (userId) {
        const usage = checkFreeUsage(userId);
        if (!usage.allowed) {
          return new NextResponse(
            JSON.stringify({
              error: "Usage limit reached",
              message: getUpgradePrompt(userId),
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

      // Validate required fields
      if (config.requiredFields) {
        for (const field of config.requiredFields) {
          if (body[field] === undefined || body[field] === null || body[field] === "") {
            return errorResponse(`Missing required field: ${field}`, 400, "MISSING_FIELD");
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

      // ─── Execute Agent Handler ───
      const result = await config.handler({
        input: sanitized,
        request: req,
        email,
        userId,
      });

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

      // ─── Track Usage & Return Response ───
      if (userId) {
        incrementUsage(userId);
      }
      trackAgentExecution(config.name, Date.now() - startTime, true);

      const remaining = userId ? checkFreeUsage(userId).remaining : undefined;
      const response = NextResponse.json({
        ...finalResult,
        _meta: {
          agent: config.name,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          ...(piiWarning ? { piiWarning } : {}),
          ...(qualityScore ? { qualityScore: qualityScore.overall, qualityPassed: qualityScore.passed } : {}),
        },
      });

      if (remaining !== undefined) {
        response.headers.set("X-Free-Remaining", String(remaining));
      }

      return response;
    } catch (error: unknown) {
      trackAgentExecution(config.name, Date.now() - startTime, false);
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error("Agent execution failed", { agent: config.name, error: message });
      return errorResponse(message, 500, "AGENT_ERROR");
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
