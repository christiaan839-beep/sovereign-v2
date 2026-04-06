import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";

/**
 * IMAGE GENERATION — Uses NVIDIA FLUX.1 Schnell via NIM.
 * Generates social media imagery, product shots, marketing assets.
 */

const schema = z.object({
  prompt: z.string().min(3, "Prompt is required").max(2000),
  negative_prompt: z.string().max(500).optional().default(""),
  width: z.number().int().min(256).max(1024).optional().default(1024),
  height: z.number().int().min(256).max(1024).optional().default(1024),
  steps: z.number().int().min(1).max(50).optional().default(28),
});

export const POST = createAgentRoute({
  name: "image-gen",
  schema,
  skipQualityCheck: true, // Image output is binary, not text
  skipPiiScan: true, // Image URLs don't contain PII text
  handler: async ({ input }) => {
    const { prompt, negative_prompt, width, height, steps } = input as z.infer<typeof schema>;

    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getNimKey()}`,
      },
      body: JSON.stringify({
        model: "black-forest-labs/flux1-schnell",
        prompt: `${prompt}, ultra high quality, professional photography, 8k resolution, sharp focus`,
        negative_prompt: `${negative_prompt}, blurry, low quality, pixelated, watermark, text`,
        width: Math.min(width, 1024),
        height: Math.min(height, 1024),
        steps,
        n: 1,
      }),
    });

    if (!nimRes.ok) {
      const errorText = await nimRes.text();
      throw new Error(`Image generation failed: ${errorText.slice(0, 200)}`);
    }

    const data = await nimRes.json();

    return {
      success: true,
      model: "flux1-schnell",
      prompt,
      image: data.data?.[0] || null,
      dimensions: `${width}x${height}`,
      steps,
    };
  },
});
