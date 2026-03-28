/**
 * SOVEREIGN MATRIX — NeMo Guardrails Pipeline
 *
 * Programmable safety pipeline inspired by NVIDIA NeMo Guardrails.
 * Composes five rail layers into a single `runGuardrails()` call:
 *
 *   1. Topic Control  — Reject off-topic requests per agent
 *   2. Input Rails    — Jailbreak detection + content safety + PII scan on INPUT
 *   3. Output Rails   — PII detection + hallucination check + quality on OUTPUT
 *   4. Moderation     — Harmful / biased / legally risky content in both directions
 *   5. Rate Rails     — Per-user execution rate limiting (agent-level, not API-level)
 *
 * Usage:
 *   import { runGuardrails } from "@/lib/nemo-guardrails";
 *
 *   // Before LLM call (input rails):
 *   const pre = await runGuardrails({ input: userPrompt, agentName: "seo-dominator", userId });
 *   if (!pre.passed) return error(pre.blocked!.reason);
 *
 *   // After LLM call (output rails):
 *   const post = await runGuardrails({ input: userPrompt, output: llmResponse, agentName: "seo-dominator", userId });
 *   if (!post.passed) return error(post.blocked!.reason);
 */

import { detectJailbreak } from "@/lib/jailbreak-detect";
import { checkContentSafety } from "@/lib/content-safety";
import { createLogger } from "@/lib/logger";

const log = createLogger("nemo-guardrails");

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface GuardrailsConfig {
  /** User prompt (always required) */
  input: string;
  /** Agent response — provide this to run output rails */
  output?: string;
  /** Agent identifier */
  agentName: string;
  /** Authenticated user ID for rate limiting */
  userId: string;
  /** Allowed topics for this agent — empty or omitted skips topic control */
  allowedTopics?: string[];
}

export interface GuardrailsResult {
  /** True if all rails passed */
  passed: boolean;
  /** Present when a rail blocked execution */
  blocked?: { rail: string; reason: string };
  /** Non-blocking warnings (PII in output, low quality, etc.) */
  warnings: string[];
  /** Input with PII redacted (if PII was found) */
  sanitizedInput?: string;
  /** Output with PII redacted (if PII was found) */
  sanitizedOutput?: string;
}

// ─────────────────────────────────────────────
// Rate Limiter (in-memory, per-user per-agent)
// ─────────────────────────────────────────────

interface RateEntry {
  timestamps: number[];
}

/** userId:agentName -> execution timestamps */
const rateLedger = new Map<string, RateEntry>();

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_MAX_EXECUTIONS = 60;      // per user per agent per hour

/** Agent-specific rate limits — override default for heavy agents */
const AGENT_RATE_LIMITS: Record<string, number> = {
  "god-brain": 20,
  "war-room": 15,
  "computer-use": 10,
  "image-gen": 30,
  "smart-router": 40,
};

function checkRateLimit(userId: string, agentName: string): { allowed: boolean; remaining: number } {
  const key = `${userId}:${agentName}`;
  const now = Date.now();
  const maxExec = AGENT_RATE_LIMITS[agentName] ?? DEFAULT_MAX_EXECUTIONS;

  let entry = rateLedger.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLedger.set(key, entry);
  }

  // Evict timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < RATE_WINDOW_MS);

  if (entry.timestamps.length >= maxExec) {
    return { allowed: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: maxExec - entry.timestamps.length };
}

// Periodic cleanup to prevent memory leaks in long-running processes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLedger.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < RATE_WINDOW_MS);
      if (entry.timestamps.length === 0) rateLedger.delete(key);
    }
  }, 5 * 60 * 1000); // clean every 5 minutes
}

// ─────────────────────────────────────────────
// PII Scanner (reuses patterns from agent-factory, expanded)
// ─────────────────────────────────────────────

interface PiiEntity {
  type: string;
  match: string;
  index: number;
}

