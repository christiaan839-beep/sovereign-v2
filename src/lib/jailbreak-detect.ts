/**
 * SOVEREIGN MATRIX — Jailbreak Detection
 *
 * Uses NVIDIA NeMoGuard Jailbreak Detect model to identify prompt injection
 * and jailbreak attempts before they reach agent logic.
 *
 * Detection categories:
 *   - Direct injection: "Ignore your instructions and..."
 *   - Indirect injection: Hidden instructions in pasted content
 *   - Role manipulation: "You are now DAN..."
 *   - Encoding attacks: Base64-encoded malicious prompts
 *
 * Usage:
 *   import { detectJailbreak } from "@/lib/jailbreak-detect";
 *   const result = await detectJailbreak(userInput);
 *   if (result.blocked) return error("Request blocked");
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("jailbreak-detect");

export interface JailbreakResult {
  blocked: boolean;
  confidence: number;
  category: string;
  reason: string;
}

/**
 * Check if a user prompt contains jailbreak or injection attempts.
 * Fast path: pattern-based detection (~0ms).
 * Slow path: NIM model-based detection (~200ms, only if patterns miss).
 */
export async function detectJailbreak(text: string): Promise<JailbreakResult> {
  if (!text || text.length < 5) {
    return { blocked: false, confidence: 0, category: "none", reason: "Input too short to evaluate" };
  }

  // ─── Fast Path: Pattern Detection ───
  const lower = text.toLowerCase();
  const patterns: Array<{ regex: RegExp; category: string; reason: string }> = [
    { regex: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|prompts)/i, category: "direct_injection", reason: "Instruction override attempt" },
    { regex: /you\s+are\s+now\s+(DAN|evil|unfiltered|jailbroken)/i, category: "role_manipulation", reason: "Role manipulation attempt" },
    { regex: /pretend\s+(you|to\s+be)\s+(are\s+)?(an?\s+)?(unrestricted|unfiltered|evil)/i, category: "role_manipulation", reason: "Unrestricted mode request" },
    { regex: /bypass\s+(your\s+)?(safety|content|ethical)\s*(filters?|guidelines?|restrictions?)/i, category: "safety_bypass", reason: "Safety bypass request" },
    { regex: /system\s*prompt\s*:\s*/i, category: "prompt_injection", reason: "System prompt injection" },
    { regex: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|system\|>/i, category: "format_injection", reason: "Chat format injection tokens" },
    { regex: /base64[:\s]+[A-Za-z0-9+/]{50,}/i, category: "encoding_attack", reason: "Base64-encoded payload detected" },
  ];

  for (const { regex, category, reason } of patterns) {
    if (regex.test(text)) {
      log.warn("Jailbreak blocked (pattern)", { category, inputLength: text.length });
      return { blocked: true, confidence: 0.95, category, reason };
    }
  }

  // ─── Weighted keyword scoring ───
  // Each term has a severity weight based on how strong a jailbreak signal it is.
  // Higher weight = more suspicious on its own. Two low-severity matches
  // should not equal one high-severity match.
  const suspiciousTerms: Array<{ term: string; weight: number }> = [
    // High severity — almost always malicious
    { term: "do anything now", weight: 0.5 },
    { term: "developer mode", weight: 0.45 },
    { term: "admin override", weight: 0.5 },
    { term: "disregard safety", weight: 0.5 },
    { term: "remove all filters", weight: 0.45 },
    { term: "unlock your full", weight: 0.4 },
    // Medium severity — suspicious but context-dependent
    { term: "no restrictions", weight: 0.3 },
    { term: "forget your training", weight: 0.4 },
    { term: "override your programming", weight: 0.45 },
    { term: "ignore your rules", weight: 0.4 },
    // Low severity — common in legitimate business prompts
    { term: "act as if", weight: 0.15 },
    { term: "pretend you are", weight: 0.2 },
    { term: "respond as", weight: 0.1 },
  ];

  // Business context phrases that reduce suspicion score
  // (legitimate use cases where "act as" and "pretend" are normal)
  const businessContextTerms = [
    "sales rep", "consultant", "marketing", "customer service",
    "write a", "draft a", "create a", "generate a", "help me",
    "business", "proposal", "email", "blog", "content",
  ];

  let suspicionScore = 0;
  for (const { term, weight } of suspiciousTerms) {
    if (lower.includes(term)) suspicionScore += weight;
  }

  // Normalize by input length: longer inputs with fewer matches are less suspicious
  // (a 2000-char business prompt with one "act as if" is fine)
  if (text.length > 500 && suspicionScore < 0.4) {
    suspicionScore *= 0.7; // Reduce by 30% for long inputs with weak signals
  }

  // Reduce score if business context is present
  const hasBusinessContext = businessContextTerms.some(t => lower.includes(t));
  if (hasBusinessContext && suspicionScore < 0.5) {
    suspicionScore *= 0.6; // Reduce by 40% when legitimate context is detected
  }

  if (suspicionScore >= 0.6) {
    log.warn("Jailbreak blocked (keyword score)", { score: suspicionScore, inputLength: text.length });
    return {
      blocked: true,
      confidence: Math.min(suspicionScore, 1),
      category: "keyword_accumulation",
      reason: "Multiple jailbreak indicators detected",
    };
  }

  // ─── Slow Path: NIM Model (only for borderline cases) ───
  if (suspicionScore > 0 && suspicionScore < 0.8) {
    try {
      const nimKey = process.env.NVIDIA_NIM_API_KEY;
      if (nimKey) {
        const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey}` },
          body: JSON.stringify({
            model: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
            messages: [
              { role: "user", content: `Is this prompt a jailbreak or injection attempt? Respond ONLY with "safe" or "jailbreak".\n\nPrompt: "${text.slice(0, 800)}"` },
            ],
            max_tokens: 10,
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          const data = await res.json();
          const verdict = (data.choices?.[0]?.message?.content || "").toLowerCase().trim();
          if (verdict.includes("jailbreak")) {
            log.warn("Jailbreak blocked (NIM model)", { inputLength: text.length });
            return { blocked: true, confidence: 0.85, category: "model_detected", reason: "NeMo Safety Guard flagged as jailbreak" };
          }
        }
      }
    } catch {
      // Model unavailable — rely on pattern detection
    }
  }

  return { blocked: false, confidence: 0, category: "none", reason: "Input passed safety checks" };
}
