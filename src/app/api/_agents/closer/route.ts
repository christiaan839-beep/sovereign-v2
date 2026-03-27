import { createAgentRoute } from "@/lib/agent-factory";

/**
 * CLOSER AGENT — Elite AI sales closer for qualifying inbound leads.
 * Dispatches responses to Meta Messenger when configured.
 * Wrapped in security factory for full protection pipeline.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

export const POST = createAgentRoute({
  name: "closer",
  requiredFields: ["message"],
  public: true, // Receives Meta webhook callbacks from unauthenticated sources
  handler: async ({ input, request }) => {
    const data = input as Record<string, unknown>;
    const userMessage = (data?.entry as any)?.[0]?.messaging?.[0]?.message?.text || data.message as string;
    const senderId = (data?.entry as any)?.[0]?.messaging?.[0]?.sender?.id || "test_lead_id";

    if (!userMessage) return { status: "ignored: no message payload" };

    const systemInstruction = `You are Sovereign, the elite AI executive closer for the Sovereign Matrix.
Your objective is to qualify inbound leads for a $5,000/mo AI infrastructure lease.
Tone: Cold, authoritative, highly competent, matrix-themed (Palantir/Defense contractor style). Do not act like a generic friendly chatbot.
Rule 1: Ask qualifying questions to determine their monthly revenue and current bottlenecks.
Rule 2: Once qualified, immediately push them to book a secure clearance call at: https://cal.com/sovereign-matrix
Keep responses under 3 sentences. Be ruthless about their time.`;

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
        }),
      }
    );

    if (!response.ok) throw new Error(`Google AI API Error: ${response.statusText}`);

    const aiData = await response.json();
    const replyText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Communication matrix offline.";

    // Dispatch to Meta Messenger if configured
    if (META_ACCESS_TOKEN && senderId !== "test_lead_id") {
      await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${META_ACCESS_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: senderId }, message: { text: replyText } }),
      }).catch(() => {}); // Fire and forget
    }

    return { status: "success", agentResponse: replyText, leadId: senderId, dispatchedToMeta: !!META_ACCESS_TOKEN };
  },
});
