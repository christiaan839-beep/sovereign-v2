import { createAgentRoute } from "@/lib/agent-factory";

/**
 * VISUAL REASONING — Uses cosmos-reason2-8b for deep visual analysis.
 * Can analyze competitor screenshots, landing page layouts, and design patterns.
 */
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "visual-reason",
  handler: async ({ input, email, userId }) => {

    const { imageUrl, question = "Analyze this image and provide detailed insights." } = input as Record<string, unknown>;
    if (!imageUrl) return ({ error: "Missing `imageUrl`." });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return ({ error: "NVIDIA_NIM_API_KEY not configured." });

    const res = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/cosmos-reason2-8b",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: question },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    }, { ruleId: "agents.visual-reason.route.1", allowedHosts: ["integrate.api.nvidia.com"] });

    if (!res.ok) {
      const errText = await res.text();
      return ({ error: `Visual reasoning failed: ${res.status}`, details: errText });
    }

    const data = await res.json();
    return ({
      analysis: data.choices?.[0]?.message?.content || "",
      model: "cosmos-reason2-8b",
    });
  
  },
});

