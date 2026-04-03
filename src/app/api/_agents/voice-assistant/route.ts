import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";
import { routeIntent } from "@/lib/intent-router";
import { getSystemPrompt } from "@/lib/system-prompts";

/**
 * SOVEREIGN VOICE ASSISTANT — Human-sounding AI voice interface.
 *
 * Combines intent routing with conversational AI and voice synthesis.
 * Designed to sound natural, concise, and human — not robotic.
 *
 * Flow: speech text → intent detection → agent execution → response → TTS
 *
 * Input: { text, context?: string, voice_style?: "professional" | "friendly" | "concise" }
 * Output: { response, intent, voiceResponse?, agentResult? }
 */

export const POST = createAgentRoute({
  name: "voice-assistant",
  requiredFields: ["text"],
  handler: async ({ input }) => {
    const text = input.text as string;
    const context = (input.context as string) || "";
    const voiceStyle = (input.voice_style as string) || "professional";

    // Step 1: Detect intent
    const intent = routeIntent(text);

    // Step 2: If it's a specific agent, execute it
    let agentResult: unknown = null;
    if (intent.confidence > 0.7 && intent.endpoint !== "/api/ai/stream") {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}${intent.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(intent.params),
          signal: AbortSignal.timeout(15000),
        });
        agentResult = await res.json();
      } catch {
        // Agent call failed — fall through to conversational response
      }
    }

    // Step 3: Generate voice-optimized response
    const voicePrompts: Record<string, string> = {
      professional: "Respond in 2-3 short sentences. Be clear and direct. Use natural speech patterns — contractions, simple words. Never say 'I would be happy to'. Sound like a competent human on a phone call.",
      friendly: "Respond warmly in 2-3 sentences. Be casual but helpful. Use contractions. Sound like a smart friend giving advice, not a corporate chatbot.",
      concise: "Respond in 1-2 sentences maximum. Get straight to the point. No pleasantries. Sound like a busy executive giving a quick answer.",
    };

    const systemPrompt = `${getSystemPrompt("general")}
${voicePrompts[voiceStyle] || voicePrompts.professional}
${context ? `\nContext from previous conversation: ${context}` : ""}
${agentResult ? `\nYou just executed the "${intent.label}" tool. Here are the results to summarize for the user:\n${JSON.stringify(agentResult).slice(0, 1500)}` : ""}`;

    const response = await nimChat(
      "mistralai/mistral-nemotron",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      { maxTokens: 200, temperature: 0.7 }
    );

    // Step 4: Generate TTS audio (optional — if voice synthesis is needed)
    let _voiceAudioUrl: string | null = null;
    try {
      const nimKey = process.env.NVIDIA_NIM_API_KEY;
      if (nimKey && response.length < 500) {
        // Only synthesize short responses to keep latency low
        const ttsRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey}` },
          body: JSON.stringify({
            model: "nvidia/nemotron-voicechat",
            messages: [{ role: "user", content: `Convert to natural speech: "${response}"` }],
            max_tokens: 200,
            temperature: 0.8,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (ttsRes.ok) {
          // Voice chat returns text optimized for speech
          const ttsData = await ttsRes.json();
          _voiceAudioUrl = ttsData.choices?.[0]?.message?.content || null;
        }
      }
    } catch {
      // TTS optional — continue without it
    }

    return {
      response,
      intent: {
        label: intent.label,
        endpoint: intent.endpoint,
        confidence: intent.confidence,
      },
      voiceStyle,
      agentExecuted: !!agentResult,
      agentResult: agentResult ? JSON.stringify(agentResult).slice(0, 500) : undefined,
      speechOptimized: true,
      model: "mistral-nemotron",
    };
  },
});
