/**
 * server/voice-ws.ts — standalone Node.js runner for the voice WebSocket.
 *
 * Deploys to Railway/Fly/any Node host. Vercel serverless can't sustain
 * long-lived WS connections, so this lives outside the Next.js runtime.
 *
 * Run:
 *   VOICE_WS_PORT=9090 ts-node server/voice-ws.ts
 *
 * Env vars required:
 *   VOICE_SESSION_SECRET   matches the Next.js app's secret
 *   NVIDIA_NIM_API_KEY     for LLM + TTS streaming
 *   DATABASE_URL           for credit hold settlement
 *
 * The client is expected to open the WS to:
 *   wss://voice.sovereignmatrix.agency/ws
 * where the hostname is whatever Railway assigns you. The main site
 * passes this URL to the client via NEXT_PUBLIC_VOICE_WS_URL.
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { handleVoiceWs, type WsLike } from "../src/lib/voice-ws-server";

const PORT = Number(process.env.VOICE_WS_PORT ?? 9090);
const SECRET = process.env.VOICE_SESSION_SECRET ?? "";

if (!SECRET || SECRET.length < 16) {
  console.error("[voice-ws] VOICE_SESSION_SECRET must be set and >= 16 chars");
  process.exit(1);
}

const httpServer = createServer((_req, res) => {
  // Simple health endpoint — Railway/Fly health checks hit this.
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok");
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  // ws.WebSocket already has .send / .close / .on, matching WsLike.
  handleVoiceWs(ws as unknown as WsLike, { secret: SECRET }).catch((err) => {
    console.error("[voice-ws] handler error", err);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[voice-ws] listening on :${PORT}`);
});

// Graceful shutdown — close all sockets so Railway sees a clean exit.
function shutdown(sig: string): void {
  console.log(`[voice-ws] ${sig} — shutting down`);
  wss.clients.forEach((ws) => ws.close(1001, "server going away"));
  httpServer.close(() => process.exit(0));
  // Hard-exit if clean shutdown stalls.
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
