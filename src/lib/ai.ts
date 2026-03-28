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
        return JSON.parse(userSettings.apiKeys);
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
  const { model = "gemini", system, maxTokens = 2000, thinking, useOpus } = options;
  
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
    return claudeText(prompt, system, maxTokens, userKeys, thinking, useOpus);
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
    model: "gemini-2.5-flash",
    systemInstruction: system || undefined,
    generationConfig: { maxOutputTokens: maxTokens }
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function claudeText(prompt: string, system?: string, maxTokens: number = 2000, userKeys: { anthropic?: string } = {}, thinking?: boolean, useOpus?: boolean): Promise<string> {
  const keys = Object.keys(userKeys).length > 0 ? userKeys : await getUserKeys();
  const apiKey = keys.anthropic || globalAnthropicKey;

  const betaHeaders = ["prompt-caching-2024-07-31"];
  if (thinking) {
    betaHeaders.push("interleaved-thinking-2025-05-14");
  }

  const client = new Anthropic({
    apiKey,
    defaultHeaders: { "anthropic-beta": betaHeaders.join(",") }
  });

  // Inject ephemeral caching on the system prompt to slash token costs by 90%
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemParam: any = system ? [
    { type: "text", text: system, cache_control: { type: "ephemeral" } }
  ] : undefined;

  // Extended thinking and max_tokens are incompatible — use one or the other
  // Opus 4.6: strongest reasoning, 1M context, 128K output — use for God Brain, deep analysis
  // Sonnet 4.6: best balance of speed/quality — default for all other agents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestParams: any = {
    model: useOpus ? "claude-opus-4-6-20250514" : "claude-sonnet-4-6-20250514",
    ...(systemParam ? { system: systemParam } : {}),
    messages: [{ role: "user", content: prompt }],
  };

  if (thinking) {
    requestParams.thinking = { type: "enabled", budget_tokens: 10000 };
  } else {
    requestParams.max_tokens = maxTokens;
  }

  const response = await client.messages.create(requestParams);

  // Filter out thinking blocks and return only text content
  const textBlock = response.content.find((b: { type: string }) => b.type === "text");
  return textBlock && textBlock.type === "text" ? (textBlock as { type: "text"; text: string }).text : "";
}

/**
 * claudeWithCitations — Claude response with source citations.
 * Pass documents as content blocks; Claude returns text with citation references.
 * Used by research agents for verifiable, source-grounded output.
 */
async function claudeWithCitations(
  prompt: string,
  documents: Array<{ title: string; content: string }>,
  system?: string,
  maxTokens: number = 4000
): Promise<{ text: string; citations: Array<{ cited_text: string; document_title: string }> }> {
  const keys = await getUserKeys();
  const apiKey = keys.anthropic || globalAnthropicKey;

  const client = new Anthropic({
    apiKey,
    defaultHeaders: { "anthropic-beta": "citations-2025-01-24" }
  });

  // Build document content blocks
  const documentBlocks = documents.map((doc) => ({
    type: "document" as const,
    source: {
      type: "text" as const,
      media_type: "text/plain" as const,
      data: doc.content,
    },
    title: doc.title,
    citations: { enabled: true },
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages.create as any)({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{
      role: "user",
      content: [...documentBlocks, { type: "text", text: prompt }],
    }],
  });

  // Extract text and citations from response
  let fullText = "";
  const citations: Array<{ cited_text: string; document_title: string }> = [];

  for (const block of response.content) {
    if (block.type === "text") {
      fullText += block.text;
      // Extract citation references if present
      if ("citations" in block && Array.isArray(block.citations)) {
        for (const cite of block.citations) {
          if (cite.cited_text) {
            citations.push({
              cited_text: cite.cited_text,
              document_title: cite.document_title || "Unknown",
            });
          }
        }
      }
    }
  }

  return { text: fullText, citations };
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
 * Claude Tool Use — Agentic loop with automatic tool execution.
 * Calls Claude with tools, executes tool_use blocks via the provided executor,
 * feeds results back, and repeats until stop_reason === "end_turn" or max iterations.
 * Falls back to single-call mode when no toolExecutor is provided (legacy compat).
 */
export async function claudeToolUse(
  prompt: string,
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
  system?: string,
  maxTokens: number = 4096,
  toolExecutor?: (name: string, input: Record<string, unknown>) => Promise<string>
): Promise<{ text: string; toolCalls: Array<{ name: string; input: Record<string, unknown> }> }> {
  const userKeys = await getUserKeys();
  const apiKey = userKeys.anthropic || globalAnthropicKey;
  const client = new Anthropic({ apiKey });

  const MAX_ITERATIONS = 10;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "user", content: prompt }];
  const allToolCalls: Array<{ name: string; input: Record<string, unknown> }> = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
      messages,
    });

    // Collect tool calls from this iteration
    const iterToolCalls = response.content
      .filter(b => b.type === "tool_use")
      .map(b => {
        const tu = b as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
        return { id: tu.id, name: tu.name, input: tu.input };
      });

    allToolCalls.push(...iterToolCalls.map(({ name, input }) => ({ name, input })));

    // If no tool calls or no executor, return immediately (legacy single-call behavior)
    if (iterToolCalls.length === 0 || !toolExecutor || response.stop_reason === "end_turn") {
      const text = response.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("");
      return { text, toolCalls: allToolCalls };
    }

    // Append the assistant's response to the conversation
    messages.push({ role: "assistant", content: response.content });

    // Execute each tool call and feed results back
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResults: any[] = [];
    for (const tc of iterToolCalls) {
      let result: string;
      try {
        result = await toolExecutor(tc.name, tc.input);
      } catch (err) {
        result = `Error executing tool ${tc.name}: ${String(err)}`;
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: tc.id,
        content: result,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Max iterations reached — return whatever text we have
  log.error("claudeToolUse: max iterations reached", { iterations: MAX_ITERATIONS });
  return { text: "[Agent loop reached maximum iterations]", toolCalls: allToolCalls };
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

export { claudeWithCitations };
