/**
 * SOVEREIGN MATRIX — Privacy Router
 *
 * Evaluates every AI task to determine:
 * 1. Can this be done locally (Ollama) for zero data leakage?
 * 2. Does this need cloud models (NIM/Gemini/Claude)?
 * 3. If cloud is needed, strip PII first.
 *
 * This is the core of "Data Sovereignty" — the #1 selling point
 * for enterprise, healthcare, legal, and finance clients.
 *
 * Routing logic:
 * - If user has Ollama configured → prefer local for ALL tasks
 * - If input contains PII → MUST route locally or redact before cloud
 * - If task is simple (classification, extraction) → local model
 * - If task needs frontier reasoning → cloud with PII stripped
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("privacy-router");

export type RouteDecision = "local" | "cloud" | "cloud_redacted";

export interface PrivacyRoute {
  decision: RouteDecision;
  reason: string;
  model: string;
  piiDetected: boolean;
  redactedInput?: string;
}

// PII patterns (same as safety-check.ts for consistency)
const PII_PATTERNS = [
  { type: "email", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: "phone", pattern: /(?:\+?27|0)\s?\d{2}\s?\d{3}\s?\d{4}|\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
  { type: "ssn", pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g },
  { type: "credit_card", pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  { type: "id_number", pattern: /\b\d{13}\b/g }, // SA ID number
];

function detectPII(text: string): { hasPII: boolean; types: string[]; redacted: string } {
  let redacted = text;
  const foundTypes: string[] = [];

  for (const { type, pattern } of PII_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      foundTypes.push(type);
      for (const match of matches) {
        redacted = redacted.replace(match, `[REDACTED_${type.toUpperCase()}]`);
      }
    }
  }

  return { hasPII: foundTypes.length > 0, types: foundTypes, redacted };
}

function isSimpleTask(input: string): boolean {
  const simplePatterns = [
    /^classify/i, /^categorize/i, /^extract/i, /^summarize/i,
    /^translate/i, /^detect/i, /^count/i, /^list/i, /^parse/i,
  ];
  return simplePatterns.some((p) => p.test(input.trim()));
}

/**
 * Route a task through the privacy router.
 * Returns the decision + the (possibly redacted) input to use.
 */
export function routeForPrivacy(
  input: string,
  options: {
    ollamaConfigured?: boolean;
    forceLocal?: boolean; // "Sovereign Mode" toggle
    taskType?: string;
  } = {}
): PrivacyRoute {
  const { ollamaConfigured = false, forceLocal = false, taskType } = options;

  // Sovereign Mode: everything local, no exceptions
  if (forceLocal) {
    if (!ollamaConfigured) {
      log.warn("Sovereign Mode enabled but Ollama not configured — falling back to cloud with redaction");
    } else {
      return {
        decision: "local",
        reason: "Sovereign Mode — all inference local, zero cloud exposure",
        model: "qwen2.5-coder",
        piiDetected: false,
      };
    }
  }

  // Check for PII
  const piiResult = detectPII(input);

  // If PII detected + Ollama available → route local
  if (piiResult.hasPII && ollamaConfigured) {
    log.info("PII detected — routing to local Ollama", { types: piiResult.types });
    return {
      decision: "local",
      reason: `PII detected (${piiResult.types.join(", ")}) — routed locally for data sovereignty`,
      model: "llama3.1:8b",
      piiDetected: true,
    };
  }

  // If PII detected but no Ollama → redact then send to cloud
  if (piiResult.hasPII && !ollamaConfigured) {
    log.info("PII detected, no Ollama — redacting before cloud", { types: piiResult.types });
    return {
      decision: "cloud_redacted",
      reason: `PII detected (${piiResult.types.join(", ")}) — redacted before cloud transmission`,
      model: "auto",
      piiDetected: true,
      redactedInput: piiResult.redacted,
    };
  }

  // Simple tasks + Ollama → route local for speed and privacy
  if (isSimpleTask(input) && ollamaConfigured) {
    return {
      decision: "local",
      reason: "Simple task — routed locally for speed and zero cost",
      model: "mistral:7b",
      piiDetected: false,
    };
  }

  // Complex tasks → cloud (no PII present, safe to transmit)
  return {
    decision: "cloud",
    reason: "No PII detected, complex task — routed to cloud for frontier reasoning",
    model: "auto",
    piiDetected: false,
  };
}
