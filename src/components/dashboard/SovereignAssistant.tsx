"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles, Globe, FileText, Users, Code2, Search, Zap, Image as ImageIcon, ThumbsUp, ThumbsDown, Copy, Check, ChevronDown, Eye, EyeOff, ArrowRight } from "lucide-react";
import { routeIntent } from "@/lib/intent-router";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { PreviewPanel } from "./PreviewPanel";
import { getSystemPrompt, PROMPT_CATEGORIES } from "@/lib/system-prompts";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  label?: string;
  timestamp: Date;
  contentType?: "text" | "code" | "html" | "image" | "table";
  agentLabel?: string;
  responseTimeMs?: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  systemPrompt: string;
  createdAt: number;
}

interface AgentHistoryEntry {
  label: string;
  responseTimeMs: number;
  status: "success" | "error";
  timestamp: number;
}

const MODELS = [
  { id: "auto", name: "Auto", desc: "Smart routing picks the best model" },
  { id: "nemotron", name: "Nemotron Ultra", desc: "253B reasoning" },
  { id: "claude", name: "Claude", desc: "Anthropic MCP" },
  { id: "gemini", name: "Gemini 2.5", desc: "Google Pro" },
  { id: "deepseek", name: "DeepSeek", desc: "V3.2 reasoning" },
];

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

// ─── Conversation Tabs ───
function ConversationTabs({ conversations, activeId, onSelect, onNew, onClose }: {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.04] overflow-x-auto scrollbar-hide">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            c.id === activeId
              ? "bg-white/[0.06] text-white border border-white/[0.08]"
              : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]"
          }`}
        >
          <span className="max-w-[120px] truncate">{c.title}</span>
          {conversations.length > 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); onClose(c.id); }}
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity cursor-pointer"
            >×</span>
          )}
        </button>
      ))}
      {conversations.length < 8 && (
        <button onClick={onNew} className="px-2 py-1.5 text-neutral-600 hover:text-emerald-400 text-sm transition-colors" title="New conversation">
          +
        </button>
      )}
    </div>
  );
}

// ─── Agent Status Strip ───
function AgentStatusStrip({ history, activeAgent }: {
  history: AgentHistoryEntry[];
  activeAgent: { label: string; startTime: number } | null;
}) {
  const recent = history.slice(-3);
  if (recent.length === 0 && !activeAgent) return null;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/[0.04] bg-white/[0.01]">
      <div className="flex items-center gap-4">
        {recent.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${i === recent.length - 1 ? "bg-emerald-500 animate-pulse" : "bg-neutral-700"}`} />
            <span className="text-[10px] text-neutral-500">{entry.label}</span>
            <span className="text-[10px] text-neutral-600 font-mono">{(entry.responseTimeMs / 1000).toFixed(1)}s</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {activeAgent && (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-400">{activeAgent.label}</span>
          </div>
        )}
        <a href="/dashboard/agent-analytics" className="text-[9px] text-neutral-600 hover:text-emerald-400 transition-colors">
          All Agents →
        </a>
      </div>
    </div>
  );
}

// ─── System Prompt Editor ───
const PROMPT_TEMPLATES = [
  { id: "sales", name: "Sales Agent", icon: Users },
  { id: "technical", name: "Code Reviewer", icon: Code2 },
  { id: "creative", name: "Content Writer", icon: FileText },
  { id: "analysis", name: "SEO Analyst", icon: Search },
  { id: "support", name: "Support Engineer", icon: Sparkles },
  { id: "general", name: "General Assistant", icon: Zap },
];

