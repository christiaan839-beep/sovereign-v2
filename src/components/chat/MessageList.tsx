"use client";

import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Globe, FileText, Users, Code2, Search, Sparkles, Image as ImageIcon, Zap } from "lucide-react";
import { MessageBubble, LoadingDots } from "./MessageBubble";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import type { Message, Suggestion } from "./types";

const SUGGESTIONS: Suggestion[] = [
  { icon: Globe, text: "Audit a website", prompt: "audit example.com" },
  { icon: FileText, text: "Write a blog post", prompt: "write a blog about AI agents for business" },
  { icon: Users, text: "Find B2B leads", prompt: "find leads for SaaS companies in fintech" },
  { icon: Code2, text: "Review code", prompt: "review code for security issues" },
  { icon: Search, text: "Scan a competitor", prompt: "competitor scan stripe.com" },
  { icon: Sparkles, text: "Generate an image", prompt: "generate image of a futuristic dashboard" },
  { icon: ImageIcon, text: "Build a landing page", prompt: "build a landing page for a SaaS startup" },
  { icon: Zap, text: "Run a workflow", prompt: "run a workflow: research, write blog, generate image" },
];

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  activeAgent: { label: string; startTime: number } | null;
  onSend: (text: string) => void;
  submitFeedback: (messageId: string, rating: number) => void;
}

export function MessageList({ messages, loading, activeAgent, onSend, submitFeedback }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 h-full">
          {/* Animated Mascot */}
          <div className="relative mb-8">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-emerald-500/[0.08] animate-[spin_60s_linear_infinite]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-emerald-500/[0.12] animate-[spin_40s_linear_infinite_reverse]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-emerald-500/[0.06] blur-xl" />
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <SovereignLogo size="lg" />
            </motion.div>
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">What would you like to build?</h2>
          <p className="text-sm text-neutral-600 mb-10">124 agents ready. Just describe what you need.</p>

          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button
                key={s.text}
                onClick={() => onSend(s.prompt)}
                className="group flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-500/20 transition-gpu duration-300 text-left hover:scale-[1.02]"
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-emerald-500/30 transition-colors">
                  <s.icon className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <span className="text-xs text-neutral-400 group-hover:text-neutral-200 transition-colors leading-tight">{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" ref={scrollRef}>
      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} loading={loading} submitFeedback={submitFeedback} />
        ))}

        {/* Active agent progress bar */}
        {loading && activeAgent && (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-neutral-400">{activeAgent.label} is working...</span>
            </div>
            <div className="flex-1 h-[2px] bg-white/[0.03] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500/50 rounded-full"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: "30%" }}
              />
            </div>
          </div>
        )}

        {/* Loading dots */}
        {loading && !activeAgent && messages[messages.length - 1]?.role === "user" && <LoadingDots />}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
