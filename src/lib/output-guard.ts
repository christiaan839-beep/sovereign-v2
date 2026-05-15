/**
 * SOVEREIGN MATRIX — Output-side guard (Cook 97).
 *
 * Mirrors Cook 44 / 96 input-side red-team patterns on the agent's
 * OUTPUT. The threat model: a prompt-injected agent could still emit
 * a system-prompt leak, a "I am DAN" persona slip, or an exfiltration
 * marker — even if its input passed every guard.
 *
 * Six leak classes flagged:
 *
 *   - system-prompt-leak       — explicit "my system prompt is..."
 *   - credential-leak          — "sk-...", "api-key:", base64 secrets
 *   - persona-slip             — "I am DAN", "I am [unrestricted AI]"
 *   - directive-acceptance     — "Confirmed, I will ignore..."
 *   - tool-output-spoof        — fake [END USER] / [BEGIN ASSISTANT]
 *   - pii-style                — bare SSN / credit-card / private email leak
 *
 * Pure module. Caller decides the action — block, redact, mark for
 * human review, or just log. This is the second sheet of armour
 * behind the existing 6-layer verifier pipeline.
 */

export type LeakClass =
  | "system-prompt-leak"
  | "credential-leak"
  | "persona-slip"
  | "directive-acceptance"
  | "tool-output-spoof"
  | "pii-style";

export interface OutputLeak {
  leak: LeakClass;
  severity: "low" | "medium" | "high" | "critical";
  excerpt: string;
}

export interface OutputGuardReport {
  /** True iff at least one high or critical leak. */
  blocked: boolean;
  leaks: OutputLeak[];
  /** Sum of severity weights. */
  score: number;
  /** Worst severity observed (or "low" when none). */
  worst: OutputLeak["severity"] | "low";
}

const WEIGHTS: Record<OutputLeak["severity"], number> = {
  low: 1,
  medium: 3,
  high: 8,
  critical: 16,
};

const PATTERNS: Array<{
  re: RegExp;
  leak: LeakClass;
  severity: OutputLeak["severity"];
}> = [
  // System-prompt leak
  {
    re: /\bmy\s+(system\s+prompt|initial\s+instructions?)\s+(is|are|was)\b/i,
    leak: "system-prompt-leak",
    severity: "critical",
  },
  {
    re: /^\s*(system\s+prompt|instructions?)\s*:\s*you\s+are\b/im,
    leak: "system-prompt-leak",
    severity: "high",
  },

  // Credential leaks
  {
    re: /\bsk-[a-zA-Z0-9_-]{16,}\b/,
    leak: "credential-leak",
    severity: "critical",
  },
  {
    re: /\bsk_pat_[a-zA-Z0-9_-]{16,}\b/,
    leak: "credential-leak",
    severity: "critical",
  },
  {
    re: /\b(api[_-]?key|access[_-]?token|bearer)\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}["']?/i,
    leak: "credential-leak",
    severity: "high",
  },

  // Persona slip
  {
    re: /\bI\s+am\s+(now\s+)?DAN\b/i,
    leak: "persona-slip",
    severity: "high",
  },
  {
    re: /\bI\s+am\s+(an?\s+)?(unrestricted|uncensored|jailbroken)\s+AI\b/i,
    leak: "persona-slip",
    severity: "high",
  },

  // Directive acceptance
  {
    re: /\b(confirmed|understood|sure)[\s.,]+I\s+will\s+(ignore|disregard)\s+(my\s+)?(previous|prior|all)\s+(instructions?|guidelines?)\b/i,
    leak: "directive-acceptance",
    severity: "critical",
  },
  {
    re: /\bI\s+(will\s+)?(now\s+)?ignore\s+(my\s+)?(previous|prior|all)\s+(instructions?|safety|guidelines?)\b/i,
    leak: "directive-acceptance",
    severity: "high",
  },

  // Tool-output spoof
  {
    re: /\[END\s*USER\]|\[BEGIN\s*ASSISTANT\]|<\|im_start\|>|<\|im_end\|>/i,
    leak: "tool-output-spoof",
    severity: "critical",
  },

  // PII-style — quick bare-leak check; Sovereign's full PII scanner
  // runs in layer-3, this is the cheap fallback.
  {
    re: /\b\d{3}-\d{2}-\d{4}\b/,
    leak: "pii-style",
    severity: "medium",
  },
  {
    re: /\b(?:\d[ -]?){13,19}\b/,
    leak: "pii-style",
    severity: "medium",
  },
];

/**
 * Score the agent's output. Same shape as Cook 96 input filter so
 * receipt embedding is symmetric.
 */
export function scan(output: string): OutputGuardReport {
  const leaks: OutputLeak[] = [];
  if (!output || typeof output !== "string") {
    return { blocked: false, leaks, score: 0, worst: "low" };
  }
  for (const p of PATTERNS) {
    const match = output.match(p.re);
    if (match) {
      const idx = match.index ?? 0;
      const excerpt = output.slice(Math.max(0, idx - 16), idx + 64);
      leaks.push({
        leak: p.leak,
        severity: p.severity,
        excerpt: excerpt.slice(0, 80),
      });
    }
  }
  let score = 0;
  let worst: OutputLeak["severity"] | "low" = "low";
  const order = ["low", "medium", "high", "critical"] as const;
  for (const l of leaks) {
    score += WEIGHTS[l.severity];
    if (order.indexOf(l.severity) > order.indexOf(worst as "low")) {
      worst = l.severity;
    }
  }
  return {
    blocked: worst === "high" || worst === "critical",
    leaks,
    score,
    worst,
  };
}

/**
 * Redact obvious credential leaks from the output. Leaves the
 * surrounding context intact so the model still reports an
 * informative answer; just sanitises the secret-shaped tokens.
 */
export function redact(output: string): string {
  return output
    .replace(/\bsk-[a-zA-Z0-9_-]{16,}\b/g, "[REDACTED:KEY]")
    .replace(/\bsk_pat_[a-zA-Z0-9_-]{16,}\b/g, "[REDACTED:PAT]")
    .replace(
      /(\b(?:api[_-]?key|access[_-]?token|bearer)\s*[:=]\s*["']?)[A-Za-z0-9_\-]{12,}(["']?)/gi,
      "$1[REDACTED]$2",
    );
}
