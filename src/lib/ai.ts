import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nimChat } from "./nvidia";
import type { AIOptions } from "@/types";
import { createLogger } from "@/lib/logger";
import { safeDecrypt } from "@/lib/crypto";

const log = createLogger("ai");

const globalGeminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || "";
const globalAnthropicKey = process.env.ANTHROPIC_API_KEY || "";
const globalGroqKey = process.env.GROQ_API_KEY || "";
const globalTavilyKey = process.env.TAVILY_API_KEY || "tvly-demo";

async function getUserKeys(): Promise<{ gemini?: string, tavily?: string, anthropic?: string, ollama?: string, nvidia?: string, groq?: string }> {
  try {
    const user = await currentUser();
    if (user?.primaryEmailAddress?.emailAddress) {
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userEmail, user.primaryEmailAddress.emailAddress)
      });
      if (userSettings?.apiKeys) {
        return JSON.parse(safeDecrypt(userSettings.apiKeys));
      }
    }
  } catch (e) {
    log.error("Failed to load user API keys:", e as Record<string, unknown>);
  }
  return {};
}

// Fallback global clients
const globalGenAI = new GoogleGenerativeAI(globalGeminiKey);

/**
 * Unified AI text generation router.
 * Single entry point for all AI calls across the entire platform.
 * 
 * Routing priority:
 * 1. Ollama (local, $0) — if configured
 * 2. NVIDIA NIM (free open-source models) — if model is "nim" or NIM key exists
 * 3. Gemini (Google free tier) — default
 * 4. Claude (Anthropic) — if explicitly selected or BYOK key exists
 */
export async function ai(prompt: string, options: AIOptions = {}): Promise<string> {
  const { model = "gemini", system, maxTokens = 2000 } = options;
  
  const userKeys = await getUserKeys();

  // 1. Local execution (cost: $0)
  if (userKeys.ollama) {
    return ollamaText(prompt, system, userKeys.ollama);
  }

  // 2. NVIDIA NIM open-source models (cost: $0)
  if (model === "nim" || (userKeys.nvidia && model !== "claude" && model !== "gemini")) {
    return nimText(prompt, system, maxTokens);
  }

  // 3. Claude (BYOK only) - Opus or Sonnet
  if (model === "claude" || (userKeys.anthropic && !userKeys.gemini && !userKeys.groq)) {
    return claudeText(prompt, system, maxTokens, userKeys);
  }

  // 4. Mistral Large 2 (EU Compliance / Open Weights via NIM)
  if (model === "mistral") {
    return mistralText(prompt, system, maxTokens);
  }

  // 5. Groq (DeepSeek-R1, Qwen 2.5 Coder, Llama 3.1)
  if (model === "groq" || model === "deepseek" || model === "qwen" || (userKeys.groq && !userKeys.gemini)) {
    return groqText(prompt, system, maxTokens, userKeys, model);
  }

  // 5. Gemini (default — Google free tier)
  return geminiText(prompt, system, maxTokens, userKeys);
}

/**
 * NVIDIA NIM — Free open-source model execution.
 * Routes to Nemotron Ultra 253B (God Brain) for maximum quality.
 */
async function nimText(prompt: string, system?: string, maxTokens: number = 2000): Promise<string> {
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: prompt }
  ];
  return nimChat("nvidia/llama-3.1-nemotron-ultra-253b-v1", messages, { maxTokens, temperature: 0.6 }) as Promise<string>;
}

async function ollamaText(prompt: string, system?: string, ollamaUrl: string = "http://localhost:11434"): Promise<string> {
  try {
    const url = new URL("/api/generate", ollamaUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-coder",
        prompt: prompt,
        system: system || "",
        stream: false
      })
    });
    if (!res.ok) throw new Error("Ollama request failed");
    const data = await res.json();
    return data.response;
  } catch (err) {
    log.error("Local Ollama Node failed:", err as Record<string, unknown>);
    throw err;
  }
}

