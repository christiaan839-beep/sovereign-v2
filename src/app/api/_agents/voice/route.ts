import { createAgentRoute } from "@/lib/agent-factory";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const POST = createAgentRoute({
  name: "voice",
  requiredFields: ["target_number"],
  handler: async ({ input }) => {
    const { target_number, lead_name } = input as Record<string, any>;

    // TCPA/AI Disclosure: Agents must identify as AI at the start of every call
    const AI_DISCLOSURE = `CRITICAL LEGAL REQUIREMENT: You MUST begin every call by saying: "Hi, this is an AI assistant calling on behalf of Sovereign Matrix. This call may be recorded for quality purposes. Is now a good time to speak?"`;

    const systemInstruction = `${AI_DISCLOSURE}

You are Sovereign, a professional AI sales development agent.
Target: ${lead_name || "Enterprise Decision Maker"}.
Write a conversational script that professionally introduces the platform's capabilities and asks qualifying questions.
Keep it under 4 sentences after the disclosure. Tone: Professional, concise, consultative. No aggressive language.`;

    // Fetch the dynamic conversational hook from Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Synthesize the outbound voice strike protocol." }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.3 }
      })
    });

    const aiData = await response.json();
    const generatedScript = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Communication relay offline.";

    return {
      status: 'voice_call_authorized',
      telephony_engine: 'Pipecat/Twilio WebRTC',
      target: target_number,
      synthesized_script: generatedScript
    };
  },
});
