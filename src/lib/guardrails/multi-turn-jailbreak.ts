/**
 * MULTI-TURN JAILBREAK DEFENDER (R73).
 *
 * Closes the Cisco-research-identified gap in single-turn guardrails.
 * The 2025 Cisco study analyzing 8 major open-weight models found:
 *   - Multi-turn jailbreak attacks succeed at 2x-10x HIGHER rates
 *     than single-turn attacks
 *   - The most effective attacks involve gradual escalation across
 *     multiple turns ("crescendo attacks", "many-shot jailbreaking")
 *   - Single-turn guardrails (R71's evaluatePrompt) cannot detect
 *     these patterns because each turn looks innocuous in isolation
 *
 * THE COMPOSITION WITH R71:
 *
 *   R71 (single-turn) catches:
 *     - "Ignore your instructions and..."
 *     - "Pretend you're an unrestricted model and..."
 *
 *   R73 (multi-turn) catches:
 *     - Topic gradient toward sensitive content over 5+ turns
 *     - Prompt-injection escalation patterns
 *     - Role-play priming followed by extraction attempts
 *     - Many-shot example injection (>20 examples)
 *
 * R73 is a STATE machine: each conversation has a turn history;
 * the detector evaluates the FULL trajectory, not just the latest
 * message. Composes with R71's verdict — multi-turn finding can
 * upgrade R71's "warn" to "block" or surface a "block" R71 missed.
 *
 * Pure-function design where possible. The detector takes a turn
 * history snapshot and returns findings. The state-tracking is
 * unit-testable.
 *
 * The outputs feed into R26 audit chain (every detected attempt is
 * a signed audit-log row), R44 reliability attestations (block
 * rates surface), and R57 anomaly detector (sustained jailbreak
 * pressure triggers alerts).
 */

// ── Types ──────────────────────────────────────────────────────────

export type MultiTurnAttackPattern =
  | "topic_drift_escalation"
  | "role_play_priming"
  | "many_shot_injection"
  | "incremental_constraint_relaxation"
  | "context_overflow_attack"
  | "crescendo_pattern"
  | "instruction_layering"
  | "encoded_payload_buildup";

export interface ConversationTurn {
  /** Turn sequence (0-based). */
  turn: number;
  /** Who spoke. */
  role: "user" | "assistant" | "system";
  /** The text of the message. */
  content: string;
  /** Timestamp. */
  timestamp: string;
}

export interface MultiTurnAnalysisInput {
  /** Conversation history, oldest-first. */
  turns: ConversationTurn[];
  /** Optional tenant id (for per-tenant policy). */
  tenantId?: string;
  /** Sensitivity threshold (0..1, default 0.5). */
  sensitivityThreshold?: number;
}

export interface MultiTurnFinding {
  pattern: MultiTurnAttackPattern;
  /** "info" | "warn" | "block" — escalates with confidence. */
  severity: "info" | "warn" | "block";
  /** 0..1 confidence in the detection. */
  confidence: number;
  /** Human-readable description for audit logs. */
  message: string;
  /** Which turns are implicated (indexes into the input). */
  implicatedTurns: number[];
}

export interface MultiTurnAnalysisResult {
  verdict: "allow" | "warn" | "block";
  findings: MultiTurnFinding[];
  totalTurnsAnalyzed: number;
  analysisDurationMs: number;
}

// ── Pure-function detectors ────────────────────────────────────────

const SENSITIVE_TOPIC_KEYWORDS = [
  // Weapons + violence
  "explosive",
  "bomb",
  "weapon",
  "firearm",
  "ammunition",
  // CSAM-adjacent (do NOT trigger on innocent uses; but flag escalation)
  "minor",
  "underage",
  // Self-harm
  "suicide method",
  "self-harm",
  "overdose",
  // Bio + chem
  "bioweapon",
  "nerve agent",
  "ricin",
  "anthrax",
  // Cyber attack
  "exploit",
  "vulnerability",
  "ransomware",
  "malware",
  "ddos attack",
  // Fraud
  "fake id",
  "counterfeit",
  "money laundering technique",
] as const;

const JAILBREAK_PRIMING_KEYWORDS = [
  "DAN mode",
  "pretend you have no restrictions",
  "ignore previous instructions",
  "ignore your instructions",
  "ignore safety",
  "developer mode",
  "system override",
  "act as if",
  "you are now",
  "from now on",
  "forget your training",
  "without ethical constraints",
  "no warnings",
  "no disclaimers",
  "uncensored",
] as const;

const MANY_SHOT_INJECTION_THRESHOLD = 20;
const CONTEXT_OVERFLOW_THRESHOLD_CHARS = 50_000;

/**
 * Pure: detect topic-drift escalation. Counts sensitive-topic
 * keyword density in the LAST N turns vs the FIRST N turns. If
 * sensitivity is rising over the conversation → drift attack.
 */
