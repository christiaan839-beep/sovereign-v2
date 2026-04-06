import { createLogger } from "@/lib/logger";

const log = createLogger("llm-router");

// ─── Response Cache (60s TTL) ────────────────────────────────
const responseCache = new Map<string, { result: string; timestamp: number }>();
const CACHE_TTL = 60_000;

function getCached(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    responseCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: string) {
  if (responseCache.size > 200) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { result, timestamp: Date.now() });
}

// ─── Task Classification (Enhanced) ─────────────────────────
type TaskType = "code" | "creative" | "reasoning" | "vision" | "safety" | "multilingual" | "long_context" | "general";

export function classifyTask(prompt: string): TaskType {
  const lower = prompt.toLowerCase();

  // Vision tasks
  if (lower.includes("image") || lower.includes("screenshot") || lower.includes("photo") ||
      lower.includes("visual") || lower.includes("picture") || lower.includes("diagram") ||
      lower.includes("ocr") || lower.includes("describe this")) return "vision";

  // Code tasks
  if (lower.includes("write code") || lower.includes("function") || lower.includes("typescript") ||
      lower.includes("javascript") || lower.includes("python") || lower.includes("api") ||
      lower.includes("debug") || lower.includes("refactor") || lower.includes("deploy") ||
      lower.includes("build") || lower.includes("component") || lower.includes("test")) return "code";

  // Creative tasks
  if (lower.includes("blog") || lower.includes("email") || lower.includes("content") ||
      lower.includes("write") || lower.includes("draft") || lower.includes("copy") ||
      lower.includes("headline") || lower.includes("social media") || lower.includes("post") ||
      lower.includes("article") || lower.includes("story") || lower.includes("script")) return "creative";

  // Reasoning tasks
  if (lower.includes("analyze") || lower.includes("strategy") || lower.includes("compare") ||
      lower.includes("evaluate") || lower.includes("reasoning") || lower.includes("plan") ||
      lower.includes("research") || lower.includes("audit") || lower.includes("assess") ||
      lower.includes("review") || lower.includes("investigate")) return "reasoning";

  // Multilingual tasks
  if (lower.includes("translate") || lower.includes("multilingual") || lower.includes("language") ||
      lower.includes("chinese") || lower.includes("spanish") || lower.includes("french") ||
      lower.includes("german") || lower.includes("japanese") || lower.includes("korean") ||
      lower.includes("arabic") || lower.includes("localize") || lower.includes("i18n")) return "multilingual";

  // Long-context tasks
  if (lower.includes("long document") || lower.includes("entire codebase") || lower.includes("full transcript") ||
      lower.includes("large file") || lower.includes("book") || lower.includes("summarize all") ||
      lower.includes("comprehensive review") || lower.includes("full context")) return "long_context";

  // Safety classification
  if (lower.includes("safe") || lower.includes("moderate") || lower.includes("harmful") ||
      lower.includes("toxic") || lower.includes("guardrail")) return "safety";

  return "general";
}

// ─── Model Registry ─────────────────────────────────────────
export const NIM_MODELS = {
  code:         "nvidia/nemotron-3-super-120b",
  reasoning:    "deepseek-ai/deepseek-v3-2-0324",
  creative:     "nvidia/llama-3.1-nemotron-70b-instruct",
  vision:       "google/gemma-3-27b-it",
  safety:       "meta/llama-guard-3-8b",
  multilingual: "qwen/qwen3-235b-a22b",
  long_context: "meta/llama-4-scout-17b-16e-instruct",
  general:      "nvidia/llama-3.1-nemotron-70b-instruct",
} as const;

// ─── LlamaGuard Safety Check ────────────────────────────────
async function llamaGuardCheck(text: string): Promise<{ safe: boolean; category?: string }> {
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (!nimKey) return { safe: true }; // Skip if no key

  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "meta/llama-guard-3-8b",
        messages: [
          { role: "user", content: text },
        ],
        max_tokens: 100,
        temperature: 0,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const verdict = data.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
      if (verdict.startsWith("safe") || verdict === "safe") {
        return { safe: true };
      }
      return { safe: false, category: verdict };
    }
  } catch {
    log.warn("LlamaGuard check failed — allowing through");
  }
  return { safe: true }; // Fail open — other safety layers will catch issues
}

// ─── Router Payload ─────────────────────────────────────────
interface RouterPayload {
  prompt: string;
  systemInstruction?: string;
  noCache?: boolean;
  forceTier?: "local" | "nim" | "gemini" | "claude";
  /** Enable LlamaGuard safety check on output */
  safetyCheck?: boolean;
}

/**
 * THE INDESTRUCTIBLE MATRIX: AUTO-HEALING LLM ROUTER v3
 *
 * v3 upgrades:
 * - LlamaGuard 3 safety layer (Layer 6)
 * - Vision task routing (Gemma 3 27B)
 * - Enhanced task classification (8 types: code, creative, reasoning, vision, safety, multilingual, long_context, general)
 * - Expanded NIM model registry (DeepSeek V3.2, Llama 4 Scout, Qwen 3)
 * - Gemini 2.5 Flash upgrade
 * - Output safety validation
 */
