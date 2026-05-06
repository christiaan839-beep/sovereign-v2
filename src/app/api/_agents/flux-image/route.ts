import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";

/**
 * AI IMAGE GENERATION — Uses FLUX.2 Klein 4B from Black Forest Labs via NIM.
 * Generates high-quality images for blog headers, social media, and client deliverables.
 */
export const POST = createAgentRoute({
  name: "flux-image",
  handler: async ({ input }) => {

    const { prompt, width = 1024, height = 1024 } = input as Record<string, any>;
    if (!prompt) return ({ error: "Missing `prompt`." });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return ({ error: "NVIDIA_NIM_API_KEY not configured." });

    const res = await fetch("https://integrate.api.nvidia.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "black-forest-labs/flux.2-klein-4b",
        prompt,
        width,
        height,
        n: 1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return ({ error: `Image gen failed: ${res.status}`, details: errText });
    }

    const data = await res.json();
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json || null;

    return ({
      imageUrl,
      model: "FLUX.2 Klein 4B",
      prompt,
    });
  
  },
});

