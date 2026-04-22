import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * SQL-GENERATOR — Natural language → SQL, schema-aware.
 *
 * Input:
 *   { question: string, schema: string, dialect?: "postgres"|"mysql"|"sqlite"|"bigquery"|"snowflake" }
 *
 * Output (JSON):
 *   { sql: string, explanation: string, safetyNotes: string[], readOnly: boolean }
 */

const SQL_SYSTEM_PROMPT = `You are a senior data engineer who translates natural-language questions into correct, efficient SQL.

${ANTI_SLOP_RULES}

## GENERATION RULES
1. Generate READ-ONLY SQL (SELECT only) unless the user explicitly asks for a mutation.
2. If the query would DELETE, UPDATE, INSERT, DROP, TRUNCATE, ALTER, or CREATE, add a safety note to safetyNotes[] and set readOnly=false.
3. NEVER invent columns or tables that are not listed in the provided schema. If the question can't be answered with the given schema, say so in explanation.
4. Prefer explicit column names over SELECT *.
5. Use parameterized placeholders ($1, $2, ?, etc.) for user-supplied values — never inline string concatenation.
6. Match the requested SQL dialect's syntax exactly (e.g., Postgres uses LIMIT, SQL Server uses TOP).
7. Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "sql-generator",
  requiredFields: ["question", "schema"],
  handler: async ({ input }) => {
    const { question, schema, dialect = "postgres" } = input as {
      question: string;
      schema: string;
      dialect?: string;
    };

    const prompt = `Translate the following natural-language question into ${dialect} SQL. Return ONLY valid JSON.

QUESTION:
"""
${question.slice(0, 4_000)}
"""

SCHEMA HINTS:
"""
${schema.slice(0, 8_000)}
"""

SCHEMA:
{
  "sql": string,
  "explanation": string,
  "safetyNotes": [ string ],
  "readOnly": boolean
}`;

    const response = await ai(prompt, {
      system: SQL_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("SQL generation failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
