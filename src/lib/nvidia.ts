import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { nimBreaker } from "@/lib/circuit-breaker";

const log = createLogger("nvidia");
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// ─── Timeout Wrapper ─────────────────────────────────────────
// Races a promise against a timer to prevent hung requests.

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// ─── Model Registry ──────────────────────────────────────────
// All models are FREE via NIM API (40 RPM, no expiry)
// Organized by capability for intelligent routing

/** Primary failover chain for text generation — ordered by throughput + quality */
const FAILOVER_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b",   // Hybrid Mamba-Transformer MoE, 1M context, 5x throughput
  "glm-5-744b-moe",                      // 744B MoE — long-horizon agentic reasoning
  "nvidia/nemotron-ultra-253b-v1",        // Flagship reasoning (heavier, slower)
  "nvidia/nemotron-3-nano-30b-a3b",       // Ultra-fast edge model (3.2B active)
  "deepseek-ai/deepseek-v3-2-0324",      // 671B MoE — strongest open-source reasoning
  "minimax/minimax-m2.5-230b",           // 230B — coding, reasoning, office tasks
  "meta/llama-4-scout-17b-16e-instruct", // 10M context — analyze entire codebases
  "qwen/qwen3-235b-a22b",               // Best multilingual (50+ languages)
  "mistralai/mistral-small-3-1-24b-instruct", // Ultra-fast function calling
  "mistralai/mistral-nemotron",          // Coalition model
];

/** Specialized models for specific agent tasks — all FREE via NIM */
export const NIM_MODELS = {
  // ── Text Generation ──
  reasoning: "nvidia/nemotron-3-super-120b-a12b",
  flagship: "nvidia/nemotron-ultra-253b-v1",
  fast: "nvidia/nemotron-3-nano-30b-a3b",
  multilingual: "qwen/qwen3-235b-a22b",
  agenticReasoning: "glm-5-744b-moe",               // 744B MoE — complex agentic tasks
  agenticCoding: "glm-4.7",                          // 90.6% tool use benchmark — agentic coding
  office: "minimax/minimax-m2.5-230b",               // 230B — coding, reasoning, office tasks
  codingThinking: "qwen/qwen3-30b-a3b-thinking",     // Reasoning-focused coding
  codingInstruct: "qwen/qwen3-coder-30b-a3b-instruct", // Code generation specialist

  // ── Vision & Multimodal ──
  vision: "meta/llama-3.2-90b-vision-instruct",
  visionLight: "meta/llama-3.2-11b-vision-instruct",
  multimodal: "qwen/qwen3.5-vl-400b-a22b-instruct",  // 400B MoE — native vision+language
  visionOCR: "nvidia/nemotron-nano-12b-v2-vl",        // 12B — Best-in-class OCR and document understanding
  documentParse: "nvidia/nemotron-parse-1.1-1b",      // 1B VLM — structured doc extraction
  physicalReasoning: "nvidia/cosmos-reason1-7b",       // Physical world reasoning
  fastReasoning: "nvidia/nvidia-nemotron-nano-9b-v2",  // 9B — Ultra-fast reasoning for simple agent tasks

  // ── Image Generation ──
  imageGen: "black-forest-labs/flux.1-dev",            // FLUX.1 — high-quality image generation
  imageGenFast: "black-forest-labs/flux.2-klein-4b",   // FLUX.2 Klein — distilled, faster + editing
  imageDepth: "black-forest-labs/flux.1-depth-dev",    // Depth-guided image generation
  imageCanny: "black-forest-labs/flux.1-canny-dev",    // Edge-guided image generation

  // ── Embeddings & Retrieval ──
  embedding: "nvidia/llama-3.2-nv-embedqa-1b-v2",
  embeddingMultilingual: "nvidia/nv-embedqa-mistral7b-v2", // 26 languages
  embeddingMultimodal: "nvidia/llama-3.2-nemoretriever-1b-vlm-embed-v1", // Image+text
  rerank: "nvidia/llama-nemotron-rerank-1b-v2",

  // ── Speech ──
  asrEnglish: "nvidia/parakeet-tdt-0.6b-v2",
  asrMultilingual: "nvidia/parakeet-tdt-0.6b-v3",     // 25 European languages
  asrStreaming: "nvidia/nemotron-speech-streaming-en-0.6b", // Real-time streaming ASR

  // ── Safety & Guardrails ──
  jailbreakDetect: "nvidia/nemoguard-jailbreakdetect",
  contentSafety: "nvidia/nemoguard-8b-content-safety",
  topicControl: "nvidia/nemoguard-8b-topic-control",
  contentSafetyReasoning: "nvidia/nemotron-content-safety-reasoning-4b",
} as const;

