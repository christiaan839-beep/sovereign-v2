/**
 * Invoice OCR — first-class vision agent.
 *
 * Takes an image URL (invoice PDF page, photo of a receipt, scanned
 * bill) and returns structured invoice JSON end-to-end. No prior
 * OCR step needed — the NIM visionOCR model reads the pixels and
 * extracts fields in one call.
 *
 * Pairs with the existing `invoice-extractor` agent which handles the
 * TEXT → structured case (already-OCR'd invoices, text pasted into a
 * form). `invoice-ocr` is IMAGE → structured.
 *
 * Output schema mirrors invoice-extractor's shape deliberately — both
 * agents emit JSON with the same top-level fields so downstream
 * categorisers / accounting integrations don't branch on the source.
 *
 * This route is also the reference implementation for the vision
 * factory. Every future doc-extraction agent (receipt-scanner,
 * contract-parser, W-2-reader, chart-reader) follows the same shape:
 * a Zod output schema + an extraction prompt + createVisionAgentRoute.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

/* ─── Output schema ───────────────────────────────────────────── */

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().optional(),
  unitPriceCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative().optional(),
});

const InvoiceOcrSchema = z.object({
  vendor: z.string().describe("Company that issued the invoice"),
  invoiceNumber: z.string().optional(),
  issueDate: z.string().optional().describe("ISO date: YYYY-MM-DD"),
  dueDate: z.string().optional(),
  currency: z
    .string()
    .optional()
    .describe("ISO 4217 code (USD, EUR, ZAR, etc.)"),
  subtotalCents: z.number().int().nonnegative().optional(),
  taxCents: z.number().int().nonnegative().optional(),
  totalCents: z
    .number()
    .int()
    .nonnegative()
    .describe("Final amount owed, in cents"),
  lineItems: z.array(LineItemSchema).default([]),
  /**
   * Any field that was ambiguous or illegible. Creator-facing honesty
   * — the agent's SAM manifest guarantees "never fabricates values",
   * and this field is the mechanism that honours it.
   */
  missingFields: z.array(z.string()).default([]),
});

/* ─── Extraction prompt ───────────────────────────────────────── */

const EXTRACTION_PROMPT = `You are an invoice data extractor.

Extract structured fields from the attached invoice image and return JSON with this shape:
  - vendor                  (string; company that issued the invoice)
  - invoiceNumber           (string, optional)
  - issueDate               (YYYY-MM-DD, optional)
  - dueDate                 (YYYY-MM-DD, optional)
  - currency                (ISO 4217 code, e.g. "USD", "EUR")
  - subtotalCents           (integer, amount in CENTS)
  - taxCents                (integer, amount in CENTS)
  - totalCents              (integer, final amount owed in CENTS)
  - lineItems               (array of { description, quantity, unitPriceCents, totalCents })
  - missingFields           (array of field names that were not visible or unclear)

Rules:
  - All monetary amounts MUST be in CENTS (integer), not dollars/euros.
  - If a field is not present or illegible, OMIT it from the response
    AND add its name to missingFields. NEVER fabricate values.
  - Dates must be ISO format (YYYY-MM-DD) or omitted.
  - If the image is not an invoice (e.g. a receipt or random doc),
    return { missingFields: ["this is not an invoice"] } with an
    empty lineItems array and totalCents: 0.`;

/* ─── Route ───────────────────────────────────────────────────── */

export const POST = createVisionAgentRoute({
  name: "invoice-ocr",
  model: "ocr", // nvidia/nemotron-nano-12b-v2-vl
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: InvoiceOcrSchema,
  extraMeta: { samVersion: "1.0", category: "Finance" },
});
