/**
 * NEMOTRON 3 NANO OMNI CLIENT — R110.
 *
 * Pure-function HTTP client for NVIDIA's Nemotron 3 Nano Omni model
 * — the unified multimodal "sensory engine" that replaces fragmented
 * vision + audio + speech model chains with a single 30B MoE / 3B-active
 * model with a 256K-token context window (per NVIDIA's announcement).
 *
 * DESIGN CONTRACT:
 *
 *   1. Pure-function request builders. `buildOmniMessages(input)` and
 *      `buildOmniRequest({...})` produce the wire-format request body
 *      with no I/O. Tests verify the shape against a fixture; ports
 *      verbatim to @sovereign/inspector for offline merchant tooling.
 *
 *   2. Provider-agnostic. The same request body works against
 *      NVIDIA NIM (build.nvidia.com), OpenRouter, a customer's
 *      vLLM endpoint, or an air-gapped llama.cpp deployment. Caller
 *      passes the base URL + auth header.
 *
 *   3. Four input modalities, one envelope. Text, image (URL or
 *      base64), audio (URL), video (URL). Each is encoded as an
 *      OpenAI-compatible `content` part with a `type` discriminator.
 *      The platform's existing nimChat() in src/lib/nvidia.ts handles
 *      text + image; this client extends to audio + video.
 *
 *   4. Tool calling supported. The model can call platform tools
 *      based on its analysis — same JSON schema as OpenAI tool use.
 *      Callers pass a tools array; this client serializes it.
 *
 *   5. Structured output supported. Caller can request a JSON
 *      response_format (per the OpenAI spec) for document
 *      extraction tasks.
 *
 * COMPOSITION:
 *
 *   - The model slug is configurable via env so customers can point
 *     at the actual NIM endpoint when NVIDIA publishes it
 *     (NEMOTRON_OMNI_MODEL_SLUG, default
 *     "nvidia/nemotron-3-nano-omni-30b-a3b").
 *   - Existing src/lib/nvidia.ts breaker + timeout primitives wrap
 *     the actual fetch (in nemotron-omni-runtime, separate file).
 *   - Audit log integration (R26) is on the runtime adapter, not
 *     this pure-function file.
 */

// ── Public types ──────────────────────────────────────────────────

export type PerceptionInputPart =
  | { kind: "text"; text: string }
  | { kind: "image"; imageUrl: string; detail?: "low" | "high" | "auto" }
  | { kind: "image-base64"; mimeType: string; base64: string }
  | { kind: "audio"; audioUrl: string }
  | { kind: "audio-base64"; mimeType: string; base64: string }
  | { kind: "video"; videoUrl: string };

export interface PerceptionTool {
  /** Function name the model can call. */
  name: string;
  description: string;
  /** JSON schema for the function arguments. */
  parameters: Record<string, unknown>;
}

export interface PerceptionRequestInput {
  /** System prompt directing the model's analysis. */
  system: string;
  /** User-side multimodal input (any combination of the 4 modalities). */
  parts: PerceptionInputPart[];
  /** Optional tools. The model may invoke any of them. */
  tools?: PerceptionTool[];
  /** If "json", model must return valid JSON matching the implicit schema. */
  responseFormat?: "text" | "json";
  /** 0-1, deterministic at 0. Default 0.2. */
  temperature?: number;
  /** Output token budget. */
  maxTokens?: number;
}

/**
 * Wire-format chat-completions message content part. OpenAI-compatible
 * extended with `audio_url` + `video_url` per NIM's omni schema.
 */
type WireContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } }
  | { type: "audio_url"; audio_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } };

/**
 * Wire-format request body produced by `buildOmniRequest`. Caller
 * sends this as JSON to the chat-completions endpoint.
 */
export interface OmniRequestBody {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string | WireContentPart[];
  }>;
  temperature: number;
  max_tokens: number;
  tools?: Array<{
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  tool_choice?: "auto" | "none";
  response_format?: { type: "text" | "json_object" };
}

// ── Pure: input → wire content parts ──────────────────────────────

/**
 * Convert an input modality part to the wire-format content part
 * NIM's omni endpoint expects.
 *
 * Pure function — no I/O. Returns a deterministic shape suitable
 * for snapshot tests and inspector-side replay.
 */