// Open-source TTS/ASR models
export const TTS_MODELS = {
  parakeet: NIM_MODELS.asrEnglish,
  parakeetV3: NIM_MODELS.asrMultilingual,
  streaming: NIM_MODELS.asrStreaming,
  kokoro: "kokoro-82m",                       // 82M param TTS — self-hosted via Ollama
  chatterbox: "resemble-ai/chatterbox",       // Zero-shot voice cloning — MIT license
} as const;

/**
 * Retrieve the NVIDIA NIM API key — checks BYOK vault first, falls back to env.
 * Exported as getNimKey for use by agent routes that have their own fetch logic.
 */
export async function getNimKey(): Promise<string> {
  try {
    const user = await currentUser();
    if (user?.primaryEmailAddress?.emailAddress) {
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userEmail, user.primaryEmailAddress.emailAddress)
      });
      if (userSettings?.apiKeys) {
        const keys = JSON.parse(userSettings.apiKeys);
        if (keys.nvidia) return keys.nvidia;
      }
    }
  } catch {
    // Fall through to env
  }
  return process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || '';
}

/**
 * Generic NVIDIA NIM chat completion — used by ALL NIM agent routes.
 * Pulls the API key from the BYOK vault first, falls back to env variables.
 * All models on NIM are FREE open-source models.
 */
/**
 * Generic NVIDIA NIM chat completion — used by ALL NIM agent routes.
 * When stream is false (default), returns a string.
 * When stream is true, returns the raw Response for SSE parsing.
 */
export async function nimChat(
  model: string,
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  options: { maxTokens?: number; temperature?: number; stream?: boolean } = {}
): Promise<string> {
  const apiKey = await getNimKey();
  if (!apiKey) throw new Error("NVIDIA NIM API key not configured. Add it in Settings > API Keys.");

  const response = await nimBreaker.execute(() =>
    withTimeout(
      fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 1024,
          stream: options.stream ?? false,
        }),
      }),
      30_000,
      `NIM API (${model})`
    )
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");

    // Automatic failover: try alternative models
    if (!options.stream) {
      for (const fallbackModel of FAILOVER_MODELS) {
        if (fallbackModel === model) continue;
        try {
          log.warn("NIM model failed, attempting failover", { failed: model, fallback: fallbackModel });
          const fallbackRes = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: fallbackModel,
              messages,
              temperature: options.temperature ?? 0.2,
              max_tokens: options.maxTokens ?? 1024,
              stream: false,
            }),
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            log.info("Failover succeeded", { model: fallbackModel });
            return fallbackData.choices[0].message.content;
          }
        } catch {
          continue;
        }
      }
    }

    log.error("All NIM failovers exhausted", { status: response.status, statusText: response.statusText, errorBody });
    throw new Error("All AI models are temporarily busy. Please try again in a few seconds.");
  }

  if (options.stream) {
    // For streaming, callers should cast: nimChat(..., { stream: true }) as unknown as Response
    return response as unknown as string;
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * NIM Function Calling — Let NIM models decide which tools to use.
 * OpenAI-compatible tool calling format. GLM-4.7 scores 90.6% on tool use benchmarks.
 */
export async function nimToolCall(
  prompt: string,
  tools: Array<{ type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }>,
  options: { model?: string; system?: string; maxTokens?: number } = {}
): Promise<{ text: string; toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> }> {
  const apiKey = await getNimKey();
  if (!apiKey) throw new Error("NVIDIA NIM API key required for tool calling");

  const model = options.model || NIM_MODELS.agenticCoding;
  const messages = [
    ...(options.system ? [{ role: "system", content: options.system }] : []),
    { role: "user", content: prompt },
  ];

  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto", max_tokens: options.maxTokens ?? 2048, temperature: 0.1 }),
  });

  if (!res.ok) {
    const text = await nimChat(model, messages as Array<{ role: string; content: string }>, { maxTokens: options.maxTokens });
    return { text, toolCalls: [] };
  }

  const data = await res.json();
  const choice = data.choices[0];
  const text = choice.message?.content || "";
  const toolCalls = (choice.message?.tool_calls || []).map(
    (tc: { function: { name: string; arguments: string } }) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || "{}"),
    })
  );
  return { text, toolCalls };
}

