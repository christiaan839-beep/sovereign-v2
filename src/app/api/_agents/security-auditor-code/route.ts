import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * SECURITY-AUDITOR-CODE — Defense-in-depth audit of a function or module.
 * Score is based on "would this survive a hostile environment", not
 * "does it compile".
 *
 * Input:
 *   { code: string, language: string, threatModel?: string }
 *
 * Output (JSON):
 *   {
 *     auditScore:        number (0-100),
 *     criticalIssues:    string[],
 *     recommendations:   Array<{ priority: "must-fix"|"should-fix"|"nice-to-have", issue: string, fix: string }>,
 *     positiveFindings:  string[]
 *   }
 *
 * Pairs with:
 *   - `vulnerability-scanner` — quicker per-diff scan
 *   - `code-reviewer` — general quality review
 */

const AUDIT_SYSTEM_PROMPT = `You are a senior code auditor. You evaluate code on defense-in-depth, not on whether it works. A correct implementation with weak validation, logged secrets, or missing authz fails your audit.

${ANTI_SLOP_RULES}

## AUDIT DIMENSIONS
1. Input validation — type checks, bounds, encoding, allowlist vs denylist, schema validation.
2. Authentication — credential handling, session management, MFA hooks, token expiry.
3. Authorization — consistent checks, least privilege, tenant/org scoping, IDOR resistance.
4. Cryptography — algorithm choice, key management, IV/nonce handling, secure randomness.
5. Secrets handling — env vars vs hardcoded, never logged, redacted in errors.
6. Logging — structured, does not leak PII/secrets, correlation IDs present.
7. Error handling — fails closed, does not leak stack traces to users, consistent error shape.
8. Dependencies — avoid known-vulnerable patterns, pin versions, audit transitive risk.

## SCORE CALIBRATION (0-100)
- 90-100 — production-ready defense-in-depth, minor hardening left.
- 70-89  — solid, several should-fix items, would pass a friendly audit.
- 50-69  — meaningful gaps, at least one must-fix before prod.
- 30-49  — structural weaknesses across multiple dimensions.
- 0-29   — dangerous; systemic rewrite needed.

## RULES
1. criticalIssues[] only contains items that, left unfixed, would constitute a breach risk. If the code is strong, this list can be empty.
2. recommendations[] priority:
   - "must-fix" — do not deploy without this.
   - "should-fix" — deploy is OK, but track as tech debt.
   - "nice-to-have" — polish.
3. Each recommendation pairs an "issue" (specific observation, not a category) with a "fix" (concrete code change, not "sanitize inputs").
4. Always surface at least one positive finding if any exists — auditors who only list negatives lose credibility. If the code genuinely has no positives (e.g., trivially broken), positiveFindings may be [].
5. Do not invent threats unsupported by the code. If threatModel is provided, align recommendations with it; if absent, assume standard web-app threat model.

Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "security-auditor-code",
  requiredFields: ["code", "language"],
  handler: async ({ input }) => {
    const { code, language, threatModel } = input as {
      code: string;
      language: string;
      threatModel?: string;
    };

    const prompt = `Audit this ${language} code for defense-in-depth weaknesses. Return ONLY valid JSON.

THREAT MODEL: ${threatModel ?? "standard web-app (untrusted network, authenticated sessions, multi-tenant data)"}

CODE:
"""
${code.slice(0, 25_000)}
"""

SCHEMA:
{
  "auditScore": number,
  "criticalIssues": [ string ],
  "recommendations": [
    {
      "priority": "must-fix"|"should-fix"|"nice-to-have",
      "issue": string,
      "fix": string
    }
  ],
  "positiveFindings": [ string ]
}`;

    const response = await ai(prompt, {
      system: AUDIT_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Code audit failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
