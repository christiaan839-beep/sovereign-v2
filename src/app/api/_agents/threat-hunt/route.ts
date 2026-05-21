import { createAgentRoute } from "@/lib/agent-factory";
import { research_ai } from "@/lib/ai";
import { nimChat } from "@/lib/nvidia";
import { withSelfHeal } from "@/lib/self-heal";
import { z } from "zod";

/**
 * THREAT-HUNT AGENT — Proactive cybersecurity threat hunting and hypothesis generation.
 *
 * Uses live research to pull the latest CVEs, threat actor TTPs (MITRE ATT&CK),
 * and active threat campaigns relevant to the described environment, then uses
 * NVIDIA Nemotron Ultra to generate structured hunt hypotheses, IOC lists, and
 * a prioritized remediation roadmap for the security team.
 *
 * Input:  { systemDescription: string, recentEvents?: string, assetTypes?: string }
 * Output: { threatLevel, huntHypotheses, iocList, remediationSteps, prioritizedActions }
 */

const INPUT_SCHEMA = z
  .object({
    systemDescription: z.string().min(10).max(3000),
    recentEvents: z.string().max(2000).optional(),
    assetTypes: z.string().max(1000).optional(),
    prompt: z.string().max(5000).optional(),
  })
  .passthrough();

export const POST = createAgentRoute({
  name: "threat-hunt",
  requiredFields: ["systemDescription"],
  // Wave-111.1 batch 6: memory hooks. Prior hunts on similar
  // assetTypes + systemDescription compound — surface recurring
  // attacker TTPs, track which hunt hypotheses panned out, prevent
  // re-investigating closed leads.
  memory: {
    search: {
      query: (input) =>
        `threat-hunt assets:${input.assetTypes ?? ""} system:${String(input.systemDescription ?? "").slice(0, 200)}`,
      limit: 3,
    },
    store: {
      extract: (result) => {
        const r = result as {
          threatLevel?: string;
          huntHypotheses?: Array<{ hypothesis?: string }>;
          prioritizedActions?: string[];
        };
        const hyps = (r.huntHypotheses ?? [])
          .slice(0, 2)
          .map((h) => h.hypothesis)
          .filter(Boolean)
          .join(" | ");
        const actions = (r.prioritizedActions ?? []).slice(0, 2).join("; ");
        if (!hyps && !actions) return null;
        return `Level: ${r.threatLevel ?? "?"}. Hyps: ${hyps}. Actions: ${actions}`;
      },
      metadata: (input) => ({
        assetTypes: String(input.assetTypes ?? ""),
        kind: "threat-hunt",
      }),
    },
  },
  handler: withSelfHeal(
    async ({ input, pastContextAsPrompt }) => {
      const systemDescription = input.systemDescription as string;
      const recentEvents = (input.recentEvents as string) || "";
      const assetTypes = (input.assetTypes as string) || "";
      const pastHunts = pastContextAsPrompt();

      // Step 1: Fetch latest CVEs and active threat campaigns
      let threatIntel = "";
      try {
        threatIntel = await research_ai(
          `cybersecurity CVE vulnerabilities threat actors 2026 active campaigns MITRE ATT&CK`,
          `Find current cybersecurity threat intelligence relevant to this environment: "${systemDescription}". Include: (1) recently disclosed CVEs (last 30 days) affecting similar technology stacks, (2) active threat actor campaigns and their TTPs, (3) indicators of compromise (IOCs) from recent incidents, (4) CISA Known Exploited Vulnerabilities catalog updates, (5) ransomware group activity targeting this sector. Focus on actionable, current intelligence.`,
        );
      } catch {
        threatIntel = "";
      }

      // Step 2: Generate hunt hypotheses and remediation plan
      const systemPrompt = `You are a senior threat intelligence analyst and red team operator with expertise in MITRE ATT&CK framework, incident response, and proactive threat hunting. You hold OSCP, CISSP, and GIAC certifications and have 15+ years of experience in adversary emulation and defensive security operations.

Your threat hunting methodology:
- Hypothesis-driven hunting using MITRE ATT&CK
- Crown jewel analysis and lateral movement path modeling
- Behavioral analytics and anomaly-based detection
- IOC/TTP correlation across kill chain phases
- Risk-based prioritization using CVSS scores and exploitability

Output ONLY valid JSON. Threat levels: CRITICAL / HIGH / MEDIUM / LOW / MINIMAL.
Never fabricate specific CVE numbers — use real CVEs from threat intel or mark as GENERIC-PATTERN.`;

      const userPrompt = `Perform a threat hunt assessment for the following environment.

SYSTEM DESCRIPTION: ${systemDescription}
${assetTypes ? `ASSET TYPES: ${assetTypes}` : ""}
${recentEvents ? `RECENT SECURITY EVENTS:\n${recentEvents}` : ""}
${pastHunts ? `\nPRIOR HUNT RESULTS on similar environments (historical FACTS — surface recurring TTPs, do NOT re-investigate closed leads):\n${pastHunts}\n` : ""}

LIVE THREAT INTELLIGENCE:
${threatIntel || "Live threat intelligence unavailable — generate hypotheses based on known attack patterns for this environment type. Flag all hypotheses as PATTERN-BASED."}

Generate a comprehensive threat hunting report. Return ONLY valid JSON:
{
  "threatLevel": "CRITICAL|HIGH|MEDIUM|LOW|MINIMAL",
  "threatLevelRationale": "...",
  "activeThreats": [
    {
      "name": "...",
      "type": "ransomware|apt|insider|supply-chain|opportunistic",
      "mitreTactics": [],
      "relevanceToEnvironment": "..."
    }
  ],
  "huntHypotheses": [
    {
      "id": "H-001",
      "hypothesis": "...",
      "mitreAttackTechnique": "...",
      "huntQuery": "...",
      "evidenceSources": [],
      "priority": "critical|high|medium|low"
    }
  ],
  "iocList": {
    "ipAddresses": [],
    "domains": [],
    "fileHashes": [],
    "registryKeys": [],
    "networkSignatures": [],
    "note": "Verify all IOCs against current threat feeds before blocking"
  },
  "vulnerabilities": [
    {
      "cve": "...",
      "cvssScore": 0.0,
      "affectedComponent": "...",
      "exploitabilityInWild": true,
      "patchAvailable": true,
      "remediationPriority": "immediate|urgent|planned"
    }
  ],
  "remediationSteps": [
    {
      "step": "...",
      "category": "patch|config|detection|access-control|backup",
      "effort": "hours|days|weeks",
      "impact": "critical|high|medium|low"
    }
  ],
  "prioritizedActions": [
    {
      "action": "...",
      "timeframe": "now|24h|72h|1-week|1-month",
      "owner": "soc|it|management|vendor",
      "rationale": "..."
    }
  ],
  "detectionCoverage": {
    "estimatedCoveragePercent": 0,
    "gaps": [],
    "recommendedTools": []
  },
  "researchGrounded": ${threatIntel.length > 100}
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
        throw new Error("Model returned non-JSON threat hunt output");
      }

      if (!parsed.threatLevel || !parsed.huntHypotheses) {
        throw new Error(
          "Incomplete threat hunt output — system description may be too vague",
        );
      }

      return {
        success: true,
        threatLevel: parsed.threatLevel,
        threatLevelRationale: parsed.threatLevelRationale || "",
        activeThreats: parsed.activeThreats || [],
        huntHypotheses: parsed.huntHypotheses || [],
        iocList: parsed.iocList || {},
        vulnerabilities: parsed.vulnerabilities || [],
        remediationSteps: parsed.remediationSteps || [],
        prioritizedActions: parsed.prioritizedActions || [],
        detectionCoverage: parsed.detectionCoverage || {},
        researchGrounded: threatIntel.length > 100,
        hypothesisCount: (parsed.huntHypotheses || []).length,
      };
    },
    { label: "threat-hunt", maxRetries: 1, inputSchema: INPUT_SCHEMA },
  ),
});
