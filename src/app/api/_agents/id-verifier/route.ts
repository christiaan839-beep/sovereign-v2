/**
 * ID Verifier — extract structured fields from a government-issued ID image.
 *
 * Compliance-friendly: fields are limited to what KYC flows need. Does
 * NOT perform identity verification itself (no liveness check, no
 * biometric match) — it's a structured extraction step that feeds INTO
 * a KYC pipeline.
 *
 * Legal note: government IDs are sensitive PII. Use only with explicit
 * user consent + a legitimate KYC/AML purpose. The invocation attestation
 * stores hashes of input/output, not plaintext — so a compliance auditor
 * can prove the extraction happened without the platform retaining
 * sensitive fields.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const IdSchema = z.object({
  idType: z.enum([
    "passport",
    "drivers_license",
    "national_id",
    "state_id",
    "residence_permit",
    "unknown",
  ]),
  issuingCountry: z.string().optional().describe("ISO 3166-1 alpha-2 if determinable"),
  issuingRegion: z.string().optional().describe("State/province for sub-national IDs"),
  documentNumber: z.string().optional().describe("Masked format: last 4 digits only"),
  fullName: z.string().optional(),
  dateOfBirth: z.string().optional().describe("ISO YYYY-MM-DD"),
  expirationDate: z.string().optional().describe("ISO YYYY-MM-DD"),
  /** Detected but NOT returned in plaintext — liveness-check upstream. */
  mrzPresent: z.boolean().default(false),
  /** Useful for fraud detection — not a definitive judgment. */
  qualityFlags: z
    .array(z.string())
    .default([])
    .describe(
      "e.g. low_resolution, glare, edge_cropped, suspected_screen_photo",
    ),
  missingFields: z.array(z.string()).default([]),
  disclaimer: z
    .string()
    .default(
      "This is structured extraction, not identity verification. Do not use standalone for KYC/AML decisions.",
    ),
});

const EXTRACTION_PROMPT = `You are an ID-document field extractor for KYC intake flows.

Extract visible fields from the ID image and return JSON:
  - idType                 (enum: passport, drivers_license, national_id,
                            state_id, residence_permit, unknown)
  - issuingCountry         (ISO alpha-2: US, CA, GB, ZA, ...)
  - issuingRegion          (for sub-national IDs like US state licenses)
  - documentNumber         (MASKED: return only last 4 digits,
                            e.g. "****1234". NEVER return the full number.)
  - fullName
  - dateOfBirth            (ISO YYYY-MM-DD)
  - expirationDate         (ISO YYYY-MM-DD)
  - mrzPresent             (true if the Machine Readable Zone is visible;
                            NEVER extract the MRZ content itself)
  - qualityFlags           (array of findings: low_resolution, glare,
                            edge_cropped, suspected_screen_photo,
                            expired_by_date, etc.)
  - missingFields
  - disclaimer             (include verbatim — type default)

Rules:
  - Document numbers: last 4 digits ONLY. Security-critical.
  - MRZ: presence only, never content. Leaking MRZ leaks the full
    document number + check digits.
  - If this is not a government ID, return { idType: "unknown",
    qualityFlags: ["not_a_government_id"] }.`;

export const POST = createVisionAgentRoute({
  name: "id-verifier",
  model: "ocr",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: IdSchema,
  extraMeta: { samVersion: "1.0", category: "Compliance" },
});