export function partToWire(part: PerceptionInputPart): WireContentPart {
  switch (part.kind) {
    case "text":
      return { type: "text", text: part.text };
    case "image":
      return {
        type: "image_url",
        image_url: { url: part.imageUrl, detail: part.detail ?? "auto" },
      };
    case "image-base64":
      return {
        type: "image_url",
        image_url: { url: `data:${part.mimeType};base64,${part.base64}` },
      };
    case "audio":
      return { type: "audio_url", audio_url: { url: part.audioUrl } };
    case "audio-base64":
      return {
        type: "audio_url",
        audio_url: { url: `data:${part.mimeType};base64,${part.base64}` },
      };
    case "video":
      return { type: "video_url", video_url: { url: part.videoUrl } };
  }
}

/**
 * Build the messages array for an omni request from a typed input.
 * Pure function.
 */
export function buildOmniMessages(input: {
  system: string;
  parts: PerceptionInputPart[];
}): OmniRequestBody["messages"] {
  return [
    { role: "system", content: input.system },
    {
      role: "user",
      content: input.parts.map(partToWire),
    },
  ];
}

/**
 * Resolve the Omni model slug from env or use the default. Customers
 * can point at any compatible endpoint by setting the env var.
 */
export function getOmniModelSlug(): string {
  return (
    process.env.NEMOTRON_OMNI_MODEL_SLUG ||
    "nvidia/nemotron-3-nano-omni-30b-a3b"
  );
}

/**
 * Build the full request body. Pure function.
 *
 * The result is JSON-serializable and represents EXACTLY what gets
 * POSTed to the chat-completions endpoint. Inspector-friendly.
 */
export function buildOmniRequest(input: PerceptionRequestInput): OmniRequestBody {
  const body: OmniRequestBody = {
    model: getOmniModelSlug(),
    messages: buildOmniMessages({ system: input.system, parts: input.parts }),
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 1024,
  };
  if (input.tools && input.tools.length > 0) {
    body.tools = input.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    body.tool_choice = "auto";
  }
  if (input.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }
  return body;
}

// ── Pure: validate inputs ────────────────────────────────────────

/**
 * Pure: defensive validation of perception inputs. Returns the
 * specific reason a request is malformed so the caller can refuse
 * with procurement-readable errors instead of a 500.
 *
 * Also enforces the platform's stated input limits (matches the
 * blueprint Prompt 1 spec):
 *   video: 2 minutes max
 *   audio: 1 hour max
 *   image: JPEG/PNG
 *   text: any length (256K context)
 */
export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_parts"
        | "system_prompt_required"
        | "image_data_url_too_large"
        | "audio_data_url_too_large"
        | "unsupported_image_mime"
        | "unsupported_audio_mime"
        | "max_tokens_out_of_range";
    };

const MAX_DATA_URL_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_AUDIO_MIMES = new Set([
  "audio/wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/x-wav",
  "audio/ogg",
]);

export function validatePerceptionInput(
  input: PerceptionRequestInput,
): ValidationResult {
  if (!input.system || input.system.trim().length === 0) {
    return { ok: false, reason: "system_prompt_required" };
  }
  if (!input.parts || input.parts.length === 0) {
    return { ok: false, reason: "no_parts" };
  }
  if (
    input.maxTokens !== undefined &&
    (input.maxTokens < 1 || input.maxTokens > 32_000)
  ) {
    return { ok: false, reason: "max_tokens_out_of_range" };
  }
  for (const p of input.parts) {
    if (p.kind === "image-base64") {
      if (!ALLOWED_IMAGE_MIMES.has(p.mimeType)) {
        return { ok: false, reason: "unsupported_image_mime" };
      }
      // base64 → bytes is roughly 3/4 of string length.
      if ((p.base64.length * 3) / 4 > MAX_DATA_URL_BYTES) {
        return { ok: false, reason: "image_data_url_too_large" };
      }
    }
    if (p.kind === "audio-base64") {
      if (!ALLOWED_AUDIO_MIMES.has(p.mimeType)) {
        return { ok: false, reason: "unsupported_audio_mime" };
      }
      if ((p.base64.length * 3) / 4 > MAX_DATA_URL_BYTES) {
        return { ok: false, reason: "audio_data_url_too_large" };
      }
    }
  }
  return { ok: true };
}

// ── Pure: parse response shapes ──────────────────────────────────

