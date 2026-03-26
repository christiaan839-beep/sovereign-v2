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
  // Cap cache at 200 entries to prevent memory leaks
  if (responseCache.size > 200) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { result, timestamp: Date.now() });
}

// ─── Task Classification ─────────────────────────────────────
type TaskType = "code" | "creative" | "reasoning" | "general";

function classifyTask(prompt: string): TaskType {
  const lower = prompt.toLowerCase();
  if (lower.includes("write code") || lower.includes("function") || lower.includes("typescript") ||
      lower.includes("javascript") || lower.includes("python") || lower.includes("api") ||
      lower.includes("debug") || lower.includes("refactor")) return "code";
  if (lower.includes("blog") || lower.includes("email") || lower.includes("content") ||
      lower.includes("write") || lower.includes("draft") || lower.includes("copy") ||
      lower.includes("headline") || lower.includes("social media")) return "creative";
  if (lower.includes("analyze") || lower.includes("strategy") || lower.includes("compare") ||
      lower.includes("evaluate") || lower.includes("reasoning") || lower.includes("plan")) return "reasoning";
  return "general";
}

// ─── Model Configs ───────────────────────────────────────────
interface RouterPayload {
  prompt: string;
  systemInstruction?: string;
  /** Skip cache for this request */
  noCache?: boolean;
  /** Force a specific model tier */
  forceTier?: "local" | "nim" | "gemini" | "claude";
}

/**
 * THE INDESTRUCTIBLE MATRIX: AUTO-HEALING LLM ROUTER v2
 *
 * Upgrades from v1:
 * - Response caching (60s TTL) — identical prompts return instantly
 * - Task-aware routing — code/creative/reasoning get optimal models
 * - NVIDIA NIM as primary cloud tier ($0 cost)
 * - 4-tier failover: Local → NIM → Gemini → Claude
 * - Latency tracking for diagnostics
 */
export async function routeAgenticExecution({
  prompt,
  systemInstruction,
  noCache = false,
  forceTier,
}: RouterPayload): Promise<string> {
  const startTime = Date.now();

  // Check cache first
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

      // Pick model based on task
      const localModel = taskType === "code" ? "deepseek-coder-v2:latest"
        : taskType === "reasoning" ? "nemotron-mini"
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
          log.info(`Local ${localModel} (${Date.now() - startTime}ms)`);
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
        // Pick NIM model based on task — March 2026 frontier models
        const nimModel = taskType === "code" ? "nvidia/nemotron-3-super-120b"
          : taskType === "reasoning" ? "nvidia/llama-3.1-nemotron-ultra-253b-v1"
          : taskType === "creative" ? "nvidia/llama-3.1-nemotron-70b-instruct"
          : "nvidia/llama-3.1-nemotron-70b-instruct";

        const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model: nimModel,
            messages: [
              { role: "system", content: systemInstruction || "You are Sovereign Matrix, an elite AI agent." },
              { role: "user", content: prompt },
            ],
            max_tokens: 4096,
            temperature: taskType === "creative" ? 0.8 : 0.3,
          }),
        });

        if (nimRes.ok) {
          const nimData = await nimRes.json();
          const text = nimData.choices?.[0]?.message?.content;
          if (text) {
            log.info(`NIM ${nimModel.split("/")[1]} (${Date.now() - startTime}ms)`);
            setCache(cacheKey, text);
            return text;
          }
        }
      }
    } catch {
      log.warn("NVIDIA NIM failed — failover to Gemini");
    }
  }

  // ── Tier 3: Google Gemini ────────────────────────────────
  if (!forceTier || forceTier === "gemini") {
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        const aiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction || "You are Sovereign Matrix." }] },
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            log.info(`Gemini 2.0 Flash (${Date.now() - startTime}ms)`);
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
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemInstruction || "You are Sovereign Matrix.",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          const text = claudeData.content?.[0]?.text;
          if (text) {
            log.info(`Claude Sonnet 4 (${Date.now() - startTime}ms)`);
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