function SystemPromptEditor({ prompt, onChange, isOpen, onToggle }: {
  prompt: string;
  onChange: (prompt: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const tokenCount = Math.ceil(prompt.length / 4);
  const activeTemplate = PROMPT_TEMPLATES.find(t => prompt.includes(t.id)) || null;

  return (
    <div className="border-b border-white/[0.04]">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500">System Prompt:</span>
          <span className="text-[10px] text-neutral-400">{activeTemplate?.name || "Custom"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-neutral-600 font-mono">{tokenCount} tokens</span>
          <ChevronDown className={`w-3 h-3 text-neutral-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                {PROMPT_TEMPLATES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onChange(getSystemPrompt(t.id))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                        prompt === getSystemPrompt(t.id)
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/[0.03] text-neutral-500 border border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {t.name}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={prompt}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
                className="w-full bg-transparent border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 resize-none focus:outline-none focus:border-emerald-500/30"
                placeholder="Customize the system prompt..."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Quick Actions Bar ───
const QUICK_ACTIONS = [
  { id: "audit", icon: Globe, label: "Audit URL", placeholder: "Enter URL to audit...", prefix: "audit " },
  { id: "write", icon: FileText, label: "Write", placeholder: "What should I write?", prefix: "write a blog about " },
  { id: "leads", icon: Users, label: "Leads", placeholder: "Industry or company type...", prefix: "find leads for " },
  { id: "image", icon: ImageIcon, label: "Image", placeholder: "Describe the image...", prefix: "generate image of " },
  { id: "workflow", icon: Zap, label: "Workflow", placeholder: "Multi-step task...", prefix: "run a workflow: " },
];

function QuickActionsBar({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState("");

  const handleSubmit = (prefix: string) => {
    if (!actionInput.trim()) return;
    onSubmit(prefix + actionInput.trim());
    setActionInput("");
    setExpanded(null);
  };

  return (
    <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        if (expanded === action.id) {
          return (
            <motion.div key={action.id} layoutId={action.id} className="flex items-center gap-2 flex-1 min-w-0">
              <input
                autoFocus
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(action.prefix)}
                placeholder={action.placeholder}
                className="flex-1 bg-white/[0.03] border border-emerald-500/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none min-w-0"
              />
              <button onClick={() => handleSubmit(action.prefix)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setExpanded(null); setActionInput(""); }} className="p-1.5 text-neutral-600 hover:text-neutral-400">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          );
        }
        return (
          <motion.button
            key={action.id}
            layoutId={action.id}
            onClick={() => setExpanded(action.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[10px] text-neutral-500 hover:border-emerald-500/15 hover:text-neutral-300 transition-all whitespace-nowrap shrink-0"
          >
            <Icon className="w-3 h-3" />
            {action.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Content Type Detection ───
function detectContentType(content: string): Message["contentType"] {
  if (!content) return "text";
  if (content.includes("<!DOCTYPE") || content.includes("<html") || (content.includes("<div") && content.includes("</div>") && content.length > 500)) return "html";
  if (/\.(png|jpg|jpeg|webp|gif|svg)\b/i.test(content) && /https?:\/\//.test(content)) return "image";
  if (content.includes("```") || /^(import |export |function |const |class |def |from )/m.test(content)) return "code";
  return "text";
}

// ─── Shared Chat Hook ───
function useSovereignChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [activeAgent, setActiveAgent] = useState<{ label: string; startTime: number } | null>(null);
  const [previewContent, setPreviewContent] = useState<{ type: string; content: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const intent = routeIntent(text);
      setActiveAgent({ label: intent.label, startTime: Date.now() });
      const isStream = intent.endpoint === "/api/ai/stream";
      const modelOverride = selectedModel !== "auto" ? { model: selectedModel } : {};
      const res = await fetch(intent.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isStream
            ? { prompt: text, systemInstruction: "You are Sovereign Assistant, a helpful AI colleague. Be direct, concise, and useful. No corporate filler.", ...modelOverride }
            : { ...intent.params, ...modelOverride }
        ),
      });

      if (isStream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        const assistantId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "", label: intent.label, timestamp: new Date() },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line.trim() !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                const token = data.choices?.[0]?.delta?.content || data.text || "";
                accumulated += token;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
                );
              } catch { /* skip malformed */ }
            }
          }
        }
        // Add elapsed time and agent label to the streamed message
        const streamElapsed = activeAgent ? Date.now() - activeAgent.startTime : 0;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, agentLabel: activeAgent?.label, responseTimeMs: streamElapsed } : m))
        );
        // Auto-detect previewable content
        if (accumulated.includes("<!DOCTYPE") || accumulated.includes("<html")) {
          setPreviewContent({ type: "html", content: accumulated });
        } else if (/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i.test(accumulated)) {
          const match = accumulated.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i);
          if (match) setPreviewContent({ type: "image", content: match[0] });
        }
        setActiveAgent(null);
        setLoading(false);
        return;
      }

      const data = await res.json();
      let content = data.result || data.answer || data.response || data.analysis || data.text ||
        data.intelligence?.market_position || data.redacted_text ||
        (typeof data === "string" ? data : JSON.stringify(data, null, 2));

      if (content.length > 3000) {
        content = content.slice(0, 3000) + "\n\n[Response truncated — view full result in the dedicated tool]";
      }

      // Check for image URL in response data
      const imageUrl = data.images?.[0]?.url || data.imageUrl || data.image_url || data.url;
      const finalContent = imageUrl && /\.(png|jpg|jpeg|webp|gif|svg)/i.test(imageUrl) ? imageUrl : content;

      const elapsed = activeAgent ? Date.now() - activeAgent.startTime : 0;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: finalContent, label: intent.label, timestamp: new Date(), contentType: detectContentType(finalContent), agentLabel: activeAgent?.label, responseTimeMs: elapsed },
      ]);
      // Auto-detect previewable content
      if (finalContent.includes("<!DOCTYPE") || finalContent.includes("<html")) {
        setPreviewContent({ type: "html", content: finalContent });
      } else if (/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i.test(finalContent)) {
        const match = finalContent.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i);
        if (match) setPreviewContent({ type: "image", content: match[0] });
      }
      setActiveAgent(null);
    } catch (error) {
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
      setLoading(false);
    }
  }, [loading]);

  const resetMessages = () => {
    setMessages([]);
    setActiveAgent(null);
  };

  const submitFeedback = async (messageId: string, rating: number) => {
    try {
      await fetch("/api/agents/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rate", agentId: "assistant", rating, output: messages.find(m => m.id === messageId)?.content || "" })
      });
    } catch {}
  };

  return { messages, input, setInput, loading, sendMessage, scrollRef, inputRef, submitFeedback, selectedModel, setSelectedModel, activeAgent, previewContent, setPreviewContent, resetMessages };
}

