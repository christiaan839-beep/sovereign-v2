/**
 * Vision agent factory — thin wrapper over createAgentRoute that
 * adds NIM-backed image understanding.
 *
 * Why this exists:
 *   - Every new vision agent would otherwise re-write the same
 *     "take imageUrl → call NIM vision model → parse structured JSON"
 *     boilerplate. Centralising it here lets a new vision agent be
 *     a ~30-LOC config object.
 *   - The NIM vision models (visionOCR / documentParse / multimodal)
 *     all speak similar APIs via nimChat but have different optimal
 *     use cases. The factory picks the right model per task.
 *
 * Composition:
 *
 *   vision factory config
 *        ↓
 *   createVisionAgentRoute
 *        ↓ wraps
 *   createAgentRoute (auth / rate-limit / audit / quality)
 *        ↓
 *   Next.js POST handler
 *
 * All existing safety machinery (PII scan, quality score, critic)
 * still runs on the structured output. Input-side jailbreak checks
 * are skipped by default because image URLs aren't text prompts.
 *
 * Model choice: `model` field selects between
 *   "ocr"         — nemotron-nano-12b-v2-vl (best document OCR)
 *   "document"    — nemotron-parse-1.1-1b   (structured KV extraction)
 *   "multimodal"  — qwen3.5-vl-400b         (general image+text reasoning)
 *   "vision"      — llama-3.2-90b-vision    (open-source vision chat)
 * All are FREE via NIM.
 */

import { z } from "zod";
import { createAgentRoute, type AgentContext } from "@/lib/agent-factory";
import { NIM_MODELS, nimChat } from "@/lib/nvidia";
import { createLogger } from "@/lib/logger";

const log = createLogger("vision-agent-factory");

/* ─── Types ───────────────────────────────────────────────────── */

export type VisionModel = "ocr" | "document" | "multimodal" | "vision";

export interface VisionAgentConfig<TSchema extends z.ZodTypeAny> {
  /** Agent slug used for logging / telemetry (e.g. "invoice-extractor"). */
  name: string;
  /** Which NIM vision backbone to call. OCR-heavy docs → "ocr". */
  model: VisionModel;
  /**
   * Instruction to the vision model. The factory will append a
   * "return JSON only" footer and pass the image alongside.
   * Keep this concise — NIM vision models have smaller effective
   * context than text-only LLMs.
   */
  extractionPrompt: string;
  /**
   * Zod schema the model's JSON output must conform to. Runs after
   * parsing; throws if the model returns malformed data. The caller
   * receives the typed result via the handler's return.
   */
  outputSchema: TSchema;
  /**
   * Optional extra metadata returned alongside the parsed output
   * (e.g. model name, confidence). Included in the API response.
   */
  extraMeta?: Record<string, unknown>;
}

/** Standard input shape accepted by every vision agent. */
const VISION_INPUT = z.object({
  imageUrl: z
    .string()
    .url()
    .describe("Public https:// URL to the image or PDF"),
  extraContext: z
    .string()
    .optional()
    .describe("Optional free-text context to help the extractor"),
});

/* ─── Internals ───────────────────────────────────────────────── */

function modelId(choice: VisionModel): string {
  switch (choice) {
    case "ocr":
      return NIM_MODELS.visionOCR;
    case "document":
      return NIM_MODELS.documentParse;
    case "multimodal":
      return NIM_MODELS.multimodal;
    case "vision":
      return NIM_MODELS.vision;
  }
}

function extractJson(text: string): unknown {
  // Find the first {...} block. NIM vision models sometimes preface
  // JSON with "Here is the extracted data:" or wrap it in ```json.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object found in vision-model output");
  }
  return JSON.parse(match[0]);
}

/**
 * Build the messages array for a NIM vision call. Matches the
 * OpenAI-compatible content-parts format NIM uses for multimodal:
 * each part declares its `type` ("text" | "image_url") + the
 * appropriate payload. Typed strictly so it's assignable to
 * nimChat's ChatMessage union.
 */
type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function buildVisionMessages(
  imageUrl: string,
  prompt: string,
  extraContext?: string,
): Array<{ role: "user"; content: VisionContentPart[] }> {
  const contextLine = extraContext ? `\n\nContext: ${extraContext}` : "";
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `${prompt}${contextLine}\n\nReturn ONLY a JSON object. No prose before or after.`,
        },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ];
}

/* ─── Factory ─────────────────────────────────────────────────── */

/**
 * Create a vision agent route. The returned function is a Next.js
 * POST handler ready to export from a route.ts file.
 *
 * Example:
 *
 *   export const POST = createVisionAgentRoute({
 *     name: "invoice-extractor",
 *     model: "ocr",
 *     extractionPrompt: "Extract invoice fields…",
 *     outputSchema: InvoiceSchema,
 *   });
 */
export function createVisionAgentRoute<TSchema extends z.ZodTypeAny>(
  config: VisionAgentConfig<TSchema>,
) {
  return createAgentRoute({
    name: config.name,
    schema: VISION_INPUT as unknown as z.ZodObject<z.ZodRawShape>,
    // Image URLs aren't user-authored text prompts — skip jailbreak
    // detection. The synthesized extraction prompt is fully owned by
    // us, not the user.
    skipJailbreakCheck: true,
    handler: async (ctx: AgentContext) => {
      const imageUrl = String(ctx.input.imageUrl ?? "");
      const extraContext = typeof ctx.input.extraContext === "string"
        ? ctx.input.extraContext
        : undefined;

      const messages = buildVisionMessages(
        imageUrl,
        config.extractionPrompt,
        extraContext,
      );

      const raw = await nimChat(modelId(config.model), messages, {
        maxTokens: 1500,
        temperature: 0.1, // low temp — extraction should be deterministic
      });

      let parsed: unknown;
      try {
        parsed = extractJson(raw);
      } catch (err) {
        log.warn("vision model returned non-JSON output", {
          agent: config.name,
          raw: raw.slice(0, 400),
          error: err instanceof Error ? err.message : String(err),
        });
        throw new Error("Vision model returned malformed output. Try a clearer image.");
      }

      // Schema-validate the parsed JSON. A model that hallucinates
      // fields now fails at the type boundary, not silently into the
      // marketplace earnings ledger.
      const validated = config.outputSchema.parse(parsed);

      return {
        result: validated,
        meta: {
          model: modelId(config.model),
          ...config.extraMeta,
        },
      };
    },
  });
}
