import { NextResponse } from "next/server";
import { vertex as google } from "@ai-sdk/google-vertex";
import { generateText } from "ai";
import { db } from "@/db";
import { globalTelemetry } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";

/**
 * Infinite SEO Network Generator
 * 
 * Programmatically generates massive, 2,000+ word hyper-optimized 
 * SEO articles based on a single keyword constraint. Uses strict
 * HTML structuring (H2, H3, tags) for instant web publishing.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  try {
    const { tenantId, targetKeyword, industry, location } = await req.json();

    if (!targetKeyword) {
      return NextResponse.json({ error: "Missing targetKeyword" }, { status: 400 });
    }

    const { text: articleHtml } = await generateText({
      model: google("gemini-2.5-pro"),
      prompt: `You are an elite, technical SEO architect writing for a ${industry || "digital agency"}. 

Generate a completely comprehensive, 2,000-word authoritative guide optimized for the keyword: "${targetKeyword}" in "${location || 'Global'}".

CRITICAL SEO RULES:
1. Output valid HTML (only structural tags: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>). No HTML or body wrappers.
2. The H1 must contain the exact keyword and a compelling hook.
3. Use semantic LSI keywords naturally throughout the text.
4. "ANTI-SLOP" TONE: Write like a cynical, high-level expert explaining a complex system to a peer. Zero corporate jargon (no "delve", "navigate", "landscape"). Short, punchy sentences. High information density.
5. Include a section on "Common Failures" and a section on "Architectural Solutions".
6. The article must be extremely long, deep, and valuable. Do not summarize. Explain the "HOW".

Output ONLY the raw HTML string. No markdown code blocks.`,
    });

    const cleanedHtml = articleHtml.replace(/```html?\n?/g, "").replace(/```/g, "").trim();

    // Log the generated SEO asset
    await db.insert(globalTelemetry).values({
      tenantId: tenantId || "system",
      eventType: "seo_article_generated",
      payload: JSON.stringify({ keyword: targetKeyword, location, contentLength: cleanedHtml.length }),
    });

    return NextResponse.json({ 
      success: true, 
      keyword: targetKeyword,
      html: cleanedHtml 
    });
  } catch (error) {
    console.error("[SEO Generator Error]:", error);
    return NextResponse.json({ error: "SEO generation failed" }, { status: 500 });
  }
}
