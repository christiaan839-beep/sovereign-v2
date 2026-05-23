import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";

/**
 * GOOGLE IMAGEN 4 — Premium image generation with FLUX.1 fallback.
 *
 * Primary: Google Imagen 4 (imagen-4.0-generate-001) via Generative Language API.
 * Fallback: Black Forest Labs FLUX.1 Schnell via NVIDIA NIM.
 *
 * Imagen 4 requires GEMINI_API_KEY with appropriate billing.
 * Falls back automatically to FLUX.1 if Imagen 4 is unavailable.
 *
 * Input: { prompt, aspectRatio?, numberOfImages? }
 * Output: { images: [{ base64, mimeType }] }
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "imagen",
  requiredFields: ["prompt"],
  // Wave 127 M3 batch 17: per-aspect-ratio prompt history. Past
  // generations surface which prompts produced the desired
  // composition for portrait vs landscape vs square outputs.
  memory: {
    search: {
      query: (input) =>
        `imagen ${input.aspectRatio ?? "1:1"} ${String(input.prompt ?? "").slice(0, 120)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          prompt?: string;
          aspectRatio?: string;
          images?: Array<unknown>;
        };
        if (!r.prompt) return null;
        return `[${r.aspectRatio ?? "1:1"}] ${(r.prompt ?? "").slice(0, 220).replace(/\s+/g, " ")} (${r.images?.length ?? 0} img)`;
      },
      metadata: (input) => ({
        aspectRatio:
          typeof input.aspectRatio === "string" ? input.aspectRatio : "1:1",
        kind: "imagen",
      }),
    },
  },
  handler: async ({ input }) => {
    const prompt = input.prompt as string;
    const aspectRatio = (input.aspectRatio as string) || "1:1";
    const numberOfImages = Math.min((input.numberOfImages as number) || 1, 4);

    const geminiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

    // --- Strategy 1: Google Imagen 4 ---
    if (geminiKey) {
      try {
        const res = await outboundFetchAsResponse(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instances: [{ prompt }],
              parameters: {
                sampleCount: numberOfImages,
                aspectRatio,
                personGeneration: "allow_adult",
              },
            }),
          },
          {
            ruleId: "agents.imagen.route.1",
            allowedHosts: ["generativelanguage.googleapis.com"],
          },
        );

        if (res.ok) {
          const data = await res.json();
          const images = (data.predictions || []).map(
            (pred: { bytesBase64Encoded: string; mimeType?: string }) => ({
              base64: pred.bytesBase64Encoded,
              mimeType: pred.mimeType || "image/png",
            }),
          );

          if (images.length > 0) {
            return {
              images,
              count: images.length,
              model: "imagen-4.0-generate-001",
              aspectRatio,
              prompt,
            };
          }
        }

        // Imagen 4 returned an error — log it and fall through to fallback
        const _errorText = await res.text().catch(() => "unknown error");
        // Imagen 4 failed — falling back to FLUX.1
      } catch {
        // Imagen 4 unavailable — FLUX.1 fallback below
      }
    }

    // --- Strategy 2: FLUX.1 Schnell via NVIDIA NIM ---
    try {
      const nimKey = await getNimKey();
      if (!nimKey) {
        return {
          error:
            "No image generation backend available. Set GEMINI_API_KEY for Imagen 4 or NVIDIA_NIM_API_KEY for FLUX.1.",
        };
      }

      // Map aspect ratios to pixel dimensions for FLUX
      const dimensionMap: Record<string, { width: number; height: number }> = {
        "1:1": { width: 1024, height: 1024 },
        "16:9": { width: 1024, height: 576 },
        "9:16": { width: 576, height: 1024 },
        "4:3": { width: 1024, height: 768 },
        "3:4": { width: 768, height: 1024 },
      };
      const dims = dimensionMap[aspectRatio] || { width: 1024, height: 1024 };

      const nimRes = await outboundFetchAsResponse(
        "https://integrate.api.nvidia.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model: "black-forest-labs/flux1-schnell",
            prompt: `${prompt}, ultra high quality, professional photography, 8k resolution, sharp focus`,
            negative_prompt: "blurry, low quality, pixelated, watermark, text",
            width: dims.width,
            height: dims.height,
            steps: 28,
            n: numberOfImages,
          }),
        },
        {
          ruleId: "agents.imagen.route.2",
          allowedHosts: ["integrate.api.nvidia.com"],
        },
      );

      if (!nimRes.ok) {
        const errorText = await nimRes.text();
        return {
          error: "All image generation backends failed",
          details: `Imagen 4: ${geminiKey ? "API error" : "no API key"}. FLUX.1: ${nimRes.status} ${errorText}`,
        };
      }

      const nimData = await nimRes.json();
      const fluxImages = (nimData.data || []).map(
        (img: { b64_json?: string; url?: string }) => ({
          base64: img.b64_json || null,
          url: img.url || null,
          mimeType: "image/png",
        }),
      );

      return {
        images: fluxImages,
        count: fluxImages.length,
        model: "flux1-schnell (fallback)",
        aspectRatio,
        prompt,
        note: "Imagen 4 was unavailable. Used FLUX.1 via NVIDIA NIM as fallback.",
      };
    } catch (err) {
      return {
        error: "Image generation failed",
        details: String(err),
      };
    }
  },
});
