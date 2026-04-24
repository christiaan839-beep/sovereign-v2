/**
 * W-2 Reader — extract US tax form W-2 fields from an image.
 *
 * Fields are 1:1 with the IRS box numbers so downstream tax-prep
 * integrations get exact match. Closes a vertical-depth gap: tax-prep
 * software vendors can plug this into their intake flow.
 *
 * Legal note: US W-2 data is PII. Buyers invoking this agent should
 * ensure they have consent to process. The platform enforces no
 * retention beyond the invocation attestation (which stores hashes,
 * not plaintext).
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const W2Schema = z.object({
  employeeName: z.string().optional(),
  employeeSsn: z.string().optional().describe("Masked format: XXX-XX-NNNN"),
  employerName: z.string().optional(),
  employerEin: z.string().optional(),
  taxYear: z.number().int().optional(),
  box1WagesCents: z.number().int().nonnegative().optional(),
  box2FederalWithholdingCents: z.number().int().nonnegative().optional(),
  box3SocialSecurityWagesCents: z.number().int().nonnegative().optional(),
  box4SocialSecurityTaxCents: z.number().int().nonnegative().optional(),
  box5MedicareWagesCents: z.number().int().nonnegative().optional(),
  box6MedicareTaxCents: z.number().int().nonnegative().optional(),
  box12Codes: z
    .array(
      z.object({
        code: z.string(),
        amountCents: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  box15StateCode: z.string().optional(),
  box16StateWagesCents: z.number().int().nonnegative().optional(),
  box17StateTaxCents: z.number().int().nonnegative().optional(),
  missingFields: z.array(z.string()).default([]),
});

const EXTRACTION_PROMPT = `You are a US W-2 tax form data extractor.

Extract the fields visible on the image and return JSON with the shape:
  - employeeName
  - employeeSsn             (return masked as "XXX-XX-NNNN" with the last
                             four digits visible; NEVER return the full SSN)
  - employerName, employerEin
  - taxYear                 (4-digit year from the top-right of the form)
  - box1WagesCents ... box17StateTaxCents
    (monetary amounts MUST be integer cents; a W-2 showing "\$54,320.10"
    becomes 5432010)
  - box12Codes              (array of { code: "D" | "DD" | ..., amountCents })
  - missingFields           (array of field names that were illegible)

Rules:
  - CENTS only, never dollars.
  - NEVER return a full unmasked SSN — mask the first five digits.
  - If the image is not a W-2, return missingFields: ["this is not a W-2"]
    with empty objects for other fields.
  - If a field is missing or unclear, OMIT it + add to missingFields.`;

export const POST = createVisionAgentRoute({
  name: "w2-reader",
  model: "document",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: W2Schema,
  extraMeta: { samVersion: "1.0", category: "Finance" },
});
