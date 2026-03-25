/**
 * Shared types for the output refiner (used by both server and client versions).
 */

export interface RefinedOutput {
  original: string;
  refined: string;
  score: number; // 0-100 humanness score
  changes: string[];
  stage: "raw" | "polished" | "humanized";
}

export interface RefineOptions {
  mode?: "speed" | "quality"; // speed skips Stage 1, quality does all 3
  tone?: "professional" | "casual" | "technical" | "creative";
  preserveFormatting?: boolean; // keep markdown, code blocks, etc.
}
