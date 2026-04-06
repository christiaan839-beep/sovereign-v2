"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, Copy, XCircle } from "lucide-react";

/**
 * STREAMING OUTPUT — Word-by-word rendering for agent results.
 *
 * Makes agent output feel alive instead of loading → dump.
 * Simulates streaming by progressively revealing text with a natural typing speed.
 * For actual SSE streams, use the `streamUrl` prop.
 *
 * Usage:
 *   <StreamingOutput text={agentResult} isLoading={loading} />
 *   <StreamingOutput streamUrl="/api/ai/stream" body={{ prompt: "..." }} />
 */

interface StreamingOutputProps {
  /** Pre-fetched result text to stream progressively */
  text?: string;
  /** Whether data is still loading (shows spinner) */
  isLoading?: boolean;
  /** Error message to display */
  error?: string;
  /** SSE endpoint to stream from directly */
  streamUrl?: string;
  /** POST body for SSE endpoint */
  body?: Record<string, unknown>;
  /** Words per second for progressive reveal (default: 40) */
  speed?: number;
  /** Callback when streaming completes */
  onComplete?: (fullText: string) => void;
  /** Custom class name */
  className?: string;
}

export function StreamingOutput({
  text,
  isLoading,
  error,
  streamUrl,
  body,
  speed = 40,
  onComplete,
  className = "",
}: StreamingOutputProps) {
  const [displayed, setDisplayed] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sseText, setSseText] = useState("");
  const [sseError, setSseError] = useState("");
  const [sseDone, setSseDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── SSE Streaming Mode ──
  useEffect(() => {
    if (!streamUrl || !body) return;
    setStreaming(true);
    setSseText("");
    setSseError("");
    setSseDone(false);

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(streamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setSseError(`Request failed: ${res.status}`);
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text" && data.text) {
                accumulated += data.text;
                setSseText(accumulated);
              }
              if (data.type === "done") {
                setSseDone(true);
                setStreaming(false);
                onComplete?.(accumulated);
              }
              if (data.type === "error") {
                setSseError(data.error || "Stream error");
                setStreaming(false);
              }
            } catch { /* skip malformed lines */ }
          }
        }

        if (!sseDone) {
          setSseDone(true);
          setStreaming(false);
          onComplete?.(accumulated);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setSseError(String(err));
          setStreaming(false);
        }
      }
    })();

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl, JSON.stringify(body)]);

  // ── Progressive Reveal Mode (pre-fetched text) ──
  useEffect(() => {
    if (!text || streamUrl) return;
    setDisplayed("");
    setStreaming(true);

    const words = text.split(/(\s+)/); // Keep whitespace tokens
    let index = 0;
    const interval = setInterval(() => {
      if (index >= words.length) {
        clearInterval(interval);
        setStreaming(false);
        onComplete?.(text);
        return;
      }
      // Batch 2-3 words at a time for natural feel
      const batch = words.slice(index, index + 3).join("");
      setDisplayed((prev) => prev + batch);
      index += 3;
    }, 1000 / speed * 3);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayed, sseText]);

  const finalText = streamUrl ? sseText : displayed;
  const finalError = error || sseError;
  const isActive = isLoading || streaming;

  const handleCopy = () => {
    navigator.clipboard.writeText(finalText || text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          {isActive ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-500/70 font-mono">GENERATING</span>
            </>
          ) : finalError ? (
            <>
              <XCircle className="w-3 h-3 text-red-500" />
              <span className="text-[10px] text-red-500/70 font-mono">ERROR</span>
            </>
          ) : finalText ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-500/60" />
              <span className="text-[10px] text-neutral-500 font-mono">COMPLETE</span>
            </>
          ) : (
            <span className="text-[10px] text-neutral-600 font-mono">READY</span>
          )}
        </div>
        {finalText && !isActive && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-white transition-colors"
          >
            {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="p-4 max-h-[500px] overflow-y-auto"
      >
        {isLoading && !finalText && (
          <div className="flex items-center gap-2 text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Running agent...</span>
          </div>
        )}

        {finalError && (
          <div className="text-sm text-red-400">{finalError}</div>
        )}

        {finalText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap"
          >
            {finalText}
            {isActive && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 align-middle"
              />
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
