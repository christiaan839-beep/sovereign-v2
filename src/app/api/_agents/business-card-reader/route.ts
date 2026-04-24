/**
 * Business Card Reader — extract contact info from a business card image.
 *
 * CRM-friendly output: fields are normalised to standard formats
 * (E.164 phones, lowercased emails, URLs with protocol) so the
 * downstream CRM doesn't need cleanup logic.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const BusinessCardSchema = z.object({
  fullName: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  companyAddress: z.string().optional(),
  email: z.string().email().optional().describe("Lowercase"),
  phoneE164: z.string().optional().describe("E.164 format, e.g. +14155551212"),
  mobileE164: z.string().optional().describe("E.164 if distinctly marked as mobile"),
  website: z.string().optional().describe("Full URL with protocol"),
  linkedinUrl: z.string().optional(),
  twitterHandle: z.string().optional().describe("Without @ prefix"),
  additional: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .default([])
    .describe("Misc fields that don't fit the standard schema"),
  missingFields: z.array(z.string()).default([]),
});

const EXTRACTION_PROMPT = `You are a business-card data extractor for CRM intake.

Extract contact fields from the card image and return JSON.

Normalisation rules (very important — downstream CRMs rely on these):
  - email: lowercase
  - phone: E.164 format (starts with "+", includes country code, digits only
    after that). If the country code isn't visible, use +1 for US-format
    numbers and add a qualityFlag.
  - website: include "https://" if absent
  - linkedinUrl: full https://linkedin.com/in/... URL
  - twitterHandle: WITHOUT the @ prefix
  - company: strip legal suffixes like ", LLC" or ", Inc." from the
    primary field — surface them in additional if distinctive.

Rules:
  - If a field is illegible, OMIT it + add to missingFields.
  - Free-form contact tags ("Press contact", "After-hours mobile", etc.)
    go into the additional[] array with { label, value }.
  - If this is not a business card, return missingFields:
    ["this is not a business card"] with empty fields.`;

export const POST = createVisionAgentRoute({
  name: "business-card-reader",
  model: "ocr",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: BusinessCardSchema,
  extraMeta: { samVersion: "1.0", category: "Sales" },
});
