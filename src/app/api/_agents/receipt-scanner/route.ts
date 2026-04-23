/**
 * Receipt Scanner — vision agent for expense tracking.
 *
 * Takes a receipt photo (grocery, meal, parking, Uber) and returns
 * structured expense data: merchant, category, total, line items,
 * payment method. Output shape is optimised for downstream accounting
 * integrations (QuickBooks, Xero) — the `category` field uses the
 * IRS Schedule C expense categories so it drops straight into tax prep.
 *
 * Backed by nvidia/nemotron-nano-12b-v2-vl (OCR), free via NIM.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

/* ─── Output schema ───────────────────────────────────────────── */

/**
 * IRS Schedule C expense categories. Closed enum so the model can't
 * invent "mystery category #47" that breaks downstream reports.
 */
const ExpenseCategorySchema = z.enum([
  "advertising",
  "car_and_truck",
  "commissions_and_fees",
  "contract_labor",
  "insurance",
  "legal_and_professional",
  "office_expense",
  "rent_or_lease",
  "repairs_and_maintenance",
  "supplies",
  "taxes_and_licenses",
  "travel",
  "meals",
  "utilities",
  "other",
]);

const ReceiptLineSchema = z.object({
  description: z.string(),
  quantity: z.number().optional(),
  totalCents: z.number().int().nonnegative().optional(),
});

const ReceiptSchema = z.object({
  merchant: z.string().describe("Business name on the receipt"),
  merchantAddress: z.string().optional(),
  purchaseDate: z
    .string()
    .optional()
    .describe("ISO date: YYYY-MM-DD"),
  purchaseTime: z.string().optional().describe("24h HH:MM if visible"),
  category: ExpenseCategorySchema.describe(
    "Primary IRS Schedule C expense category",
  ),
  currency: z.string().optional().describe("ISO 4217 code"),
  subtotalCents: z.number().int().nonnegative().optional(),
  taxCents: z.number().int().nonnegative().optional(),
  tipCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative(),
  paymentMethod: z
    .enum(["cash", "credit", "debit", "mobile_wallet", "unknown"])
    .optional(),
  cardLast4: z.string().optional().describe("Last 4 digits if on receipt"),
  lineItems: z.array(ReceiptLineSchema).default([]),
  missingFields: z.array(z.string()).default([]),
});

/* ─── Prompt ──────────────────────────────────────────────────── */

const EXTRACTION_PROMPT = `You are a receipt data extractor for expense tracking.

Extract structured fields from the receipt image and return JSON:
  - merchant             (string; business name)
  - merchantAddress      (string, optional)
  - purchaseDate         (YYYY-MM-DD)
  - purchaseTime         (HH:MM, 24h, optional)
  - category             (one of: advertising, car_and_truck,
                          commissions_and_fees, contract_labor,
                          insurance, legal_and_professional,
                          office_expense, rent_or_lease,
                          repairs_and_maintenance, supplies,
                          taxes_and_licenses, travel, meals,
                          utilities, other)
  - currency             (ISO 4217, e.g. "USD")
  - subtotalCents, taxCents, tipCents, totalCents  (INTEGER CENTS)
  - paymentMethod        (cash | credit | debit | mobile_wallet | unknown)
  - cardLast4            (string, optional, last 4 of card if shown)
  - lineItems            (array of { description, quantity, totalCents })
  - missingFields        (array of names of fields not visible)

Category rules:
  - Restaurants / food / bars → "meals"
  - Gas / parking / tolls / ride-share → "car_and_truck"
  - Hotels / flights → "travel"
  - Office supplies / laptops / software → "office_expense"
  - Legal / accounting fees → "legal_and_professional"
  - Marketing / ads → "advertising"
  - Phone / internet → "utilities"
  - Everything else → "other"

All money in INTEGER CENTS. Never fabricate values — if unclear,
add the field name to missingFields.`;

/* ─── Route ───────────────────────────────────────────────────── */

export const POST = createVisionAgentRoute({
  name: "receipt-scanner",
  model: "ocr",
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: ReceiptSchema,
  extraMeta: { samVersion: "1.0", category: "Finance" },
});
