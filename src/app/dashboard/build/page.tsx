"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Code2, Eye, Copy, Check, Loader2,
  Wand2, RotateCcw, Download, Maximize2, Minimize2,
  Globe, FileText, Palette, Zap, Terminal
} from "lucide-react";

interface BuildMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  code?: string;
  timestamp: Date;
}

const STARTER_PROMPTS = [
  { icon: Globe, text: "Build a landing page", prompt: "Build a modern dark landing page for an AI SaaS product with hero section, features grid, pricing cards, and CTA" },
  { icon: Palette, text: "Design a dashboard", prompt: "Create a dark analytics dashboard with charts, KPI cards, and a sidebar navigation" },
  { icon: FileText, text: "Generate a form", prompt: "Build a multi-step onboarding form with email, company name, and plan selection" },
  { icon: Zap, text: "Create an API client", prompt: "Generate a TypeScript API client with fetch wrapper, error handling, and retry logic" },
];

export default function BuildModePage() {
  const [messages, setMessages] = useState<BuildMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const extractCode = (text: string): string => {
    // Extract HTML/code blocks from response
    const htmlMatch = text.match(/```(?:html|tsx|jsx|css)?\n([\s\S]*?)```/);
    if (htmlMatch) return htmlMatch[1].trim();

    // If the response IS HTML (starts with < or <!DOCTYPE)
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html") || text.trim().startsWith("<div")) {
      return text.trim();
    }

    return "";
  };

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: BuildMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Use page-builder-stream for HTML generation, smart-router for code
      const isHTMLRequest = /landing|page|dashboard|form|card|hero|section|website|ui|design|layout/i.test(text);
      const endpoint = isHTMLRequest ? "/api/agents/page-builder-stream" : "/api/agents/code-agent";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isHTMLRequest
            ? { prompt: text, mode: "full" }
            : { prompt: text, language: "typescript" }
        ),
      });

      if (!res.ok) throw new Error(`API returned ${res.status}`);

      let fullContent = "";

      if (res.body && isHTMLRequest) {
        // Stream the response
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const assistantId = crypto.randomUUID();

        setMessages(prev => [...prev, {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line.trim() !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                const token = data.choices?.[0]?.delta?.content || data.html || data.text || data.chunk || "";
                fullContent += token;
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
                );
              } catch {
                // Raw text chunk
                fullContent += line.slice(6);
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
                );
              }
            }
          }
        }
      } else {
        // JSON response
        const data = await res.json();
        fullContent = data.html || data.code || data.result || data.response ||
          (typeof data === "string" ? data : JSON.stringify(data, null, 2));

        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullContent,
          timestamp: new Date(),
        }]);
      }

      // Extract and preview code
      const code = extractCode(fullContent) || fullContent;
      if (code.includes("<") && code.includes(">")) {
        setPreviewCode(code);
        setShowPreview(true);
        setActiveTab("preview");
      } else {
        setActiveTab("code");
      }

      // Update message with extracted code
      setMessages(prev =>
        prev.map((m, i) => i === prev.length - 1 ? { ...m, code } : m)
      );

    } catch (error) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Build failed: ${error instanceof Error ? error.message : "Unknown error"}. Try again with a different prompt.`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const copyCode = () => {
    navigator.clipboard.writeText(previewCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    const blob = new Blob([previewCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sovereign-build.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className={`h-[calc(100vh-4rem)] flex ${fullscreen ? "fixed inset-0 z-50 bg-black" : ""}`} role="main" aria-label="Build mode code generator">
      {/* Left: Chat Panel */}
      <div className={`flex flex-col ${showPreview ? "w-1/2" : "w-full"} border-r border-white/[0.06]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00B7FF]/10 border border-[#00B7FF]/20 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-[#00B7FF]" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Build Mode</h1>
              <p className="text-[11px] text-neutral-500">Describe it. I build it. Live.</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 rounded-lg hover:bg-white/[0.04] text-neutral-500 hover:text-white transition-colors"
              title={showPreview ? "Hide preview" : "Show preview"}
              aria-label={showPreview ? "Hide preview" : "Show preview"}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setMessages([]); setPreviewCode(""); }}
              className="p-2 rounded-lg hover:bg-white/[0.04] text-neutral-500 hover:text-white transition-colors"
              title="New session"
              aria-label="New session"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#00B7FF]/10 border border-[#00B7FF]/20 flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-[#00B7FF]" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">What do you want to build?</h2>
              <p className="text-sm text-neutral-500 mb-8 max-w-md">
                Describe any UI, page, component, or code. I&apos;ll generate it and show you a live preview.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {STARTER_PROMPTS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s.prompt)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-[#00B7FF]/20 transition-gpu text-left group"
                  >
                    <s.icon className="w-4 h-4 text-neutral-500 group-hover:text-[#00B7FF] transition-colors shrink-0" />
                    <span className="text-xs text-neutral-400 group-hover:text-white transition-colors">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${
                msg.role === "user"
                  ? "bg-[#00B7FF]/10 border border-[#00B7FF]/20 rounded-2xl rounded-br-md px-4 py-2.5"
                  : "bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3"
              }`}>
                {msg.role === "assistant" && msg.code ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal className="w-3.5 h-3.5 text-[#00B7FF]" />
                      <span className="text-[10px] text-[#00B7FF] font-medium uppercase tracking-wider">Generated</span>
                    </div>
                    <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto leading-relaxed">
                      {msg.code.slice(0, 500)}{msg.code.length > 500 ? "\n..." : ""}
                    </pre>
                    <button
                      onClick={() => {
                        setPreviewCode(msg.code!);
                        setShowPreview(true);
                        setActiveTab("preview");
                      }}
                      className="mt-2 text-[10px] text-[#00B7FF] hover:text-[#00B7FF]/80 transition-colors"
                    >
                      View full preview →
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">{msg.content.slice(0, 2000)}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="w-4 h-4 text-[#00B7FF] animate-spin" />
                <span className="text-sm text-neutral-400">Building...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-end gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-[#00B7FF]/30 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build..."
              aria-label="Build prompt"
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 outline-none resize-none max-h-32"
              style={{ minHeight: "24px" }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              aria-label="Send build prompt"
              className="p-1.5 rounded-lg bg-[#00B7FF]/20 text-[#00B7FF] hover:bg-[#00B7FF]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-gpu"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-neutral-600 mt-1.5 px-1">
            Powered by Devstral 2 123B + Nemotron Ultra 253B. Enter to send, Shift+Enter for new line.
          </p>
        </div>
      </div>

      {/* Right: Preview Panel */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "50%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col bg-[#0a0a0a] overflow-hidden"
          >
            {/* Preview Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeTab === "preview"
                      ? "bg-white/[0.08] text-white"
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setActiveTab("code")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeTab === "code"
                      ? "bg-white/[0.08] text-white"
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  Code
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={copyCode}
                  disabled={!previewCode}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-neutral-500 hover:text-white transition-colors disabled:opacity-30"
                  title="Copy code"
                  aria-label="Copy code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#00B7FF]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={downloadCode}
                  disabled={!previewCode}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-neutral-500 hover:text-white transition-colors disabled:opacity-30"
                  title="Download HTML"
                  aria-label="Download HTML"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setFullscreen(!fullscreen)}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-neutral-500 hover:text-white transition-colors"
                  title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-hidden">
              {!previewCode ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <Code2 className="w-10 h-10 text-neutral-700 mb-3" />
                  <p className="text-sm text-neutral-500">Your build will appear here</p>
                  <p className="text-xs text-neutral-600 mt-1">Live preview with hot reload</p>
                </div>
              ) : activeTab === "preview" ? (
                <iframe
                  srcDoc={previewCode}
                  className="w-full h-full bg-white"
                  sandbox="allow-scripts allow-same-origin"
                  title="Build preview"
                />
              ) : (
                <pre className="w-full h-full overflow-auto p-4 text-xs text-[#00B7FF]/80 font-mono leading-relaxed bg-[#0a0a0a]">
                  {previewCode}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
