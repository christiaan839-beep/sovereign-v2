import { createAgentRoute } from "@/lib/agent-factory";
import crypto from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("closer-agent");

/**
 * CLOSER — qualifies inbound leads for the Sovereign Matrix infra lease.
 * Accepts plain JSON via the agent factory ({ message, senderId? }) and
 * optionally dispatches replies through the Meta Graph API for IG DMs.
 *
 * SECURITY:
 *  - Meta webhook signatures are verified upstream by the dedicated
 *    /api/webhooks/meta endpoint (where `request` and signature headers are
 *    available). This endpoint is meant for authenticated Sovereign tenants
 *    only — the agent factory enforces Clerk auth before dispatch.
 *  - META_ACCESS_TOKEN is sent via Authorization header (not query string)
 *    so it doesn't leak into upstream proxy/access logs.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_ALLOWED_SENDERS = (process.env.META_ALLOWED_SENDERS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedSender(senderId: string): boolean {
  // Either the operator has whitelisted sender IDs, or we never dispatch
  // outbound messages (test mode). Prevents an attacker from passing an
  // arbitrary IG sender ID to spam DMs from the business account.
  if (!META_ALLOWED_SENDERS.length) return false;
  return META_ALLOWED_SENDERS.includes(senderId);
}

const SYSTEM_INSTRUCTION = `You are Sovereign, the elite AI executive closer for the Sovereign Matrix.
Your objective is to qualify inbound leads for a $5,000/mo AI infrastructure lease.
Tone: Cold, authoritative, highly competent, matrix-themed (Palantir/Defense contractor style). Do not act like a generic friendly chatbot.
Rule 1: Ask qualifying questions to determine their monthly revenue and current bottlenecks.
Rule 2: Once qualified, immediately push them to book a secure clearance call at: https://cal.com/sovereign-matrix
Keep responses under 3 sentences. Be strategic about their time.`;

export const POST = createAgentRoute({
  name: "closer",
  handler: async ({ input }) => {
    const userMessage =
      typeof input.message === "string"
        ? input.message
        : (
            (input as Record<string, unknown>)?.entry as Array<{
              messaging?: Array<{ message?: { text?: string } }>;
            }>
          )?.[0]?.messaging?.[0]?.message?.text;

    const senderIdRaw =
      typeof input.senderId === "string"
        ? input.senderId
        : (
            (input as Record<string, unknown>)?.entry as Array<{
              messaging?: Array<{ sender?: { id?: string } }>;
            }>
          )?.[0]?.messaging?.[0]?.sender?.id;

    const senderId = typeof senderIdRaw === "string" ? senderIdRaw : "";

    if (!userMessage) {
      return { status: "ignored: no message payload" };
    }

    if (!GEMINI_API_KEY) {
      log.error("GEMINI_API_KEY missing — closer offline");
      return { error: "AI Engine Offline" };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Header auth keeps the key out of upstream proxy/access logs
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Google AI API Error: ${response.statusText}`);
    }

    const aiData = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const replyText =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Communication matrix offline. Please hold.";

    // Outbound dispatch — only for whitelisted IG sender IDs
    let dispatched = false;
    if (META_ACCESS_TOKEN && senderId && isAllowedSender(senderId)) {
      try {
        await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${META_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: replyText },
          }),
        });
        dispatched = true;
      } catch (err) {
        log.error("Meta dispatch failed", { error: String(err) });
      }
    }

    return {
      status: "success",
      agentResponse: replyText,
      leadId: senderId || null,
      dispatchedToMeta: dispatched,
    };
  },
});

/**
 * Verify Meta webhook signature (HMAC-SHA256 of the raw body using META_APP_SECRET).
 * Exported for the dedicated webhook route — kept here so the verification logic
 * stays close to the closer agent that consumes the payload.
 */
export function verifyMetaSignature(
  rawBody: string,
  headerSig: string | null,
): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !headerSig) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(headerSig, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
