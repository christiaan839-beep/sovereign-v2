import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";

/**
 * 1M CONTEXT DOCUMENT ANALYST — Uses Nemotron 3 Nano's 262K context
 * for ingesting entire documents and answering questions.
 * Now BYOK-aware via nimChat().
 */

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { document, question = "Summarize this document and highlight the 5 most important points.", mode = "qa" } = await request.json();

    if (!document) {
      return NextResponse.json({ error: "document is required (paste full text)." }, { status: 400 });
    }

    const modePrompts: Record<string, string> = {
      qa: `Answer the following question based ONLY on the document provided. Be specific and cite relevant sections.\n\nQuestion: ${question}`,
      extract: `Extract ALL key data points from this document: names, dates, amounts, deadlines, obligations, conditions, and contact information. Format as structured JSON.`,
      summarize: `Create a comprehensive executive summary of this document. Include: main purpose, key parties, critical terms, important dates, and recommended actions. Max 500 words.`,
      risks: `Identify ALL risks, liabilities, and potential issues in this document. Rate each risk as LOW/MEDIUM/HIGH/CRITICAL. Recommend mitigations.`,
      compare: `Analyze this document and identify: strengths, weaknesses, unusual clauses, and anything that deviates from standard practice in this type of document.`,
    };

    const charCount = document.length;
    const wordCount = document.split(/\s+/).length;

    const start = Date.now();
    const analysis = await nimChat(
      "nvidia/nemotron-3-nano-30b-a3b",
      [
        { role: "system", content: "You are a senior document analyst and legal reviewer. Analyze documents with precision, cite specific sections, and provide actionable insights." },
        { role: "user", content: `${modePrompts[mode] || modePrompts.qa}\n\n--- DOCUMENT START ---\n${document.substring(0, 200000)}\n--- DOCUMENT END ---` },
      ],
      { maxTokens: 2048, temperature: 0.2 }
    );

    return NextResponse.json({
      success: true,
      model: "Nemotron 3 Nano 30B (262K Context — Long Document Specialist)",
      mode,
      document_stats: { characters: charCount, words: wordCount, pages_estimated: Math.ceil(wordCount / 300) },
      analysis,
      duration_ms: Date.now() - start,
      license: "NVIDIA Open Model License — commercial use permitted",
    });
  } catch (_error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
