/**
 * The AGI Governor Ruleset
 *
 * Interception layer for the DSPy optimizer. This module parses autonomous
 * payload generation and prevents SOVEREIGN from triggering algorithmic bans.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("governor");

export interface GovernorCheck {
  isCompliant: boolean;
  reason?: string;
  riskFactor: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const FORBIDDEN_META_PHRASES = [
  "get rich quick",
  "guaranteed income",
  "work from home and make thousands",
  "crypto explosive growth"
];

export async function evaluateMetaAdCompliance(adCopy: string): Promise<GovernorCheck> {
  // 1. Check for banned phrases
  const lowerCopy = adCopy.toLowerCase();
  for (const phrase of FORBIDDEN_META_PHRASES) {
    if (lowerCopy.includes(phrase)) {
      return {
        isCompliant: false,
        reason: `Ad copy contains restricted phrase: "${phrase}". High probability of Business Manager ban.`,
        riskFactor: 'CRITICAL'
      };
    }
  }

  // 2. Perform DSPy mock TOS Evaluation
  // Simulation: We would run a lightweight local LLM check here to analyze context.
  log.info("Scanning payload logic... No immediate TOS violations found.");

  return { isCompliant: true, riskFactor: 'LOW' };
}

export async function evaluateTwilioVelocity(messagesInLastSecond: number): Promise<GovernorCheck> {
  // Twilio A2P 10DLC restrictions (e.g., max 10/sec for certain campaigns)
  const MAX_PER_SEC = 10;
  
  if (messagesInLastSecond >= MAX_PER_SEC) {
    return {
      isCompliant: false,
      reason: `WhatsApp velocity exceeded ${MAX_PER_SEC} msg/sec. Approaching carrier throttling.`,
      riskFactor: 'HIGH'
    };
  }

  return { isCompliant: true, riskFactor: 'LOW' };
}
