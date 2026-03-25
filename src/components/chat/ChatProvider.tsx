"use client";

import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import type { Message, Conversation, AgentHistoryEntry, PreviewContent } from "./types";
import { detectContentType } from "./types";
import { streamChat } from "./StreamHandler";
import { routeIntent } from "@/lib/intent-router";
import { getSystemPrompt } from "@/lib/system-prompts";
import { getModel, MODEL_REGISTRY } from "@/config/models";
import { detectAIPatterns } from "@/lib/ai-detect";
import { refineOutputClient } from "@/lib/output-refiner-client";

const MAX_CONVERSATIONS = 5;
const MAX_MESSAGES_PER_CONVERSATION = 100;
const STORAGE_DEBOUNCE_MS = 2000;

// ── Context Shape ──

export type RefineMode = "off" | "auto" | "always";

interface ChatContextValue {
  // State
  messages: Message[];
  conversations: Conversation[];
  activeConversationId: string;
  selectedModel: string;
  loading: boolean;
  activeAgent: { label: string; startTime: number } | null;
  previewContent: PreviewContent | null;
  agentHistory: AgentHistoryEntry[];
  promptEditorOpen: boolean;
  refineMode: RefineMode;

  // Actions
  sendMessage: (text: string) => void;
  selectConversation: (id: string) => void;
  newConversation: () => void;
  closeConversation: (id: string) => void;
  setModel: (id: string) => void;
  submitFeedback: (messageId: string, rating: number) => void;
  cancelStream: () => void;
  setPreviewContent: (content: PreviewContent | null) => void;
  setPromptEditorOpen: (open: boolean) => void;
  updateSystemPrompt: (prompt: string) => void;
  setRefineMode: (mode: RefineMode) => void;
  activeConversation: Conversation;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within a ChatProvider");
  return ctx;
}

// ── Provider ──

function createDefaultConversation(): Conversation {
  return {
    id: "1",
    title: "New Mission",
    messages: [],
    model: "auto",
    systemPrompt: getSystemPrompt("general"),
    createdAt: Date.now(),
  };
}

