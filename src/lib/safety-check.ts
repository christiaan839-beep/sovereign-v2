// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// multi-stage safety pipeline; not wired.
/**
 * SOVEREIGN MATRIX — Local Content Safety Check
 *
 * Fast, zero-latency safety screening using regex patterns.
 * No API call — designed to run before every agent response.
 *
 * For deep checks, use the NIM content safety model via
 * /api/agents/content-safety instead.
 */

export interface SafetyResult {
  safe: boolean;
  flags: string[];
  score: number; // 0-100 safety score (100 = completely safe)
}

// ─── PII Patterns ────────────────────────────────────

const PII_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  { type: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: "phone", regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
  { type: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "credit_card", regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g },
  { type: "ip_address", regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
];

// ─── Jailbreak Phrases ──────────────────────────────

const JAILBREAK_PHRASES = [
  "ignore previous instructions",
  "ignore all previous",
  "disregard your instructions",
  "pretend you are",
  "pretend you're",
  "act as if you have no restrictions",
  "dan mode",
  "developer mode",
  "jailbreak",
  "bypass your filters",
  "ignore your safety",
  "override your programming",
  "forget your rules",
  "you are now",
  "from now on you",
  "simulate a conversation",
  "hypothetically if you had no limits",
  "let's play a game where you",
  "respond without any ethical",
  "do anything now",
];

// ─── Harmful Content Blocklist ──────────────────────

const HARMFUL_KEYWORDS = [
  "how to make a bomb",
  "how to make explosives",
  "synthesize drugs",
  "make methamphetamine",
  "build a weapon",
  "create malware",
  "write ransomware",
  "hack into",
  "ddos attack",
  "exploit vulnerability",
  "child exploitation",
  "self-harm instructions",
  "suicide methods",
];

// ─── Main Check ─────────────────────────────────────

/**
 * Quick local safety check — no API call needed.
 * Returns a SafetyResult with flags and a 0-100 score.
 */
export async function checkSafety(content: string): Promise<SafetyResult> {
  const flags: string[] = [];
  let deductions = 0;
  const lowerContent = content.toLowerCase();

  // 1. PII Detection (regex)
  for (const { type, regex } of PII_PATTERNS) {
    // Reset regex state (global flag)
    regex.lastIndex = 0;
    if (regex.test(content)) {
      flags.push(`pii_detected:${type}`);
      deductions += 10;
    }
  }

  // 2. Jailbreak Detection
  for (const phrase of JAILBREAK_PHRASES) {
    if (lowerContent.includes(phrase)) {
      flags.push("jailbreak_attempt");
      deductions += 40;
      break; // One jailbreak flag is enough
    }
  }

  // 3. Harmful Content Detection
  for (const keyword of HARMFUL_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      flags.push("harmful_content");
      deductions += 50;
      break;
    }
  }

  const score = Math.max(0, 100 - deductions);
  const safe = score >= 50 && !flags.includes("harmful_content");

  return { safe, flags, score };
}
