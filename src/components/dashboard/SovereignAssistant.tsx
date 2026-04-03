"use client";

/**
 * SOVEREIGN MATRIX -- Assistant Entry Points
 *
 * SovereignAssistant: Floating widget (bottom-right bubble).
 * SovereignAssistantEmbed: Full-page modular chat (re-exported from @/components/chat).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Globe,
  FileText,
  Users,
  Code2,
  Search,
  Image as ImageIcon,
  Zap,
  Bot,
  Copy,
  Check,
  ArrowDown,
} from "lucide-react";
import { routeIntent } from "@/lib/intent-router";
import type { Message } from "@/components/chat/types";
import { detectContentType } from "@/components/chat/types";

const STREAM_FLUSH_MS = 40;

const SUGGESTIONS = [
  { icon: Search, text: "Find 50 leads in SaaS", prompt: "find 50 leads in SaaS companies" },
  { icon: FileText, text: "Write a blog post", prompt: "write a blog about AI agents for business" },
  { icon: Globe, text: "Analyze hubspot.com", prompt: "audit hubspot.com" },
  { icon: ImageIcon, text: "Build a landing page", prompt: "build a landing page for a SaaS startup" },
];

const ALL_SUGGESTIONS = [
  ...SUGGESTIONS,
  { icon: Code2, text: "Review code", prompt: "review code for security issues" },
  { icon: Users, text: "Scan a competitor", prompt: "competitor scan stripe.com" },
  { icon: Sparkles, text: "Generate an image", prompt: "generate image of a futuristic dashboard" },
  { icon: Zap, text: "Run a workflow", prompt: "run a workflow: research, write blog, generate image" },
];

// ── Markdown-lite renderer ──

function renderMarkdown(text: string) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let codeBlock: string[] | null = null;
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block boundaries
    if (line.startsWith("```")) {
      if (codeBlock === null) {
        codeBlock = [];
        codeLang = line.slice(3).trim();
        continue;
      } else {
        elements.push(
          <div key={`code-${i}`} className="my-2 rounded-lg overflow-hidden border border-white/5">
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/5">
              <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-mono">
                {codeLang || "code"}
              </span>
            </div>
            <pre className="text-xs text-neutral-300 bg-black/40 p-3 overflow-x-auto font-mono leading-relaxed">
              <code>{codeBlock.join("\n")}</code>
            </pre>
          </div>
        );
        codeBlock = null;
        codeLang = "";
        continue;
      }
    }

    if (codeBlock !== null) {
      codeBlock.push(line);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={`h3-${i}`} className="text-sm font-semibold text-white mt-3 mb-1">
          {line.slice(4)}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={`h2-${i}`} className="text-sm font-bold text-white mt-3 mb-1">
          {line.slice(3)}
        </h3>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={`h1-${i}`} className="text-base font-bold text-white mt-3 mb-1">
          {line.slice(2)}
        </h2>
      );
      continue;
    }

    // List items
    if (/^[\-\*]\s/.test(line)) {
      elements.push(
        <div key={`li-${i}`} className="flex gap-2 pl-1">
          <span className="text-emerald-400/60 mt-0.5 shrink-0">&#8226;</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={`ol-${i}`} className="flex gap-2 pl-1">
          <span className="text-emerald-400/60 mt-0.5 shrink-0 text-xs font-mono w-4 text-right">
            {num}.
          </span>
          <span>{formatInline(line.replace(/^\d+\.\s/, ""))}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`}>{formatInline(line)}</p>
    );
  }

  // Unclosed code block
  if (codeBlock !== null) {
    elements.push(
      <pre key="code-unclosed" className="text-xs text-neutral-300 bg-black/40 rounded-lg p-3 overflow-x-auto font-mono border border-white/5">
        <code>{codeBlock.join("\n")}</code>
      </pre>
    );
  }

  return <>{elements}</>;
}

function formatInline(text: string): React.ReactNode {
  // Process bold, italic, inline code
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(formatBoldItalic(codeMatch[1], key++));
      parts.push(
        <code
          key={`ic-${key++}`}
          className="px-1.5 py-0.5 bg-white/[0.06] border border-white/5 rounded text-[11px] font-mono text-emerald-300/80"
        >
          {codeMatch[2]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    parts.push(formatBoldItalic(remaining, key++));
    break;
  }

  return <>{parts}</>;
}

function formatBoldItalic(text: string, baseKey: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = baseKey * 100;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={`t-${key++}`}>{boldMatch[1]}</span>);
      parts.push(
        <strong key={`b-${key++}`} className="font-semibold text-white">
          {boldMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    // Italic
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*/);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={`t-${key++}`}>{italicMatch[1]}</span>);
      parts.push(<em key={`i-${key++}`}>{italicMatch[2]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    parts.push(<span key={`t-${key++}`}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

// ── Typing cursor ──

function StreamingCursor() {
  return (
    <motion.span
      className="inline-block w-[2px] h-[14px] bg-emerald-400 ml-0.5 align-text-bottom rounded-full"
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
    />
  );
}

// ── Thinking indicator ──

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex justify-start"
    >
      <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex gap-1 items-center">
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
          />
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
          />
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
          />
        </div>
        <span className="text-xs text-neutral-500">Thinking</span>
      </div>
    </motion.div>
  );
}

// ── Copy button ──

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Agent routing badge ──

function AgentBadge({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20 mb-2"
    >
      <div className="w-4 h-4 rounded-md bg-emerald-500/20 flex items-center justify-center">
        <Zap className="w-2.5 h-2.5 text-emerald-400" />
      </div>
      <span className="text-[10px] text-emerald-400/80 font-medium">
        Routed to <span className="text-emerald-300 font-semibold">{label}</span> via Smart Router
      </span>
    </motion.div>
  );
}

// ── Lightweight chat hook for the floating widget only ──

const CHAT_STORAGE_KEY = "sovereign-chat-history";
const MAX_PERSISTED_MESSAGES = 50;

function useWidgetChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<string>("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist chat history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        const toSave = messages.slice(-MAX_PERSISTED_MESSAGES);
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
      } catch {
        /* quota exceeded -- silently skip */
      }
    }
  }, [messages]);

  // Smooth scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

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
      setInput("");
      setLoading(true);
      setIsStreaming(false);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      try {
        const intent = routeIntent(text);
        const startTime = Date.now();
        const isStream = intent.endpoint === "/api/ai/stream";

        const res = await fetch(intent.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isStream
              ? {
                  prompt: text,
                  systemInstruction:
                    "You are Sovereign Assistant, a helpful AI colleague. Be direct, concise, and useful. Use markdown formatting (bold, lists, code blocks) when appropriate.",
                }
              : intent.params
          ),
          signal: controller.signal,
        });

        if (isStream && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          streamBufferRef.current = "";
          const assistantId = crypto.randomUUID();
          setIsStreaming(true);
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: "",
              label: intent.label,
              agentLabel: intent.label,
              timestamp: new Date(),
            },
          ]);

          const flushBuffer = () => {
            const content = streamBufferRef.current;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
            );
            scrollToBottom();
          };

          const scheduleFlush = () => {
            if (!flushTimerRef.current) {
              flushTimerRef.current = setTimeout(() => {
                flushTimerRef.current = null;
                flushBuffer();
              }, STREAM_FLUSH_MS);
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (controller.signal.aborted) {
              reader.cancel();
              break;
            }
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ") && line.trim() !== "data: [DONE]") {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (
                    data.type === "thinking_start" ||
                    data.type === "thinking_end" ||
                    data.type === "thinking"
                  )
                    continue;
                  const token =
                    data.choices?.[0]?.delta?.content || data.text || "";
                  streamBufferRef.current += token;
                  scheduleFlush();
                } catch {
                  /* skip */
                }
              }
            }
          }

          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          const accumulated = streamBufferRef.current;
          const elapsed = Date.now() - startTime;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: accumulated,
                    agentLabel: intent.label,
                    responseTimeMs: elapsed,
                  }
                : m
            )
          );
          setIsStreaming(false);
          setLoading(false);
          return;
        }

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

        if (content.length > 3000) content = content.slice(0, 3000) + "\n\n---\n*Response trimmed for display. Full output available via API.*";

        const imageUrl =
          data.images?.[0]?.url || data.imageUrl || data.image_url || data.url;
        const finalContent =
          imageUrl && /\.(png|jpg|jpeg|webp|gif|svg)/i.test(imageUrl)
            ? imageUrl
            : content;

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
            responseTimeMs: Date.now() - startTime,
          },
        ]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setLoading(false);
          setIsStreaming(false);
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
        setIsStreaming(false);
      }
    },
    [loading, scrollToBottom]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  }, []);

  return {
    messages,
    input,
    setInput,
    loading,
    isStreaming,
    sendMessage,
    scrollRef,
    textareaRef,
    clearHistory,
  };
}

