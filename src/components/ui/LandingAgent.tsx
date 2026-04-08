"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

/**
 * LandingAgent — Conversational AI assistant on the landing page.
 * Visitors can ask questions about Sovereign Matrix and get real answers.
 * Uses the smart-router API for actual AI responses.
 *
 * Features:
 * - Claude-style thinking animation (pulsing orb)
 * - Typewriter response effect
 * - Quick-action suggestion chips
 * - Glassmorphic floating chat bubble
 */

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

const QUICK_ACTIONS = [
  "What can Sovereign Matrix do?",
  "How much does it cost?",
  "How is this different from ChatGPT?",
  "Can I run it locally?",
];

// Claude-style thinking orb
function ThinkingOrb() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="relative w-6 h-6">
        {/* Outer ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-emerald-500/30"
        />
        {/* Middle ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-1 rounded-full border border-emerald-400/40"
        />
        {/* Core pulse */}
        <motion.div
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-2 rounded-full bg-emerald-500/60"
        />
      </div>
      <div className="space-y-1">
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest"
        >
          Thinking...
        </motion.div>
      </div>
    </div>
  );
}

export function LandingAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: "assistant",
      content: "Hey! I\u2019m the Sovereign Matrix agent. Type or tap the mic to speak. Ask me anything \u2014 pricing, capabilities, how it compares to HubSpot or Clay, or what makes it different.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // ── Voice: Speech Recognition ──
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return; // Browser doesn't support

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      // Auto-send after voice input
      setTimeout(() => sendMessage(transcript), 300);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // ── Voice: Text-to-Speech ──
  const speakText = (text: string) => {
    if (!voiceEnabled) return;
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Try to pick a natural voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Samantha") || v.name.includes("Google") || v.name.includes("Natural"));
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isThinking) return;

    const now = Date.now(); // eslint-disable-line react-hooks/purity -- called from event handler, not during render
    const userMessage: Message = { role: "user", content: text.trim(), timestamp: now };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);
    setStreamText("");

    try {
      // Build context from conversation history
      const context = messages
        .slice(-4)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      const res = await fetch("/api/agents/smart-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are the Sovereign Matrix voice assistant. Be concise (2-3 sentences max), helpful, and specific. You represent an Agent Operating System with 130 specialized agents, 39+ models (including Gemini 3.1 Pro, Claude Mythos, Llama 4 Maverick), $199/mo flat pricing (no credits, no per-token fees), 5-layer safety pipeline, white-label for agencies, and local execution via Ollama.

Previous conversation:
${context}

User question: ${text.trim()}

Answer concisely and specifically. Do not be generic. Reference real features of the platform.`,
          task_type: "analysis",
        }),
      });

      const data = await res.json();
      const fullText = data.result || data.response || "I can help with that! Visit our dashboard to explore the full platform.";

      // Typewriter effect
      setIsThinking(false);
      let i = 0;
      const typewriter = setInterval(() => {
        i += 2;
        setStreamText(fullText.slice(0, i));
        if (i >= fullText.length) {
          clearInterval(typewriter);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullText, timestamp: Date.now() },
          ]);
          setStreamText("");
          // Speak the response
          speakText(fullText);
        }
      }, 15);
    } catch {
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having trouble connecting right now. Check out sovereignmatrix.agency/showcase for a full interactive demo!",
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating chat button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-emerald-500 text-black flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] transition-shadow"
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-6rem)] rounded-3xl border border-white/[0.08] bg-[#0A0A0A]/95 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0A0A0A]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Sovereign Agent</p>
                  <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider">Voice-enabled — Powered by NIM</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.05] transition-gpu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-emerald-500/10 border border-emerald-500/15 text-emerald-100 rounded-br-md"
                        : "bg-white/[0.03] border border-white/[0.06] text-neutral-300 rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {/* Thinking animation */}
              {isThinking && <ThinkingOrb />}

              {/* Streaming text */}
              {streamText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/[0.06] text-sm text-neutral-300 leading-relaxed">
                    {streamText}
                    <span className="inline-block w-1 h-3.5 bg-emerald-400 ml-0.5 animate-pulse" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick actions (show only if no user messages yet) */}
            {messages.length <= 1 && !isThinking && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => sendMessage(action)}
                      className="px-3 py-1.5 rounded-full text-[10px] font-medium text-neutral-400 border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/20 hover:text-emerald-400 transition-gpu"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-white/[0.06]">
              {/* Voice controls */}
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wider transition-all ${
                    isListening
                      ? "bg-red-500/10 border border-red-500/20 text-red-400"
                      : "bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/20"
                  }`}
                >
                  {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isListening ? "Listening..." : "Speak"}
                </button>
                <button
                  type="button"
                  onClick={() => { setVoiceEnabled(!voiceEnabled); if (voiceEnabled) window.speechSynthesis?.cancel(); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wider transition-all ${
                    voiceEnabled
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      : "bg-white/[0.03] border border-white/[0.06] text-neutral-600"
                  }`}
                >
                  {voiceEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                  {voiceEnabled ? "Voice on" : "Voice off"}
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 focus-within:border-emerald-500/20 transition-colors">
                <label htmlFor="landing-agent-input" className="sr-only">Ask about the platform</label>
                <input
                  id="landing-agent-input"
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? "Listening..." : "Type or speak..."}
                  disabled={isThinking}
                  aria-label="Ask about the platform"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isThinking}
                  className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-gpu disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
