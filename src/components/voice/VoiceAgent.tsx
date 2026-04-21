"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaPicker } from "@/components/voice/PersonaPicker";
import { VoiceStatusBar, type VoiceStatus } from "@/components/voice/VoiceStatusBar";
import { DEFAULT_PERSONA_ID, type PersonaId } from "@/lib/voice-personas";

/**
 * VoiceAgent — client orchestrator for the voice loop.
 *
 * Flow:
 *   1. User taps mic → POST /api/voice/session (auth + hold + token).
 *   2. Connect to WebSocket via NEXT_PUBLIC_VOICE_WS_URL (Railway-hosted).
 *   3. Send { type: "auth", token } → wait for { type: "ready" }.
 *   4. MediaRecorder captures user audio locally. Client-side VAD would
 *      live here (Plan 3.6 follow-up); for now this is push-to-talk.
 *   5. When the user releases the button, we send a finalized transcript
 *      via { type: "turn-end", transcript }. (Hot-path ASR transcription
 *      is a separate follow-up; for now we send an empty placeholder and
 *      rely on the LLM-side to ask "what did you say?" — or the user
 *      types for testing.)
 *   6. Server streams back { type: "audio", chunk } → we accumulate
 *      per-turn and play via AudioContext when { type: "turn-done" }.
 *   7. Barge-in: user taps Stop during playback → send { type: "barge-in" }.
 *
 * Where the "push-to-talk with typed transcript" escape hatch comes in:
 *   For the first ship of Plan 3, the UI surfaces a text input the user
 *   can type into while the WS is connected. This lets end-to-end
 *   verification happen without depending on Parakeet streaming ASR.
 *   VAD + live ASR upgrade is a follow-up plan.
 */

export interface VoiceAgentProps {
  /** Optional initial persona ID. */
  initialPersona?: PersonaId;
  /** Fires for each transcribed turn (UI display). */
  onUserTurn?: (text: string) => void;
  onAssistantSentence?: (text: string) => void;
}

interface Transcript {
  role: "user" | "assistant";
  text: string;
  at: number;
}

