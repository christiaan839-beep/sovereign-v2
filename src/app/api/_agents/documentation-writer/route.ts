import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * DOCUMENTATION-WRITER — Code → annotated code with JSDoc/docstrings + examples.
 *
 * Reads a code snippet and produces (a) the code annotated with doc comments in
 * the requested style, (b) a one-paragraph summary, (c) a list of things the
 * reader of the snippet can't know (missingContext), and (d) runnable examples.
 *
 * Input:
 *   code:     string                                                (required)
 *   language: "typescript"|"javascript"|"python"|"go"|"rust"        (required)
 *   style?:   "jsdoc"|"tsdoc"|"google"|"numpy"|"rustdoc"
 *
 * Output (JSON):
 *   {
 *     annotated: string,             // snippet with doc comments inserted
 *     summary: string,               // one-paragraph plain-English summary
 *     missingContext: string[],      // things not inferable from the snippet alone
 *     examples: Array<{ title, code, output }>
 *   }
 *
 * Pairs with:
 *   - `refactor-suggester` — often run as a follow-up pass after refactors land
 *   - `code-reviewer` — reviewer can cite doc gaps flagged here
 */

const DOC_SYSTEM_PROMPT = `You are a technical writer who doubles as a staff engineer. You document code as it actually behaves, not as it looks like it should behave.

${ANTI_SLOP_RULES}

## DOCUMENTATION RULES
1. NEVER fabricate behavior. Read what the code actually does — if behavior is not inferable from the snippet, list it in missingContext. Do NOT write a plausible-sounding guess.
2. Annotations MUST be non-destructive: preserve every line of original code verbatim — only insert doc comments above/beside declarations.
3. Match the requested style exactly (jsdoc uses \`/** */\`; google Python uses "Args:" sections; rustdoc uses \`///\`). If style is not provided, pick the language-idiomatic default and state it in summary.
4. Examples MUST be concrete and copy-pastable. The "output" field reflects what the example WOULD produce if run — if non-deterministic or dependent on environment, say so and use a placeholder (e.g. "<uuid>").
5. missingContext is an explicit list of the things a reader cannot determine from the snippet alone (e.g. "what DB dialect is used", "what the calling convention for 'ctx' is"). Be specific.
6. If the snippet is already well-documented, still produce annotated (unchanged) + summary + missingContext=[] + examples, so the schema is stable.
7. Output VALID JSON only — no markdown fences, no prose, no trailing commas. The "annotated" string will contain backticks and newlines — escape them per JSON rules.`;

type Language = "typescript" | "javascript" | "python" | "go" | "rust";
type Style = "jsdoc" | "tsdoc" | "google" | "numpy" | "rustdoc";

export const POST = createAgentRoute({
  name: "documentation-writer",
  requiredFields: ["code", "language"],
  handler: async ({ input }) => {
    const {
      code,
      language,
      style,
    } = input as {
      code: string;
      language: Language;
      style?: Style;
    };

    const prompt = `Add documentation to this ${language} snippet. Return ONLY valid JSON matching the schema.

LANGUAGE: ${language}
STYLE: ${style ?? "language-idiomatic default"}

CODE:
\`\`\`${language}
${code.slice(0, 15_000)}
\`\`\`

SCHEMA:
{
  "annotated": string,
  "summary": string,
  "missingContext": [ string ],
  "examples": [ { "title": string, "code": string, "output": string } ]
}`;

    const response = await ai(prompt, {
      system: DOC_SYSTEM_PROMPT,
      maxTokens: 4000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Documentation generation failed: model returned non-JSON output");
    }

    return { success: true, documentation: parsed };
  },
});
