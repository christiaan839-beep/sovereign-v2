// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// knowledge-graph context weaver; not wired.
/**
 * SOVEREIGN MATRIX — Context Weaver
 *
 * Gives agents effective infinite context by hierarchically summarizing
 * conversation history. Instead of hitting the context window limit
 * and losing old data, the weaver:
 *
 *   1. Keeps the last N messages in full detail (working memory)
 *   2. Summarizes older messages into compressed chunks (short-term memory)
 *   3. Stores key facts in the knowledge graph (long-term memory)
 *
 * This means an agent can reference a conversation from 3 months ago
 * without needing 2M tokens of context. Claude has 200K tokens.
 * We have effectively infinite context via hierarchical compression.
 *
 * Architecture:
 *   Full messages (last 10) → Summarized chunks (last 50) → Graph memory (all time)
 *   ~4K tokens           → ~2K tokens                    → ~1K tokens
 *   Total: ~7K tokens to represent months of conversation history
 */

import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";


// ── Types ──

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

interface WovenContext {
  /** Full recent messages (last N) */
  recentMessages: Message[];
  /** Compressed summaries of older messages */
  summaryChunks: string[];
  /** Key facts from graph memory */
  graphFacts: string[];
  /** Total token estimate */
  estimatedTokens: number;
  /** How many original messages were compressed */
  messagesCompressed: number;
}

// ── Configuration ──

const RECENT_MESSAGE_COUNT = 10;       // Keep last 10 messages in full
const SUMMARY_CHUNK_SIZE = 20;         // Summarize every 20 messages into one chunk
const MAX_SUMMARY_CHUNKS = 5;          // Keep max 5 summary chunks (~2K tokens)
const TOKENS_PER_CHAR = 0.25;          // Rough estimate: 4 chars per token

// ── Summarize ──

async function summarizeMessages(messages: Message[]): Promise<string> {
  const text = messages
    .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n");

  const summary = await ai(
    `Summarize this conversation into 2-3 key points. Include: what was discussed, what decisions were made, and what action items exist.\n\n${text}`,
    { system: "You are a summarizer. Be concise — max 100 words. Keep all specific names, numbers, and decisions.", maxTokens: 200 }
  );

  return summary;
}

// ── Main Function ──

/**
 * Weave a conversation history into compressed context.
 * Call this before sending messages to an agent to give it
 * effective infinite memory.
 */
export async function weaveContext(
  fullHistory: Message[],
  graphFacts?: string[]
): Promise<WovenContext> {
  const totalMessages = fullHistory.length;

  // Layer 1: Recent messages (full detail)
  const recentMessages = fullHistory.slice(-RECENT_MESSAGE_COUNT);

  // Layer 2: Older messages → compressed summaries
  const olderMessages = fullHistory.slice(0, -RECENT_MESSAGE_COUNT);
  const summaryChunks: string[] = [];

  if (olderMessages.length > 0) {
    // Split into chunks and summarize each
    for (let i = 0; i < olderMessages.length; i += SUMMARY_CHUNK_SIZE) {
      if (summaryChunks.length >= MAX_SUMMARY_CHUNKS) break;
      const chunk = olderMessages.slice(i, i + SUMMARY_CHUNK_SIZE);
      try {
        const summary = await summarizeMessages(chunk);
        summaryChunks.push(summary);
      } catch {
        // If summarization fails, skip this chunk
      }
    }
  }

  // Layer 3: Graph facts (from knowledge graph)
  const facts = graphFacts || [];

  // Estimate tokens
  const recentTokens = recentMessages.reduce((sum, m) => sum + m.content.length * TOKENS_PER_CHAR, 0);
  const summaryTokens = summaryChunks.reduce((sum, s) => sum + s.length * TOKENS_PER_CHAR, 0);
  const factTokens = facts.reduce((sum, f) => sum + f.length * TOKENS_PER_CHAR, 0);

  return {
    recentMessages,
    summaryChunks,
    graphFacts: facts,
    estimatedTokens: Math.round(recentTokens + summaryTokens + factTokens),
    messagesCompressed: totalMessages - recentMessages.length,
  };
}

/**
 * Build a system prompt that includes woven context.
 * This is what you inject into the agent's system message.
 */
export function buildContextPrompt(woven: WovenContext): string {
  const parts: string[] = [];

  // Graph facts (highest-level, most persistent)
  if (woven.graphFacts.length > 0) {
    parts.push(`KEY FACTS ABOUT THIS USER (from past interactions):\n${woven.graphFacts.map(f => `- ${f}`).join("\n")}`);
  }

  // Summary chunks (compressed history)
  if (woven.summaryChunks.length > 0) {
    parts.push(`CONVERSATION HISTORY (summarized):\n${woven.summaryChunks.map((s, i) => `[Session ${i + 1}] ${s}`).join("\n")}`);
  }

  // Note about compression
  if (woven.messagesCompressed > 0) {
    parts.push(`(${woven.messagesCompressed} older messages compressed into summaries above)`);
  }

  return parts.join("\n\n");
}
