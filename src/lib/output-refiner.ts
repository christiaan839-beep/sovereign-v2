/**
 * SOVEREIGN MATRIX — Anti-AI-Slop Output Refiner
 *
 * 3-stage pipeline that transforms AI output so it doesn't read like AI.
 * Stage 1 (Polish): AI call to tighten prose.
 * Stage 2 (Humanize): Pure string manipulation — no API calls.
 * Stage 3 (Score): Heuristic humanness scoring.
 */

import { detectAIPatterns } from "./ai-detect";
import { createLogger } from "@/lib/logger";

const log = createLogger("output-refiner");

// ---------------------------------------------------------------------------
// Types (re-exported from shared types)
// ---------------------------------------------------------------------------

export type { RefinedOutput, RefineOptions } from "./output-refiner-types";
import type { RefinedOutput, RefineOptions } from "./output-refiner-types";

// ---------------------------------------------------------------------------
// Cliche Replacement Map (used in Stage 2)
// ---------------------------------------------------------------------------

const CLICHE_REPLACEMENTS: [RegExp, string][] = [
  [/\bdelve(?:s|d)?\s+into\b/gi, "explore"],
  [/\bleverage[sd]?\b/gi, "use"],
  [/\butilize[sd]?\b/gi, "use"],
  [/\bit(?:'s| is)\s+important\s+to\s+note\b/gi, "note:"],
  [/\bin\s+today(?:'s|\s+is)\s+fast[- ]paced\s+world\b/gi, "right now"],
  [/\bgame[- ]changer\b/gi, "big shift"],
  [/\bcutting[- ]edge\b/gi, "modern"],
  [/\brevolutionize[sd]?\b/gi, "change"],
  [/\bharness(?:es|ed|ing)?\s+the\s+power\b/gi, "use"],
  [/\bdive\s+deep\b/gi, "look closely"],
  [/\bat\s+the\s+end\s+of\s+the\s+day\b/gi, "ultimately"],
  [/\bseamless(?:ly)?\b/gi, "smooth"],
  [/\brobust\b/gi, "solid"],
  [/\bin\s+the\s+realm\s+of\b/gi, "in"],
  [/\bneedless\s+to\s+say\b/gi, ""],
  [/\bfirst\s+and\s+foremost\b/gi, "first"],
  [/\blast\s+but\s+not\s+least\b/gi, "finally"],
  [/\btap(?:s|ped|ping)?\s+into\b/gi, "use"],
  [/\bunlock(?:s|ed|ing)?\s+the\s+(?:full\s+)?potential\b/gi, "make the most of"],
  [/\bpave(?:s|d)?\s+the\s+way\b/gi, "open the door"],
  [/\bparadigm\s+shift\b/gi, "major change"],
  [/\bholistic(?:ally)?\b/gi, "overall"],
  [/\bempowering\b/gi, "enabling"],
  [/\btransformative\b/gi, "powerful"],
  [/\bsynerg(?:y|ies|istic)\b/gi, "combined effect"],
  [/\bat\s+its\s+core\b/gi, "fundamentally"],
  [/\bit\s+goes\s+without\s+saying\b/gi, ""],
  [/\bgenerally\s+speaking\b/gi, ""],
];

// Filler starters that AI loves
const FILLER_STARTERS: RegExp[] = [
  /^In\s+conclusion,?\s*/i,
  /^To\s+summarize,?\s*/i,
  /^As\s+mentioned\s+(?:above|earlier|previously),?\s*/i,
  /^It\s+is\s+worth\s+(?:mentioning|noting)\s+that\s*/i,
  /^It\s+should\s+be\s+noted\s+that\s*/i,
];

// ---------------------------------------------------------------------------
// Stage 1 — Polish (AI call)
// ---------------------------------------------------------------------------

async function stagePolish(
  text: string,
  tone: string
): Promise<{ text: string; changes: string[] }> {
  const toneGuide: Record<string, string> = {
    professional:
      "Clear, confident, direct. No fluff. Like a sharp memo from a trusted advisor.",
    casual:
      "Conversational, approachable. Like texting a smart friend. Use contractions freely.",
    technical:
      "Precise, no-nonsense. Say exactly what you mean. Assume the reader is competent.",
    creative:
      "Vivid, rhythmic. Surprise the reader. Break rules on purpose, not by accident.",
  };

  const system = `You are a senior copy editor. Your job: make this text sound like a sharp human wrote it, not an AI.

Rules:
- Remove filler and throat-clearing sentences
- Tighten every sentence — cut words that don't earn their place
- Fix tone inconsistencies
- Do NOT add new information or change the meaning
- Do NOT add cliches, buzzwords, or marketing-speak
- Preserve all markdown formatting, code blocks, and links exactly

Tone target: ${toneGuide[tone] || toneGuide.professional}

Return ONLY the improved text. No commentary.`;

  try {
    // Dynamic import to avoid pulling server-only deps (Pinecone/Clerk) into client bundles
    const { ai } = await import("./ai");
    const polished = await ai(text, {
      model: "groq",
      system,
      maxTokens: 4000,
    });
    return {
      text: polished,
      changes: ["AI polish pass: tightened prose, removed filler"],
    };
  } catch (err) {
    log.error("Polish stage failed, skipping:", err as Record<string, unknown>);
    return { text, changes: [] };
  }
}

// ---------------------------------------------------------------------------
// Stage 2 — Humanize (pure string manipulation)
// ---------------------------------------------------------------------------

function stageHumanize(
  text: string,
  preserveFormatting: boolean
): { text: string; changes: string[] } {
  const changes: string[] = [];
  let result = text;

  // Extract code blocks and markdown structures to protect them
  const codeBlocks: string[] = [];
  if (preserveFormatting) {
    result = result.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
  }

  // 2a. Replace cliches
  let clicheCount = 0;
  for (const [pattern, replacement] of CLICHE_REPLACEMENTS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) clicheCount++;
  }
  if (clicheCount > 0) {
    changes.push(`Replaced ${clicheCount} AI cliche phrase(s)`);
  }

  // 2b. Remove filler sentence starters
  const lines = result.split("\n");
  let fillerCount = 0;
  for (let i = 0; i < lines.length; i++) {
    for (const filler of FILLER_STARTERS) {
      if (filler.test(lines[i])) {
        lines[i] = lines[i].replace(filler, "");
        fillerCount++;
      }
    }
  }
  result = lines.join("\n");
  if (fillerCount > 0) {
    changes.push(`Removed ${fillerCount} filler opener(s)`);
  }

  // 2c. Add contractions where natural
  const contractionMap: [RegExp, string][] = [
    [/\bdo not\b/gi, "don't"],
    [/\bcannot\b/gi, "can't"],
    [/\bwill not\b/gi, "won't"],
    [/\bshould not\b/gi, "shouldn't"],
    [/\bwould not\b/gi, "wouldn't"],
    [/\bcould not\b/gi, "couldn't"],
    [/\bit is\b/gi, "it's"],
    [/\bthat is\b/gi, "that's"],
    [/\bthey are\b/gi, "they're"],
    [/\bwe are\b/gi, "we're"],
    [/\byou are\b/gi, "you're"],
    [/\bI am\b/gi, "I'm"],
    [/\blet us\b/gi, "let's"],
    [/\bdoes not\b/gi, "doesn't"],
    [/\bhas not\b/gi, "hasn't"],
    [/\bhave not\b/gi, "haven't"],
    [/\bis not\b/gi, "isn't"],
    [/\bare not\b/gi, "aren't"],
    [/\bwas not\b/gi, "wasn't"],
    [/\bwere not\b/gi, "weren't"],
  ];

  let contractionCount = 0;
  for (const [pattern, replacement] of contractionMap) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) contractionCount++;
  }
  if (contractionCount > 0) {
    changes.push(`Added ${contractionCount} natural contraction(s)`);
  }

  // 2d. Break overly uniform sentence lengths
  // Split into paragraphs, within each paragraph vary sentence length
  const paragraphs = result.split(/\n\s*\n/);
  const reworked = paragraphs.map((para) => {
    // Skip short paragraphs, headings, list items
    if (
      para.trim().length < 100 ||
      para.trim().startsWith("#") ||
      para.trim().startsWith("-") ||
      para.trim().startsWith("*") ||
      para.trim().match(/^__CODE_BLOCK_/)
    ) {
      return para;
    }

    const sents = para.match(/[^.!?]+[.!?]+/g);
    if (!sents || sents.length < 4) return para;

    // Check if all sentences are similar length
    const lengths = sents.map((s) => s.trim().split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((acc, l) => acc + (l - mean) ** 2, 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 4 && sents.length >= 4) {
      // Occasionally merge two short sentences or split a long one
      // Simple heuristic: if a sentence has "and" or "but" in the middle, fragment it
      for (let i = 0; i < sents.length; i++) {
        const words = sents[i].trim().split(/\s+/);
        if (words.length > 15) {
          // Try to split at a conjunction
          const conjIdx = words.findIndex(
            (w, idx) => idx > 5 && idx < words.length - 3 && /^(?:and|but)$/i.test(w)
          );
          if (conjIdx > 0) {
            const first = words.slice(0, conjIdx).join(" ") + ".";
            const second =
              words[conjIdx].charAt(0).toUpperCase() +
              words[conjIdx].slice(1) +
              " " +
              words.slice(conjIdx + 1).join(" ");
            sents[i] = first + " " + second;
            changes.push("Split a long compound sentence for variety");
            break; // One split per paragraph is enough
          }
        }
      }
      return sents.join(" ").replace(/\s+/g, " ").trim();
    }

    return para;
  });
  result = reworked.join("\n\n");

  // 2e. Clean up double spaces and trailing whitespace
  result = result.replace(/  +/g, " ").replace(/ +\n/g, "\n");

  // Restore code blocks
  if (preserveFormatting) {
    for (let i = 0; i < codeBlocks.length; i++) {
      result = result.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
    }
  }

  return { text: result, changes };
}

// ---------------------------------------------------------------------------
// Stage 3 — Score (pure heuristics)
// ---------------------------------------------------------------------------

function stageScore(text: string): number {
  const detection = detectAIPatterns(text);
  // Invert: detectAIPatterns gives 0 (human) to 100 (AI).
  // We want humanness score: 0 (robot) to 100 (human).
  return Math.max(0, 100 - detection.score);
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

export async function refineOutput(
  rawOutput: string,
  options?: RefineOptions
): Promise<RefinedOutput> {
  const mode = options?.mode ?? "quality";
  const tone = options?.tone ?? "professional";
  const preserveFormatting = options?.preserveFormatting ?? true;

  const changes: string[] = [];
  let current = rawOutput;
  let stage: RefinedOutput["stage"] = "raw";

  // Stage 1 — Polish (skipped in speed mode)
  if (mode === "quality") {
    const polishResult = await stagePolish(current, tone);
    current = polishResult.text;
    changes.push(...polishResult.changes);
    stage = "polished";
  }

  // Stage 2 — Humanize (always runs, pure string manipulation)
  const humanizeResult = stageHumanize(current, preserveFormatting);
  current = humanizeResult.text;
  changes.push(...humanizeResult.changes);
  stage = "humanized";

  // Stage 3 — Score
  const score = stageScore(current);

  return {
    original: rawOutput,
    refined: current,
    score,
    changes,
    stage,
  };
}
