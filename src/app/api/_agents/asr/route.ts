import { createAgentRoute } from "@/lib/agent-factory";

/**
 * ASR (Automatic Speech Recognition) — Uses NVIDIA Nemotron ASR Streaming
 * for real-time speech-to-text transcription during Twilio voice calls.
 */
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "asr",
  handler: async ({ input, email, userId }) => {

    const { audioBase64, language = "en" } = input as Record<string, unknown>;
    if (!audioBase64) return ({ error: "Missing audioBase64 payload." });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return ({ error: "NVIDIA_NIM_API_KEY not configured." });

    const res = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/asr/transcriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-asr-streaming",
        audio: audioBase64,
        language,
        response_format: "json",
      }),
    }, { ruleId: "agents.asr.route.1", allowedHosts: ["integrate.api.nvidia.com"] });

    if (!res.ok) {
      const errText = await res.text();
      return ({ error: `ASR failed: ${res.status}`, details: errText });
    }

    const data = await res.json();
    return ({
      transcript: data.text || data.transcript || "",
      confidence: data.confidence || null,
      model: "nemotron-asr-streaming",
    });
  
  },
});

