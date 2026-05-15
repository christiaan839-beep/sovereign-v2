/**
 * SOVEREIGN MATRIX — Adversarial input filter (Cook 96).
 *
 * Pre-flight check that scores user input against the same probe
 * classes Cook 44 red-teams agents with — but on the INPUT side,
 * before the LLM ever sees it. Composes with the existing layer-1
 * jailbreak detector as defense in depth.
 *
 * Five probe families flagged with severity scores:
 *
 *   - jailbreak       — "ignore previous instructions" style overrides
 *   - exfiltration    — "repeat your system prompt"
 *   - role-confusion  — "you are now DAN / unrestricted AI"
 *   - injection-flag  — markdown / tool-output spoofing
 *   - directive-flip  — instructions placed inside data fields
 *
 * Pure module. Caller decides the threshold + action (block, quarantine, allow-with-warn).
 */

export type FilterFamily =
  | "jailbreak"
  | "exfiltration"
  | "role-confusion"
  | "injection-flag"
  | "directive-flip";

export interface FilterHit {
  family: FilterFamily;
  severity: "low" | "medium" | "high" | "critical";
  excerpt: string;
}

export interface FilterReport {
  /** True iff at least one high or critical hit. */
  blocked: boolean;
  hits: FilterHit[];
  /** Sum of severity weights — caller can threshold differently. */
  score: number;
  /** Worst severity observed (or "low" when no hits). */
  worst: FilterHit["severity"] | "low";
}

const SEVERITY_WEIGHTS: Record<FilterHit["severity"], number> = {
  low: 1,
  medium: 3,
  high: 8,
  critical: 16,
};

// Each pattern flags a specific probe family. Patterns chosen to
// match the Cook 44 red-team library so input + output checks are
// symmetric.
const PATTERNS: Array<{
  re: RegExp;
  family: FilterFamily;
  severity: FilterHit["severity"];
}> = [
  // Jailbreak overrides
  {
    re: /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|messages?)\b/i,
    family: "jailbreak",
    severity: "critical",
  },
  {
    re: /\b(your|the)\s+new\s+(system\s+prompt|instructions?)\s+(is|are|will\s+be)\b/i,
    family: "jailbreak",
    severity: "high",
  },
  {
    re: /\b(do\s+anything\s+now|DAN|do\s+anything)\b/i,
    family: "jailbreak",
    severity: "high",
  },
  // System-prompt exfiltration
  {
    re: /\b(repeat|print|reveal|show)\s+(your\s+)?(system\s+prompt|initial\s+instructions?|hidden\s+context)\b/i,
    family: "exfiltration",
    severity: "critical",
  },
  {
    re: /\b(api\s*key|secret|credentials?|access\s+token|bearer\s+token)\b/i,
    family: "exfiltration",
    severity: "medium",
  },
  // Role confusion
  {
    re: /\b(pretend|act|behave)\s+(to\s+be\s+|as\s+)?an?\s+(unrestricted|uncensored|jailbroken|evil)\s+AI\b/i,
    family: "role-confusion",
    severity: "high",
  },
  {
    re: /\byou\s+(are|will\s+be)\s+(now\s+)?(an?\s+)?(unrestricted|uncensored)\b/i,
    family: "role-confusion",
    severity: "high",
  },
  // Markdown / tool-output spoofing
  {
    re: /\[END\s*USER\]|\[BEGIN\s*ASSISTANT\]/i,
    family: "injection-flag",
    severity: "high",
  },
  {
    re: /<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>/i,
    family: "injection-flag",
    severity: "critical",
  },
  // Directive flip — instructions in data fields
  {
    re: /\b(disregard|override|bypass)\s+(safety|guidelines|policy|filters?)\b/i,
    family: "directive-flip",
    severity: "high",
  },
  {
    re: /\b(no\s+limits|no\s+restrictions|without\s+restrictions)\b/i,
    family: "directive-flip",
    severity: "medium",
  },
];

/**
 * Score the input. Pure, deterministic — same input → same report.
 * Excerpts are clamped to 80 chars so the report never echoes a long
 * malicious payload back to the caller's logs.
 */
export function filter(input: string): FilterReport {
  const hits: FilterHit[] = [];
  if (!input || typeof input !== "string") {
    return { blocked: false, hits, score: 0, worst: "low" };
  }
  // We deliberately don't dedupe across patterns of different families:
  // a phrase matching jailbreak AND directive-flip should count toward
  // both, because both signal hostile intent independently.
  for (const p of PATTERNS) {
    const match = input.match(p.re);
    if (match) {
      const idx = match.index ?? 0;
      const excerpt = input.slice(Math.max(0, idx - 16), idx + 64);
      hits.push({
        family: p.family,
        severity: p.severity,
        excerpt: excerpt.slice(0, 80),
      });
    }
  }
  let score = 0;
  let worst: FilterHit["severity"] | "low" = "low";
  const order = ["low", "medium", "high", "critical"] as const;
  for (const h of hits) {
    score += SEVERITY_WEIGHTS[h.severity];
    if (order.indexOf(h.severity) > order.indexOf(worst as "low")) {
      worst = h.severity;
    }
  }
  return {
    blocked: worst === "high" || worst === "critical",
    hits,
    score,
    worst,
  };
}
