/**
 * Bill of Lading reader — extract the 23 canonical BOL fields from a
 * scanned or photographed BOL document.
 *
 * BOLs are the contract between shipper + carrier. Every commercial
 * truck, rail car, ship, and airway bill in the world has one. In
 * North America ~400M BOLs are generated per year; in 2025 roughly
 * half still moved as paper or scanned PDF despite EDI mandates.
 *
 * Output matches the FMCSA standard BOL + ACE eManifest schema so
 * TMS platforms (McLeod, MercuryGate, Oracle OTM) can ingest directly.
 *
 * This closes a persistent logistics gap: freight brokers spend 3-5
 * minutes manually keying each BOL into their TMS. At 200 BOLs/day
 * that's a full-time job. This agent is that job.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

const CommoditySchema = z.object({
  description: z.string(),
  nmfcCode: z.string().optional().describe("National Motor Freight Classification"),
  freightClass: z.string().optional(),
  packageCount: z.number().int().nonnegative().optional(),
  packageType: z.string().optional().describe("e.g. 'pallet', 'case', 'drum'"),
  weightPounds: z.number().nonnegative().optional(),
  hazmat: z.boolean().optional(),
  hazmatUnNumber: z.string().optional(),
});

const BOLSchema = z.object({
  bolNumber: z.string().optional(),
  proNumber: z.string().optional().describe("Carrier's PRO tracking number"),
  shipDate: z.string().optional().describe("ISO-8601"),
  shipper: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  consignee: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  carrier: z
    .object({
      name: z.string().optional(),
      scacCode: z.string().optional().describe("Standard Carrier Alpha Code"),
      dotNumber: z.string().optional(),
    })
    .optional(),
  commodities: z.array(CommoditySchema).default([]),
  totalWeightPounds: z.number().nonnegative().optional(),
  freightTerms: z.enum(["prepaid", "collect", "third-party", "unknown"]).optional(),
  declaredValueUsd: z.number().int().nonnegative().optional(),
  specialInstructions: z.string().optional(),
  signedByShipper: z.boolean().optional(),
  signedByCarrier: z.boolean().optional(),
  signedByConsignee: z.boolean().optional(),
  missingFields: z.array(z.string()).default([]),
});

const EXTRACTION_PROMPT = `You are a Bill of Lading data extractor. Extract
structured fields from the document image and return JSON matching the schema.

Rules:
  - Weights are decimal pounds. "12,500 lbs" becomes 12500. Metric weights
    (kg) should be converted to lbs and flagged in specialInstructions.
  - Monetary values are INTEGER USD (no cents).
  - Freight terms: "Prepaid" → "prepaid", "Collect" → "collect",
    "3rd Party" / "TP" → "third-party". Otherwise "unknown".
  - Hazmat flag is TRUE only when a UN number or hazmat label is visible.
  - Signature booleans are TRUE only if a legible signature exists — initials
    or typed names don't count.
  - If a field is illegible, OMIT it + add its name to missingFields.
  - If the document is NOT a bill of lading, return { missingFields: ["not-a-bol"] }.`;

export const POST = createVisionAgentRoute({
  name: "bill-of-lading-reader",
  model: "document",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: BOLSchema,
  extraMeta: { samVersion: "1.0", category: "Logistics" },
});
