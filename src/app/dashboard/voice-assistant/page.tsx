"use client";

import Link from "next/link";
import { VoiceAgent } from "@/components/voice/VoiceAgent";

/**
 * /dashboard/voice-assistant — full-page voice UI.
 *
 * Simple, focused page: header with back link + a single VoiceAgent
 * embedded mid-page. All the protocol complexity lives inside the
 * component; this page is purely a home for it.
 *
 * This replaces the previous Web Speech API page (332 lines) with the
 * new WS-backed streaming version.
 */

export default function VoiceAssistantPage() {
  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#030303] text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-3">
          Voice · Beta
        </p>
        <h1 className="font-serif text-3xl md:text-5xl leading-[1.04] tracking-[-0.02em] mb-3">
          Talk to <em className="not-italic text-[#B5532C]">your Sovereign agent.</em>
        </h1>
        <p className="text-[14px] text-neutral-400 leading-relaxed max-w-xl mb-8">
          Pick a persona, start a session, and have a real-time conversation.
          Interrupt any time — the agent stops mid-sentence. Sessions are
          billed per-minute at 15¢.
        </p>

        <VoiceAgent />

        <div className="mt-12 pt-6 border-t border-white/[0.05]">
          <p className="text-[11px] font-mono text-neutral-600 leading-relaxed">
            Requires <code className="text-neutral-400">NEXT_PUBLIC_VOICE_WS_URL</code> to
            point at a Railway/Fly-hosted endpoint running{" "}
            <code className="text-neutral-400">server/voice-ws.ts</code>. Local dev:{" "}
            <code className="text-neutral-400">VOICE_WS_PORT=9090 npx tsx server/voice-ws.ts</code>{" "}
            + set <code className="text-neutral-400">NEXT_PUBLIC_VOICE_WS_URL=ws://localhost:9090</code>.
          </p>
          <p className="mt-3 text-[11px] font-mono text-neutral-600">
            <Link
              href="/dashboard/billing"
              className="text-neutral-400 hover:text-[#B5532C] transition-colors"
            >
              Manage credits →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