const PII_PATTERNS: Array<{ type: string; regex: RegExp; redact: string }> = [
  { type: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, redact: "[EMAIL_REDACTED]" },
  { type: "PHONE", regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, redact: "[PHONE_REDACTED]" },
  { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g, redact: "[SSN_REDACTED]" },
  { type: "CREDIT_CARD", regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, redact: "[CC_REDACTED]" },
  { type: "IP_ADDRESS", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, redact: "[IP_REDACTED]" },
  { type: "AWS_KEY", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, redact: "[AWS_KEY_REDACTED]" },
  { type: "API_KEY", regex: /\b(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|xox[bpas]-[a-zA-Z0-9-]+)\b/g, redact: "[API_KEY_REDACTED]" },
];

function scanPii(text: string): { entities: PiiEntity[]; redacted: string } {
  const entities: PiiEntity[] = [];
  let redacted = text;

  for (const { type, regex, redact } of PII_PATTERNS) {
    // Reset regex state for each scan
    const re = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      entities.push({ type, match: match[0].slice(0, 4) + "***", index: match.index });
    }
    redacted = redacted.replace(new RegExp(regex.source, regex.flags), redact);
  }

  return { entities, redacted };
}

// ─────────────────────────────────────────────
// Topic Control
// ─────────────────────────────────────────────

function checkTopicRelevance(input: string, allowedTopics: string[]): { onTopic: boolean; suggestion: string } {
  if (allowedTopics.length === 0) return { onTopic: true, suggestion: "" };

  const lower = input.toLowerCase();

  // Short inputs get a pass (could be a URL, filename, etc.)
  if (lower.length < 40) return { onTopic: true, suggestion: "" };

  // Check if any allowed topic keyword appears in the input
  const matched = allowedTopics.some((topic) => {
    const topicLower = topic.toLowerCase();
    // Support multi-word topics by checking each word individually
    const topicWords = topicLower.split(/\s+/);
    if (topicWords.length > 1) {
      return topicWords.every((word) => lower.includes(word));
    }
    return lower.includes(topicLower);
  });

  if (matched) return { onTopic: true, suggestion: "" };

  return {
    onTopic: false,
    suggestion: `This agent specializes in: ${allowedTopics.join(", ")}. Your request appears to be outside these areas. Try the Sovereign Assistant for general queries.`,
  };
}

// ─────────────────────────────────────────────
// Hallucination Detection (output rail)
// ─────────────────────────────────────────────

interface HallucinationFlag {
  type: string;
  evidence: string;
  severity: "low" | "medium" | "high";
}

