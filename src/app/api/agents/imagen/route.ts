import { createAgentRoute } from "@/lib/agent-factory";

/**
 * GOOGLE IMAGEN 3 — Premium image generation.
 *
 * Uses Google's Imagen 3 model for photorealistic, high-quality
 * image generation. Alternative to FLUX for when users need
 * Google-quality output.
 *
 * Available with Google AI Ultra plan.
 *
 * Input: { prompt, aspectRatio?, numberOfImages? }
 * Output: { images: [{ base64, mimeType }] }
 */

export const POST = createAgentRoute({
  name: "imagen",
  requiredFields: ["prompt"],
  handler: async ({ input }) => {
    const prompt = input.prompt as string;
    const aspectRatio = (input.aspectRatio as string) || "1:1";
    const numberOfImages = Math.min((input.numberOfImages as number) || 1, 4);

    const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return { error: "Google AI API key not configured." };
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: numberOfImages,
              aspectRatio,
              safetyFilterLevel: "block_few",
              personGeneration: "allow_adult",
            },
          }),
        }
      );

      if (!res.ok) {
        // Fallback to Gemini 2.5 Pro with image generation
        const fallbackRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: `Generate an image: ${prompt}` }] }],
              generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
              },
            }),
          }
        );

        if (!fallbackRes.ok) {
          return { error: "Image generation failed", details: await fallbackRes.text() };
        }

        const fallbackData = await fallbackRes.json();
        const parts = fallbackData.candidates?.[0]?.content?.parts || [];
        const images = parts
          .filter((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData)
          .map((p: { inlineData: { mimeType: string; data: string } }) => ({
            base64: p.inlineData.data,
            mimeType: p.inlineData.mimeType,
          }));

        return {
          images,
          count: images.length,
          model: "gemini-2.5-pro (image generation fallback)",
          prompt,
        };
      }

      const data = await res.json();
      const images = (data.predictions || []).map((pred: { bytesBase64Encoded: string; mimeType: string }) => ({
        base64: pred.bytesBase64Encoded,
        mimeType: pred.mimeType || "image/png",
      }));

      return {
        images,
        count: images.length,
        model: "imagen-3.0-generate-002",
        aspectRatio,
        prompt,
      };
    } catch (error) {
      return { error: "Imagen error", details: String(error) };
    }
  },
});
