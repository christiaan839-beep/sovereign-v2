/**
 * SOVEREIGN MATRIX — AI Pattern Detection Engine
 *
 * Pure heuristic scanner that identifies telltale AI writing patterns.
 * Zero API calls — runs entirely on regex and string analysis for speed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIDetectionResult {
  score: number; // 0-100 (0 = definitely human, 100 = definitely AI)
  flags: AIFlag[];
  suggestion: string;
}

export interface AIFlag {
  pattern: string;
  severity: "low" | "medium" | "high";
  location: number; // char index
  replacement?: string;
}

// ---------------------------------------------------------------------------
// Pattern Dictionaries
// ---------------------------------------------------------------------------

const CLICHE_PHRASES: { pattern: RegExp; replacement?: string }[] = [
  { pattern: /\bdelve(?:s|d)?\s+into\b/gi, replacement: "explore" },
  { pattern: /\bit(?:'s| is)\s+worth\s+noting\b/gi, replacement: "note that" },
  { pattern: /\bat\s+its\s+core\b/gi, replacement: "fundamentally" },
  { pattern: /\bin\s+the\s+realm\s+of\b/gi, replacement: "in" },
  { pattern: /\bneedless\s+to\s+say\b/gi },
  { pattern: /\bfirst\s+and\s+foremost\b/gi, replacement: "first" },
  { pattern: /\blast\s+but\s+not\s+least\b/gi, replacement: "finally" },
  { pattern: /\bin\s+conclusion\b/gi },
  { pattern: /\bin\s+today(?:'s|\s+is)\s+(?:fast[- ]paced|digital|modern)\s+world\b/gi },
  { pattern: /\bgame[- ]changer\b/gi },
  { pattern: /\bcutting[- ]edge\b/gi, replacement: "modern" },
  { pattern: /\brevolutionize[sd]?\b/gi, replacement: "transform" },
  { pattern: /\bharness(?:es|ed|ing)?\s+the\s+power\b/gi, replacement: "use" },
  { pattern: /\bdive\s+deep\b/gi, replacement: "look closely" },
  { pattern: /\bat\s+the\s+end\s+of\s+the\s+day\b/gi, replacement: "ultimately" },
  { pattern: /\bseamless(?:ly)?\b/gi, replacement: "smooth" },
  { pattern: /\brobust\b/gi, replacement: "strong" },
  { pattern: /\bleverage[sd]?\b/gi, replacement: "use" },
  { pattern: /\butilize[sd]?\b/gi, replacement: "use" },
  { pattern: /\bit(?:'s| is)\s+important\s+to\s+note\b/gi },
  { pattern: /\btap(?:s|ped|ping)?\s+into\b/gi, replacement: "use" },
  { pattern: /\bunlock(?:s|ed|ing)?\s+the\s+(?:full\s+)?potential\b/gi },
  { pattern: /\bpave(?:s|d)?\s+the\s+way\b/gi },
  { pattern: /\bparadigm\s+shift\b/gi },
  { pattern: /\bsynerg(?:y|ies|istic)\b/gi },
  { pattern: /\bholistic(?:ally)?\b/gi },
  { pattern: /\bempowering\b/gi },
  { pattern: /\btransformative\b/gi },
];

const HEDGING_PHRASES: { pattern: RegExp; replacement?: string }[] = [
  { pattern: /\bit(?:'s| is)\s+important\s+to\b/gi },
  { pattern: /\bone\s+might\s+argue\b/gi },
  { pattern: /\bit\s+could\s+be\s+said\b/gi },
  { pattern: /\bgenerally\s+speaking\b/gi },
  { pattern: /\bit\s+should\s+be\s+noted\b/gi },
  { pattern: /\bit\s+goes\s+without\s+saying\b/gi },
  { pattern: /\bas\s+(?:we\s+)?(?:all\s+)?know\b/gi },
  { pattern: /\bit\s+is\s+widely\s+(?:known|accepted|recognized)\b/gi },
];

const EXCESSIVE_TRANSITIONS = [
  /\bfurthermore\b/gi,
  /\bmoreover\b/gi,
  /\badditionally\b/gi,
  /\bconsequently\b/gi,
  /\bnevertheless\b/gi,
  /\bnonetheless\b/gi,
  /\bin\s+addition\b/gi,
  /\bby\s+the\s+same\s+token\b/gi,
];

const REPEATED_ADJECTIVES = [
  "comprehensive",
  "innovative",
  "transformative",
  "dynamic",
  "strategic",
  "impactful",
  "significant",
  "essential",
  "crucial",
  "pivotal",
  "groundbreaking",
];

// ---------------------------------------------------------------------------
// Core Detection
// ---------------------------------------------------------------------------

export function detectAIPatterns(text: string): AIDetectionResult {
  const flags: AIFlag[] = [];
  let score = 0;

  // 1. Cliche phrases
  for (const { pattern, replacement } of CLICHE_PHRASES) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      flags.push({
        pattern: `Cliche phrase: "${match[0]}"`,
        severity: "high",
        location: match.index,
        replacement,
      });
      score += 6;
    }
  }

  // 2. Hedging language
  for (const { pattern, replacement } of HEDGING_PHRASES) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      flags.push({
        pattern: `Hedging language: "${match[0]}"`,
        severity: "medium",
        location: match.index,
        replacement,
      });
      score += 4;
    }
  }

  // 3. Perfect paragraph structure (every paragraph has 3-5 sentences)
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 3) {
    const sentenceCounts = paragraphs.map(
      (p) => (p.match(/[.!?]+(?:\s|$)/g) || []).length
    );
    const allInRange = sentenceCounts.every((c) => c >= 3 && c <= 5);
    if (allInRange && paragraphs.length >= 4) {
      flags.push({
        pattern: `Perfect paragraph structure: all ${paragraphs.length} paragraphs have 3-5 sentences`,
        severity: "medium",
        location: 0,
      });
      score += 12;
    }
  }

  // 4. Excessive transitions (> 2 per 500 words)
  const wordCount = text.split(/\s+/).length;
  let transitionCount = 0;
  for (const re of EXCESSIVE_TRANSITIONS) {
    const matches = text.match(new RegExp(re.source, re.flags));
    transitionCount += matches ? matches.length : 0;
  }
  const transitionsPer500 = wordCount > 0 ? (transitionCount / wordCount) * 500 : 0;
  if (transitionsPer500 > 2) {
    flags.push({
      pattern: `Excessive transitions: ${transitionCount} in ${wordCount} words (${transitionsPer500.toFixed(1)} per 500)`,
      severity: "medium",
      location: 0,
    });
    score += 8;
  }

  // 5. Zero contractions in casual-length content (> 100 words)
  if (wordCount > 100) {
    const contractions = text.match(
      /\b(?:I'm|you're|we're|they're|he's|she's|it's|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|won't|wouldn't|can't|couldn't|shouldn't|haven't|hasn't|hadn't|let's|that's|there's|here's|who's|what's)\b/gi
    );
    if (!contractions || contractions.length === 0) {
      flags.push({
        pattern: "Zero contractions in 100+ word text — reads overly formal",
        severity: "low",
        location: 0,
      });
      score += 6;
    }
  }

  // 6. List obsession (> 3 bullet/numbered lists per 500 words in prose)
  const listMarkers = text.match(/^[\s]*[-*\u2022]\s|^\s*\d+[.)]\s/gm);
  const listCount = listMarkers ? listMarkers.length : 0;
  const listsPer500 = wordCount > 0 ? (listCount / wordCount) * 500 : 0;
  if (listsPer500 > 3 && listCount > 6) {
    flags.push({
      pattern: `List obsession: ${listCount} list items in ${wordCount} words`,
      severity: "low",
      location: 0,
    });
    score += 5;
  }

  // 7. Vocabulary uniformity — repeated "AI adjectives"
  for (const adj of REPEATED_ADJECTIVES) {
    const re = new RegExp(`\\b${adj}\\b`, "gi");
    const matches = text.match(re);
    if (matches && matches.length >= 3) {
      flags.push({
        pattern: `Repeated AI adjective: "${adj}" used ${matches.length} times`,
        severity: "medium",
        location: text.search(re),
      });
      score += 4;
    }
  }

  // 8. Sentence length variance — low variance = robotic
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length >= 5) {
    const lengths = sentences.map((s) => s.split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((acc, l) => acc + (l - mean) ** 2, 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev < 3) {
      flags.push({
        pattern: `Low sentence length variance: std dev ${stdDev.toFixed(1)} words (should be > 5)`,
        severity: "medium",
        location: 0,
      });
      score += 10;
    } else if (stdDev < 5) {
      flags.push({
        pattern: `Moderate sentence length variance: std dev ${stdDev.toFixed(1)} words (ideally > 5)`,
        severity: "low",
        location: 0,
      });
      score += 4;
    }
  }

  // 9. Vocabulary diversity — unique words / total words
  if (wordCount > 50) {
    const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    const unique = new Set(words).size;
    const ratio = unique / words.length;
    if (ratio < 0.4) {
      flags.push({
        pattern: `Low vocabulary diversity: ${(ratio * 100).toFixed(0)}% unique words`,
        severity: "low",
        location: 0,
      });
      score += 5;
    }
  }

  // Cap at 100
  score = Math.min(100, score);

  // Build suggestion
  const suggestion = buildSuggestion(flags, score);

  return { score, flags, suggestion };
}

// ---------------------------------------------------------------------------
// Suggestion Builder
// ---------------------------------------------------------------------------

function buildSuggestion(flags: AIFlag[], score: number): string {
  if (score <= 15) return "Text reads naturally. No major AI patterns detected.";
  if (score <= 35) return "Mildly robotic. Vary sentence lengths and swap a few cliches for plain language.";

  const highFlags = flags.filter((f) => f.severity === "high");
  const mediumFlags = flags.filter((f) => f.severity === "medium");

  const parts: string[] = [];
  if (highFlags.length > 0) {
    parts.push(
      `Replace ${highFlags.length} cliche phrase${highFlags.length > 1 ? "s" : ""} with plain language`
    );
  }
  if (mediumFlags.some((f) => f.pattern.includes("sentence length"))) {
    parts.push("Mix short punchy sentences with longer ones");
  }
  if (mediumFlags.some((f) => f.pattern.includes("transition"))) {
    parts.push("Cut formal transitions — just start the next thought");
  }
  if (flags.some((f) => f.pattern.includes("contraction"))) {
    parts.push("Add contractions to sound less stiff");
  }

  return parts.length > 0
    ? parts.join(". ") + "."
    : "Rewrite with more varied structure and less formulaic language.";
}
