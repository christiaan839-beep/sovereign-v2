/**
 * SOVEREIGN MATRIX -- Chat System Types
 *
 * Shared interfaces extracted from SovereignAssistant.
 * Single source of truth for the modular chat architecture.
 */

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  label?: string;
  timestamp: Date;
  contentType?: "text" | "code" | "html" | "image" | "table";
  agentLabel?: string;
  responseTimeMs?: number;
  modelUsed?: string;
  thinking?: string;
  qualityScore?: number; // 0-100 humanness score from ai-detect
  refined?: boolean; // whether the output was auto-refined
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  systemPrompt: string;
  createdAt: number;
}

export interface AgentHistoryEntry {
  label: string;
  responseTimeMs: number;
  status: "success" | "error";
  timestamp: number;
}

export interface PreviewContent {
  type: "html" | "image" | "code";
  content: string;
  label?: string;
}

export interface Suggestion {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  prompt: string;
}

/** Detect the content type of a message body. */
export function detectContentType(content: string): Message["contentType"] {
  if (!content) return "text";
  if (
    content.includes("<!DOCTYPE") ||
    content.includes("<html") ||
    (content.includes("<div") && content.includes("</div>") && content.length > 500)
  )
    return "html";
  if (/\.(png|jpg|jpeg|webp|gif|svg)\b/i.test(content) && /https?:\/\//.test(content))
    return "image";
  if (content.includes("```") || /^(import |export |function |const |class |def |from )/m.test(content))
    return "code";
  return "text";
}