// ─── Copy Button ───
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── Rich Content Renderer ───
function RichContent({ content, contentType }: { content: string; contentType?: Message["contentType"] }) {
  const [showPreview, setShowPreview] = useState(true);
  const type = contentType || detectContentType(content);

  if (type === "image") {
    const url = content.match(/https?:\/\/[^\s"]+\.(png|jpg|jpeg|webp|gif|svg)[^\s"]*/i)?.[0] || content;
    return (
      <div className="space-y-2">
        <img src={url} alt="Generated" className="rounded-xl max-w-full max-h-[400px] object-contain border border-white/10" />
        <div className="flex gap-1">
          <CopyButton text={url} />
          <a href={url} target="_blank" rel="noopener" className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors text-xs">Download</a>
        </div>
      </div>
    );
  }

  if (type === "html") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] text-emerald-400/70 uppercase tracking-widest font-bold">Live Preview</span>
          <button onClick={() => setShowPreview(!showPreview)} className="p-0.5 rounded hover:bg-white/10 text-neutral-500">
            {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <CopyButton text={content} />
        </div>
        {showPreview ? (
          <iframe srcDoc={content} sandbox="allow-scripts" className="w-full h-[400px] rounded-xl border border-white/10 bg-white" />
        ) : (
          <pre className="text-xs text-neutral-400 bg-black/50 rounded-xl p-4 overflow-x-auto max-h-[400px] border border-white/5">
            <code>{content.slice(0, 3000)}</code>
          </pre>
        )}
      </div>
    );
  }

  if (type === "code") {
    // Extract code blocks from markdown
    const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]*?)```/);
    const codeContent = codeBlockMatch ? codeBlockMatch[1] : content;
    const lang = content.match(/```(\w+)/)?.[1] || "code";
    const textBefore = codeBlockMatch ? content.slice(0, content.indexOf("```")).trim() : "";
    const textAfter = codeBlockMatch ? content.slice(content.lastIndexOf("```") + 3).trim() : "";

    return (
      <div className="space-y-2">
        {textBefore && <div className="whitespace-pre-wrap text-sm">{textBefore}</div>}
        <div className="relative group/code">
          <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-t-xl">
            <span className="text-[9px] text-neutral-500 uppercase tracking-widest">{lang}</span>
            <CopyButton text={codeContent} />
          </div>
          <pre className="text-xs text-neutral-300 bg-black/40 rounded-b-xl p-4 overflow-x-auto max-h-[400px] border border-t-0 border-white/5 font-mono">
            <code>{codeContent}</code>
          </pre>
        </div>
        {textAfter && <div className="whitespace-pre-wrap text-sm">{textAfter}</div>}
      </div>
    );
  }

  // Check for data that could be a chart (numbers, metrics, percentages)
  const chartMatch = content.match(/(\d+(?:\.\d+)?%|\$[\d,]+|R[\d,]+|\d+ (?:agents?|leads?|requests?|users?))/gi);
  if (chartMatch && chartMatch.length >= 3) {
    // Extract metric pairs for a simple bar chart
    const metrics = content.split('\n')
      .filter(line => /\d/.test(line) && line.trim().length > 0)
      .slice(0, 8)
      .map(line => {
        const numMatch = line.match(/([\d,.]+%?)/);
        const label = line.replace(/([\d,.]+%?)/, '').replace(/[:\-|]/g, '').trim().slice(0, 30);
        return { label: label || 'Metric', value: numMatch ? parseFloat(numMatch[1].replace(/[,%]/g, '')) : 0 };
      })
      .filter(m => m.value > 0);

    if (metrics.length >= 2) {
      const maxVal = Math.max(...metrics.map(m => m.value));
      return (
        <div className="space-y-3">
          <div className="whitespace-pre-wrap break-words text-sm mb-4">{content}</div>
          <div className="p-4 rounded-xl bg-black/30 border border-white/5">
            <p className="text-[9px] uppercase tracking-widest text-emerald-500/60 font-bold mb-3">Auto-Generated Chart</p>
            <div className="space-y-2">
              {metrics.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-neutral-500 w-24 truncate text-right">{m.label}</span>
                  <div className="flex-1 h-5 bg-white/[0.03] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 rounded-full transition-all duration-700"
                      style={{ width: `${(m.value / maxVal) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-neutral-400 w-12 text-right font-mono">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  // Default: plain text with whitespace preserved
  return <div className="whitespace-pre-wrap break-words">{content}</div>;
}

// ─── Message Bubble (shared) ───
function ChatMessage({ msg, loading, submitFeedback }: { msg: Message; loading: boolean; submitFeedback: (messageId: string, rating: number) => void }) {
  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`${msg.role === "assistant" && (msg.contentType === "html" || msg.contentType === "image" || msg.contentType === "code") ? "max-w-[95%] w-full" : "max-w-[85%]"} px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          msg.role === "user"
            ? "bg-white text-black rounded-br-md"
            : "bg-white/5 text-neutral-300 border border-white/5 rounded-bl-md"
        }`}
      >
        {msg.label && msg.role === "assistant" && (
          <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold block mb-1.5">
            {msg.label}
            {msg.responseTimeMs && msg.responseTimeMs > 0 && (
              <span className="text-[9px] text-neutral-600 ml-2">{(msg.responseTimeMs / 1000).toFixed(1)}s</span>
            )}
          </span>
        )}
        {msg.role === "assistant" ? (
          <RichContent content={msg.content || (loading ? "Thinking..." : "")} contentType={msg.contentType} />
        ) : (
          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        )}
        {msg.role === "assistant" && msg.content && !loading && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
            <CopyButton text={msg.content} />
            <button onClick={() => submitFeedback(msg.id, 5)} className="p-1 rounded hover:bg-white/5 text-neutral-600 hover:text-emerald-400 transition-colors" title="Good response">
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => submitFeedback(msg.id, 1)} className="p-1 rounded hover:bg-white/5 text-neutral-600 hover:text-red-400 transition-colors" title="Bad response">
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loading Dots ───
function LoadingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-white/5 border border-white/5 px-4 py-3 rounded-2xl rounded-bl-md">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Floating Widget (existing behavior) ───
export function SovereignAssistant() {
  const [open, setOpen] = useState(false);
  const { messages, input, setInput, loading, sendMessage, scrollRef, inputRef, submitFeedback } = useSovereignChat();

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, inputRef]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
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
                  <p className="text-[10px] text-neutral-500">Routes to 109 AI agents</p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-500 text-center mb-4">What would you like to do?</p>
                  {SUGGESTIONS.slice(0, 6).map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s.prompt)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all text-left group">
                      <s.icon className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors shrink-0" />
                      <span className="text-sm text-neutral-400 group-hover:text-white transition-colors">{s.text}</span>
                    </button>
                  ))}
                </div>
              )}
              {messages.map((msg) => <ChatMessage key={msg.id} msg={msg} loading={loading} submitFeedback={submitFeedback} />)}
              {loading && messages[messages.length - 1]?.role === "user" && <LoadingDots />}
            </div>

            <div className="px-4 py-3 border-t border-white/5 shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..." disabled={loading}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20 disabled:opacity-50 transition-colors" />
                <button type="submit" disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:bg-neutral-200 disabled:opacity-30 transition-all shrink-0">
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

// ─── Model Switcher Dropdown ───
function ModelSwitcher({ selected, onChange }: { selected: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = MODELS.find(m => m.id === selected) || MODELS[0];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] hover:border-white/15 transition-colors text-xs text-neutral-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {current.name}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            className="absolute bottom-full left-0 mb-2 w-52 rounded-xl bg-[#0A0A0A] border border-white/10 shadow-2xl overflow-hidden z-50">
            {MODELS.map((m) => (
              <button key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${selected === m.id ? "bg-white/[0.03]" : ""}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selected === m.id ? "bg-emerald-400" : "bg-neutral-600"}`} />
                <div>
                  <span className="text-xs font-medium text-white block">{m.name}</span>
                  <span className="text-[9px] text-neutral-600">{m.desc}</span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Full-Page Embedded Chat (Claude + AI Studio style) ───
export function SovereignAssistantEmbed() {
  const { messages, input, setInput, loading, sendMessage, scrollRef, inputRef, submitFeedback, selectedModel, setSelectedModel, activeAgent, previewContent, setPreviewContent, resetMessages } = useSovereignChat();

  // Multi-conversation state
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window === "undefined") return [{ id: "1", title: "New Mission", messages: [], model: "auto", systemPrompt: getSystemPrompt("general"), createdAt: Date.now() }];
    try {
      const saved = sessionStorage.getItem("sovereign_conversations");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((c: Conversation) => ({ ...c, messages: c.messages.map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })) }));
      }
    } catch {}
    return [{ id: "1", title: "New Mission", messages: [], model: "auto", systemPrompt: getSystemPrompt("general"), createdAt: Date.now() }];
  });
  const [activeConvId, setActiveConvId] = useState(conversations[0]?.id || "1");
  const [agentHistory, setAgentHistory] = useState<AgentHistoryEntry[]>([]);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];

  // Track agent completions in history
  useEffect(() => {
    if (!activeAgent) return;
    const checkCompletion = () => {
      if (!loading && activeAgent) {
        setAgentHistory(prev => [...prev, {
          label: activeAgent.label,
          responseTimeMs: Date.now() - activeAgent.startTime,
          status: "success",
          timestamp: Date.now(),
        }]);
      }
    };
    // Check on loading state change
    if (!loading) checkCompletion();
  }, [loading, activeAgent]);

  // Persist conversations to sessionStorage
  useEffect(() => {
    try {
      const toSave = conversations.map(c => c.id === activeConvId ? { ...c, messages } : c);
      sessionStorage.setItem("sovereign_conversations", JSON.stringify(toSave));
    } catch {}
  }, [messages, conversations, activeConvId]);

  // Auto-update conversation title from first user message
  useEffect(() => {
    if (messages.length > 0) {
      const firstUserMsg = messages.find(m => m.role === "user");
      if (firstUserMsg) {
        setConversations(prev => prev.map(c =>
          c.id === activeConvId && c.title === "New Mission"
            ? { ...c, title: firstUserMsg.content.slice(0, 30) }
            : c
        ));
      }
    }
  }, [messages, activeConvId]);

  const handleNewConversation = () => {
    // Save current messages to current conversation
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, messages } : c));
    const newId = Date.now().toString();
    const newConv: Conversation = { id: newId, title: "New Mission", messages: [], model: "auto", systemPrompt: getSystemPrompt("general"), createdAt: Date.now() };
    setConversations(prev => [...prev, newConv]);
    setActiveConvId(newId);
    resetMessages();
  };

  const handleSelectConversation = (id: string) => {
    if (id === activeConvId) return;
    // Save current messages to current conversation
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, messages } : c));
    setActiveConvId(id);
    resetMessages();
  };

  const handleCloseConversation = (id: string) => {
    if (conversations.length <= 1) return;
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    if (id === activeConvId) {
      setActiveConvId(remaining[0].id);
      resetMessages();
    }
  };

  const handleSystemPromptChange = (prompt: string) => {
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, systemPrompt: prompt } : c));
  };

  const handleSend = (text: string) => sendMessage(text);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <div className="h-screen flex bg-[#050505]">
      {/* Chat area */}
      <div className={`flex flex-col transition-all duration-300 ${previewContent ? 'w-full lg:w-[60%]' : 'w-full'}`}>
        {/* Conversation Tabs */}
        <ConversationTabs
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onClose={handleCloseConversation}
        />

        {/* Agent Status Strip */}
        <AgentStatusStrip history={agentHistory} activeAgent={activeAgent} />

        {/* System Prompt Editor */}
        <SystemPromptEditor
          prompt={activeConv?.systemPrompt || getSystemPrompt("general")}
          onChange={handleSystemPromptChange}
          isOpen={promptEditorOpen}
          onToggle={() => setPromptEditorOpen(!promptEditorOpen)}
        />

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 h-full">
              {/* Animated Mascot */}
              <div className="relative mb-8">
                {/* Outer glow ring */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-emerald-500/[0.08] animate-[spin_60s_linear_infinite]" />
                {/* Inner glow ring */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-emerald-500/[0.12] animate-[spin_40s_linear_infinite_reverse]" />
                {/* Glow backdrop */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-emerald-500/[0.06] blur-xl" />
                {/* Logo with breathing animation */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <SovereignLogo size="lg" />
                </motion.div>
              </div>

              <h2 className="text-xl font-semibold text-white mb-2">What would you like to build?</h2>
              <p className="text-sm text-neutral-600 mb-10">109 agents ready. Just describe what you need.</p>

              <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                {SUGGESTIONS.slice(0, 4).map((s) => (
                  <button
                    key={s.text}
                    onClick={() => handleSend(s.text)}
                    className="group flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-500/20 transition-all duration-300 text-left hover:scale-[1.02]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-emerald-500/30 transition-colors">
                      <s.icon className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <span className="text-xs text-neutral-400 group-hover:text-neutral-200 transition-colors leading-tight">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            /* Active chat — scrollable messages with rich rendering */
            <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
              {messages.map((msg) => <ChatMessage key={msg.id} msg={msg} loading={loading} submitFeedback={submitFeedback} />)}
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
              {loading && !activeAgent && messages[messages.length - 1]?.role === "user" && <LoadingDots />}
            </div>
          )}
        </div>

        {/* Quick Actions Bar */}
        <QuickActionsBar onSubmit={handleSend} />

        {/* Pinned Input Bar with Model Switcher */}
        <div className="shrink-0 border-t border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl px-6 py-4">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything — audit a site, write content, find leads, build a page..."
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/30 disabled:opacity-50 transition-colors" />
              <button type="submit" disabled={loading || !input.trim()}
                className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center hover:bg-neutral-200 disabled:opacity-30 transition-all shrink-0">
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <ModelSwitcher selected={selectedModel} onChange={setSelectedModel} />
              <p className="text-[10px] text-neutral-600">109 Agents &middot; 39 Models</p>
            </div>
          </form>
        </div>
      </div>

      {/* Preview panel */}
      <AnimatePresence>
        {previewContent && (
          <div className="hidden lg:block w-[40%]">
            <PreviewPanel content={previewContent} onClose={() => setPreviewContent(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
