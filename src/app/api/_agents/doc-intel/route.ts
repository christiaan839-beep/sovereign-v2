import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { parseDocument } from "@/lib/nvidia";

/**
 * DOCUMENT INTELLIGENCE — Combines Nemotron OCR + Table Structure + Page Elements.
 * Extracts text, tables, and visual structure from any document image.
 * Based on NVIDIA's Document Intelligence Blueprint.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { imageUrl, imageBase64, extractTables = true } = await req.json();
    if (!imageUrl && !imageBase64) return NextResponse.json({ error: "Provide `imageUrl` or `imageBase64`." }, { status: 400 });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not configured." }, { status: 500 });

    const resolvedImageUrl = imageUrl || `data:image/png;base64,${imageBase64}`;
    const imgContent = imageUrl
      ? { type: "image_url", image_url: { url: imageUrl } }
      : { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } };

    // Step 0: Nemotron Parse — structured document extraction (tables + text + layout)
    // Runs in parallel with OCR and structure analysis below.
    let parsedDocument = "";
    const parsePromise = parseDocument(
      resolvedImageUrl,
      extractTables ? "all" : "text"
    ).then(result => { parsedDocument = result; })
     .catch(() => { /* parseDocument is optional — failure doesn't block the pipeline */ });

    // Step 1: Full OCR text extraction
    const ocrRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: "nvidia/nemotron-ocr-v1",
        messages: [{ role: "user", content: [
          { type: "text", text: "Extract ALL text from this document image. Preserve layout, headings, bullet points, and table structures. Format tables as markdown." },
          imgContent,
        ]}],
        max_tokens: 3000,
        temperature: 0.1,
      }),
    });
    const ocrData = ocrRes.ok ? await ocrRes.json() : null;
    const extractedText = ocrData?.choices?.[0]?.message?.content || "";

    // Step 2: Structural analysis (page elements)
    const structRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: "nvidia/cosmos-reason2-8b",
        messages: [{ role: "user", content: [
          { type: "text", text: "Analyze this document image. Identify: 1) Document type (invoice, report, pricing table, etc), 2) Key data fields, 3) Any tables with their column headers, 4) Overall layout structure. Return as structured JSON." },
          imgContent,
        ]}],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });
    const structData = structRes.ok ? await structRes.json() : null;

    // Wait for the parallel parseDocument call to complete
    await parsePromise;

    return NextResponse.json({
      text: extractedText,
      parsedDocument: parsedDocument || undefined,
      structure: structData?.choices?.[0]?.message?.content || "Structure analysis unavailable",
      wordCount: extractedText.split(/\s+/).length,
      models: {
        ocr: "nemotron-ocr-v1",
        structure: "cosmos-reason2-8b",
        ...(parsedDocument ? { documentParse: "nemotron-parse-1.1-1b" } : {}),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
