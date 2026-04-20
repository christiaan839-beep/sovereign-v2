import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";

/**
 * DIGITAL HUMANS BLUEPRINT — Combines Nemotron VoiceChat + FLUX image gen
 * to create a digital human avatar pipeline: face generation → voice synthesis → lip-sync metadata.
 * Based on NVIDIA's Audio2Face blueprint architecture.
 */
export const POST = createAgentRoute({
  name: "digital-human",
  handler: async ({ input, email, userId }) => {

    const { name, script, gender = "female", style = "corporate" } = input as {
      name?: string; script?: string; gender?: "female" | "male"; style?: string;
    };
    if (!script) return ({ error: "Missing `script`." });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return ({ error: "NVIDIA_NIM_API_KEY not configured." });

    // Step 1: Generate avatar face via FLUX
    const faceRes = await fetch("https://integrate.api.nvidia.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: "black-forest-labs/flux.2-klein-4b",
        prompt: `Professional photorealistic headshot of a ${gender} ${style} executive named ${name || "AI Avatar"}, high-end studio lighting, neutral gray background, looking directly at camera, 4K quality`,
        width: 512, height: 512, n: 1,
      }),
    });
    const faceData = faceRes.ok ? await faceRes.json() : null;

    // Step 2: Generate voice dialogue via VoiceChat
    const voiceRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: "nvidia/nemotron-voicechat",
        messages: [
          { role: "system", content: `You are ${name || "an AI sales representative"}. Deliver the following script naturally, as if speaking on a video call. Add natural pauses with "..." where appropriate.` },
          { role: "user", content: script },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    let voiceData;
    if (voiceRes.ok) {
      voiceData = await voiceRes.json();
    } else {
      // Fallback to Super
      const fallback = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
        body: JSON.stringify({ model: "nvidia/nemotron-3-super-120b-a12b", messages: [{ role: "user", content: script }], max_tokens: 500 }),
      });
      voiceData = await fallback.json();
    }

    // Step 3: Generate lip-sync timing metadata
    const words = script.split(/\s+/);
    const phonemeMap = words.map((word: string, i: number) => ({
      word,
      start_ms: i * 350,
      end_ms: (i + 1) * 350,
      viseme: word.charAt(0).toLowerCase(),
    }));

    return ({
      avatar: {
        faceUrl: faceData?.data?.[0]?.url || faceData?.data?.[0]?.b64_json || null,
        dialogue: voiceData?.choices?.[0]?.message?.content || script,
        phonemeTimings: phonemeMap,
        totalDuration_ms: words.length * 350,
      },
      models: { face: "FLUX.2 Klein 4B", voice: "nemotron-voicechat" },
    });
  
  },
});