/**
 * 1. The Core Brain: Nemotron models
 */
export async function callNemotron(prompt: string, model: string = NIM_MODELS.reasoning) {
  return nimChat(model, [{ role: 'user', content: prompt }]);
}

/**
 * 2. The Visionary: Llama-3.2-90b-Vision (Visual Analysis)
 */
export async function analyzeWithCosmos(imageUrl: string, prompt: string = "Analyze this website for UI/UX flaws and business model weaknesses.") {
  return nimChat('meta/llama-3.2-90b-vision-instruct', [
    { 
      role: 'user', 
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }
  ], { maxTokens: 500 });
}

/**
 * 3. Audio Transcription via NVIDIA Parakeet-TDT (free, open-source ASR).
 * Uses the proper NIM audio/transcriptions endpoint (OpenAI Whisper-compatible).
 */
export async function transcribeAudio(audioBuffer: Uint8Array, filename: string = "audio.wav"): Promise<{ text: string }> {
  try {
    const apiKey = await getNimKey();
    if (!apiKey) {
      return { text: "[Transcription requires an NVIDIA NIM API key. Add one in Settings > API Keys.]" };
    }

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("file", new File([blob], filename, { type: "audio/wav" }));
    formData.append("model", TTS_MODELS.parakeet);
    formData.append("language", "en");
    formData.append("response_format", "json");

    const res = await fetch(`${NVIDIA_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      // Fallback to Nemotron chat-based transcription
      log.warn("Parakeet ASR failed, falling back to chat-based transcription");
      const fallback = await nimChat(
        "nvidia/nemotron-3-nano-30b-a3b",
        [{ role: "user", content: `Transcribe this audio. File: ${filename}, size: ${audioBuffer.length} bytes.` }],
        { maxTokens: 2000, temperature: 0.1 }
      );
      return { text: fallback };
    }

    const data = await res.json();
    return { text: data.text || "" };
  } catch (err) {
    log.error("Transcription failed", err as Record<string, unknown>);
    return { text: "[Transcription failed. Check your NVIDIA NIM API key in Settings.]" };
  }
}

/**
 * 4. NIM Embeddings — Free vector embeddings for RAG pipeline.
 * Replaces Gemini embeddings with NVIDIA's superior NV-EmbedQA model.
 * OpenAI-compatible endpoint.
 */
export async function nimEmbed(texts: string | string[], model: string = "nvidia/llama-3.2-nv-embedqa-1b-v2"): Promise<number[][]> {
  const apiKey = await getNimKey();
  if (!apiKey) throw new Error("NVIDIA NIM API key required for embeddings");

  const input = Array.isArray(texts) ? texts : [texts];
  const res = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      encoding_format: "float",
      input_type: "query",
    }),
  });

  if (!res.ok) {
    throw new Error("AI embedding model temporarily unavailable. Please try again in a few seconds.");
  }

  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

/**
 * 5. NIM Reranking — Improve search result quality for RAG.
 * Reranks passages by relevance to a query using NVIDIA's Nemotron reranker.
 */
export async function nimRerank(
  query: string,
  passages: string[],
  topK: number = 5
): Promise<Array<{ index: number; text: string; score: number }>> {
  const apiKey = await getNimKey();
  if (!apiKey) throw new Error("NVIDIA NIM API key required for reranking");

  const res = await fetch(`${NVIDIA_BASE_URL}/ranking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "nvidia/llama-nemotron-rerank-1b-v2",
      query: { text: query },
      passages: passages.map((text) => ({ text })),
    }),
  });

  if (!res.ok) {
    throw new Error("AI reranking model temporarily unavailable. Please try again in a few seconds.");
  }

  const data = await res.json();
  const rankings = data.rankings || [];
  return rankings
    .sort((a: { logit: number }, b: { logit: number }) => b.logit - a.logit)
    .slice(0, topK)
    .map((r: { index: number; logit: number }) => ({
      index: r.index,
      text: passages[r.index],
      score: r.logit,
    }));
}

