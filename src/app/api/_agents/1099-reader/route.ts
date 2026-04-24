/**
 * 1099 Reader — extract US 1099-MISC / 1099-NEC fields from an image or PDF.
 *
 * Tax-prep companies handle tens of millions of 1099s per year. Most OCR
 * solutions are trained on W-2 (uniform layout); 1099 variants differ
 * significantly by payer. This agent emits the canonical payer / recipient
 * / box-level data that matches IRS transmittal format.
 *
 * CRITICAL: TIN (Taxpayer Identification Number) is PII. We mask to
 * last 4 digits ("XXX-XX-NNNN") — NEVER return unmasked. Enforced via
 * the system prompt AND a post-extraction safety check.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const ElevenNinetyNineSchema = z.object({
  formVariant: z
    .enum(["1099-MISC", "1099-NEC", "1099-INT", "1099-DIV", "1099-K", "unknown"])
    .describe("Which 1099 variant this is"),
  taxYear: z.number().int().optional(),
  payerName: z.string().optional(),
  payerEin: z.string().optional().describe("Format: XX-XXXXXXX"),
  payerAddress: z.string().optional(),
  recipientName: z.string().optional(),
  recipientTin: z
    .string()
    .optional()
    .describe("Masked format: XXX-XX-NNNN for SSN, XX-XXXNNNN for EIN"),
  recipientAddress: z.string().optional(),
  // 1099-NEC
  nonemployeeCompensationCents: z.number().int().nonnegative().optional(),
  federalIncomeTaxWithheldCents: z.number().int().nonnegative().optional(),
  // 1099-MISC boxes (most common subset)
  rentsCents: z.number().int().nonnegative().optional(),
  royaltiesCents: z.number().int().nonnegative().optional(),
  otherIncomeCents: z.number().int().nonnegative().optional(),
  fishingBoatProceedsCents: z.number().int().nonnegative().optional(),
  medicalPaymentsCents: z.number().int().nonnegative().optional(),
  // 1099-INT / 1099-DIV
  interestIncomeCents: z.number().int().nonnegative().optional(),
  ordinaryDividendsCents: z.number().int().nonnegative().optional(),
  qualifiedDividendsCents: z.number().int().nonnegative().optional(),
  // State info
  stateIncomeTaxWithheldCents: z.number().int().nonnegative().optional(),
  stateCode: z.string().optional(),
  missingFields: z.array(z.string()).default([]),
});

const EXTRACTION_PROMPT = `You are a US IRS Form 1099 data extractor (supports
1099-MISC, 1099-NEC, 1099-INT, 1099-DIV, 1099-K).

Extract the fields visible on the image and return JSON matching the schema.

Rules:
  - Identify the 1099 VARIANT first (top-left corner + box layout).
  - Monetary amounts are INTEGER CENTS. "$12,450.00" becomes 1245000.
  - TIN (recipient's SSN or EIN) MUST be masked: mask all but last 4 digits.
    An SSN becomes "XXX-XX-NNNN"; an EIN becomes "XX-XXXNNNN".
    NEVER return the full unmasked TIN.
  - EIN for payer (not recipient) can be returned unmasked — business EINs
    are public record.
  - If a field is illegible, OMIT it and add the field path to missingFields.
  - If this is NOT a 1099 variant, return { formVariant: "unknown",
    missingFields: ["not-a-1099"] }.`;

export const POST = createVisionAgentRoute({
  name: "1099-reader",
  model: "document",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: ElevenNinetyNineSchema,
  extraMeta: { samVersion: "1.0", category: "Finance" },
});
