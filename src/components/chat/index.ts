/**
 * SOVEREIGN MATRIX -- Modular Chat System
 *
 * Barrel export for the decomposed chat architecture.
 * Usage: import { ChatLayout, useChatContext } from "@/components/chat";
 */

export { ChatLayout } from "./ChatLayout";
export { ChatProvider, useChatContext } from "./ChatProvider";
export { MessageBubble, LoadingDots } from "./MessageBubble";
export { MessageList } from "./MessageList";
export { ModelSwitcher } from "./ModelSwitcher";
export { InputBar } from "./InputBar";
export { ConversationTabs } from "./ConversationTabs";
export { AgentStatusStrip } from "./AgentStatusStrip";
export { SystemPromptEditor } from "./SystemPromptEditor";
export { ThinkingTrace } from "./ThinkingTrace";
export type { Message, Conversation, AgentHistoryEntry, PreviewContent, Suggestion } from "./types";
export { detectContentType } from "./types";
export { streamChat } from "./StreamHandler";