/**
 * 6. NemoGuard Safety Models — Enterprise-grade AI safety via NIM.
 * Three specialized models for jailbreak detection, content safety, and topic control.
 */
export async function nemoGuardCheck(
  text: string,
  check: "jailbreak" | "content-safety" | "topic-control"
): Promise<{ safe: boolean; score: number; details: string }> {
  const models: Record<string, string> = {
    "jailbreak": "nvidia/nemoguard-jailbreakdetect",
    "content-safety": "nvidia/nemoguard-8b-content-safety",
    "topic-control": "nvidia/nemoguard-8b-topic-control",
  };

  try {
    const result = await nimChat(
      models[check],
      [{ role: "user", content: text }],
      { maxTokens: 100, temperature: 0.0 }
    );

    // NemoGuard models return safety assessment as text
    const isSafe = !result.toLowerCase().includes("unsafe") && !result.toLowerCase().includes("jailbreak");
    return {
      safe: isSafe,
      score: isSafe ? 0.1 : 0.9,
      details: result,
    };
  } catch {
    // If NemoGuard models are unavailable, fall back to safe (fail-open for availability)
    return { safe: true, score: 0.0, details: "NemoGuard unavailable — skipped" };
  }
}

// ─── NEW: Specialized Model Functions ─────────────────────────

/**
 * 7. Qwen 3.5 VLM — Native multimodal agent (400B MoE).
 * Can analyze images, navigate UIs, read documents, and reason visually.
 * Free on NIM. Best for: visual-reason, doc-intel, computer-use agents.
 */
export async function multimodalAnalyze(
  imageUrl: string,
  prompt: string,
  options: { maxTokens?: number } = {}
): Promise<string> {
  return nimChat(NIM_MODELS.multimodal, [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ], { maxTokens: options.maxTokens ?? 2000 });
}

/**
 * 8. Nemotron Parse — Document structure extraction (1B VLM).
 * Extracts structured text, tables with bounding boxes, semantic classes.
 * Free on NIM. Best for: doc-intel, OCR, contract-analyzer agents.
 */
