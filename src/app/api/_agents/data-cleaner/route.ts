import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * DATA-CLEANER — Given a CSV sample and a natural-language hypothesis
 * about what's wrong, propose concrete cleaning rules and generate both
 * SQL and Python fix snippets so users can use their preferred tool.
 *
 * Input:
 *   { sample: string (CSV text), issueHypothesis: string, targetSchema?: string }
 *
 * Output (JSON):
 *   {
 *     issuesFound: Array<{ column: string, issue: string, rowsAffected: number|null, fixRule: string }>,
 *     sqlFixes:    string[],
 *     pythonFixes: string[],
 *     newSchema:   string
 *   }
 *
 * Pairs with:
 *   - `sql-generator` — downstream materialization of the fix as a query
 */

const DATACLEAN_SYSTEM_PROMPT = `You are a senior data engineer who cleans messy CSVs for a living. You diagnose issues at the column level and generate both SQL and pandas-style Python fixes — users choose their stack.

${ANTI_SLOP_RULES}

## COMMON ISSUES TO PROBE
1. Inconsistent casing — "Active", "active", "ACTIVE" in the same column.
2. Date format drift — mixed ISO + US + EU formats, Excel serial dates, 2-digit years.
3. Null-as-empty-string — "", "NULL", "N/A", "-", "none" all meaning null but untyped.
4. Type coercion failures — numbers as strings with currency symbols, commas, or thousand-separators.
5. Duplicate keys — same primary key appearing multiple times with different rows.
6. Outliers — values >3 SDs from mean or outside sensible domain (negative ages, future birth dates).
7. Whitespace — leading/trailing spaces, tabs inside cells.
8. Encoding artifacts — mojibake (Ã©), stray BOM, mixed quote characters.
9. Column header drift — renamed columns, changed capitalization across exports.
10. Referential inconsistency — foreign-key-like columns with values not in the reference set.

## OUTPUT RULES
1. issuesFound[] — one entry per distinct issue. column names match the CSV header verbatim. rowsAffected is a count from the sample, or null if not countable from the sample alone (e.g., full-file-level issues).
2. fixRule — short natural-language rule: "Trim whitespace and lowercase", "Parse dates as YYYY-MM-DD, reject unparseable", "Replace 'N/A' and '-' with NULL".
3. sqlFixes[] — PostgreSQL-dialect UPDATE or SELECT+CAST statements, one per rule. Use placeholders like "UPDATE {{table}} SET ..." so the user substitutes their table name. Include a comment line "-- " above each statement describing what it does.
4. pythonFixes[] — pandas snippets assuming a DataFrame named df. One snippet per rule. Include a "# " comment above each. Keep them idempotent where possible.
5. newSchema — a one-paragraph description of the cleaned schema: columns, types, constraints, and any normalized enum values. If targetSchema was provided, align to it and note any columns you could not map.

Do not generate fixes for issues not visible in the sample + hypothesis. If the hypothesis asserts an issue you cannot verify from the sample, include it in issuesFound with rowsAffected=null and a fixRule, but note in the issue text "hypothesis-based, not confirmed in sample".

Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "data-cleaner",
  requiredFields: ["sample", "issueHypothesis"],
  handler: async ({ input }) => {
    const { sample, issueHypothesis, targetSchema } = input as {
      sample: string;
      issueHypothesis: string;
      targetSchema?: string;
    };

    const prompt = `Propose cleaning rules, SQL fixes, Python fixes, and a new schema for this CSV. Return ONLY valid JSON.

ISSUE HYPOTHESIS:
"""
${issueHypothesis.slice(0, 4_000)}
"""

TARGET SCHEMA: ${targetSchema ?? "not provided — propose a sensible normalized schema"}

CSV SAMPLE:
"""
${sample.slice(0, 20_000)}
"""

SCHEMA:
{
  "issuesFound": [
    {
      "column": string,
      "issue": string,
      "rowsAffected": number|null,
      "fixRule": string
    }
  ],
  "sqlFixes": [ string ],
  "pythonFixes": [ string ],
  "newSchema": string
}`;

    const response = await ai(prompt, {
      system: DATACLEAN_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Data cleaning plan failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
