import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { parseDocument } from "@/lib/nvidia";

/**
 * DOCUMENT INTELLIGENCE — Nemotron OCR + Cosmos structural analysis.
 * Extracts text, tables, and structure from document images.
 */

const schema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  extractTables: z.boolean().optional().default(true),
  prompt: z.string().optional(),
}).refine(
  (d) => d.imageUrl || d.imageBase64,
  { message: "Provide imageUrl or imageBase64" }
);

export const POST = createAgentRoute({
  name: "doc-intel",
  schema,
  skipQualityCheck: true, // OCR output quality is domain-specific
  handler: async ({ input }) => {
    const { imageUrl, imageBase64, extractTables } = input as z.infer<typeof schema>;

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) throw new Error("NVIDIA_NIM_API_KEY not configured");

    const resolvedImageUrl = imageUrl || `data:image/png;base64,${imageBase64}`;
    const imgContent = imageUrl
      ? { type: "image_url", image_url: { url: imageUrl } }
      : { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } };

    // Parallel: OCR + structural analysis + optional document parsing
    let parsedDocument = "";
    const parsePromise = parseDocument(
      resolvedImageUrl,
      extractTables ? "all" : "text"
    ).then(r => { parsedDocument = r; }).catch(() => {});

    const [ocrRes, structRes] = await Promise.all([
      fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey}` },
        body: JSON.stringify({
          model: "nvidia/nemotron-ocr-v1",
          messages: [{ role: "user", content: [
            { type: "text", text: "Extract ALL text from this document image. Preserve layout, headings, bullet points, and table structures." },
            imgContent,
          ]}],
          max_tokens: 3000,
          temperature: 0.1,
        }),
      }),
      fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey}` },
        body: JSON.stringify({
          model: "nvidia/cosmos-reason2-8b",
          messages: [{ role: "user", content: [
            { type: "text", text: "Identify: document type, key data fields, table column headers, layout structure. Return as JSON." },
            imgContent,
          ]}],
          max_tokens: 1000,
          temperature: 0.2,
        }),
      }),
    ]);

    const ocrData = ocrRes.ok ? await ocrRes.json() : null;
    const structData = structRes.ok ? await structRes.json() : null;
    const extractedText = ocrData?.choices?.[0]?.message?.content || "";

    await parsePromise;

    return {
      text: extractedText,
      parsedDocument: parsedDocument || undefined,
      structure: structData?.choices?.[0]?.message?.content || "Structure analysis unavailable",
      wordCount: extractedText.split(/\s+/).length,
      models: {
        ocr: "nemotron-ocr-v1",
        structure: "cosmos-reason2-8b",
        ...(parsedDocument ? { documentParse: "nemotron-parse-1.1-1b" } : {}),
      },
    };
  },
});