async function geminiText(prompt: string, system?: string, maxTokens: number = 2000, userKeys: { gemini?: string } = {}): Promise<string> {
  const keys = Object.keys(userKeys).length > 0 ? userKeys : await getUserKeys();
  const client = keys.gemini ? new GoogleGenerativeAI(keys.gemini) : globalGenAI;
  
  const model = client.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    systemInstruction: system || undefined,
    generationConfig: { maxOutputTokens: maxTokens }
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function claudeText(prompt: string, system?: string, maxTokens: number = 2000, userKeys: { anthropic?: string } = {}): Promise<string> {
  const keys = Object.keys(userKeys).length > 0 ? userKeys : await getUserKeys();
  const apiKey = keys.anthropic || globalAnthropicKey;
  
  const client = new Anthropic({ 
    apiKey,
    defaultHeaders: { "anthropic-beta": "prompt-caching-2024-07-31" }
  });

  // Inject ephemeral caching on the system prompt to slash token costs by 90%
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemParam: any = system ? [
    { type: "text", text: system, cache_control: { type: "ephemeral" } }
  ] : undefined;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    ...(systemParam ? { system: systemParam } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function groqText(prompt: string, system?: string, maxTokens: number = 2000, userKeys: { groq?: string } = {}, modelTarget: string = "groq"): Promise<string> {
  const keys = Object.keys(userKeys).length > 0 ? userKeys : await getUserKeys();
  const apiKey = keys.groq || globalGroqKey;
  
  const client = new Groq({ apiKey });
  
  // Decide actual model based on route
  let groqModel = "llama-3.1-8b-instant";
  if (modelTarget === "deepseek") {
    groqModel = "deepseek-r1-distill-llama-70b"; // DeepSeek reasoning logic
  } else if (modelTarget === "qwen") {
    groqModel = "qwen-2.5-coder-32b"; // Super-fast dedicated code generation
  }

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (system) messages.push({ role: "system" as const, content: system });
  messages.push({ role: "user" as const, content: prompt });

  const completion = await client.chat.completions.create({
    messages,
    model: groqModel,
    max_tokens: maxTokens,
  });

  return completion.choices[0]?.message?.content || "";
}

/**
 * Mistral Large 2 — European Sovereign AI via NIM.
 */
async function mistralText(prompt: string, system?: string, maxTokens: number = 2000): Promise<string> {
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: prompt }
  ];
  return nimChat("mistralai/mistral-large-2-instruct", messages, { maxTokens, temperature: 0.4 }) as Promise<string>;
}

/**
 * Whisper v3 Turbo — Ultra-fast audio transcription via Groq.
 * Transcribes 1 hour of audio in ~3 seconds at fractions of a penny.
 */
export async function groqTranscribe(audioBuffer: Uint8Array, filename: string = "audio.wav"): Promise<string> {
  const userKeys = await getUserKeys();
  const apiKey = userKeys.groq || globalGroqKey;
  if (!apiKey) throw new Error("Groq API key required for Whisper transcription.");

  const client = new Groq({ apiKey });

  const blob = new Blob([audioBuffer.buffer as ArrayBuffer], { type: "audio/wav" });
  const file = new File([blob], filename, { type: "audio/wav" });

  const transcription = await client.audio.transcriptions.create({
    file,
    model: "whisper-large-v3-turbo",
    language: "en",
    response_format: "text",
  });

  return typeof transcription === "string" ? transcription : String(transcription);
}

/**
 * Claude Tool Use — Agentic function calling for structured outputs.
 * Uses Anthropic's native tool_use to let Claude call predefined functions.
 */
export async function claudeToolUse(
  prompt: string,
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
  system?: string,
  maxTokens: number = 4096
): Promise<{ text: string; toolCalls: Array<{ name: string; input: Record<string, unknown> }> }> {
  const userKeys = await getUserKeys();
  const apiKey = userKeys.anthropic || globalAnthropicKey;
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: tools as any,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("");

  const toolCalls = response.content
    .filter(b => b.type === "tool_use")
    .map(b => {
      const tu = b as { type: "tool_use"; name: string; input: Record<string, unknown> };
      return { name: tu.name, input: tu.input };
    });

  return { text, toolCalls };
}

/**
 * Live Web Search AI — Tavily scrape + LLM synthesis.
 */
export async function research_ai(query: string, prompt: string, options: AIOptions = {}): Promise<string> {
  try {
    const userKeys = await getUserKeys();
    const searchClient = tavily({ apiKey: userKeys.tavily || globalTavilyKey });

    const searchResult = await searchClient.search(query, {
      searchDepth: "advanced",
      includeImages: false,
      includeRawContent: false,
      maxResults: 5,
    });

    const context = searchResult.results
      .map((r, i) => `Source ${i + 1} (${r.url}):\n${r.content}`)
      .join("\n\n");

    const enrichedPrompt = `LIVE WEB SEARCH RESULTS:\n${context}\n\n---\n\nUSER TASK:\n${prompt}`;
    
    return ai(enrichedPrompt, { 
      ...options, 
      system: `${options.system || "You are an elite researcher."}\n\nYou have been provided with real-time web search results. Use this data absolutely strictly to answer the user's task. If the search results contradict your training data, trust the search results.` 
    });
  } catch (error) {
    log.error("Live Search Error:", error as Record<string, unknown>);
    return ai(prompt, options);
  }
}

/**
 * Adaptive AI — Self-Improving Prompt Engine with Pinecone Memory.
 */
export async function adaptive_ai(prompt: string, options: AIOptions = {}): Promise<string> {
  const { recall } = await import("./memory");
  
  let learnedDirectives = "";
  try {
    const optimizations = await recall("SYSTEM_OPTIMIZATION directive", 2);
    if (optimizations.length > 0) {
      learnedDirectives = optimizations
        .map(o => o.entry.text)
        .join("\n\n");
    }
  } catch {
    // If recall fails, proceed without optimizations
  }

  const enhancedSystem = [
    options.system || "You are SOVEREIGN, an elite autonomous AI marketing system.",
    learnedDirectives ? `\n\n--- LEARNED OPTIMIZATION DIRECTIVES (Auto-Injected) ---\n${learnedDirectives}\n--- END DIRECTIVES ---` : "",
  ].join("");

  return ai(prompt, { ...options, system: enhancedSystem });
}

/**
 * Generate embeddings using Gemini for vector memory.
 */
export async function embed(text: string): Promise<number[]> {
  const userKeys = await getUserKeys();
  const client = userKeys.gemini ? new GoogleGenerativeAI(userKeys.gemini) : globalGenAI;
  
  const model = client.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