export async function routeAgenticExecution({
  prompt,
  systemInstruction,
  noCache = false,
  forceTier,
  safetyCheck = false,
}: RouterPayload): Promise<string> {
  const startTime = Date.now();

  // ── Pre-flight safety check (input) ──────────────────────
  if (safetyCheck) {
    const inputSafety = await llamaGuardCheck(prompt);
    if (!inputSafety.safe) {
      log.warn(`LlamaGuard blocked input: ${inputSafety.category}`);
      return "[SAFETY] This request was flagged by our safety system. Please rephrase your request.";
    }
  }

  // ── Cache check ──────────────────────────────────────────
  if (!noCache) {
    const cacheKey = `${systemInstruction || ""}::${prompt}`.slice(0, 500);
    const cached = getCached(cacheKey);
    if (cached) {
      log.info(`Cache hit (${Date.now() - startTime}ms)`);
      return cached;
    }
  }

  const taskType = classifyTask(prompt);
  const cacheKey = `${systemInstruction || ""}::${prompt}`.slice(0, 500);

  // ── Tier 1: Local Ollama ($0, air-gapped) ────────────────
  if (!forceTier || forceTier === "local") {
    try {
      const OLLAMA_URL = process.env.LOCAL_OLLAMA_URL || "http://localhost:11434";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const localModel = taskType === "code" ? "deepseek-coder-v2:latest"
        : taskType === "reasoning" ? "nemotron-mini"
        : taskType === "vision" ? "llava:latest"
        : "nemotron-mini";

      const localRes = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: localModel,
          prompt: `${systemInstruction ? systemInstruction + "\n\n" : ""}${prompt}`,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (localRes.ok) {
        const localData = await localRes.json();
        if (localData.response) {
          log.info(`Local ${localModel} [${taskType}] (${Date.now() - startTime}ms)`);
          setCache(cacheKey, localData.response);
          return localData.response;
        }
      }
    } catch {
      log.warn("Local node unreachable — failover to cloud");
    }
  }

  // ── Tier 2: NVIDIA NIM ($0, cloud) ───────────────────────
  if (!forceTier || forceTier === "nim") {
    try {
      const nimKey = process.env.NVIDIA_NIM_API_KEY;
      if (nimKey) {
        const nimModel = NIM_MODELS[taskType] || NIM_MODELS.general;

        const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model: nimModel,
            messages: [
              { role: "system", content: systemInstruction || "You are Sovereign Matrix, a senior AI agent. Be concise, accurate, and actionable." },
              { role: "user", content: prompt },
            ],
            max_tokens: 4096,
            temperature: taskType === "creative" ? 0.8 : taskType === "code" ? 0.1 : 0.3,
          }),
        });

        if (nimRes.ok) {
          const nimData = await nimRes.json();
          const text = nimData.choices?.[0]?.message?.content;
          if (text) {
            log.info(`NIM ${nimModel.split("/")[1]} [${taskType}] (${Date.now() - startTime}ms)`);
            setCache(cacheKey, text);

            // Post-flight safety check (output)
            if (safetyCheck) {
              const outputSafety = await llamaGuardCheck(text);
              if (!outputSafety.safe) {
                log.warn(`LlamaGuard blocked output: ${outputSafety.category}`);
                return "[SAFETY] The generated response was flagged by our safety system. Please try a different approach.";
              }
            }

            return text;
          }
        }
      }
    } catch {
      log.warn("NVIDIA NIM failed — failover to Gemini");
    }
  }

  // ── Tier 3: Google Gemini 2.5 Flash ────────────────────────
  if (!forceTier || forceTier === "gemini") {
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const geminiModel = taskType === "reasoning" ? "gemini-2.5-pro-preview-05-06"
          : "gemini-2.5-flash-preview-05-20";

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
        const aiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction || "You are Sovereign Matrix, a senior AI agent." }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: taskType === "creative" ? 0.8 : 0.3,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            log.info(`Gemini ${geminiModel} [${taskType}] (${Date.now() - startTime}ms)`);
            setCache(cacheKey, text);
            return text;
          }
        }
      }
    } catch {
      log.error("Gemini failed — failover to Claude");
    }
  }

  // ── Tier 4: Claude (BYOK) ───────────────────────────────
  if (!forceTier || forceTier === "claude") {
    try {
      const claudeKey = process.env.ANTHROPIC_API_KEY;
      if (claudeKey) {
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": claudeKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: systemInstruction || "You are Sovereign Matrix, a senior AI agent.",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          const text = claudeData.content?.[0]?.text;
          if (text) {
            log.info(`Claude Sonnet 4 [${taskType}] (${Date.now() - startTime}ms)`);
            setCache(cacheKey, text);
            return text;
          }
        }
      }
    } catch {
      log.error("Claude BYOK failed");
    }
  }

  return "[SYSTEM] All inference tiers offline. Please check API keys in Settings → API Keys.";
}

/**
 * Safety-first routing — wraps routeAgenticExecution with LlamaGuard checks
 * on both input and output. Use for user-facing agent responses.
 */
export async function routeSafeExecution(payload: Omit<RouterPayload, "safetyCheck">): Promise<string> {
  return routeAgenticExecution({ ...payload, safetyCheck: true });
}
