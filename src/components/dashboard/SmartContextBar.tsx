"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, X, Zap, Target, TrendingUp, BarChart3, MessageCircle, Send, BrainCircuit, Minimize2, Maximize2 } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface SmartSuggestion {
  title: string;
  description: string;
  action: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: "high" | "medium" | "low";
  color: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CONTEXT_SUGGESTIONS: SmartSuggestion[] = [
  {
    title: "Strike a Competitor",
    description: "Drop a URL into the War Room to identify pricing gaps and messaging weaknesses.",
    action: "Open War Room",
    href: "/dashboard/war-room",
    icon: Target,
    priority: "high",
    color: "text-rose-400",
  },
  {
    title: "Generate Fresh Content",
    description: "Your Content Factory has been idle. Generate a LinkedIn post or blog to maintain momentum.",
    action: "Open Factory",
    href: "/dashboard/content-factory",
    icon: Sparkles,
    priority: "medium",
    color: "text-[#00B7FF]",
  },
  {
    title: "Analyze SEO Gaps",
    description: "Run the SEO X-Ray on your landing page to discover keyword opportunities.",
    action: "Launch X-Ray",
    href: "/dashboard/seo-dominator",
    icon: TrendingUp,
    priority: "medium",
    color: "text-emerald-400",
  },
  {
    title: "Review Pipeline Metrics",
    description: "Check which autonomous workflows are converting the highest.",
    action: "View Analytics",
    href: "/dashboard/agent-analytics",
    icon: BarChart3,
    priority: "low",
    color: "text-violet-400",
  },
];

/**
 * SmartContextBar — Combines two innovations:
 * 1. Proactive AI suggestions based on current page context
 * 2. A floating REAL conversation agent (Sovereign Copilot) that answers
 *    questions using the live NVIDIA NIM smart-router API
 */
export function SmartContextBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [currentSuggestion, setCurrentSuggestion] = useState<SmartSuggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // === CONVERSATION AGENT STATE ===
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const suppressedPaths = ["/dashboard/war-room", "/dashboard/nemo-claw", "/dashboard/content-factory"];
    const isSuppressed = suppressedPaths.some(p => pathname.startsWith(p));
    
    if (isSuppressed) return;

    const timer = setTimeout(() => {
      const relevantSuggestions = CONTEXT_SUGGESTIONS.filter(s => s.href !== pathname);
      const random = relevantSuggestions[Math.floor(Math.random() * relevantSuggestions.length)];
      setCurrentSuggestion(random);
      setVisible(true);
      setDismissed(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // === REAL AI CONVERSATION ===
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsThinking(true);

    try {
      const res = await fetch("/api/agents/smart-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are the Sovereign Matrix Copilot — a helpful, concise AI assistant embedded inside the Sovereign Matrix dashboard. The user is currently on the page: ${pathname}. Answer their question clearly and actionably. Be concise (max 3 sentences unless they ask for detail). If they ask about a feature, tell them where to find it in the dashboard.\n\nUser question: ${userMsg}`,
          agentId: "copilot",
        }),
      });

      const data = await res.json();
      const reply = data.response || data.result || "I'm having trouble connecting to the AI engine right now. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection to the AI engine failed. Make sure your NVIDIA API key is configured." }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      {/* === SUGGESTION BAR === */}
      {visible && !dismissed && currentSuggestion && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-4 mt-4 mb-2 md:mx-8"
          >
            <div className="relative rounded-2xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 backdrop-blur-xl p-4 md:p-5 flex items-center justify-between gap-4 overflow-hidden group">
              <div className="absolute -left-20 -top-20 w-60 h-60 bg-[#00B7FF]/5 rounded-full blur-[80px] pointer-events-none" />
              
              <div className="flex items-center gap-4 relative z-10">
                <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 ${currentSuggestion.color}`}>
                  <currentSuggestion.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400">AI Suggestion</span>
                  </div>
                  <p className="text-sm text-white font-medium">{currentSuggestion.title}</p>
                  <p className="text-xs text-neutral-500 hidden md:block">{currentSuggestion.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 relative z-10 shrink-0">
                <Link
                  href={currentSuggestion.href}
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-widest text-white hover:bg-white/20 transition-all flex items-center gap-2"
                >
                  {currentSuggestion.action} <ArrowRight className="w-3 h-3" />
                </Link>
                <button
                  onClick={() => setDismissed(true)}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* === FLOATING CONVERSATION AGENT (REAL AI) === */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3">
        <AnimatePresence>
          {chatOpen && !chatMinimized && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-[380px] h-[500px] bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
            >
              {/* Chat Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00B7FF] to-indigo-600 flex items-center justify-center">
                    <BrainCircuit className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white tracking-widest uppercase block">Sovereign Copilot</span>
                    <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> NVIDIA NIM Live
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setChatMinimized(true)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-neutral-500 hover:text-white transition-colors">
                    <Minimize2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => setChatOpen(false)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-neutral-500 hover:text-white transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <BrainCircuit className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
                    <p className="text-sm text-neutral-500 mb-1">Ask me anything about your platform.</p>
                    <p className="text-[10px] text-neutral-600">Powered by NVIDIA NIM — real AI, not a script.</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#00B7FF]/20 text-white border border-[#00B7FF]/20"
                        : "bg-white/5 text-neutral-300 border border-white/5"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#00B7FF] animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-[#00B7FF] animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <span className="w-2 h-2 rounded-full bg-[#00B7FF] animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={sendMessage} className="p-3 border-t border-white/5 bg-black/40">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask the Sovereign Copilot..."
                    disabled={isThinking}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#00B7FF]/30 transition-colors font-mono disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isThinking}
                    className="w-11 h-11 rounded-xl bg-[#00B7FF] flex items-center justify-center text-white hover:bg-[#00B7FF]/80 transition-colors disabled:opacity-30"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Trigger Button */}
        <motion.button
          onClick={() => {
            if (chatMinimized) {
              setChatMinimized(false);
            } else {
              setChatOpen(!chatOpen);
            }
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00B7FF] to-indigo-600 flex items-center justify-center text-white shadow-[0_0_30px_rgba(0,183,255,0.3)] border border-white/20 hover:shadow-[0_0_50px_rgba(0,183,255,0.4)] transition-shadow"
        >
          {chatOpen && !chatMinimized ? (
            <X className="w-5 h-5" />
          ) : chatMinimized ? (
            <Maximize2 className="w-5 h-5" />
          ) : (
            <MessageCircle className="w-5 h-5" />
          )}
        </motion.button>
      </div>
    </>
  );
}