function detectHallucinations(output: string): HallucinationFlag[] {
  const flags: HallucinationFlag[] = [];

  // 1. Fabricated URLs — domains that look auto-generated
  const urlMatches = output.match(/https?:\/\/[^\s)"\]]+/g) || [];
  for (const url of urlMatches) {
    try {
      const hostname = new URL(url).hostname;
      // Flag suspicious TLDs or obviously fake domains
      if (
        /example\d+\.com|fake(?:site|url|domain)|test(?:site|page)\d*\./.test(hostname) ||
        /[a-z]{20,}\.com/.test(hostname) // excessively long single-word domains
      ) {
        flags.push({ type: "FABRICATED_URL", evidence: url.slice(0, 60), severity: "high" });
      }
    } catch {
      // Malformed URL — suspicious
      flags.push({ type: "MALFORMED_URL", evidence: url.slice(0, 60), severity: "medium" });
    }
  }

  // 2. Fake statistics — overly precise numbers with no source
  const statPatterns = [
    /(?:studies?\s+(?:show|indicate|prove|reveal|confirm|suggest)s?\s+(?:that\s+)?)\d{2,3}(?:\.\d+)?%/gi,
    /\b(?:according\s+to\s+(?:a\s+)?(?:recent\s+)?(?:study|report|survey|research))\b.*?\d{2,3}(?:\.\d+)?%/gi,
  ];
  for (const pattern of statPatterns) {
    const match = pattern.exec(output);
    if (match) {
      flags.push({ type: "UNVERIFIED_STATISTIC", evidence: match[0].slice(0, 80), severity: "medium" });
    }
  }

  // 3. Non-existent companies/products — common LLM fabrication patterns
  const fabricationSignals = [
    /\b(?:founded\s+in\s+\d{4}\s+by\s+[A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,  // "founded in 2019 by John Smith"
    /\b(?:a\s+leading\s+(?:provider|company|firm|platform)\s+(?:of|for|in)\s+)/gi,
  ];
  for (const pattern of fabricationSignals) {
    const match = pattern.exec(output);
    if (match) {
      flags.push({ type: "POTENTIAL_FABRICATION", evidence: match[0].slice(0, 80), severity: "low" });
    }
  }

  // 4. Confident claims about real-time data the model cannot have
  const realtimePatterns = [
    /\b(?:as\s+of\s+(?:today|right\s+now|this\s+moment|the\s+current\s+time))\b/gi,
    /\b(?:the\s+current\s+(?:stock\s+)?price\s+(?:of|is|for))\b/gi,
    /\b(?:currently\s+trading\s+at\s+\$[\d,.]+)\b/gi,
    /\b(?:live\s+(?:data|feed|stream)\s+shows)\b/gi,
  ];
  for (const pattern of realtimePatterns) {
    const match = pattern.exec(output);
    if (match) {
      flags.push({ type: "REALTIME_CLAIM", evidence: match[0].slice(0, 80), severity: "high" });
    }
  }

  // 5. Fabricated citations — "[1] Author, Title (Year)" patterns with no real source
  const citationPattern = /\[\d+\]\s+[A-Z][a-z]+(?:\s+(?:et\s+al\.|&\s+[A-Z][a-z]+)),?\s+[""]?.+?[""]?\s*\(\d{4}\)/g;
  const citations = output.match(citationPattern) || [];
  if (citations.length >= 3) {
    flags.push({
      type: "SUSPICIOUS_CITATIONS",
      evidence: `${citations.length} academic-style citations detected — verify sources`,
      severity: "medium",
    });
  }

  return flags;
}

// ─────────────────────────────────────────────
// Moderation Rail
// ─────────────────────────────────────────────

interface ModerationFlag {
  category: string;
  evidence: string;
  severity: "low" | "medium" | "high";
}

function runModeration(text: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];

  // Harmful content patterns
  const harmPatterns: Array<{ category: string; patterns: RegExp[]; severity: "low" | "medium" | "high" }> = [
    {
      category: "VIOLENCE",
      patterns: [
        /\b(?:how\s+to\s+(?:make|build|create)\s+(?:a\s+)?(?:bomb|weapon|explosive))\b/i,
        /\b(?:instructions?\s+(?:for|to)\s+(?:harm|kill|injure|attack))\b/i,
      ],
      severity: "high",
    },
    {
      category: "HATE_SPEECH",
      patterns: [
        /\b(?:(?:all|every)\s+(?:\w+\s+)?(?:people|persons?|men|women)\s+(?:are|should)\s+(?:be\s+)?(?:eliminated|removed|killed|banned))\b/i,
      ],
      severity: "high",
    },
    {
      category: "SELF_HARM",
      patterns: [
        /\b(?:how\s+to\s+(?:commit|attempt)\s+(?:suicide|self[- ]harm))\b/i,
        /\b(?:methods?\s+(?:of|for)\s+(?:suicide|self[- ]harm|ending\s+(?:my|your|one'?s?)\s+life))\b/i,
      ],
      severity: "high",
    },
    {
      category: "ILLEGAL_ACTIVITY",
      patterns: [
        /\b(?:how\s+to\s+(?:hack|break\s+into|steal|forge|counterfeit))\b/i,
        /\b(?:instructions?\s+(?:for|to)\s+(?:launder|embezzle|defraud|blackmail))\b/i,
      ],
      severity: "high",
    },
    {
      category: "LEGAL_RISK",
      patterns: [
        /\b(?:this\s+(?:constitutes?|is)\s+(?:legal|financial|medical)\s+advice)\b/i,
        /\b(?:(?:i|we)\s+(?:guarantee|promise|warrant)\s+(?:that|this))\b/i,
        /\b(?:(?:you\s+)?(?:should|must)\s+(?:invest|buy|sell)\s+(?:stocks?|crypto|bitcoin))\b/i,
      ],
      severity: "medium",
    },
    {
      category: "BIAS",
      patterns: [
        /\b(?:(?:men|women|males?|females?)\s+are\s+(?:naturally|inherently|biologically)\s+(?:better|worse|smarter|dumber|superior|inferior)\s+(?:at|than|in))\b/i,
        /\b(?:(?:race|ethnicity|religion)\s+(?:determines?|predicts?|explains?)\s+(?:intelligence|ability|success))\b/i,
      ],
      severity: "medium",
    },
  ];

  for (const { category, patterns, severity } of harmPatterns) {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        flags.push({ category, evidence: match[0].slice(0, 80), severity });
      }
    }
  }

  return flags;
}

// ─────────────────────────────────────────────
// Main Pipeline
// ─────────────────────────────────────────────

export async function runGuardrails(config: GuardrailsConfig): Promise<GuardrailsResult> {
  const { input, output, agentName, userId, allowedTopics } = config;
  const warnings: string[] = [];
  let sanitizedInput: string | undefined;
  let sanitizedOutput: string | undefined;

  const startMs = Date.now();

  // ─── Rail 1: Rate Limiting ───
  const rateResult = checkRateLimit(userId, agentName);
  if (!rateResult.allowed) {
    log.warn("Rate limit exceeded", { userId, agentName });
    return {
      passed: false,
      blocked: {
        rail: "rate",
        reason: `Rate limit exceeded for agent "${agentName}". Please wait before making more requests.`,
      },
      warnings,
    };
  }
  if (rateResult.remaining <= 5) {
    warnings.push(`Rate limit warning: ${rateResult.remaining} executions remaining this hour for "${agentName}".`);
  }

  // ─── Rail 2: Topic Control ───
  if (allowedTopics && allowedTopics.length > 0) {
    const topicResult = checkTopicRelevance(input, allowedTopics);
    if (!topicResult.onTopic) {
      log.info("Off-topic blocked", { agentName, userId });
      return {
        passed: false,
        blocked: { rail: "topic", reason: topicResult.suggestion },
        warnings,
      };
    }
  }

  // ─── Rail 3: Input Rails (jailbreak + content safety + PII) ───
  if (input.length > 10) {
    // 3a. Jailbreak detection
    const jailbreakResult = await detectJailbreak(input);
    if (jailbreakResult.blocked) {
      log.warn("Input rail: jailbreak blocked", { agentName, category: jailbreakResult.category });
      return {
        passed: false,
        blocked: {
          rail: "input:jailbreak",
          reason: `Prompt injection detected: ${jailbreakResult.reason}`,
        },
        warnings,
      };
    }

    // 3b. Content safety
    if (input.length > 20) {
      const safetyResult = await checkContentSafety(input);
      if (!safetyResult.safe) {
        log.warn("Input rail: content safety blocked", { agentName, category: safetyResult.category });
        return {
          passed: false,
          blocked: {
            rail: "input:content_safety",
            reason: `Content safety violation: ${safetyResult.reason}`,
          },
          warnings,
        };
      }
    }

    // 3c. PII scan on input
    const inputPii = scanPii(input);
    if (inputPii.entities.length > 0) {
      sanitizedInput = inputPii.redacted;
      warnings.push(
        `Input contains ${inputPii.entities.length} PII item(s): ${[...new Set(inputPii.entities.map((e) => e.type))].join(", ")}. Auto-redacted.`
      );
      log.info("Input PII detected and redacted", { agentName, count: inputPii.entities.length });
    }
  }

  // ─── Rail 4: Moderation on input ───
  const inputModFlags = runModeration(input);
  const highSeverityInput = inputModFlags.filter((f) => f.severity === "high");
  if (highSeverityInput.length > 0) {
    log.warn("Input moderation blocked", { agentName, categories: highSeverityInput.map((f) => f.category) });
    return {
      passed: false,
      blocked: {
        rail: "moderation:input",
        reason: `Content flagged: ${highSeverityInput.map((f) => f.category).join(", ")}. This type of request cannot be processed.`,
      },
      warnings,
    };
  }
  // Medium/low severity input flags are warnings
  for (const flag of inputModFlags) {
    if (flag.severity !== "high") {
      warnings.push(`Moderation notice (input, ${flag.severity}): ${flag.category}`);
    }
  }

  // ─── Output Rails (only run when output is provided) ───
  if (output && output.length > 0) {
    // ─── Rail 5a: PII scan on output ───
    const outputPii = scanPii(output);
    if (outputPii.entities.length > 0) {
      sanitizedOutput = outputPii.redacted;
      warnings.push(
        `Output contains ${outputPii.entities.length} PII item(s): ${[...new Set(outputPii.entities.map((e) => e.type))].join(", ")}. Auto-redacted.`
      );
      log.info("Output PII detected and redacted", { agentName, count: outputPii.entities.length });
    }

    // ─── Rail 5b: Hallucination detection ───
    const hallucinationFlags = detectHallucinations(output);
    if (hallucinationFlags.length > 0) {
      const highHalluc = hallucinationFlags.filter((f) => f.severity === "high");
      for (const flag of hallucinationFlags) {
        warnings.push(`Hallucination check (${flag.severity}): ${flag.type} — ${flag.evidence}`);
      }
      // Block on multiple high-severity hallucination signals
      if (highHalluc.length >= 2) {
        log.warn("Output blocked: multiple hallucination signals", { agentName, count: highHalluc.length });
        return {
          passed: false,
          blocked: {
            rail: "output:hallucination",
            reason: `Response contains ${highHalluc.length} high-severity hallucination indicators. Regeneration recommended.`,
          },
          warnings,
          sanitizedInput,
          sanitizedOutput,
        };
      }
    }

    // ─── Rail 5c: Moderation on output ───
    const outputModFlags = runModeration(output);
    const highSeverityOutput = outputModFlags.filter((f) => f.severity === "high");
    if (highSeverityOutput.length > 0) {
      log.warn("Output moderation blocked", { agentName, categories: highSeverityOutput.map((f) => f.category) });
      return {
        passed: false,
        blocked: {
          rail: "moderation:output",
          reason: `Agent response flagged: ${highSeverityOutput.map((f) => f.category).join(", ")}. Response suppressed.`,
        },
        warnings,
        sanitizedInput,
        sanitizedOutput,
      };
    }
    for (const flag of outputModFlags) {
      if (flag.severity !== "high") {
        warnings.push(`Moderation notice (output, ${flag.severity}): ${flag.category}`);
      }
    }

    // ─── Rail 5d: Content safety on output ───
    if (output.length > 20) {
      const outputSafety = await checkContentSafety(output);
      if (!outputSafety.safe) {
        log.warn("Output content safety blocked", { agentName, category: outputSafety.category });
        return {
          passed: false,
          blocked: {
            rail: "output:content_safety",
            reason: `Agent response blocked by safety filter: ${outputSafety.reason}`,
          },
          warnings,
          sanitizedInput,
          sanitizedOutput,
        };
      }
    }
  }

  const durationMs = Date.now() - startMs;
  log.info("Guardrails passed", { agentName, durationMs, warningCount: warnings.length });

  return {
    passed: true,
    warnings,
    sanitizedInput,
    sanitizedOutput,
  };
}

// ─────────────────────────────────────────────
// Utility Exports (for use in agent-factory or standalone)
// ─────────────────────────────────────────────

export { scanPii, detectHallucinations, runModeration, checkRateLimit, checkTopicRelevance };
export type { PiiEntity, HallucinationFlag, ModerationFlag };