// ── Scroll-to-bottom button ──

function ScrollToBottomBtn({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShow(distFromBottom > 100);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  if (!show) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      onClick={() =>
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        })
      }
      className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors z-10"
    >
      <ArrowDown className="w-3.5 h-3.5 text-neutral-400" />
    </motion.button>
  );
}

// ── Auto-growing textarea ──

function AutoGrowTextarea({
  value,
  onChange,
  onSubmit,
  disabled,
  textareaRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [textareaRef]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder="Ask anything..."
      disabled={disabled}
      data-chat-input="true"
      rows={1}
      className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none disabled:opacity-50 resize-none leading-relaxed py-2.5 max-h-[120px]"
    />
  );
}

// ── Floating Widget ──

export function SovereignAssistant() {
  const [open, setOpen] = useState(false);
  const {
    messages,
    input,
    setInput,
    loading,
    isStreaming,
    sendMessage,
    scrollRef,
    textareaRef,
    clearHistory,
  } = useWidgetChat();

  const hasSentMessage = messages.length > 0;

  // The last message -- used to determine if streaming is happening on it
  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming =
    isStreaming && lastMessage?.role === "assistant" && !lastMessage.responseTimeMs;

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open, textareaRef]);

  // Message item animation variants
  const messageVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
          open
            ? "bg-white/10 border border-white/20 backdrop-blur-xl"
            : "bg-white text-black hover:bg-neutral-200 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
        }`}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageSquare className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] h-[620px] max-h-[calc(100vh-8rem)] rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0A0A0A]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Sovereign Assistant</h3>
                  <p className="text-[10px] text-neutral-500">Routes to 123 AI agents</p>
                </div>
              </div>
              {hasSentMessage && (
                <button
                  onClick={clearHistory}
                  className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Messages area */}
            <div className="relative flex-1 overflow-hidden">
              <div
                ref={scrollRef}
                className="h-full overflow-y-auto px-5 py-4 space-y-3 scroll-smooth"
              >
                {/* Empty state with suggestions */}
                {!hasSentMessage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full -mt-4"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20 flex items-center justify-center mb-4">
                      <Sparkles className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h4 className="text-sm font-medium text-white mb-1">
                      How can I help?
                    </h4>
                    <p className="text-xs text-neutral-500 mb-6 text-center max-w-[240px]">
                      I route your request to the best agent automatically.
                    </p>
                    <div className="w-full space-y-2">
                      {ALL_SUGGESTIONS.slice(0, 6).map((s, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => sendMessage(s.prompt)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all text-left group"
                        >
                          <s.icon className="w-4 h-4 text-neutral-600 group-hover:text-emerald-400 transition-colors shrink-0" />
                          <span className="text-[13px] text-neutral-400 group-hover:text-white transition-colors">
                            {s.text}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Message list */}
                <AnimatePresence initial={false}>
                  {messages.map((msg, idx) => {
                    const isMsgStreaming =
                      isStreaming &&
                      msg.role === "assistant" &&
                      idx === messages.length - 1 &&
                      !msg.responseTimeMs;

                    return (
                      <motion.div
                        key={msg.id}
                        variants={messageVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{
                          type: "spring",
                          damping: 25,
                          stiffness: 400,
                        }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {/* AI avatar */}
                        {msg.role === "assistant" && (
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mt-1 mr-2 shrink-0">
                            <Bot className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                        )}

                        <div
                          className={`max-w-[80%] rounded-2xl text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-emerald-600 text-white px-4 py-2.5 rounded-br-md shadow-lg shadow-emerald-900/20"
                              : "text-neutral-300 px-1 py-1"
                          }`}
                        >
                          {/* Agent attribution badge */}
                          {msg.role === "assistant" &&
                            msg.agentLabel &&
                            msg.agentLabel !== "General Chat" && (
                              <AgentBadge label={msg.agentLabel} />
                            )}

                          {/* Message content */}
                          {msg.role === "assistant" ? (
                            <div className="space-y-1">
                              <div className="text-sm leading-relaxed">
                                {renderMarkdown(
                                  msg.content || (loading ? "" : "")
                                )}
                                {isMsgStreaming && <StreamingCursor />}
                              </div>
                              {/* Footer: time + copy */}
                              {msg.content && !isMsgStreaming && (
                                <div className="flex items-center gap-2 mt-2 pt-1.5">
                                  {msg.responseTimeMs != null &&
                                    msg.responseTimeMs > 0 && (
                                      <span className="text-[10px] text-neutral-600 font-mono">
                                        {(msg.responseTimeMs / 1000).toFixed(1)}s
                                      </span>
                                    )}
                                  <CopyBtn text={msg.content} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap break-words">
                              {msg.content}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Thinking indicator (shown before first streaming token) */}
                <AnimatePresence>
                  {loading && !isLastMessageStreaming && lastMessage?.role === "user" && (
                    <ThinkingIndicator />
                  )}
                </AnimatePresence>
              </div>

              {/* Scroll-to-bottom floating button */}
              <ScrollToBottomBtn scrollRef={scrollRef} />
            </div>

            {/* Suggested prompts (only before first message) */}
            <AnimatePresence>
              {!hasSentMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pb-2 flex flex-wrap gap-1.5 overflow-hidden"
                >
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s.prompt)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:text-white hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all"
                    >
                      {s.text}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
              <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 focus-within:border-emerald-500/30 focus-within:bg-white/[0.06] transition-all">
                <AutoGrowTextarea
                  value={input}
                  onChange={setInput}
                  onSubmit={() => sendMessage(input)}
                  disabled={loading}
                  textareaRef={textareaRef}
                />
                <AnimatePresence>
                  {input.trim() && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      type="button"
                      onClick={() => sendMessage(input)}
                      disabled={loading}
                      className="w-8 h-8 mb-0.5 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-400 disabled:opacity-30 transition-all shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <p className="text-[9px] text-neutral-600 text-center mt-2">
                Sovereign routes to the best agent for your task
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
