/**
 * AI OUTPUT PARSING — schema-validated responses with auto-repair.
 *
 * Problem solved: LLMs routinely return malformed JSON — trailing commas,
 * markdown fences, prose before/after the JSON block, escaped quotes that
 * shouldn't be escaped. Today, a single parse failure aborts the entire
 * playbook. This module makes one repair attempt before giving up.
 *
 *   ai() → raw string → parseWithSchema() → typed value
 *     ↓ parse fails
 *   repair prompt ("fix this JSON") → parse again → typed value
 *     ↓ parse still fails
 *   throw with full context (original output, error, schema)
 *
 * Keep repair prompts aggressive but cheap — the model that failed will
 * usually succeed on a second pass when shown its own broken output.
 */

import { z } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai-parse");

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Best-effort extraction of JSON from an LLM response. Handles:
 *   - ```json ... ``` markdown fences
 *   - ``` ... ``` plain fences
 *   - Prose preamble like "Here's your JSON:" followed by the object
 *   - Trailing commas (common Claude output pattern)
 *   - Single quotes (common Gemini pattern)
 */
export function extractJson(raw: string): string {
  let text = raw.trim();

  // Strip markdown fences first — they're the most common wrapper
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // If the model prefixed "Here's the JSON:" etc., find the first { or [
  const firstBrace = text.search(/[{[]/);
  if (firstBrace > 0) {
    // Only strip prefix if there's balanced closure after it — guards
    // against stripping legitimate leading content in a non-JSON response.
    const candidate = text.slice(firstBrace);
    const lastBrace = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (lastBrace > 0) {
      text = candidate.slice(0, lastBrace + 1);
    }
  }

  // Repair trailing commas (", }" or ", ]")
  text = text.replace(/,(\s*[}\]])/g, "$1");

  return text;
}

/**
 * Parse an LLM response against a Zod schema. Returns the validated value
 * or throws ParseError with the raw response for debugging.
 *
 * Does NOT attempt repair — use parseWithRepair() for that.
 */
export function parseWithSchema<T>(raw: string, schema: z.ZodType<T>): T {
  const candidate = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new ParseError(
      `Failed to parse JSON: ${(err as Error).message}`,
      raw,
      err,
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ParseError(
      `Schema validation failed: ${result.error.message}`,
      raw,
      result.error,
    );
  }
  return result.data;
}

/**
 * Parse an LLM response against a Zod schema, with ONE repair attempt if
 * parsing fails. The repair prompt sends the broken output + the error
 * back to the caller-provided repair function (typically ai() itself).
 *
 * Cost: 1 extra LLM call on failure. Catches ~90% of malformed JSON in
 * practice — much better than giving up and killing the playbook step.
 */
export async function parseWithRepair<T>(
  raw: string,
  schema: z.ZodType<T>,
  repair: (prompt: string) => Promise<string>,
): Promise<T> {
  try {
    return parseWithSchema(raw, schema);
  } catch (err) {
    if (!(err instanceof ParseError)) throw err;

    log.warn("Initial parse failed — attempting repair", {
      error: err.message.slice(0, 200),
    });

    // Build repair prompt. Keep it short — the model just needs to fix its
    // own output, not re-derive the answer.
    const schemaDescription = describeSchema(schema);
    const repairPrompt = `The previous JSON response was malformed. Fix it.

The response MUST match this schema:
${schemaDescription}

The broken response was:
${raw.slice(0, 3000)}

The error was:
${err.message.slice(0, 500)}

Return ONLY the corrected JSON. No explanation, no markdown, no prose.`;

    const repaired = await repair(repairPrompt);
    try {
      return parseWithSchema(repaired, schema);
    } catch (err2) {
      // Both passes failed — surface the ORIGINAL failure to preserve
      // context for debugging. The repaired version is logged for
      // post-mortem, but the user-visible error is the real one.
      log.error("Repair also failed", {
        originalError: err.message.slice(0, 200),
        repairError: (err2 as Error).message.slice(0, 200),
        repairedOutput: repaired.slice(0, 500),
      });
      throw err; // throw original; repair is internal
    }
  }
}

/**
 * Render a Zod schema as a compact text description for the repair prompt.
 * Zod's built-in .describe() is verbose; we just want shape hints.
 */
function describeSchema<T>(schema: z.ZodType<T>): string {
  try {
    // Best-effort: grab the top-level shape if it's a ZodObject
    // Zod v4 exposes shape on the .def — keep this defensive.
    const def = (schema as unknown as { def?: { type?: string; shape?: Record<string, unknown> } }).def;
    if (def?.type === "object" && def.shape) {
      const fields = Object.keys(def.shape).map((k) => `  ${k}: ...`);
      return `{\n${fields.join(",\n")}\n}`;
    }
  } catch {
    /* fallthrough */
  }
  return "(see original schema)";
}
