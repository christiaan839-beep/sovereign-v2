"use client";

/**
 * SOVEREIGN MATRIX -- Assistant Entry Points
 *
 * SovereignAssistant: Floating widget (bottom-right bubble).
 * SovereignAssistantEmbed: Full-page modular chat (re-exported from @/components/chat).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles, Globe, FileText, Users, Code2, Search, Image as ImageIcon, Zap } from "lucide-react";
import { routeIntent } from "@/lib/intent-router";
import { ChatLayout } from "@/components/chat";
import type { Message } from "@/components/chat/types";
import { detectContentType } from "@/components/chat/types";

// ── Re-export the modular chat as the embedded version ──
export { ChatLayout as SovereignAssistantEmbed };

const STREAM_FLUSH_MS = 80;

const SUGGESTIONS = [
  { icon: Globe, text: "Audit a website", prompt: "audit example.com" },
  { icon: FileText, text: "Write a blog post", prompt: "write a blog about AI agents for business" },
  { icon: Users, text: "Find B2B leads", prompt: "find leads for SaaS companies in fintech" },
  { icon: Code2, text: "Review code", prompt: "review code for security issues" },
  { icon: Search, text: "Scan a competitor", prompt: "competitor scan stripe.com" },
  { icon: Sparkles, text: "Generate an image", prompt: "generate image of a futuristic dashboard" },
  { icon: ImageIcon, text: "Build a landing page", prompt: "build a landing page for a SaaS startup" },
  { icon: Zap, text: "Run a workflow", prompt: "run a workflow: research, write blog, generate image" },
];

// ── Lightweight chat hook for the floating widget only ──

function useWidgetChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<string>("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim(), timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const intent = routeIntent(text);
        const startTime = Date.now();
        const isStream = intent.endpoint === "/api/ai/stream";

        const res = await fetch(intent.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isStream
              ? { prompt: text, systemInstruction: "You are Sovereign Assistant, a helpful AI colleague. Be direct, concise, and useful." }
              : intent.params,
          ),
          signal: controller.signal,
        });

        if (isStream && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          streamBufferRef.current = "";
          const assistantId = crypto.randomUUID();
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", content: "", label: intent.label, timestamp: new Date() },
          ]);

          const flushBuffer = () => {
            const content = streamBufferRef.current;
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content } : m)));
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
            if (controller.signal.aborted) { reader.cancel(); break; }
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ") && line.trim() !== "data: [DONE]") {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === "thinking_start" || data.type === "thinking_end" || data.type === "thinking") continue;
                  const token = data.choices?.[0]?.delta?.content || data.text || "";
                  streamBufferRef.current += token;
                  scheduleFlush();
                } catch { /* skip */ }
              }
            }
          }

          if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
          const accumulated = streamBufferRef.current;
          const elapsed = Date.now() - startTime;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated, agentLabel: intent.label, responseTimeMs: elapsed } : m)),
          );
          setLoading(false);
          return;
        }

        const data = await res.json();
        let content =
          data.result || data.answer || data.response || data.analysis || data.text ||
          data.intelligence?.market_position || data.redacted_text ||
          (typeof data === "string" ? data : JSON.stringify(data, null, 2));

        if (content.length > 3000) content = content.slice(0, 3000) + "\n\n[Truncated]";

        const imageUrl = data.images?.[0]?.url || data.imageUrl || data.image_url || data.url;
        const finalContent = imageUrl && /\.(png|jpg|jpeg|webp|gif|svg)/i.test(imageUrl) ? imageUrl : content;

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
        if (error instanceof DOMException && error.name === "AbortError") { setLoading(false); return; }
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: `Error: ${error instanceof Error ? error.message : "Unknown"}`, timestamp: new Date() },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  return { messages, input, setInput, loading, sendMessage, scrollRef, inputRef };
}

// ── Floating Widget ──

export function SovereignAssistant() {
  const [open, setOpen] = useState(false);
  const { messages, input, setInput, loading, sendMessage, scrollRef, inputRef } = useWidgetChat();

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, inputRef]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-gpu duration-300 shadow-2xl ${
          open
            ? "bg-white/10 border border-white/20 backdrop-blur-xl"
            : "bg-white text-black hover:bg-neutral-200 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
        }`}
      >
        {open ? <X className="w-5 h-5 text-white" /> : <MessageSquare className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] rounded-2xl border border-white/10 bg-[#0A0A0A]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Sovereign Assistant</h3>
                  <p className="text-[10px] text-neutral-500">Routes to 132 AI agents</p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-500 text-center mb-4">What would you like to do?</p>
                  {SUGGESTIONS.slice(0, 6).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s.prompt)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-gpu text-left group"
                    >
                      <s.icon className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors shrink-0" />
                      <span className="text-sm text-neutral-400 group-hover:text-white transition-colors">{s.text}</span>
                    </button>
                  ))}
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-white text-black rounded-br-md"
                        : "bg-white/5 text-neutral-300 border border-white/5 rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" && msg.label && (
                      <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold block mb-1">{msg.label}</span>
                    )}
                    <div className="whitespace-pre-wrap break-words">{msg.content || (loading ? "Thinking..." : "")}</div>
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/5 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-white/5 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  disabled={loading}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20 disabled:opacity-50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-neutral-200 disabled:opacity-30 transition-gpu shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
