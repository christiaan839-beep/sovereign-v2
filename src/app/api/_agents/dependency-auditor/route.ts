import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * DEPENDENCY-AUDITOR — package.json / requirements.txt → CVE + license + outdated report.
 *
 * Parses a manifest file and produces a severity-ranked findings list covering
 * known vulnerability classes, license concerns, deprecations, and "too old to
 * trust" versions. NOT a replacement for a real SCA scanner — outputs are
 * advisory and flag any specific CVE numbers as "requires verification".
 *
 * Input:
 *   manifest:  string                                   (required — full file text)
 *   ecosystem?: "npm"|"pypi"|"cargo"|"go"               (default "npm")
 *
 * Output (JSON):
 *   {
 *     findings: Array<{
 *       package: string,
 *       version: string,
 *       issue: "cve"|"license"|"outdated"|"deprecated"|"unused",
 *       severity: "critical"|"high"|"medium"|"low",
 *       description: string,
 *       recommendation: string
 *     }>,
 *     summary: { critical: number, high: number, total: number, recommendation: string }
 *   }
 *
 * Pairs with:
 *   - `migration-planner` — downstream, when a finding triggers a major-version jump
 *   - `code-reviewer` — can block PRs that introduce critical-severity findings
 */

const AUDIT_SYSTEM_PROMPT = `You are a supply-chain security engineer. You produce advisory audits that point teams to verify findings — you NEVER claim false precision.

${ANTI_SLOP_RULES}

## AUDIT RULES
1. NEVER fabricate specific CVE numbers. If you suspect a CVE, describe the vulnerability CLASS (e.g. "prototype pollution in versions < 4.17.12") and append the literal phrase "requires verification" to the description. Do NOT invent CVE IDs like "CVE-2023-12345" unless certain.
2. "outdated" severity should reflect real abandonment risk, not version recency. A 2-year-old stable release is not automatically high-severity.
3. "license" findings should name the specific license detected (MIT, GPL-3.0, AGPL-3.0, UNLICENSED) and explain the concern (copyleft contamination, commercial restriction).
4. "deprecated" findings MUST cite why the package is deprecated if known, or say "deprecation flag set — requires verification".
5. "unused" findings are LOW severity unless the dep is known-risky — they're cleanup items, not security items.
6. summary.recommendation is a single imperative sentence (e.g. "Upgrade lodash and replace request before next release").
7. summary counts MUST match the findings array exactly.
8. If the manifest can't be parsed, return findings=[] and summary with a clear recommendation to verify the manifest format.
9. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

type Ecosystem = "npm" | "pypi" | "cargo" | "go";

export const POST = createAgentRoute({
  name: "dependency-auditor",
  requiredFields: ["manifest"],
  handler: async ({ input }) => {
    const {
      manifest,
      ecosystem = "npm",
    } = input as {
      manifest: string;
      ecosystem?: Ecosystem;
    };

    const prompt = `Audit this ${ecosystem} manifest for CVEs, license, outdated, deprecated, and unused dependency concerns. Return ONLY valid JSON matching the schema.

ECOSYSTEM: ${ecosystem}

MANIFEST:
"""
${manifest.slice(0, 20_000)}
"""

SCHEMA:
{
  "findings": [
    {
      "package": string,
      "version": string,
      "issue": "cve" | "license" | "outdated" | "deprecated" | "unused",
      "severity": "critical" | "high" | "medium" | "low",
      "description": string,
      "recommendation": string
    }
  ],
  "summary": { "critical": number, "high": number, "total": number, "recommendation": string }
}`;

    const response = await ai(prompt, {
      system: AUDIT_SYSTEM_PROMPT,
      maxTokens: 3500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Dependency audit failed: model returned non-JSON output");
    }

    return { success: true, audit: parsed };
  },
});