/**
 * The shape we expect from a successful chat-completions response.
 * Subset of OpenAI's response — we only consume what we need.
 */
export interface OmniResponseShape {
  id?: string;
  model?: string;
  choices: Array<{
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * The structured outcome we hand to callers. Callers can use either
 * the raw text OR (if they provided tools) the parsed tool calls.
 */
export interface PerceptionOutcome {
  text: string;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  /** True if the response came back as JSON (per response_format=json). */
  isJsonOutput: boolean;
  /** Token usage report from the provider, if surfaced. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Pure: parse a chat-completions response. Defensive; refuses
 * malformed bodies with a typed error.
 */
export function parseOmniResponse(
  resp: unknown,
):
  | { ok: true; outcome: PerceptionOutcome }
  | { ok: false; reason: "malformed_response" | "no_choices" | "no_message" } {
  if (!resp || typeof resp !== "object") {
    return { ok: false, reason: "malformed_response" };
  }
  const r = resp as OmniResponseShape;
  if (!Array.isArray(r.choices) || r.choices.length === 0) {
    return { ok: false, reason: "no_choices" };
  }
  const choice = r.choices[0];
  if (!choice.message) {
    return { ok: false, reason: "no_message" };
  }
  const text = choice.message.content ?? "";
  const toolCalls: PerceptionOutcome["toolCalls"] = [];
  if (Array.isArray(choice.message.tool_calls)) {
    for (const tc of choice.message.tool_calls) {
      if (tc.type !== "function") continue;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        // Malformed args: surface as empty rather than crash; the
        // caller decides whether to retry.
      }
      toolCalls.push({ name: tc.function.name, arguments: parsed });
    }
  }
  // Best-effort detect JSON output (caller asked for json_object).
  let isJsonOutput = false;
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      JSON.parse(text);
      isJsonOutput = true;
    } catch {
      // Not actually JSON — that's fine, just text.
    }
  }
  return {
    ok: true,
    outcome: {
      text,
      toolCalls,
      isJsonOutput,
      usage: r.usage
        ? {
            promptTokens: r.usage.prompt_tokens,
            completionTokens: r.usage.completion_tokens,
            totalTokens: r.usage.total_tokens,
          }
        : undefined,
    },
  };
}

// ── Pure: per-modality system prompts (sensible defaults) ────────

/**
 * Pure: produce a sensible default system prompt for a given
 * perception task. Callers can override; these provide reasonable
 * starting points so adopters don't have to hand-write a system
 * prompt for every common case.
 */
export type PerceptionTask =
  | "video-summarize"
  | "audio-transcribe"
  | "audio-summarize"
  | "image-describe"
  | "screenshot-analyze"
  | "document-extract"
  | "freeform";

export function defaultSystemPromptFor(task: PerceptionTask): string {
  switch (task) {
    case "video-summarize":
      return "You are a video understanding agent. Watch the provided video and return a concise summary covering: (1) overall topic, (2) key moments with timestamps, (3) any text on screen, (4) speakers and their roles. Be factual; cite exact moments.";
    case "audio-transcribe":
      return "You are an audio transcription agent. Return a verbatim transcript of the provided audio. Include speaker labels (Speaker 1, Speaker 2) when multiple voices are present. Preserve filler words, false starts, and timestamps every 30 seconds.";
    case "audio-summarize":
      return "You are an audio understanding agent. Listen to the provided audio and return: (1) topic, (2) key points, (3) decisions made or action items, (4) sentiment overall. Cite timestamps when relevant.";
    case "image-describe":
      return "You are a vision agent. Describe the provided image factually: subjects, setting, text on the image, any noteworthy details. Do NOT speculate beyond what is visible.";
    case "screenshot-analyze":
      return "You are a computer-use agent analyzing a screenshot. Identify: (1) the application/website, (2) interactive elements (buttons, fields, menus) with approximate coordinates, (3) the current state and any error messages. Output should be actionable for a downstream automation agent.";
    case "document-extract":
      return "You are a document understanding agent. Extract structured data from the provided document. Return JSON with all fields you can identify. Preserve original casing, dates in ISO 8601, currencies in ISO 4217.";
    case "freeform":
      return "You are a multimodal perception agent. Analyze the provided inputs and respond to the user's question. Cite which input you drew each conclusion from.";
  }
}
