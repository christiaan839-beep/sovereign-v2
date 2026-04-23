/**
 * Contract Parser — vision agent for legal operations.
 *
 * Takes a contract document (multi-page PDF or scanned image) and
 * returns obligations, deadlines, parties, payment terms, and
 * termination clauses as structured JSON. Designed to hand off to
 * downstream workflows: calendar blocks, compliance trackers,
 * legal-review queues.
 *
 * Backed by nvidia/nemotron-parse-1.1-1b (document model) — optimised
 * for structured KV extraction from formal documents. Free via NIM.
 *
 * Limitation (documented honestly): agents identify and extract
 * clauses but do NOT provide legal advice. The output is machine-
 * readable document understanding, not a legal opinion.
 */

import { z } from "zod";
import { createVisionAgentRoute } from "@/lib/vision-agent-factory";

/* ─── Output schema ───────────────────────────────────────────── */

const PartySchema = z.object({
  name: z.string(),
  role: z.string().optional().describe("e.g. \"Client\", \"Vendor\", \"Licensor\""),
  address: z.string().optional(),
});

const ObligationSchema = z.object({
  party: z.string().describe("Which party owes this obligation"),
  description: z.string(),
  dueDate: z.string().optional().describe("ISO date or natural-language if relative"),
  amountCents: z.number().int().optional().describe("If monetary, in cents"),
});

const ContractSchema = z.object({
  title: z.string().optional().describe("Agreement title on the document"),
  effectiveDate: z.string().optional().describe("ISO date when the contract takes effect"),
  expirationDate: z.string().optional(),
  parties: z.array(PartySchema).min(1).describe("Every named party"),
  governingLaw: z.string().optional().describe("Jurisdiction clause if present"),
  paymentTerms: z
    .string()
    .optional()
    .describe("Free-text summary of who pays whom, when, how much"),
  terminationTerms: z
    .string()
    .optional()
    .describe("How either party can terminate"),
  obligations: z.array(ObligationSchema).default([]),
  keyDates: z
    .array(
      z.object({
        label: z.string(),
        date: z.string(),
      }),
    )
    .default([])
    .describe("Deadlines worth tracking in a calendar"),
  risksFlagged: z
    .array(z.string())
    .default([])
    .describe(
      "Clauses an operator might want a lawyer to look at (indemnity," +
        " unlimited liability, auto-renewal, unusual jurisdiction, etc.)",
    ),
  missingFields: z.array(z.string()).default([]),
  /**
   * Hard disclaimer surfaced on every response. The schema MAKES the
   * model include it — not a prompt suggestion, a required field.
   */
  disclaimer: z
    .string()
    .default(
      "This extraction is document understanding, not legal advice. Consult counsel for legally binding interpretations.",
    ),
});

/* ─── Prompt ──────────────────────────────────────────────────── */

const EXTRACTION_PROMPT = `You are a contract extraction specialist.

Read the attached contract image and extract structured fields. Return JSON:

  - title, effectiveDate, expirationDate
  - parties: array of { name, role, address? }
  - governingLaw                       (jurisdiction if stated)
  - paymentTerms                       (free-text summary)
  - terminationTerms                   (free-text summary)
  - obligations: array of { party, description, dueDate?, amountCents? }
  - keyDates: array of { label, date }  (all deadlines)
  - risksFlagged: array of strings      (clauses worth a lawyer's eye:
                                         indemnity, unlimited liability,
                                         auto-renewal, exclusivity,
                                         liquidated damages, unusual venue)
  - missingFields: array of strings
  - disclaimer (pass through the default — see schema)

Extraction rules:
  - Dates ISO (YYYY-MM-DD) when unambiguous; pass as free text otherwise.
  - Monetary amounts in CENTS (integer).
  - Never invent parties, dates, or obligations — if unclear, add to
    missingFields. The risksFlagged list is about CALLING OUT clauses,
    not inventing them.
  - Do not interpret legal force or give advice. Stick to extraction.`;

/* ─── Route ───────────────────────────────────────────────────── */

export const POST = createVisionAgentRoute({
  name: "contract-parser",
  model: "document", // nvidia/nemotron-parse-1.1-1b
  extractionPrompt: EXTRACTION_PROMPT,
  outputSchema: ContractSchema,
  extraMeta: { samVersion: "1.0", category: "Legal" },
});