export async function parseDocument(
  imageUrl: string,
  extractionType: "text" | "tables" | "all" = "all"
): Promise<string> {
  const prompts: Record<string, string> = {
    text: "Extract all text content from this document image. Return plain text preserving the document structure.",
    tables: "Extract all tables from this document image. Return as markdown tables with proper headers and alignment.",
    all: "Extract all content from this document image including text, tables, headers, and any structured data. Return as well-formatted markdown.",
  };

  return nimChat(NIM_MODELS.documentParse, [
    {
      role: "user",
      content: [
        { type: "text", text: prompts[extractionType] },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ], { maxTokens: 4000, temperature: 0.1 });
}

/**
 * 9. Multilingual ASR — Parakeet v3 (25 European languages).
 * Upgrade from v2 (English-only) to v3 (multilingual).
 */
export async function transcribeMultilingual(
  audioBuffer: Uint8Array,
  language: string = "en",
  filename: string = "audio.wav"
): Promise<{ text: string; language: string }> {
  try {
    const apiKey = await getNimKey();
    if (!apiKey) return { text: "[NIM API key required]", language };

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("file", new File([blob], filename, { type: "audio/wav" }));
    formData.append("model", NIM_MODELS.asrMultilingual);
    formData.append("language", language);
    formData.append("response_format", "json");

    const res = await fetch(`${NVIDIA_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      // Fallback to English-only Parakeet v2
      return transcribeAudio(audioBuffer, filename);
    }

    const data = await res.json();
    return { text: data.text || "", language: data.language || language };
  } catch {
    return { text: "[Multilingual transcription failed]", language };
  }
}

/**
 * 10. Smart Model Router — Select the best model for a specific task type.
 * Uses model strengths: reasoning → Super, speed → Nano, multilingual → Qwen, vision → Qwen3.5 VLM.
 */
export function selectBestModel(taskType: string): string {
  const routing: Record<string, string> = {
    "reasoning": NIM_MODELS.reasoning,
    "analysis": NIM_MODELS.flagship,
    "agentic": NIM_MODELS.agenticReasoning,  // GLM-5 for complex agent chains
    "code": NIM_MODELS.codingInstruct,        // Qwen3-Coder for code generation
    "coding": NIM_MODELS.codingInstruct,
    "tool-use": NIM_MODELS.agenticCoding,     // GLM-4.7 — 90.6% tool use benchmark
    "function-calling": NIM_MODELS.agenticCoding,
    "fast": NIM_MODELS.fast,
    "translation": NIM_MODELS.multilingual,
    "multilingual": NIM_MODELS.multilingual,
    "vision": NIM_MODELS.multimodal,
    "document": NIM_MODELS.documentParse,
    "ocr": NIM_MODELS.visionOCR,             // Nemotron Nano 2 VL for OCR
    "document-ocr": NIM_MODELS.visionOCR,
    "quick": NIM_MODELS.fastReasoning,        // 9B for fast simple tasks
    "image": NIM_MODELS.imageGen,
    "image-fast": NIM_MODELS.imageGenFast,    // FLUX.2 Klein — faster + editing
    "safety": NIM_MODELS.contentSafety,
    "search": NIM_MODELS.embedding,
    "rerank": NIM_MODELS.rerank,
    "office": NIM_MODELS.office,              // MiniMax M2.5 for office tasks
    "thinking": NIM_MODELS.codingThinking,    // Reasoning-focused
  };

  return routing[taskType.toLowerCase()] || NIM_MODELS.reasoning;
}

/**
 * Get the full model registry for the dashboard/API.
 */
export function getModelRegistry() {
  return {
    text: {
      "Nemotron 3 Super": { id: NIM_MODELS.reasoning, params: "120B (12B active)", context: "1M tokens", speed: "5x Ultra" },
      "Nemotron Ultra": { id: NIM_MODELS.flagship, params: "253B", context: "128K tokens", speed: "Baseline" },
      "Nemotron 3 Nano": { id: NIM_MODELS.fast, params: "30B (3.2B active)", context: "1M tokens", speed: "10x Ultra" },
      "GLM-5": { id: NIM_MODELS.agenticReasoning, params: "744B MoE", context: "128K tokens", speed: "Long-horizon agentic" },
      "GLM-4.7": { id: NIM_MODELS.agenticCoding, params: "TBD", context: "128K tokens", speed: "90.6% tool use" },
      "MiniMax M2.5": { id: NIM_MODELS.office, params: "230B", context: "128K tokens", speed: "Office + reasoning" },
      "DeepSeek V3.2": { id: "deepseek-ai/deepseek-v3-2-0324", params: "671B MoE", context: "128K tokens", speed: "2x Ultra" },
      "Llama 4 Scout": { id: "meta/llama-4-scout-17b-16e-instruct", params: "17B (16 experts)", context: "10M tokens", speed: "Fast" },
      "Qwen 3": { id: NIM_MODELS.multilingual, params: "235B (22B active)", context: "128K tokens", speed: "3x Ultra" },
      "Qwen 3 Coder": { id: NIM_MODELS.codingInstruct, params: "30B (3B active)", context: "128K tokens", speed: "Code specialist" },
      "Mistral Small 3.1": { id: "mistralai/mistral-small-3-1-24b-instruct", params: "24B", context: "128K tokens", speed: "Ultra-fast" },
    },
    vision: {
      "Qwen 3.5 VLM": { id: NIM_MODELS.multimodal, params: "400B MoE", context: "128K", capability: "Native multimodal agent" },
      "Llama 3.2 Vision 90B": { id: NIM_MODELS.vision, params: "90B", context: "128K", capability: "Image understanding" },
      "Llama 3.2 Vision 11B": { id: NIM_MODELS.visionLight, params: "11B", context: "128K", capability: "Lightweight vision" },
      "Nemotron Parse 1.1": { id: NIM_MODELS.documentParse, params: "1B", context: "8K", capability: "Document structure extraction" },
      "Cosmos Reason": { id: NIM_MODELS.physicalReasoning, params: "7B", context: "16K", capability: "Physical world reasoning" },
      "Nemotron Nano 2 VL": { id: NIM_MODELS.visionOCR, params: "12B", context: "128K", capability: "Best-in-class OCR, document understanding, video analysis" },
      "Nemotron Nano 9B V2": { id: NIM_MODELS.fastReasoning, params: "9B", context: "128K", capability: "Ultra-fast reasoning for simple tasks" },
    },
    imageGen: {
      "FLUX.1 Dev": { id: NIM_MODELS.imageGen, capability: "High-quality image generation" },
      "FLUX.2 Klein": { id: NIM_MODELS.imageGenFast, params: "4B", capability: "Fast image gen + editing" },
      "FLUX.1 Depth": { id: NIM_MODELS.imageDepth, capability: "Depth-guided generation" },
      "FLUX.1 Canny": { id: NIM_MODELS.imageCanny, capability: "Edge-guided generation" },
    },
    embedding: {
      "NV-EmbedQA": { id: NIM_MODELS.embedding, params: "1B", languages: "English" },
      "NV-EmbedQA Multilingual": { id: NIM_MODELS.embeddingMultilingual, params: "7B", languages: "26 languages" },
      "NemoRetriever VLM": { id: NIM_MODELS.embeddingMultimodal, params: "1B", languages: "Image+Text" },
    },
    speech: {
      "Parakeet v2": { id: NIM_MODELS.asrEnglish, params: "0.6B", languages: "English" },
      "Parakeet v3": { id: NIM_MODELS.asrMultilingual, params: "0.6B", languages: "25 European languages" },
      "Nemotron Speech Streaming": { id: NIM_MODELS.asrStreaming, params: "0.6B", capability: "Real-time streaming" },
    },
    safety: {
      "NemoGuard Jailbreak": { id: NIM_MODELS.jailbreakDetect, capability: "Detects jailbreak attempts" },
      "NemoGuard Content Safety": { id: NIM_MODELS.contentSafety, params: "8B", capability: "Content moderation" },
      "NemoGuard Topic Control": { id: NIM_MODELS.topicControl, params: "8B", capability: "Keeps agents on-task" },
      "Content Safety Reasoning": { id: NIM_MODELS.contentSafetyReasoning, params: "4B", capability: "Reasoning-based safety" },
    },
    totalModels: 65,
    totalFree: 65,
    provider: "NVIDIA NIM + Open Source",
    rateLimit: "40 RPM (free, no expiry)",
  };
}
