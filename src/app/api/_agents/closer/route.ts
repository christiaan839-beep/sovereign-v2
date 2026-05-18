import { createAgentRoute } from "@/lib/agent-factory";
import { createLogger } from "@/lib/logger";
const log = createLogger("closer-agent");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; // For Instagram Graph API dispatch

export const POST = createAgentRoute({
  name: "closer",
  handler: async ({ input }) => {
    const data = input as Record<string, unknown> & {
      message?: string;
      entry?: Array<{
        messaging?: Array<{
          message?: { text?: string };
          sender?: { id?: string };
        }>;
      }>;
    };

    // Ingest Meta Graph API / IG Webhook format (or raw JSON for testing)
    const userMessage =
      data?.entry?.[0]?.messaging?.[0]?.message?.text || data.message;
    const senderId =
      data?.entry?.[0]?.messaging?.[0]?.sender?.id || "test_lead_id";

    if (!userMessage) return { status: "ignored: no message payload" };

    const systemInstruction = `You are the inbound qualifier for Sovereign Matrix.
Goal: qualify leads for the $5,000/mo AI infrastructure plan.
Tone: direct, competent, low-warmth — not a generic friendly chatbot.
Rule 1: ask short qualifying questions about monthly revenue and the bottleneck they're hiring AI to fix.
Rule 2: once qualified, push them to book at https://cal.com/sovereign-matrix.
Keep replies under 3 sentences. Don't waste their time.`;

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
