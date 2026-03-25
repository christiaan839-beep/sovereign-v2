/**
 * SOVEREIGN MATRIX — Client-Safe Output Refiner
 *
 * Subset of output-refiner.ts that runs entirely in the browser.
 * Stages 2 (Humanize) + 3 (Score) only — no AI calls, no server deps.
 *
 * For the full 3-stage pipeline (including AI polish), use output-refiner.ts
 * from server-side code only.
 */

import { detectAIPatterns } from "./ai-detect";
import type { RefinedOutput, RefineOptions } from "./output-refiner-types";

export type { RefinedOutput, RefineOptions };

// ---------------------------------------------------------------------------
// Cliche Replacement Map (Stage 2)
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

const FILLER_STARTERS: RegExp[] = [
  /^In\s+conclusion,?\s*/i,
  /^To\s+summarize,?\s*/i,
  /^As\s+mentioned\s+(?:above|earlier|previously),?\s*/i,
  /^It\s+is\s+worth\s+(?:mentioning|noting)\s+that\s*/i,
  /^It\s+should\s+be\s+noted\s+that\s*/i,
];

// ---------------------------------------------------------------------------
// Stage 2 — Humanize (pure string manipulation)
// ---------------------------------------------------------------------------

function stageHumanize(
  text: string,
  preserveFormatting: boolean
): { text: string; changes: string[] } {
  const changes: string[] = [];
  let result = text;

  const codeBlocks: string[] = [];
  if (preserveFormatting) {
    result = result.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
  }

  let clicheCount = 0;
  for (const [pattern, replacement] of CLICHE_REPLACEMENTS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) clicheCount++;
  }
  if (clicheCount > 0) changes.push(`Replaced ${clicheCount} AI cliche phrase(s)`);

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
  if (fillerCount > 0) changes.push(`Removed ${fillerCount} filler opener(s)`);

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
  if (contractionCount > 0) changes.push(`Added ${contractionCount} natural contraction(s)`);

  result = result.replace(/  +/g, " ").replace(/ +\n/g, "\n");

  if (preserveFormatting) {
    for (let i = 0; i < codeBlocks.length; i++) {
      result = result.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
    }
  }

  return { text: result, changes };
}

// ---------------------------------------------------------------------------
// Stage 3 — Score
// ---------------------------------------------------------------------------

function stageScore(text: string): number {
  const detection = detectAIPatterns(text);
  return Math.max(0, 100 - detection.score);
}

// ---------------------------------------------------------------------------
// Client-Safe Pipeline (Stages 2 + 3 only)
// ---------------------------------------------------------------------------

export function refineOutputClient(
  rawOutput: string,
  options?: RefineOptions
): RefinedOutput {
  const preserveFormatting = options?.preserveFormatting ?? true;
  const changes: string[] = [];

  const humanizeResult = stageHumanize(rawOutput, preserveFormatting);
  const current = humanizeResult.text;
  changes.push(...humanizeResult.changes);

  const score = stageScore(current);

  return {
    original: rawOutput,
    refined: current,
    score,
    changes,
    stage: "humanized",
  };
}
