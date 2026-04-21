/**
 * GET /api/marketplace/agents
 *
 * Returns all marketplace agents with category, name, and metadata.
 * No auth required (public catalog).
 *
 * Query params:
 *   category — filter by category slug (optional, "All" or omit for all)
 *   page     — page number (default 1)
 *   limit    — items per page (default 24, max 48)
 */

import { NextResponse } from "next/server";
import { AGENT_REGISTRY } from "@/app/api/agents/registry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugToName(slug: string): string {
  const acronyms: Record<string, string> = {
    seo: "SEO",
    pii: "PII",
    rag: "RAG",
    asr: "ASR",
    ocr: "OCR",
    abm: "ABM",
    crm: "CRM",
    ai:  "AI",
    api: "API",
    r1:  "R1",
  };
  return slug
    .split("-")
    .map((w) => acronyms[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function inferCategory(slug: string): string {
  const s = slug.toLowerCase();
  if (/voice|audio|speak|asr|music|tts|voicechat/.test(s))                                          return "Voice";
  if (/vision|image|ocr|flux|florence|visual|imagen|video|cosmos/.test(s))                          return "Vision";
  if (/seo|content|blog|organic|brand|social|creative|filmmaker|page-builder/.test(s))              return "Content";
  if (/lead|outbound|abm|sales|closer|funnel|ads|email-sequence|email-onboard|ghost-fleet/.test(s)) return "Sales";
  if (/threat|compliance|pii|guard|audit|nemoclaw|content-safety|claw-queue/.test(s))               return "Safety";
  if (/code|sandbox|deploy|webhook|pipeline|auto-heal|error-log/.test(s))                           return "Code";
  if (/god-brain|war-room|orchestrat|coordinator|chain|swarm|smart-router|agentic|super-agent|nexus|flywheel/.test(s)) return "Orchestration";
  if (/healthcare|legal|agri|supply-chain|prior-auth|contract|billing|verticals|whitelabel|digital-human|booking/.test(s)) return "Industry";
  if (/research|search|deep|benchmark|analytics|report|competitive|firecrawl|grounded|doc|memory/.test(s))            return "Research";
  return "Intelligence";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const category = searchParams.get("category") ?? "All";
  const page     = Math.max(1, Number(searchParams.get("page")  ?? "1"));
  const limit    = Math.min(48, Math.max(1, Number(searchParams.get("limit") ?? "24")));

  // Build the full catalog from the static registry
  const allAgents = Object.keys(AGENT_REGISTRY).map((slug) => ({
    slug,
    name:        slugToName(slug),
    category:    inferCategory(slug),
    hireCount:   0,   // future: populate from DB hire_counts table
    pricePerRun: 0,   // free for now
  }));

  // Category filter
  const filtered =
    category && category !== "All"
      ? allAgents.filter((a) => a.category === category)
      : allAgents;

  const total = filtered.length;
  const start = (page - 1) * limit;
  const agents = filtered.slice(start, start + limit);

  return NextResponse.json(
    {
      agents,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
