/**
 * DOC EXTRACTOR — entry-level agent #3.
 *
 * Replaces the data-entry clerk who reads invoices, contracts, and
 * forms and types the structured fields into a system. Caller
 * provides the extracted text and a target schema; agent returns
 * the populated fields plus per-field confidence.
 *
 * Stack: STRICT confidence tier — this is structured data going into
 * downstream systems where wrong fields are expensive to discover
 * and harder to undo. Generic-audit-ready rubric.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { runSuperAgent, toResponseEnvelope } from "@/lib/super-agent";

const schema = z.object({
  text: z.string().min(1).max(50_000),
  /**
   * Field spec: { invoiceNumber: "string", totalAmount: "number",
   * dueDate: "ISO date" }. Caller supplies it inline; agent
   * extracts each named field from the source text.
   */
  fields: z
    .record(z.string(), z.string())
    .refine(
      (v) => Object.keys(v).length > 0 && Object.keys(v).length <= 30,
      { message: "fields must contain 1–30 entries" },
    ),
  /** Optional: short description of the document type for context. */
  docType: z.string().max(200).optional(),
});

const SYSTEM_PROMPT = `You are a document field extractor. Given source text and a field spec, return ONLY the requested fields as a single JSON object on one line.

Output schema:
{"fields":{<fieldName>:{"value":<extracted value or null>,"confidence":<0..1>,"sourceQuote":<short verbatim excerpt or null>}},"missingFields":[<field names that could not be located>]}

Rules:
- Extract each requested field by name. The "value" type should match the field-spec hint (string, number, ISO date).
- "confidence" reflects how certain you are the extracted value is correct. Below 0.5 → null value, list in missingFields.
- "sourceQuote" must be a verbatim 5-15 word excerpt from the text that justifies the extraction.
- NEVER guess a value. If it's not in the text, set value:null + missingFields, do not invent.
- Respond with the JSON only.`;

export const POST = createAgentRoute({
  name: "doc-extractor",
  schema,
  handler: async ({ input }) => {
    const { text, fields, docType } = input as z.infer<typeof schema>;

    const fieldSpec = Object.entries(fields)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join("\n");

    const userPrompt = [
      docType ? `Document type: ${docType}` : null,
      "",
      "Fields to extract:",
      fieldSpec,
      "",
      "Source text:",
      text,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runSuperAgent(userPrompt, {
      agentSlug: "doc-extractor",
      systemPrompt: SYSTEM_PROMPT,
      confidenceTier: "strict",
      rubricId: "generic-audit-ready",
      maxTokens: 2500,
    });

    return toResponseEnvelope(result);
  },
});
