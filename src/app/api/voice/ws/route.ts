/**
 * /api/voice/ws — informational route.
 *
 * WebSocket endpoints can't be served from Vercel's serverless runtime
 * (5-minute function cap + no long-lived connections). The real WS
 * lives in server/voice-ws.ts and is expected to be deployed to
 * Railway/Fly under `NEXT_PUBLIC_VOICE_WS_URL`.
 *
 * This handler returns a 501 with a pointer to the configured URL so a
 * client that somehow ends up here gets a helpful error instead of a
 * timeout, AND returns 200 in dev/local when VOICE_WS_URL is not set
 * (so `npm run dev` just tells the developer how to run the WS server).
 */

import { NextResponse } from "next/server";

export function GET(): NextResponse {
  const wsUrl = process.env.NEXT_PUBLIC_VOICE_WS_URL;

  if (!wsUrl) {
    return NextResponse.json(
      {
        error: "Voice WebSocket not configured",
        hint:
          "Set NEXT_PUBLIC_VOICE_WS_URL to the Railway/Fly-hosted " +
          "ws:// or wss:// endpoint, then point the VoiceAgent component at it. " +
          "For local dev: `VOICE_WS_PORT=9090 npx tsx server/voice-ws.ts` " +
          "and set NEXT_PUBLIC_VOICE_WS_URL=ws://localhost:9090.",
      },
      {
        status: 501,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  // The WS isn't actually here — redirect-describe clients instead.
  return NextResponse.json(
    {
      wsUrl,
      note: "The voice WebSocket is hosted externally (Railway/Fly). Open this URL directly.",
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