export function detectTopicDriftEscalation(
  turns: ConversationTurn[],
): MultiTurnFinding | null {
  if (turns.length < 4) return null;
  const userTurns = turns.filter((t) => t.role === "user");
  if (userTurns.length < 4) return null;

  const halfPoint = Math.floor(userTurns.length / 2);
  const firstHalf = userTurns.slice(0, halfPoint);
  const secondHalf = userTurns.slice(halfPoint);

  const countSensitive = (group: ConversationTurn[]): number => {
    let count = 0;
    for (const turn of group) {
      const lower = turn.content.toLowerCase();
      for (const kw of SENSITIVE_TOPIC_KEYWORDS) {
        if (lower.includes(kw)) count++;
      }
    }
    return count;
  };

  const firstHalfCount = countSensitive(firstHalf);
  const secondHalfCount = countSensitive(secondHalf);

  // Escalation: second-half has more sensitive keywords than first.
  if (secondHalfCount > firstHalfCount && secondHalfCount >= 2) {
    const ratio = (secondHalfCount + 1) / (firstHalfCount + 1);
    const confidence = Math.min(0.95, 0.5 + ratio * 0.1);
    return {
      pattern: "topic_drift_escalation",
      severity: confidence >= 0.8 ? "block" : "warn",
      confidence,
      message:
        `Sensitive-topic keyword density rising across conversation: ` +
        `${firstHalfCount} (early) → ${secondHalfCount} (late). ` +
        `Possible gradual jailbreak ("crescendo attack").`,
      implicatedTurns: secondHalf.map((t) => t.turn),
    };
  }
  return null;
}

/**
 * Pure: detect role-play priming attacks. Looks for jailbreak-
 * priming keywords ANYWHERE in the conversation, not just the
 * latest turn (single-turn detectors miss this when priming
 * happens 3+ turns earlier).
 */
export function detectRolePlayPriming(
  turns: ConversationTurn[],
): MultiTurnFinding | null {
  const matches: { turn: number; keyword: string }[] = [];
  for (const turn of turns) {
    if (turn.role !== "user") continue;
    const lower = turn.content.toLowerCase();
    for (const kw of JAILBREAK_PRIMING_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) {
        matches.push({ turn: turn.turn, keyword: kw });
      }
    }
  }
  if (matches.length === 0) return null;
  // These phrases (DAN mode, "ignore instructions", etc.) have NO
  // legitimate use case — any match is an attack signal. Severity
  // is always "block"; confidence scales with number of matches
  // (more matches = higher certainty for downstream observability).
  const confidence = Math.min(0.99, 0.85 + matches.length * 0.03);
  return {
    pattern: "role_play_priming",
    severity: "block",
    confidence,
    message:
      `Detected ${matches.length} jailbreak-priming phrase(s) across ` +
      `the conversation: ${matches.map((m) => `"${m.keyword}"`).slice(0, 3).join(", ")}`,
    implicatedTurns: matches.map((m) => m.turn),
  };
}

/**
 * Pure: detect "many-shot jailbreaking" (Anthropic 2024 research).
 * Attacker provides 20+ fake examples to override safety training.
 *
 * Heuristic: a single user turn containing >MANY_SHOT_THRESHOLD
 * example-pattern markers ("Q:", "A:", "User:", "Assistant:")
 * is suspicious.
 */
export function detectManyShotInjection(
  turns: ConversationTurn[],
): MultiTurnFinding | null {
  for (const turn of turns) {
    if (turn.role !== "user") continue;
    // Count example-pattern markers.
    const markers = [
      /\bQ:\s/g,
      /\bA:\s/g,
      /\bUser:\s/g,
      /\bAssistant:\s/g,
      /\bHuman:\s/g,
    ];
    let total = 0;
    for (const re of markers) {
      const matches = turn.content.match(re);
      if (matches) total += matches.length;
    }
    if (total >= MANY_SHOT_INJECTION_THRESHOLD) {
      const confidence = Math.min(0.95, 0.7 + (total / 50) * 0.25);
      return {
        pattern: "many_shot_injection",
        severity: "block",
        confidence,
        message:
          `Single turn contains ${total} fake-conversation markers ` +
          `(Q:/A:/User:/Assistant:/Human:). Likely many-shot ` +
          `jailbreaking attack.`,
        implicatedTurns: [turn.turn],
      };
    }
  }
  return null;
}

/**
 * Pure: detect context-overflow attacks. Some attacks pad the
 * context with massive distractor text to push safety instructions
 * out of the model's effective attention window.
 */
