/**
 * SOVEREIGN MATRIX — Relationship Extraction Service
 *
 * Extracts knowledge graph triples (subject, predicate, object) from:
 * - Agent execution traces
 * - Conversation history
 * - Document analysis results
 *
 * Uses LLM with few-shot prompting to identify:
 * - Causal links (X caused Y)
 * - Temporal links (X preceded Y)
 * - Hierarchical links (X depends on Y)
 * - Similarity links (X is similar to Y)
 */

import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("relationship-extractor");

// ── Types ──

export interface Triple {
  subject: { label: string; type: string };
  predicate: string; // EXECUTED, DEPENDS_ON, CITED, LEADS_TO, SIMILAR_TO, CAUSED, PRECEDED
  object: { label: string; type: string };
  confidence: number; // 0-100
}

export interface ExtractionResult {
  triples: Triple[];
  summary: string;
}

// ── Few-Shot Prompt ──

const EXTRACTION_PROMPT = `You extract knowledge graph relationships from text. Given input text, identify entities and their relationships.

Entity types: agent, task, document, user, tool, outcome, concept
Relationship types: EXECUTED, DEPENDS_ON, CITED, LEADS_TO, SIMILAR_TO, CAUSED, PRECEDED

Examples:
Input: "The leads agent found 23 SaaS companies in Austin. The email-sequence agent then drafted outreach emails using the lead data."
Output: {"triples": [
  {"subject": {"label": "leads", "type": "agent"}, "predicate": "EXECUTED", "object": {"label": "find SaaS companies in Austin", "type": "task"}, "confidence": 95},
  {"subject": {"label": "leads", "type": "agent"}, "predicate": "LEADS_TO", "object": {"label": "email-sequence", "type": "agent"}, "confidence": 90},
  {"subject": {"label": "email-sequence", "type": "agent"}, "predicate": "DEPENDS_ON", "object": {"label": "lead data", "type": "document"}, "confidence": 85}
], "summary": "Lead generation pipeline: leads agent → email-sequence agent"}

Input: "SEO audit of competitor.com scored 67/100. Keyword gaps in 'AI automation' and 'lead generation'. Recommended 5 blog topics."
Output: {"triples": [
  {"subject": {"label": "seo-dominator", "type": "agent"}, "predicate": "EXECUTED", "object": {"label": "SEO audit of competitor.com", "type": "task"}, "confidence": 95},
  {"subject": {"label": "competitor.com", "type": "document"}, "predicate": "LEADS_TO", "object": {"label": "keyword gaps", "type": "outcome"}, "confidence": 80},
  {"subject": {"label": "keyword gaps", "type": "outcome"}, "predicate": "LEADS_TO", "object": {"label": "5 blog topics", "type": "outcome"}, "confidence": 85}
], "summary": "SEO audit revealed keyword gaps leading to content recommendations"}

Return ONLY valid JSON. Extract 2-8 triples per input.`;

// ── Main Function ──

/**
 * Extract relationship triples from text content.
 */
export async function extractRelationships(text: string): Promise<ExtractionResult> {
  if (!text || text.length < 20) {
    return { triples: [], summary: "" };
  }

  try {
    const raw = await ai(
      `Extract knowledge graph relationships from this text:\n\n${text.slice(0, 3000)}`,
      { system: EXTRACTION_PROMPT, maxTokens: 1000 }
    );

    const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    const triples: Triple[] = (parsed.triples || []).filter(
      (t: Triple) => t.subject?.label && t.predicate && t.object?.label
    );

    return {
      triples,
      summary: parsed.summary || "",
    };
  } catch (err) {
    log.warn("Relationship extraction failed", { error: String(err) });
    return { triples: [], summary: "" };
  }
}

/**
 * Extract relationships from an agent execution result.
 * Convenience wrapper with agent-specific context.
 */
export async function extractFromAgentExecution(
  agentName: string,
  input: string,
  output: string,
  durationMs: number
): Promise<ExtractionResult> {
  const text = `Agent "${agentName}" was given this task: "${input.slice(0, 500)}"\n\nIt produced this result (in ${durationMs}ms):\n${output.slice(0, 1500)}`;
  return extractRelationships(text);
}
