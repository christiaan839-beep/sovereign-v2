/**
 * Certificate of Insurance verifier.
 *
 * Commercial vendors, landlords, and GCs require a COI (ACORD 25, 27,
 * 28) before any contract starts. Verifying one means extracting:
 * insurer name + AM Best rating, insured business, policy numbers,
 * coverage limits per line, effective + expiration dates, and any
 * additional insureds or waivers of subrogation endorsements.
 *
 * That's currently a 10-minute paralegal task per COI. The largest US
 * GC (Turner Construction) handles ~3,000 COIs per MONTH. This agent
 * does the extraction — the paralegal's job becomes "approve or flag",
 * not "re-type".
 *
 * Output maps 1:1 to the ACORD 25 certificate fields so downstream
 * vendor-management systems (Smartsheet, COI-Pro, myCOI) can ingest
 * without transformation.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const CoverageLineSchema = z.object({
  line: z
    .string()
    .describe(
      "Coverage name, e.g. 'General Liability', 'Auto', 'Workers Comp', 'Umbrella'",
    ),
  policyNumber: z.string().optional(),
  effectiveDate: z.string().optional().describe("ISO-8601 if extractable"),
  expirationDate: z.string().optional().describe("ISO-8601 if extractable"),
  eachOccurrenceLimitUsd: z.number().int().nonnegative().optional(),
  aggregateLimitUsd: z.number().int().nonnegative().optional(),
  deductibleUsd: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

const COISchema = z.object({
  producer: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  insured: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  insurers: z.array(z.object({ name: z.string(), naicCode: z.string().optional() })).default([]),
  coverages: z.array(CoverageLineSchema).default([]),
  additionalInsureds: z.array(z.string()).default([]),
  waiverOfSubrogation: z.boolean().optional(),
  primaryAndNoncontributory: z.boolean().optional(),
  certificateHolder: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  issuedDate: z.string().optional().describe("ISO-8601"),
  descriptionOfOperations: z.string().optional(),
  missingFields: z.array(z.string()).default([]),
});

const EXTRACTION_PROMPT = `You are a Certificate of Insurance (ACORD 25) data extractor.

Extract the structured fields visible on the image and return JSON matching
the schema. Rules:
  - Monetary limits are INTEGER USD (no cents, no commas). "$1,000,000"
    becomes 1000000.
  - Dates are ISO-8601 where legible. If only MM/DD/YYYY visible, convert it.
  - If you cannot read a field, OMIT it AND add the field path to
    "missingFields".
  - Boolean-valued endorsements (waiver of subrogation, primary & non-
    contributory) should be true only when the checkbox is visibly marked.
  - If the document is not a COI, return { missingFields: ["not-a-coi"] }.`;

export const POST = createVisionAgentRoute({
  name: "coi-verifier",
  model: "document",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: COISchema,
  extraMeta: { samVersion: "1.0", category: "Insurance" },
});
