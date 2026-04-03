"use client";

import { useState, memo } from "react";
import { Copy, Check, ThumbsUp, ThumbsDown, Eye, EyeOff } from "lucide-react";
import type { Message } from "./types";
import { detectContentType } from "./types";
// Inline thinking trace — original component was removed during dead code cleanup
function ThinkingTrace({ thinking }: { thinking: string }) {
  return (
    <div className="mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-neutral-500 font-mono whitespace-pre-wrap">
      {thinking}
    </div>
  );
}
import { getModel, PROVIDER_COLORS } from "@/config/models";

// ── Copy Button ──

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Loading Dots ──

export function LoadingDots() {
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

// ── Rich Content Renderer ──

function RichContent({ content, contentType }: { content: string; contentType?: Message["contentType"] }) {
  const [showPreview, setShowPreview] = useState(true);
  const type = contentType || detectContentType(content);

  if (type === "image") {
    const url = content.match(/https?:\/\/[^\s"]+\.(png|jpg|jpeg|webp|gif|svg)[^\s"]*/i)?.[0] || content;
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Generated" className="rounded-xl max-w-full max-h-[400px] object-contain border border-white/10" />
        <div className="flex gap-1">
          <CopyButton text={url} />
          <a href={url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors text-xs">
            Download
          </a>
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
          <iframe srcDoc={content} sandbox="allow-scripts" className="w-full h-[400px] rounded-xl border border-white/10 bg-white" title="HTML Preview" />
        ) : (
          <pre className="text-xs text-neutral-400 bg-black/50 rounded-xl p-4 overflow-x-auto max-h-[400px] border border-white/5">
            <code>{content.slice(0, 3000)}</code>
          </pre>
        )}
      </div>
    );
  }

  if (type === "code") {
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

  // Check for data that could be a chart
  const chartMatch = content.match(/(\d+(?:\.\d+)?%|\$[\d,]+|R[\d,]+|\d+ (?:agents?|leads?|requests?|users?))/gi);
  if (chartMatch && chartMatch.length >= 3) {
    const metrics = content
      .split("\n")
      .filter((line) => /\d/.test(line) && line.trim().length > 0)
      .slice(0, 8)
      .map((line) => {
        const numMatch = line.match(/([\d,.]+%?)/);
        const label = line.replace(/([\d,.]+%?)/, "").replace(/[:\-|]/g, "").trim().slice(0, 30);
        return { label: label || "Metric", value: numMatch ? parseFloat(numMatch[1].replace(/[,%]/g, "")) : 0 };
      })
      .filter((m) => m.value > 0);

    if (metrics.length >= 2) {
      const maxVal = Math.max(...metrics.map((m) => m.value));
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
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 rounded-full transition-gpu duration-700"
                      style={{ width: `${(m.value / maxVal) * 100}%` }}
                    />
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

  return <div className="whitespace-pre-wrap break-words">{content}</div>;
}

// ── Model Badge ──

function ModelBadge({ modelId }: { modelId: string }) {
  const model = getModel(modelId);
  const color = PROVIDER_COLORS[model.provider] || "#888";

  return (
    <span
      className="text-[8px] px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1"
      style={{
        backgroundColor: `${color}10`,
        color: `${color}BB`,
        borderColor: `${color}25`,
      }}
    >
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} />
      {model.name}
    </span>
  );
}

// ── Quality Score Badge ──

function QualityBadge({ score, refined }: { score: number; refined?: boolean }) {
  if (score >= 80) {
    return (
      <span className="text-[8px] px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400/90 border-emerald-500/25">
        <span className="w-1 h-1 rounded-full bg-emerald-400" />
        {"\u2713"} Human-quality
      </span>
    );
  }

  if (score >= 60) {
    return (
      <span className="text-[8px] px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 bg-amber-500/10 text-amber-400/90 border-amber-500/25">
        <span className="w-1 h-1 rounded-full bg-amber-400" />
        {refined ? "Refined" : "Refined"}
      </span>
    );
  }

  // Score < 60 — no badge
  return null;
}

// ── Message Bubble ──

interface MessageBubbleProps {
  msg: Message;
  loading: boolean;
  submitFeedback: (messageId: string, rating: number) => void;
}

export const MessageBubble = memo(function MessageBubble({ msg, loading, submitFeedback }: MessageBubbleProps) {
  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`${
          msg.role === "assistant" && (msg.contentType === "html" || msg.contentType === "image" || msg.contentType === "code")
            ? "max-w-[95%] w-full"
            : "max-w-[85%]"
        } px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          msg.role === "user"
            ? "bg-white text-black rounded-br-md"
            : "bg-white/5 text-neutral-300 border border-white/5 rounded-bl-md"
        }`}
      >
        {msg.role === "assistant" && (
          <div className="flex items-center gap-2 mb-1.5">
            {msg.label && (
              <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold">{msg.label}</span>
            )}
            {msg.modelUsed && <ModelBadge modelId={msg.modelUsed} />}
            {msg.qualityScore != null && <QualityBadge score={msg.qualityScore} refined={msg.refined} />}
            {msg.responseTimeMs != null && msg.responseTimeMs > 0 && (
              <span className="text-[9px] text-neutral-600 ml-auto font-mono">{(msg.responseTimeMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}
        {msg.thinking && <ThinkingTrace thinking={msg.thinking} />}
        {msg.role === "assistant" ? (
          <RichContent content={msg.content || (loading ? "Thinking..." : "")} contentType={msg.contentType} />
        ) : (
          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        )}
        {msg.role === "assistant" && msg.content && !loading && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
            <CopyButton text={msg.content} />
            <button
              onClick={() => submitFeedback(msg.id, 5)}
              className="p-1 rounded hover:bg-white/5 text-neutral-600 hover:text-emerald-400 transition-colors"
              title="Good response"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => submitFeedback(msg.id, 1)}
              className="p-1 rounded hover:bg-white/5 text-neutral-600 hover:text-red-400 transition-colors"
              title="Bad response"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