function loadConversationsFromStorage(): Conversation[] {
  if (typeof window === "undefined") return [createDefaultConversation()];
  try {
    const saved = sessionStorage.getItem("sovereign_conversations");
    if (saved) {
      const parsed = JSON.parse(saved);
      const restored: Conversation[] = parsed.slice(-MAX_CONVERSATIONS).map((c: Conversation) => ({
        ...c,
        messages: c.messages
          .slice(-MAX_MESSAGES_PER_CONVERSATION)
          .map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })),
      }));
      if (restored.length > 0) return restored;
    }
  } catch {
    /* noop */
  }
  return [createDefaultConversation()];
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversationsFromStorage());
  const [activeConvId, setActiveConvId] = useState(() => {
    const loaded = loadConversationsFromStorage();
    return loaded[0]?.id || "1";
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    const loaded = loadConversationsFromStorage();
    return loaded[0]?.messages || [];
  });
  const [selectedModel, setSelectedModel] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<{ label: string; startTime: number } | null>(null);
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null);
  const [agentHistory, setAgentHistory] = useState<AgentHistoryEntry[]>([]);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [refineMode, setRefineMode] = useState<RefineMode>("auto");

  const abortRef = useRef<AbortController | null>(null);
  const storageDebouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) || conversations[0];

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Track agent completions in history
  useEffect(() => {
    if (!activeAgent || loading) return;
    setAgentHistory((prev) => [
      ...prev.slice(-20),
      {
        label: activeAgent.label,
        responseTimeMs: Date.now() - activeAgent.startTime,
        status: "success",
        timestamp: Date.now(),
      },
    ]);
  }, [loading, activeAgent]);

  // Persist conversations to sessionStorage (debounced)
  useEffect(() => {
    if (storageDebouncerRef.current) clearTimeout(storageDebouncerRef.current);
    storageDebouncerRef.current = setTimeout(() => {
      try {
        const toSave = conversations.map((c) =>
          c.id === activeConvId
            ? { ...c, messages: messages.slice(-MAX_MESSAGES_PER_CONVERSATION) }
            : { ...c, messages: c.messages.slice(-MAX_MESSAGES_PER_CONVERSATION) },
        );
        sessionStorage.setItem("sovereign_conversations", JSON.stringify(toSave));
      } catch {
        try {
          sessionStorage.removeItem("sovereign_conversations");
        } catch {
          /* noop */
        }
      }
    }, STORAGE_DEBOUNCE_MS);
    return () => {
      if (storageDebouncerRef.current) clearTimeout(storageDebouncerRef.current);
    };
  }, [messages, conversations, activeConvId]);

  // Auto-update conversation title from first user message
  useEffect(() => {
    if (messages.length === 0) return;
    const firstUserMsg = messages.find((m) => m.role === "user");
    if (firstUserMsg) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId && c.title === "New Mission" ? { ...c, title: firstUserMsg.content.slice(0, 30) } : c)),
      );
    }
  }, [messages, activeConvId]);

  // ── Actions ──

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setActiveAgent(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      const intent = routeIntent(text);
      const startTime = Date.now();
      setActiveAgent({ label: intent.label, startTime });

      const isStream = intent.endpoint === "/api/ai/stream";
      const modelOverride = selectedModel !== "auto" ? { model: selectedModel } : {};
      const useThinking = ["qwen3", "deepseek", "glm5"].includes(selectedModel);
      const modelConfig = getModel(selectedModel);
      const modelLabel = modelConfig.name || intent.label;

      const body = isStream
        ? {
            prompt: text,
            systemInstruction: "You are Sovereign Assistant, a helpful AI colleague. Be direct, concise, and useful. No corporate filler.",
            ...modelOverride,
            thinking: useThinking,
          }
        : { ...intent.params, ...modelOverride };

      if (isStream) {
        const assistantId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant" as const, content: "", label: intent.label, timestamp: new Date(), modelUsed: modelLabel },
        ]);

        await streamChat(intent.endpoint, body, controller.signal, {
          onToken: (_, accumulated) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)));
          },
          onThinkingToken: (_, accumulated) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, thinking: accumulated || undefined } : m)));
          },
          onDone: async (finalContent, thinkingContent) => {
            const elapsed = Date.now() - startTime;

            // Anti-slop pipeline
            let outputContent = finalContent;
            let qualityScore: number | undefined;
            let refined = false;

            const shouldRefine = refineMode === "always" || refineMode === "auto";
            if (shouldRefine && finalContent.length > 40) {
              const detection = detectAIPatterns(finalContent);
              const humanness = Math.max(0, 100 - detection.score);

              if (refineMode === "always" || (refineMode === "auto" && detection.score > 60)) {
                try {
                  const result = refineOutputClient(finalContent, { mode: "speed", preserveFormatting: true });
                  outputContent = result.refined;
                  qualityScore = result.score;
                  refined = true;
                } catch {
                  qualityScore = humanness;
                }
              } else {
                qualityScore = humanness;
              }
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: outputContent,
                      thinking: thinkingContent || undefined,
                      agentLabel: intent.label,
                      responseTimeMs: elapsed,
                      modelUsed: modelLabel,
                      qualityScore,
                      refined,
                    }
                  : m,
              ),
            );
            // Auto-detect previewable content
            autoDetectPreview(outputContent);
            setActiveAgent(null);
            setLoading(false);
          },
          onError: (error) => {
            setMessages((prev) => [
              ...prev.filter((m) => m.id !== assistantId || m.content),
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: `Something went wrong: ${error.message}`,
                timestamp: new Date(),
              },
            ]);
            setActiveAgent(null);
            setLoading(false);
          },
        });
      } else {
        // Non-streaming agent request
        try {
          const res = await fetch(intent.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          const data = await res.json();
          let content =
            data.result ||
            data.answer ||
            data.response ||
            data.analysis ||
            data.text ||
            data.intelligence?.market_position ||
            data.redacted_text ||
            (typeof data === "string" ? data : JSON.stringify(data, null, 2));

          if (content.length > 3000) {
            content = content.slice(0, 3000) + "\n\n[Response truncated -- view full result in the dedicated tool]";
          }

          const imageUrl = data.images?.[0]?.url || data.imageUrl || data.image_url || data.url;
          let finalContent = imageUrl && /\.(png|jpg|jpeg|webp|gif|svg)/i.test(imageUrl) ? imageUrl : content;
          const elapsed = Date.now() - startTime;

          // Anti-slop pipeline for non-streaming
          let qualityScore: number | undefined;
          let refined = false;

          const shouldRefineNonStream = refineMode === "always" || refineMode === "auto";
          if (shouldRefineNonStream && finalContent.length > 40 && !imageUrl) {
            const detection = detectAIPatterns(finalContent);
            const humanness = Math.max(0, 100 - detection.score);

            if (refineMode === "always" || (refineMode === "auto" && detection.score > 60)) {
              try {
                const result = refineOutputClient(finalContent, { mode: "speed", preserveFormatting: true });
                finalContent = result.refined;
                qualityScore = result.score;
                refined = true;
              } catch {
                qualityScore = humanness;
              }
            } else {
              qualityScore = humanness;
            }
          }

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: finalContent,
              label: intent.label,
              timestamp: new Date(),
              contentType: detectContentType(finalContent),
              agentLabel: intent.label,
              responseTimeMs: elapsed,
              qualityScore,
              refined,
            },
          ]);
          autoDetectPreview(finalContent);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setActiveAgent(null);
            setLoading(false);
            return;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `Something went wrong: ${error instanceof Error ? error.message : "Unknown error"}`,
              timestamp: new Date(),
            },
          ]);
        } finally {
          setActiveAgent(null);
          setLoading(false);
        }
      }
    },
    [loading, selectedModel, refineMode],
  );

  const autoDetectPreview = (content: string) => {
    if (content.includes("<!DOCTYPE") || content.includes("<html")) {
      setPreviewContent({ type: "html", content });
    } else if (/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i.test(content)) {
      const match = content.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i);
      if (match) setPreviewContent({ type: "image", content: match[0] });
    }
  };

  const newConversation = useCallback(() => {
    setConversations((prev) => {
      let updated = prev.map((c) => (c.id === activeConvId ? { ...c, messages } : c));
      if (updated.length >= MAX_CONVERSATIONS) {
        updated = updated.slice(-(MAX_CONVERSATIONS - 1));
      }
      const newId = Date.now().toString();
      const newConv: Conversation = {
        id: newId,
        title: "New Mission",
        messages: [],
        model: "auto",
        systemPrompt: getSystemPrompt("general"),
        createdAt: Date.now(),
      };
      setActiveConvId(newId);
      setMessages([]);
      setActiveAgent(null);
      abortRef.current?.abort();
      return [...updated, newConv];
    });
  }, [activeConvId, messages]);

  const selectConversation = useCallback(
    (id: string) => {
      if (id === activeConvId) return;
      setConversations((prev) => prev.map((c) => (c.id === activeConvId ? { ...c, messages } : c)));
      const target = conversations.find((c) => c.id === id);
      setActiveConvId(id);
      setMessages(target?.messages || []);
    },
    [activeConvId, messages, conversations],
  );

  const closeConversation = useCallback(
    (id: string) => {
      if (conversations.length <= 1) return;
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (id === activeConvId) {
        setActiveConvId(remaining[0].id);
        setMessages(remaining[0].messages || []);
      }
    },
    [conversations, activeConvId],
  );

  const submitFeedback = useCallback(
    async (messageId: string, rating: number) => {
      try {
        const msg = messages.find((m) => m.id === messageId);
        await fetch("/api/agents/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rate", agentId: "assistant", rating, output: msg?.content || "" }),
        });
      } catch {
        /* noop */
      }
    },
    [messages],
  );

  const updateSystemPrompt = useCallback(
    (prompt: string) => {
      setConversations((prev) => prev.map((c) => (c.id === activeConvId ? { ...c, systemPrompt: prompt } : c)));
    },
    [activeConvId],
  );

  const value: ChatContextValue = {
    messages,
    conversations,
    activeConversationId: activeConvId,
    selectedModel,
    loading,
    activeAgent,
    previewContent,
    agentHistory,
    promptEditorOpen,
    sendMessage,
    selectConversation,
    newConversation,
    closeConversation,
    setModel: setSelectedModel,
    submitFeedback,
    cancelStream,
    setPreviewContent,
    setPromptEditorOpen,
    updateSystemPrompt,
    setRefineMode,
    refineMode,
    activeConversation: activeConv,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
