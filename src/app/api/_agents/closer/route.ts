import { createAgentRoute } from "@/lib/agent-factory";
import { createLogger } from "@/lib/logger";
const log = createLogger("closer-agent");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; // For Instagram Graph API dispatch

export const POST = createAgentRoute({
  name: "closer",
  handler: async ({ input }) => {
    // createAgentRoute parses + sanitizes the body into `input` for us.
    const data = input as Record<string, unknown> & {
      entry?: Array<{
        messaging?: Array<{
          message?: { text?: string };
          sender?: { id?: string };
        }>;
      }>;
      message?: string;
    };

    // Ingest Meta Graph API / IG Webhook format (or raw JSON for testing)
    const userMessage =
      data?.entry?.[0]?.messaging?.[0]?.message?.text || data.message;
    const senderId =
      data?.entry?.[0]?.messaging?.[0]?.sender?.id || "test_lead_id";

    if (!userMessage) return { status: "ignored: no message payload" };

    // System Prompt for closing $5k/mo deal using Google AI Ultra (Gemini 1.5 Flash / Pro)
    const systemInstruction = `You are Sovereign, the elite AI executive closer for the Sovereign Matrix.
Your objective is to qualify inbound leads for a $5,000/mo AI infrastructure lease.
Tone: Cold, authoritative, highly competent, matrix-themed (Palantir/Defense contractor style). Do not act like a generic friendly chatbot.
Rule 1: Ask qualifying questions to determine their monthly revenue and current bottlenecks.
Rule 2: Once qualified, immediately push them to book a secure clearance call at: https://cal.com/sovereign-matrix
Keep responses under 3 sentences. Be strategic about their time.`;

    if (!GEMINI_API_KEY) {
      log.error(
        "CRITICAL: GEMINI_API_KEY is missing from environment variables",
      );
      return { error: "AI Engine Offline" };
    }

    // Google Gemini 1.5 Flash REST API (Bypassing NPM lockouts)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.3, // Elite/Cold precision setting
            maxOutputTokens: 300,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Google AI API Error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const replyText =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Communication matrix offline. Please hold.";

    // Production Meta Hook Dispatch
    if (META_ACCESS_TOKEN && senderId !== "test_lead_id") {
      await fetch(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${META_ACCESS_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: replyText },
          }),
        },
      );
    }

    return {
      status: "success",
      agentResponse: replyText,
      leadId: senderId,
      dispatchedToMeta: !!META_ACCESS_TOKEN,
    };
  },
});
