"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, Bot, User, Loader2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export default function VoiceAssistantPage() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize speech recognition
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser. Use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final || interim);
      if (final) {
        handleUserMessage(final);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech") {
        setError(`Mic error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setError("");
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // Send message to AI and get response
  const handleUserMessage = async (text: string) => {
    const userMsg: Message = { role: "user", content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setThinking(true);
    setTranscript("");

    try {
      // Build conversation context (last 10 messages)
      const context = [...messages.slice(-10), userMsg]
        .map(m => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
        .join("\n");

      const res = await fetch("/api/agents/nemotron-omni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are Sovereign — a sharp, warm AI colleague. You speak like someone who's genuinely helpful, occasionally witty, and never robotic. Keep responses concise and conversational. You don't use corporate filler like "I'd be happy to assist" — you just help. When the user speaks to you, respond as if you're a trusted team member who happens to know everything.\n\nConversation:\n${context}\nAssistant:`,
          mode: "voice",
          audioContext: text,
        }),
      });

      const data = await res.json();
      const reply = data.result || data.text || data.response || "I couldn't process that. Try again.";

      const assistantMsg: Message = { role: "assistant", content: reply, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);

      // Speak the response
      if (voiceEnabled) {
        speakText(reply);
      }
    } catch {
      const errMsg: Message = {
        role: "assistant",
        content: "Connection issue. Check your internet and try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setThinking(false);
    }
  };

  // Text-to-speech
  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a natural voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel")
    ) || voices.find(v => v.lang.startsWith("en")) || voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  // Handle text input
  const [textInput, setTextInput] = useState("");
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    handleUserMessage(textInput.trim());
    setTextInput("");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sovereign Voice</h1>
            <p className="text-sm text-neutral-500 mt-1">Talk to your AI. It talks back.</p>
          </div>
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className="p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
            title={voiceEnabled ? "Mute voice responses" : "Enable voice responses"}
            aria-label={voiceEnabled ? "Mute voice responses" : "Enable voice responses"}
            aria-pressed={voiceEnabled}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4 text-[#00B7FF]" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
          </button>
        </div>

        {/* Chat Messages */}
        <div className="space-y-4 mb-8 min-h-[400px] max-h-[60vh] overflow-y-auto pr-2" role="log" aria-label="Chat messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#00B7FF]/10 border border-[#00B7FF]/20 flex items-center justify-center mb-6">
                <Bot className="w-8 h-8 text-[#00B7FF]" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Ready to listen</h2>
              <p className="text-sm text-neutral-500 max-w-sm">
                Click the microphone and speak, or type below.
                Ask about content, SEO, leads, or any business task.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-[#00B7FF]/10 border border-[#00B7FF]/20 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-[#00B7FF]" />
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-white/10 text-white rounded-br-md"
                  : "bg-[#00B7FF]/[0.06] border border-[#00B7FF]/10 text-neutral-200 rounded-bl-md"
              }`}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </motion.div>
          ))}

          {/* Thinking indicator */}
          <AnimatePresence>
            {thinking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex gap-3 items-center"
              >
                <div className="w-8 h-8 rounded-lg bg-[#00B7FF]/10 border border-[#00B7FF]/20 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-[#00B7FF] animate-spin" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-[#00B7FF]/[0.04] border border-[#00B7FF]/10 rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00B7FF]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00B7FF]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00B7FF]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live transcript */}
          {transcript && (
            <div className="flex justify-end">
              <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-neutral-400 italic max-w-[80%]">
                {transcript}...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Input Area */}
        <div className="sticky bottom-0 bg-[#050505] pt-4">
          <div className="flex items-center gap-3">
            {/* Mic Button */}
            <button
              onClick={listening ? stopListening : startListening}
              disabled={thinking}
              aria-label={listening ? "Stop listening" : "Start listening"}
              aria-pressed={listening}
              className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-gpu shrink-0 ${
                listening
                  ? "bg-red-500/20 border-2 border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                  : "bg-[#00B7FF]/10 border-2 border-[#00B7FF]/20 hover:border-[#00B7FF]/40 hover:shadow-[0_0_30px_rgba(0,183,255,0.15)]"
              } ${thinking ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {listening ? (
                <>
                  <MicOff className="w-5 h-5 text-red-400" />
                  {/* Pulse ring */}
                  <span className="absolute inset-0 rounded-2xl border-2 border-red-400/30 animate-ping" />
                </>
              ) : (
                <Mic className="w-5 h-5 text-[#00B7FF]" />
              )}
            </button>

            {/* Text Input */}
            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={listening ? "Listening..." : "Or type your message..."}
                disabled={thinking}
                aria-label="Type a message to the voice assistant"
                className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#00B7FF]/30 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || thinking}
                aria-label="Send message"
                className="px-5 py-3 rounded-xl bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-sm font-semibold text-[#00B7FF] hover:bg-[#00B7FF]/20 transition-colors disabled:opacity-30"
              >
                Send
              </button>
            </form>

            {/* Stop speaking */}
            {speaking && (
              <button
                onClick={stopSpeaking}
                aria-label="Stop speaking"
                className="w-14 h-14 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center shrink-0"
              >
                <VolumeX className="w-5 h-5 text-amber-400" />
              </button>
            )}
          </div>

          <p className="text-[10px] text-neutral-500 text-center mt-3">
            Powered by Nemotron Voicechat. Voice recognition requires Chrome or Edge.
          </p>
        </div>
      </div>
    </div>
  );
}
