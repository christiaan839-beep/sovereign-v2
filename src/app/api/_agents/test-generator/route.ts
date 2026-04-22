import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * TEST-GENERATOR — Generate real test-framework code for a snippet.
 *
 * Input:
 *   { code: string, language?: "typescript"|"javascript"|"python", framework?: "vitest"|"jest"|"pytest" }
 *
 * Output (JSON):
 *   { tests: string, coverageNotes: string[], missingCases: string[] }
 */

const TEST_SYSTEM_PROMPT = `You are a TDD-focused test engineer. You generate real, runnable test code — never pseudocode or placeholders.

${ANTI_SLOP_RULES}

## GENERATION RULES
1. Cover the happy path, every meaningful edge case, and at least one error path.
2. Use the actual test-framework syntax (Vitest: describe/it/expect, Jest: describe/it/expect, Pytest: def test_*).
3. No commented-out TODOs. Every test must be a real assertion.
4. If you cannot fully cover a branch (e.g., external I/O), list it in missingCases[] with the reason.
5. coverageNotes[] should explain what the test suite covers, one note per area.
6. Output VALID JSON only — no markdown fences, no prose outside the JSON. The "tests" field is a string containing the code.`;

export const POST = createAgentRoute({
  name: "test-generator",
  requiredFields: ["code"],
  handler: async ({ input }) => {
    const {
      code,
      language = "typescript",
      framework,
    } = input as { code: string; language?: string; framework?: string };

    const defaultFramework = language === "python" ? "pytest" : "vitest";
    const fw = framework ?? defaultFramework;

    const prompt = `Generate a complete ${fw} test file for the following ${language} code. Return ONLY valid JSON.

CODE:
"""
${code.slice(0, 10_000)}
"""

SCHEMA:
{
  "tests": string,
  "coverageNotes": [ string ],
  "missingCases": [ string ]
}`;

    const response = await ai(prompt, {
      system: TEST_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Test generation failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