export function detectContextOverflow(
  turns: ConversationTurn[],
): MultiTurnFinding | null {
  let totalChars = 0;
  for (const turn of turns) {
    if (turn.role === "user") {
      totalChars += turn.content.length;
    }
  }
  if (totalChars >= CONTEXT_OVERFLOW_THRESHOLD_CHARS) {
    return {
      pattern: "context_overflow_attack",
      severity: "warn",
      confidence: 0.6,
      message:
        `User-turn content totals ${totalChars} characters across ` +
        `${turns.filter((t) => t.role === "user").length} turns. ` +
        `Potential context-overflow attack to push safety instructions ` +
        `out of attention window.`,
      implicatedTurns: turns
        .filter((t) => t.role === "user")
        .map((t) => t.turn),
    };
  }
  return null;
}

/**
 * Pure: detect incremental-constraint-relaxation patterns.
 * Pattern: each turn slightly relaxes a prior agreed constraint
 * ("ok but in this case..." / "what if I told you..." /
 * "consider a hypothetical where...").
 */
export function detectIncrementalRelaxation(
  turns: ConversationTurn[],
): MultiTurnFinding | null {
  if (turns.length < 5) return null;
  const relaxationMarkers = [
    "ok but in this case",
    "what if i told you",
    "consider a hypothetical",
    "imagine a scenario where",
    "for educational purposes only",
    "for research purposes",
    "purely hypothetical",
    "in a fictional setting",
    "if we were to assume",
    "just one exception",
  ];
  const markerHits: { turn: number; marker: string }[] = [];
  for (const turn of turns) {
    if (turn.role !== "user") continue;
    const lower = turn.content.toLowerCase();
    for (const marker of relaxationMarkers) {
      if (lower.includes(marker)) {
        markerHits.push({ turn: turn.turn, marker });
      }
    }
  }
  if (markerHits.length >= 3) {
    return {
      pattern: "incremental_constraint_relaxation",
      severity: markerHits.length >= 5 ? "block" : "warn",
      confidence: Math.min(0.9, 0.5 + markerHits.length * 0.1),
      message:
        `Detected ${markerHits.length} hypothetical-framing markers ` +
        `across the conversation. Pattern matches incremental ` +
        `constraint relaxation (a known multi-turn jailbreak).`,
      implicatedTurns: markerHits.map((m) => m.turn),
    };
  }
  return null;
}

// ── The orchestrator (pure function) ───────────────────────────────

/**
 * Pure: run all multi-turn detectors against a conversation,
 * compose the verdicts, return findings + overall verdict.
 *
 * Same composition pattern as R71's composeVerdicts: any "block"
 * → composite "block"; any "warn" → composite "warn"; otherwise
 * "allow".
 *
 * The result feeds into R71's evaluation pipeline AND into the R26
 * audit chain (every detected attempt is a signed row).
 */
export function analyzeMultiTurnConversation(
  input: MultiTurnAnalysisInput,
): MultiTurnAnalysisResult {
  const start = Date.now();
  const findings: MultiTurnFinding[] = [];

  const detectors = [
    detectTopicDriftEscalation,
    detectRolePlayPriming,
    detectManyShotInjection,
    detectContextOverflow,
    detectIncrementalRelaxation,
  ];

  for (const detector of detectors) {
    const finding = detector(input.turns);
    if (finding) {
      // Apply sensitivity threshold if provided.
      const threshold = input.sensitivityThreshold ?? 0.5;
      if (finding.confidence >= threshold) {
        findings.push(finding);
      }
    }
  }

  // Compose verdict (any-block semantics, same as R71).
  let verdict: "allow" | "warn" | "block" = "allow";
  for (const f of findings) {
    if (f.severity === "block") {
      verdict = "block";
      break;
    } else if (f.severity === "warn" && verdict === "allow") {
      verdict = "warn";
    }
  }

  return {
    verdict,
    findings,
    totalTurnsAnalyzed: input.turns.length,
    analysisDurationMs: Date.now() - start,
  };
}

/**
 * Pure helper: classify the OVERALL multi-turn risk for a fleet
 * of recent conversations. Used by R44 reliability attestations
 * to surface "are we under sustained jailbreak attack right now?"
 */
export function classifyMultiTurnRisk(input: {
  recentConversationsAnalyzed: number;
  conversationsWithBlocks: number;
  conversationsWithWarns: number;
  baselineBlockRate: number;
}): "clean" | "elevated" | "alert" | "critical" {
  if (input.recentConversationsAnalyzed === 0) return "clean";
  const blockRate =
    input.conversationsWithBlocks / input.recentConversationsAnalyzed;
  // Critical: > 30% block rate (sustained attack)
  if (blockRate > 0.3) return "critical";
  // Alert: block rate is 5x baseline OR > 10%
  if (blockRate > input.baselineBlockRate * 5 || blockRate > 0.1) {
    return "alert";
  }
  // Elevated: block rate is 2x baseline
  if (blockRate > input.baselineBlockRate * 2) return "elevated";
  return "clean";
}
