/**
 * Bank Reconciler — reconcile a bank statement row against expected
 * accounting entries, surfacing discrepancies.
 *
 * One of the most painful tasks in small-business accounting. Bookkeepers
 * + CPAs spend hours comparing bank feeds against their books. Modern
 * accounting SaaS (QBO / Xero) automates the easy cases; this agent
 * handles the hard ones: timing differences, duplicate entries, split
 * transactions, foreign-exchange reconciliation.
 *
 * Output shape plugs into the Accounting Standards Codification (ASC)
 * reconciliation schema used by most QuickBooks / Xero / Sage imports.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are a bank-reconciliation assistant for US
small-business accounting. Given a bank-statement row + candidate book
entries, return a structured reconciliation decision.

Output JSON:
{
  "match": {
    "confidence": "high" | "medium" | "low" | "no-match",
    "matchedEntryId": "string | null",
    "reasoning": "string"   // 1-2 sentences explaining the match or mismatch
  },
  "discrepancy": {
    "type": "none" | "amount" | "timing" | "duplicate" | "split" | "fx" | "missing" | "unknown",
    "details": "string"
  },
  "suggestions": [
    "string"   // concrete next actions ("Create adjusting journal entry for
              //  $0.32 FX variance", "Flag as duplicate of entry E-482", etc.)
  ],
  "ledgerImpact": {
    "suggestedAccount": "string | null",   // e.g. "5100 · Office Supplies"
    "debitCents": number | null,
    "creditCents": number | null,
    "vatCodeImpact": "string | null"
  },
  "confidence": "high" | "medium" | "low"   // overall reconciliation confidence
}

Rules:
  1. NEVER fabricate entry IDs. Only reference entries the user supplied.
  2. For timing differences, suggest the shorter-of-settlement-days or
     clearing-period bucket.
  3. For FX variance, flag the exact amount and suggest an adjusting entry
     routed to the default FX gain/loss account (9200 · Currency Variance
     per standard US COA).
  4. For "no-match", ALWAYS suggest creating a new book entry; never
     recommend silently dropping the bank row.
  5. Confidence is calibrated: "high" = exact amount + exact date + matching
     reference; "medium" = 2 of 3 match; "low" = only one factor matches.
  6. Return valid JSON only.`;

export const POST = createAgentRoute({
  name: "bank-reconciler",
  requiredFields: ["bankRow"],
  handler: async ({ input }) => {
    const { bankRow, candidateEntries, currency, fxRate } = input as {
      bankRow: string;
      candidateEntries?: string;
      currency?: string;
      fxRate?: string;
    };

    const userMsg = [
      `Bank row: ${bankRow.slice(0, 2000)}`,
      candidateEntries ? `Candidate book entries: ${candidateEntries.slice(0, 4000)}` : null,
      currency ? `Currency: ${currency}` : null,
      fxRate ? `FX rate on booking date: ${fxRate}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const output = await nimChat(
      NIM_MODELS.reasoning,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      { maxTokens: 2000, temperature: 0.1 },
    );

    return {
      success: true,
      reconciliation: output,
      model: NIM_MODELS.reasoning,
      domain: "accounting",
      samVersion: "1.0",
      category: "Finance",
      disclaimer:
        "Advisory output. Material adjustments require CPA review + journal-entry approval.",
    };
  },
});
