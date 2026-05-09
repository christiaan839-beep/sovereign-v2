// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// long-conversation compression; not wired.
import { createLogger } from "@/lib/logger";

const log = createLogger("context-compression");

/**
 * CONTEXT COMPRESSION — 5-level strategy for long agent conversations.
 *
 * Inspired by Claude Code's approach: try every lighter option first,
 * only truncate as an absolute last resort.
 *
 * Level 1: Dedup     — Remove duplicate/near-duplicate messages
 * Level 2: Summarize — Compress old messages into a summary block
 * Level 3: Prioritize — Keep high-signal messages, drop low-signal
 * Level 4: Trim      — Remove system/meta messages, keep user+assistant
 * Level 5: Truncate  — Hard cut at token limit (last resort)
 *
 * This makes agents dramatically better at long conversations.
 * Instead of losing context after 10 messages, they maintain
 * coherent memory across 50+ exchanges.
 */

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface CompressionResult {
  messages: Message[];
  level: number;
  originalCount: number;
  compressedCount: number;
  tokensEstimated: number;
}

// Rough token estimation (4 chars ≈ 1 token)
function estimateTokens(messages: Message[]): number {
  return Math.ceil(messages.reduce((s, m) => s + m.content.length, 0) / 4);
}

// ─── Level 1: Dedup ─────────────────────────────────────────
// Remove messages that are near-identical (>90% similar)
function dedup(messages: Message[]): Message[] {
  const result: Message[] = [];
  for (const msg of messages) {
    const isDup = result.some(
      existing =>
        existing.role === msg.role &&
        similarity(existing.content, msg.content) > 0.9
    );
    if (!isDup) result.push(msg);
  }
  return result;
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  // Simple substring overlap ratio
  let matches = 0;
  const words = shorter.toLowerCase().split(/\s+/);
  const longerLower = longer.toLowerCase();
  for (const word of words) {
    if (word.length > 3 && longerLower.includes(word)) matches++;
  }
  return words.length > 0 ? matches / words.length : 0;
}

// ─── Level 2: Summarize ─────────────────────────────────────
// Compress old messages into a summary block
function summarize(messages: Message[], keepRecent: number = 6): Message[] {
  if (messages.length <= keepRecent) return messages;

  const old = messages.slice(0, -keepRecent);
  const recent = messages.slice(-keepRecent);

  // Build summary of old messages
  const summaryParts: string[] = [];
  for (const msg of old) {
    if (msg.role === "user") {
      summaryParts.push(`User asked: ${msg.content.slice(0, 100)}`);
    } else if (msg.role === "assistant") {
      summaryParts.push(`Agent responded: ${msg.content.slice(0, 80)}`);
    }
  }

  const summaryMessage: Message = {
    role: "system",
    content: `[Conversation summary — ${old.length} earlier messages compressed]\n${summaryParts.join("\n")}`,
  };

  return [summaryMessage, ...recent];
}

// ─── Level 3: Prioritize ────────────────────────────────────
// Score messages by signal value, keep highest
function prioritize(messages: Message[], maxMessages: number = 12): Message[] {
  if (messages.length <= maxMessages) return messages;

  const scored = messages.map((msg, i) => {
    let score = 0;

    // Recent messages score higher
    score += (i / messages.length) * 30;

    // User messages are important (context)
    if (msg.role === "user") score += 20;

    // Longer messages usually have more signal
    if (msg.content.length > 200) score += 15;
    if (msg.content.length > 500) score += 10;

    // Messages with numbers/data are high-signal
    if (/\d+/.test(msg.content)) score += 10;

    // System messages are foundational
    if (msg.role === "system") score += 25;

    // Messages with URLs or structured data
    if (msg.content.includes("http") || msg.content.includes("{")) score += 5;

    return { msg, score };
  });

  // Always keep first system message and last 4 messages
  const first = messages[0]?.role === "system" ? [messages[0]] : [];
  const last4 = messages.slice(-4);
  const middle = scored
    .slice(first.length, -4)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMessages - first.length - 4)
    .sort((a, b) => messages.indexOf(a.msg) - messages.indexOf(b.msg))
    .map(s => s.msg);

  return [...first, ...middle, ...last4];
}

// ─── Level 4: Trim ──────────────────────────────────────────
// Remove meta/system messages, keep only user+assistant
function trim(messages: Message[]): Message[] {
  const systemFirst = messages[0]?.role === "system" ? [messages[0]] : [];
  const rest = messages
    .slice(systemFirst.length)
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      ...m,
      // Trim each message to 300 chars
      content: m.content.length > 300
        ? m.content.slice(0, 297) + "..."
        : m.content,
    }));

  return [...systemFirst, ...rest];
}

// ─── Level 5: Truncate ──────────────────────────────────────
// Hard cut — keep system prompt + last N messages
function truncate(messages: Message[], maxMessages: number = 8): Message[] {
  const systemFirst = messages[0]?.role === "system" ? [messages[0]] : [];
  const recent = messages.slice(-maxMessages);
  return [...systemFirst, ...recent];
}

// ─── Main Compression Pipeline ──────────────────────────────
export function compressContext(
  messages: Message[],
  maxTokens: number = 4000
): CompressionResult {
  const originalCount = messages.length;
  let current = [...messages];
  let level = 0;

  // Try each level until we're under the token limit
  const strategies = [
    { name: "dedup", fn: () => dedup(current) },
    { name: "summarize", fn: () => summarize(current) },
    { name: "prioritize", fn: () => prioritize(current) },
    { name: "trim", fn: () => trim(current) },
    { name: "truncate", fn: () => truncate(current) },
  ];

  for (const strategy of strategies) {
    if (estimateTokens(current) <= maxTokens) break;
    level++;
    current = strategy.fn();
    log.info(`Compression L${level} (${strategy.name}): ${messages.length} → ${current.length} messages, ~${estimateTokens(current)} tokens`);
  }

  return {
    messages: current,
    level,
    originalCount,
    compressedCount: current.length,
    tokensEstimated: estimateTokens(current),
  };
}

/**
 * Build optimized context for an agent call.
 * Static instructions go first (cacheable), dynamic context goes after.
 * This mirrors Claude Code's static/dynamic prompt split.
 */
export function buildAgentContext(params: {
  systemPrompt: string;
  conversationHistory: Message[];
  currentInput: string;
  maxTokens?: number;
}): Message[] {
  const { systemPrompt, conversationHistory, currentInput, maxTokens = 4000 } = params;

  // Static section (cached by NIM/Gemini)
  const staticSystem: Message = {
    role: "system",
    content: systemPrompt,
  };

  // Compress conversation history
  const compressed = compressContext(conversationHistory, maxTokens - estimateTokens([staticSystem]));

  // Dynamic section (new each turn)
  const userMessage: Message = {
    role: "user",
    content: currentInput,
  };

  return [staticSystem, ...compressed.messages, userMessage];
}
