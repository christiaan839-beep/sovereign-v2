"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, Plus, Mic, MicOff, ArrowDown } from "lucide-react";

/**
 * SOVEREIGN MATRIX APP — Premium Chat Experience
 *
 * A clean, full-screen AI chat — no sidebar, no dashboard clutter.
 * Like opening the Claude or Gemini app, but powered by 20 models.
 *
 * Features:
 * - Auto-selects best model per message (Smart Router)
 * - Streaming responses
 * - Voice input
 * - Conversation history (localStorage)
 * - "New chat" button
 * - Scroll to bottom on new messages
 * - Mobile-first responsive design
 */

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  timestamp: number;
}

const SUGGESTIONS = [
  "Find 10 SaaS companies in London hiring a Head of Marketing",
  "Write a blog post about AI agents replacing manual agency work",
  "Analyze the SEO strategy of hubspot.com",
  "Draft a cold email sequence for fintech CTOs",
  "Create a competitive analysis of my top 3 competitors",
  "Review this contract for risks and unusual clauses",
];

export default function SovereignApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Auto-resize textarea
  const handleInput = (value: string) => {
    setInput(value);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  };

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Track scroll position for "scroll down" button
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
  };

  // Load conversation from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sovereign_app_chat");
      if (saved) setMessages(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Save conversation
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("sovereign_app_chat", JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  // Voice input
  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join("");
      setInput(transcript);
      if (event.results[0]?.isFinal) {
        setIsListening(false);
        sendMessage(transcript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // Send message
  const sendMessage = async (overrideInput?: string) => {
    const text = (overrideInput || input).trim();
    if (!text || streaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text, timestamp: Date.now() };
    const assistantMsg: Message = { id: `a-${Date.now()}`, role: "assistant", content: "", timestamp: Date.now() };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      // Try streaming endpoint first
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          systemInstruction: "You are Sovereign AI — a powerful assistant backed by 20 AI models. Be helpful, direct, and actionable. Use markdown for formatting. Never use AI slop phrases.",
        }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setMessages((prev) =>
            prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullText } : m)
          );
        }

        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullText || "No response received.", model: "Sovereign AI" } : m)
        );
      } else {
        // Fallback to smart-router (non-streaming)
        const fallbackRes = await fetch("/api/agents/smart-router", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, task_type: "analysis" }),
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          const content = data.result || data.output || JSON.stringify(data, null, 2);
          const model = data.routing?.model_selected || "Smart Router";
          setMessages((prev) =>
            prev.map((m) => m.id === assistantMsg.id ? { ...m, content, model } : m)
          );
        } else {
          // Final fallback to demo endpoint
          const demoRes = await fetch("/api/demo/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: text }),
          });
          const demoData = await demoRes.json();
          setMessages((prev) =>
            prev.map((m) => m.id === assistantMsg.id ? { ...m, content: demoData.output || demoData.result || "Sign in to use all 140 agents.", model: "Demo" } : m)
          );
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsg.id ? { ...m, content: "Connection error. Please try again." } : m)
      );
    } finally {
      setStreaming(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    localStorage.removeItem("sovereign_app_chat");
    inputRef.current?.focus();
  };

  return (
    <main className="h-dvh flex flex-col bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Sovereign AI</h1>
            <p className="text-[10px] text-neutral-500">20 models • auto-routed</p>
          </div>
        </div>
        <button
          onClick={newChat}
          className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-colors"
          title="New chat"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">What can I help you with?</h2>
            <p className="text-sm text-neutral-400 max-w-sm mb-8">
              I have 20 AI models and 140 specialized agents. Ask me anything — I&apos;ll pick the best model for your task automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); sendMessage(s); }}
                  className="text-left p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-neutral-400 hover:text-white hover:border-emerald-500/20 transition-colors"
                >
                  {s.length > 60 ? s.slice(0, 60) + "..." : s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[70%] ${
                msg.role === "user"
                  ? "bg-emerald-500/10 border border-emerald-500/15 rounded-2xl rounded-br-md px-4 py-3"
                  : "bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3"
              }`}>
                {msg.role === "assistant" && msg.model && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-500/60 font-medium uppercase tracking-wider">{msg.model}</span>
                  </div>
                )}
                <div className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user" ? "text-emerald-200" : "text-neutral-300"
                }`}>
                  {msg.content || (
                    <span className="flex items-center gap-2 text-neutral-500">
                      <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={scrollToBottom}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 p-2 rounded-full bg-white/10 border border-white/20 text-white"
          >
            <ArrowDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/[0.06]">
        <div className="relative max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Message Sovereign AI..."
            disabled={streaming}
            rows={1}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 pr-24 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/30 transition-colors resize-none disabled:opacity-50"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              onClick={toggleVoice}
              className={`p-2 rounded-xl transition-colors ${isListening ? "bg-red-500/20 text-red-400" : "text-neutral-500 hover:text-white hover:bg-white/5"}`}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={streaming || !input.trim()}
              className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-30"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-neutral-500 mt-2">
          Sovereign AI • 20 models • auto-routed • sovereignmatrix.agency
        </p>
      </div>
    </main>
  );
}
