"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, Bot, ArrowLeft, Sparkles,
  ChevronDown, Copy, Check, Zap, Brain, Globe, Code2,
  Target, FileText, Search, Image, Workflow,
  Plus, Clock, CheckCircle2, Mic, MicOff, Volume2, VolumeX,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  streaming?: boolean;
  model?: string;
  duration?: number;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messageCount: number;
}

// ─── Model Options ───────────────────────────────

const MODELS = [
  { id: "auto", name: "Auto (Smart Router)", desc: "Best model per task", icon: Zap, color: "text-emerald-400" },
  { id: "fast", name: "Fast (Groq)", desc: "200ms responses", icon: Zap, color: "text-amber-400" },
  { id: "smart", name: "Deep Think (Claude)", desc: "Complex reasoning", icon: Brain, color: "text-violet-400" },
  { id: "research", name: "Research (Deep Search)", desc: "Multi-source citations", icon: Globe, color: "text-cyan-400" },
  { id: "code", name: "Code (Nemotron)", desc: "Code generation", icon: Code2, color: "text-rose-400" },
];

// ─── Quick Actions ───────────────────────────────

const QUICK_ACTIONS = [
  { label: "Find leads", prompt: "Find 50 B2B SaaS companies with Series A funding in the US", icon: Target },
  { label: "Write content", prompt: "Write a 1000-word blog post about how AI agents are replacing manual agency work", icon: FileText },
  { label: "Analyze site", prompt: "Analyze hubspot.com — tech stack, SEO gaps, and positioning weaknesses", icon: Search },
  { label: "Build workflow", prompt: "Create a workflow that finds leads, writes emails, and sends them via Slack", icon: Workflow },
  { label: "Generate image", prompt: "Generate a professional hero image for an AI platform, dark theme", icon: Image },
  { label: "Deep research", prompt: "Deep research: What are the top AI agent platforms in 2026?", icon: Globe },
];

// ─── Simple Markdown → JSX ──────────────────────

function FormattedText({ text }: { text: string }) {
  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const code = part.replace(/```\w*\n?/, "").replace(/```$/, "");
          return <pre key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-emerald-300 whitespace-pre-wrap">{code}</pre>;
        }
        // Process inline formatting
        const lines = part.split("\n");
        return lines.map((line, j) => {
          if (line.startsWith("### ")) return <h3 key={`${i}-${j}`} className="text-sm font-bold text-white mt-3 mb-1">{line.slice(4)}</h3>;
          if (line.startsWith("## ")) return <h2 key={`${i}-${j}`} className="text-base font-bold text-white mt-3 mb-1">{line.slice(3)}</h2>;
          if (line.startsWith("# ")) return <h1 key={`${i}-${j}`} className="text-lg font-bold text-white mt-3 mb-1">{line.slice(2)}</h1>;
          if (line.startsWith("- ")) return <div key={`${i}-${j}`} className="flex gap-2 ml-1"><span className="text-emerald-500 shrink-0">•</span><span>{line.slice(2)}</span></div>;
          if (line.trim() === "") return <br key={`${i}-${j}`} />;
          return <span key={`${i}-${j}`}>{line}<br /></span>;
        });
      })}
    </>
  );
}

// ─── Main App ───────────────────────────────────