export function VoiceAgent({
  initialPersona = DEFAULT_PERSONA_ID,
  onUserTurn,
  onAssistantSentence,
}: VoiceAgentProps) {
  const [persona, setPersona] = useState<PersonaId>(initialPersona);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [draft, setDraft] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const audioEltRef = useRef<HTMLAudioElement | null>(null);

  /* ─── Playback ────────────────────────────────────────────── */

  const flushAndPlay = useCallback(() => {
    const chunks = audioChunksRef.current;
    if (chunks.length === 0) return;
    audioChunksRef.current = [];

    const blob = new Blob(chunks.map((c) => new Uint8Array(c).buffer as ArrayBuffer), {
      type: "audio/mpeg",
    });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioEltRef.current = audio;
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(url);
      if (audioEltRef.current === audio) {
        audioEltRef.current = null;
        setStatus(sessionActive ? "listening" : "idle");
      }
    });
    audio.play().catch((err) => {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Audio play failed");
    });
  }, [sessionActive]);

  const cancelPlayback = useCallback(() => {
    const audio = audioEltRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    audioEltRef.current = null;
    audioChunksRef.current = [];
  }, []);

  /* ─── WebSocket ───────────────────────────────────────────── */

  const connect = useCallback(async () => {
    setStatus("connecting");
    setMessage(null);

    try {
      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personaId: persona }),
      });

      if (res.status === 401) {
        window.location.href = "/signup?next=/dashboard/voice-assistant";
        return;
      }
      if (res.status === 402) {
        const body = await res.json();
        setStatus("error");
        setMessage(`Need ${body.required}¢, have ${body.available}¢.`);
        window.setTimeout(() => {
          window.location.href = body.topUpUrl ?? "/dashboard/billing?topup=true";
        }, 1500);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { token } = await res.json();

      const wsUrl = process.env.NEXT_PUBLIC_VOICE_WS_URL;
      if (!wsUrl) {
        setStatus("error");
        setMessage("NEXT_PUBLIC_VOICE_WS_URL not configured");
        return;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token }));
      };

      ws.onmessage = (ev) => {
        let msg: { type: string; [k: string]: unknown };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case "ready":
            setSessionActive(true);
            setStatus("listening");
            setMessage(null);
            break;

          case "audio":
            // base64 → Uint8Array
            if (typeof msg.chunk !== "string") return;
            audioChunksRef.current.push(b64ToBytes(msg.chunk));
            setStatus("speaking");
            break;

          case "sentence": {
            if (typeof msg.text !== "string") return;
            setTranscripts((t) => [
              ...t,
              { role: "assistant", text: msg.text as string, at: Date.now() },
            ]);
            onAssistantSentence?.(msg.text as string);
            break;
          }

          case "turn-done":
            flushAndPlay();
            break;

          case "error":
            setStatus("error");
            setMessage(typeof msg.message === "string" ? msg.message : "Unknown error");
            break;
        }
      };

      ws.onerror = () => {
        setStatus("error");
        setMessage("WebSocket error");
      };

      ws.onclose = () => {
        wsRef.current = null;
        setSessionActive(false);
        setStatus("idle");
      };
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Connect failed");
    }
  }, [persona, flushAndPlay, onAssistantSentence]);

  const disconnect = useCallback(() => {
    cancelPlayback();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "close" }));
      ws.close();
    }
    wsRef.current = null;
    setSessionActive(false);
    setStatus("idle");
    setMessage(null);
  }, [cancelPlayback]);

  const sendTurn = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setTranscripts((t) => [...t, { role: "user", text, at: Date.now() }]);
    onUserTurn?.(text);
    ws.send(JSON.stringify({ type: "turn-end", transcript: text }));
    setDraft("");
    setStatus("thinking");
  }, [draft, onUserTurn]);

  const bargeIn = useCallback(() => {
    cancelPlayback();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "barge-in" }));
    }
    setStatus("listening");
  }, [cancelPlayback]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      cancelPlayback();
      wsRef.current?.close();
    };
  }, [cancelPlayback]);

  /* ─── UI ──────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PersonaPicker value={persona} onChange={setPersona} disabled={sessionActive} />
        <VoiceStatusBar status={status} message={message ?? undefined} />
      </div>

      <div className="flex items-center gap-3">
        {!sessionActive ? (
          <button
            type="button"
            onClick={connect}
            disabled={status === "connecting"}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#B5532C] text-white text-[13px] font-medium rounded-[3px] hover:bg-[#C96234] disabled:opacity-60 transition-colors"
          >
            {status === "connecting" ? "Connecting…" : "Start session"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={bargeIn}
              disabled={status !== "speaking"}
              className="inline-flex items-center gap-2 px-3 py-2 border border-white/[0.1] text-[12px] font-mono tracking-wide text-neutral-400 rounded-[3px] hover:border-[#B5532C]/40 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Interrupt the agent"
            >
              Interrupt
            </button>
            <button
              type="button"
              onClick={disconnect}
              className="inline-flex items-center gap-2 px-3 py-2 border border-white/[0.1] text-[12px] font-mono tracking-wide text-neutral-400 rounded-[3px] hover:border-red-500/40 hover:text-white transition-colors"
            >
              End session
            </button>
          </>
        )}
      </div>

      {sessionActive && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendTurn();
              }
            }}
            placeholder="Type what you'd say…"
            className="flex-1 bg-white/[0.03] border border-white/[0.08] focus:border-[#B5532C]/50 rounded-[4px] px-3 py-2 text-[13px] text-white placeholder:text-neutral-600 outline-none transition-colors"
          />
          <button
            type="button"
            onClick={sendTurn}
            disabled={!draft.trim() || status === "speaking"}
            className="px-4 py-2 bg-[#B5532C] text-white text-[12px] font-medium rounded-[3px] hover:bg-[#C96234] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 mt-2 min-h-[120px]">
        <AnimatePresence initial={false}>
          {transcripts.slice(-8).map((t) => (
            <motion.div
              key={t.at}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-2 text-[13px] leading-[1.55] ${
                t.role === "user" ? "text-white" : "text-neutral-300"
              }`}
            >
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-neutral-600 min-w-[60px]">
                {t.role === "user" ? "You" : "Agent"}
              </span>
              <span className="flex-1">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── helpers ──────────────────────────────────────────────── */

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
