import { createAgentRoute } from "@/lib/agent-factory";
import { research_ai } from "@/lib/ai";
import { nimChat } from "@/lib/nvidia";
import { withSelfHeal } from "@/lib/self-heal";
import { z } from "zod";

/**
 * COMPLIANCE-MONITOR AGENT — Regulatory compliance gap analysis and change monitoring.
 *
 * Uses live research to pull the latest regulatory updates, enforcement actions,
 * and guidance documents for the specified industry and jurisdiction, then uses
 * NVIDIA Nemotron Ultra to identify compliance gaps, upcoming deadlines, and
 * prioritized remediation actions for the described business.
 *
 * Input:  { industry: string, jurisdiction: string, businessDescription: string, recentChanges?: string }
 * Output: { complianceScore, gaps, deadlines, actionItems, riskLevel }
 */

const INPUT_SCHEMA = z
  .object({
    industry: z.string().min(1).max(200),
    jurisdiction: z.string().min(1).max(300),
    businessDescription: z.string().min(10).max(3000),
    recentChanges: z.string().max(2000).optional(),
    prompt: z.string().max(5000).optional(),
  })
  .passthrough();

export const POST = createAgentRoute({
  name: "compliance-monitor",
  requiredFields: ["industry", "jurisdiction", "businessDescription"],
  // Wave-111.1 batch 4: memory hooks. Per-industry + per-
  // jurisdiction analyses compound over reporting periods —
  // surface what's changed in the regulatory landscape vs prior
  // scans, track remediation follow-through.
  memory: {
    search: {
      query: (input) =>
        `compliance industry:${input.industry ?? ""} jurisdiction:${input.jurisdiction ?? ""}`,
      limit: 3,
    },
    store: {
      extract: (result, input) => {
        const r = result as {
          complianceScore?: number;
          riskLevel?: string;
          gaps?: string[];
          deadlines?: string[];
        };
        if (r.complianceScore == null && !r.riskLevel) return null;
        const gaps = (r.gaps ?? []).slice(0, 3).join("; ");
        const deadlines = (r.deadlines ?? []).slice(0, 2).join("; ");
        return `${input.industry} ${input.jurisdiction}: score ${r.complianceScore ?? "?"} (${r.riskLevel ?? "?"}). gaps: ${gaps}. deadlines: ${deadlines}`;
      },
      metadata: (input) => ({
        industry: String(input.industry ?? ""),
        jurisdiction: String(input.jurisdiction ?? ""),
        kind: "compliance-monitor",
      }),
    },
  },
  handler: withSelfHeal(
    async ({ input, pastContextAsPrompt }) => {
      const industry = input.industry as string;
      const jurisdiction = input.jurisdiction as string;
      const businessDescription = input.businessDescription as string;
      const recentChanges = (input.recentChanges as string) || "";

      // Step 1: Fetch latest regulatory updates and enforcement actions
      let regulatoryIntel = "";
      try {
        regulatoryIntel = await research_ai(
          `${industry} ${jurisdiction} regulatory changes compliance requirements 2026 enforcement`,
          `Find current and upcoming regulatory requirements for ${industry} businesses in ${jurisdiction}. Include: (1) new regulations or rule changes effective in 2025-2026, (2) recent enforcement actions and penalties in this sector, (3) upcoming compliance deadlines and effective dates, (4) guidance documents or safe harbor updates from relevant regulators, (5) industry-specific standards updates (ISO, NIST, SOC 2, etc.). Focus on requirements that would affect a business described as: ${businessDescription.substring(0, 200)}`,
        );
      } catch {
        regulatoryIntel = "";
      }

      // Step 2: Gap analysis and compliance roadmap
      const systemPrompt = `You are a regulatory compliance attorney and compliance officer with expertise across multiple industries and jurisdictions. You have 20+ years of experience advising companies on compliance program design, gap remediation, and regulatory examination preparation.

Your compliance expertise covers:
- US federal and state regulations (SEC, FTC, FDA, HIPAA, CCPA, SOX, FCPA)
- EU regulations (GDPR, AI Act, NIS2, DORA, CSRD)
- Industry-specific frameworks (PCI-DSS, SOC 2, ISO 27001, NIST CSF)
- Financial services (AML/KYC, Basel III, MiFID II, Dodd-Frank)
- Healthcare (HIPAA, CMS, FDA 21 CFR Part 11)

Compliance scoring: 0-100 (0=fully non-compliant, 100=fully compliant).
Risk levels: CRITICAL / HIGH / MEDIUM / LOW.
Always note when regulations are jurisdiction-specific or industry-specific.
Output ONLY valid JSON.`;

      const userPrompt = `Perform a compliance gap analysis for the following business.

INDUSTRY: ${industry}
JURISDICTION: ${jurisdiction}
BUSINESS DESCRIPTION: ${businessDescription}
${recentChanges ? `RECENT REGULATORY CHANGES NOTED:\n${recentChanges}` : ""}

LIVE REGULATORY INTELLIGENCE:
${regulatoryIntel || "Live regulatory intelligence unavailable — perform analysis based on established compliance frameworks for this industry/jurisdiction. Flag all assessments as FRAMEWORK-BASED."}

Generate a comprehensive compliance monitoring report. Return ONLY valid JSON:
{
  "complianceScore": 0,
  "riskLevel": "CRITICAL|HIGH|MEDIUM|LOW",
  "executiveSummary": "...",
  "applicableRegulations": [
    {
      "regulation": "...",
      "regulator": "...",
      "applicabilityRationale": "...",
      "effectiveDate": "..."
    }
  ],
  "gaps": [
    {
      "area": "...",
      "regulation": "...",
      "currentState": "...",
      "requiredState": "...",
      "riskLevel": "CRITICAL|HIGH|MEDIUM|LOW",
      "potentialPenalty": "...",
      "remediationComplexity": "high|medium|low"
    }
  ],
  "deadlines": [
    {
      "requirement": "...",
      "deadline": "...",
      "regulation": "...",
      "consequence": "...",
      "daysRemaining": "..."
    }
  ],
  "actionItems": [
    {
      "action": "...",
      "category": "policy|technical|training|audit|legal",
      "priority": "immediate|urgent|planned|ongoing",
      "effort": "...",
      "owner": "legal|it|hr|finance|operations",
      "rationale": "..."
    }
  ],
  "positiveFindings": [],
  "monitoringRecommendations": [
    {
      "area": "...",
      "frequency": "daily|weekly|monthly|quarterly|annually",
      "method": "..."
    }
  ],
  "researchGrounded": ${regulatoryIntel.length > 100}
}`;

      const result = await nimChat(
        "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { maxTokens: 4500, temperature: 0.25 },
      );

      let parsed;
      try {
        const cleaned = result
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error("Model returned non-JSON compliance monitoring output");
      }

      if (parsed.complianceScore === undefined || !parsed.gaps) {
        throw new Error(
          "Incomplete compliance analysis — business description may be too vague",
        );
      }

      const criticalGaps = (parsed.gaps || []).filter(
        (g: { riskLevel: string }) => g.riskLevel === "CRITICAL",
      ).length;

      const urgentDeadlines = (parsed.deadlines || []).filter(
        (d: { daysRemaining: string }) => {
          const days = parseInt(d.daysRemaining || "999", 10);
          return days <= 30;
        },
      ).length;

      return {
        success: true,
        complianceScore: parsed.complianceScore,
        riskLevel: parsed.riskLevel,
        executiveSummary: parsed.executiveSummary || "",
        applicableRegulations: parsed.applicableRegulations || [],
        gaps: parsed.gaps || [],
        deadlines: parsed.deadlines || [],
        actionItems: parsed.actionItems || [],
        positiveFindings: parsed.positiveFindings || [],
        monitoringRecommendations: parsed.monitoringRecommendations || [],
        summary: {
          totalGaps: (parsed.gaps || []).length,
          criticalGaps,
          urgentDeadlines,
          totalActionItems: (parsed.actionItems || []).length,
        },
        researchGrounded: regulatoryIntel.length > 100,
        industry,
        jurisdiction,
      };
    },
    { label: "compliance-monitor", maxRetries: 1, inputSchema: INPUT_SCHEMA },
  ),
});