export default function SovereignChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sovereign_conversations");
      if (saved) setConversations(JSON.parse(saved));
    } catch { /* skip */ }
  }, []);

  const saveConversation = useCallback(() => {
    if (messages.length < 2) return;
    const conv: Conversation = {
      id: `conv-${Date.now()}`,
      title: messages[0]?.content.slice(0, 50) || "New chat",
      lastMessage: messages[messages.length - 1]?.content.slice(0, 100) || "",
      timestamp: new Date().toISOString(),
      messageCount: messages.length,
    };
    const updated = [conv, ...conversations.slice(0, 19)];
    setConversations(updated);
    try { localStorage.setItem("sovereign_conversations", JSON.stringify(updated)); } catch { /* skip */ }
  }, [messages, conversations]);

  // ── Voice Input (Speech-to-Text) ──
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join("");
      setInput(transcript);
      if (event.results[0]?.isFinal) {
        setIsListening(false);
        // Auto-send after final result
        setTimeout(() => sendMessage(transcript), 300);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sendMessage is stable and called via setTimeout, not during render
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── Voice Output (Text-to-Speech) ──
  const speakText = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;

    // Strip markdown for clean speech
    const clean = text
      .replace(/```[\s\S]*?```/g, "code block omitted")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/#{1,3} /g, "")
      .replace(/\[Source \d+\]/g, "")
      .replace(/\n/g, ". ")
      .slice(0, 500); // Limit to prevent long TTS

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    // Try to find a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.name.includes("Samantha") || v.name.includes("Google") || v.name.includes("Natural"));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const sendMessage = async (text?: string) => {
    const prompt = text || input.trim();
    if (!prompt || streaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: prompt, timestamp: new Date() };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", timestamp: new Date(), streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);
    if (inputRef.current) inputRef.current.style.height = "auto";

    const startTime = Date.now();

    try {
      let endpoint = "/api/ai/stream";
      let body: Record<string, unknown> = {
        prompt,
        systemInstruction: "You are Sovereign AI, an autonomous agent assistant. Be helpful, concise, and actionable. Use markdown. When asked to do tasks, explain what agents would execute.",
      };

      if (selectedModel === "research") {
        endpoint = "/api/agents/deep-search";
        body = { query: prompt };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (selectedModel === "research" && res.ok) {
        const data = await res.json();
        const sources = data.sources?.map((s: { title: string; url: string }, i: number) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n") || "";
        const fullText = `${data.output || "No results"}\n\n**Sources:**\n${sources}`;
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullText, streaming: false, model: "Deep Search", duration: Date.now() - startTime } : m));
        setStreaming(false);
        saveConversation();
        return;
      }

      if (!res.ok) {
        const demoRes = await fetch("/api/demo/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
        const demoData = await demoRes.json();
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: demoData.response || "Try signing in for full access.", streaming: false, model: "Demo" } : m));
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text" && data.text) {
                fullText += data.text;
                setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullText } : m));
              }
              if (data.type === "thinking_start") {
                setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "🧠 Thinking deeply..." } : m));
              }
            } catch { /* skip */ }
          }
        }
      }

      setMessages((prev) => prev.map((m) => m.id === assistantId ? {
        ...m, content: fullText || "Done.", streaming: false, duration: Date.now() - startTime,
        model: MODELS.find((mod) => mod.id === selectedModel)?.name.split(" (")[0] || "Auto",
      } : m));
      // Auto-speak response if voice mode is on
      if (fullText) speakText(fullText);
      saveConversation();
    } catch {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Something went wrong. Please try again.", streaming: false } : m));
    } finally {
      setStreaming(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  return (
    <div className="h-dvh flex flex-col bg-[#010101] text-white overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] shrink-0 bg-[#010101]/95 backdrop-blur-xl z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold">Sovereign AI</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowModelPicker(!showModelPicker)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
            <currentModel.icon className={`w-3 h-3 ${currentModel.color}`} />
            <span className="hidden sm:inline">{currentModel.name.split(" (")[0]}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-all">
            <Clock className="w-4 h-4" />
          </button>
          <button onClick={() => { saveConversation(); setMessages([]); }} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Model Picker */}
      <AnimatePresence>
        {showModelPicker && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-14 right-4 z-50 w-64 rounded-xl border border-white/10 bg-[#0A0A0A] shadow-2xl p-2">
            {MODELS.map((m) => (
              <button key={m.id} onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${selectedModel === m.id ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-white/5"}`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <div>
                  <div className="text-xs font-medium text-white">{m.name}</div>
                  <div className="text-[10px] text-neutral-500">{m.desc}</div>
                </div>
                {selectedModel === m.id && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }}
            className="absolute top-0 right-0 bottom-0 w-72 z-50 bg-[#0A0A0A] border-l border-white/[0.06] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
              <span className="text-sm font-semibold">History</span>
              <button onClick={() => setShowHistory(false)} className="p-1 text-neutral-500 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.length === 0 && <p className="text-xs text-neutral-600 text-center py-8">No conversations yet</p>}
              {conversations.map((conv) => (
                <button key={conv.id} onClick={() => setShowHistory(false)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="text-xs font-medium text-neutral-300 truncate">{conv.title}</div>
                  <div className="text-[10px] text-neutral-600 truncate mt-0.5">{conv.lastMessage}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Sovereign AI</h1>
              <p className="text-sm text-neutral-500">130+ agents. 65+ models. What do you want to build?</p>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-lg">
              {QUICK_ACTIONS.map((action, i) => (
                <motion.button key={action.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => sendMessage(action.prompt)}
                  className="flex flex-col items-start gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/20 hover:bg-white/[0.04] transition-all text-left group">
                  <action.icon className="w-4 h-4 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
                  <span className="text-xs font-medium text-neutral-300">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-6 space-y-5 max-w-2xl mx-auto">
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={msg.role === "user" ? "flex justify-end" : "flex justify-start gap-3"}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
                <div className="max-w-[85%]">
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user" ? "bg-emerald-600 text-white rounded-br-sm" : "bg-white/[0.03] border border-white/[0.06] text-neutral-200 rounded-bl-sm"
                  }`}>
                    {msg.role === "assistant" && msg.content ? (
                      <FormattedText text={msg.content} />
                    ) : msg.streaming && !msg.content ? (
                      <span className="flex items-center gap-2 text-neutral-500 text-xs">
                        <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                      </span>
                    ) : (
                      msg.content
                    )}
                    {msg.streaming && msg.content && <span className="inline-block w-1 h-4 bg-emerald-400 ml-0.5 animate-pulse rounded-full" />}
                  </div>
                  {msg.role === "assistant" && !msg.streaming && msg.content && (
                    <div className="flex items-center gap-3 mt-1.5 px-1">
                      {msg.model && <span className="text-[9px] text-neutral-600 font-mono">{msg.model}</span>}
                      {msg.duration && <span className="text-[9px] text-neutral-600 font-mono">{(msg.duration / 1000).toFixed(1)}s</span>}
                      <button onClick={() => copyMessage(msg.id, msg.content)} className="text-neutral-600 hover:text-neutral-400 transition-colors">
                        {copied === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/[0.04] bg-[#010101] px-4 pb-4 pt-3">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          {/* Voice toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-3 rounded-xl shrink-0 transition-all ${voiceEnabled ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-white/[0.04] border border-white/[0.08] text-neutral-600 hover:text-neutral-400"}`}
            title={voiceEnabled ? "Voice mode on — responses will be spoken" : "Enable voice mode"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <textarea ref={inputRef} value={input} onChange={handleInputChange}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={isListening ? "Listening..." : "Ask anything..."}
            rows={1}
            className={`flex-1 resize-none bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors ${isListening ? "border-emerald-500/50 bg-emerald-500/[0.03]" : "border-white/[0.08] focus:border-emerald-500/30"}`}
            style={{ maxHeight: 120 }} />

          {/* Mic button — shows when input is empty */}
          <AnimatePresence mode="wait">
            {input.trim() || streaming ? (
              <motion.button key="send" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                onClick={() => sendMessage()} disabled={streaming || !input.trim()}
                className="p-3 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-colors disabled:opacity-50 shrink-0">
                {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </motion.button>
            ) : (
              <motion.button key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                onClick={isListening ? stopListening : startListening}
                className={`p-3 rounded-xl shrink-0 transition-all ${isListening ? "bg-red-500 text-white animate-pulse" : "bg-white/[0.04] border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.08]"}`}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Listening indicator */}
        <AnimatePresence>
          {isListening && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 mt-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div key={i} className="w-1 bg-emerald-400 rounded-full"
                    animate={{ height: [4, 16, 4] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} />
                ))}
              </div>
              <span className="text-xs text-emerald-400">Listening... tap mic to stop</span>
            </motion.div>
          )}
        </AnimatePresence>

        {!isListening && (
          <div className="flex items-center justify-center gap-4 mt-2 text-[9px] text-neutral-600">
            <span>Tap mic to speak</span>
            <span>·</span>
            <span>{currentModel.name}</span>
            {voiceEnabled && <span>· 🔊 Voice on</span>}
          </div>
        )}
      </div>
    </div>
  );
}
