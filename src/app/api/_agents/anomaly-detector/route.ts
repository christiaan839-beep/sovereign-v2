import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * ANOMALY-DETECTOR — Time-series / metric batch → anomaly report with hypotheses.
 *
 * Takes a time-series of observations (or a NL description) and returns
 * anomalies with expected ranges, severity, and hypothesis lists plus
 * concrete investigation steps.
 *
 * Input:
 *   metric: Array<{ timestamp, value }> | string  (required)
 *   metricName: string  (required)
 *   expectedPattern?: "steady" | "seasonal" | "trending-up" | "trending-down" | "unknown"
 *
 * Output (JSON):
 *   {
 *     anomalies: [{ timestamp, value, expectedRange, severity, hypotheses }],
 *     overallHealth: "healthy" | "warning" | "critical",
 *     investigationSteps: string[]
 *   }
 *
 * Pairs with:
 *   - `incident-commander` — downstream when severity = critical
 */

const ANOMALY_SYSTEM_PROMPT = `You are a senior data analyst / reliability engineer who writes anomaly reports that on-call engineers can actually act on.

${ANTI_SLOP_RULES}

## DETECTION RULES
1. Default threshold: observations > 3σ from the rolling mean qualify as anomalies. Adjust the window and σ multiplier if the expected pattern is seasonal or trending.
2. For seasonal patterns, detrend first (compare same-hour-of-day or same-day-of-week). Do not flag seasonal peaks as anomalies.
3. For trending-up / trending-down, evaluate residuals against the trend line, not the raw value.
4. expectedRange = [lower, upper] at the time of each flagged anomaly, computed from the chosen baseline.
5. Severity: critical = > 5σ or sustained breach, notable = 3-5σ, minor = borderline.

## HYPOTHESIS RULES
- NEVER claim causation. Every anomaly gets a LIST of hypotheses ("possible causes"), never one definitive explanation.
- Hypotheses should span technical (deploy, config change, dependency), business (campaign, pricing change), and external (seasonality miss, upstream provider) lenses.

## INVESTIGATION STEPS
- Every step must be ACTIONABLE and specific: "Query X table for Y between T1 and T2", "Check dashboard Z for dependency W", "Interview team A about change at time T".
- No vague steps like "look into it" or "check the data".

## OUTPUT RULES
- overallHealth: healthy = no notable+ anomalies, warning = ≥1 notable, critical = ≥1 critical anomaly OR sustained breach.
- Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "anomaly-detector",
  requiredFields: ["metric", "metricName"],
  handler: async ({ input }) => {
    const { metric, metricName, expectedPattern = "unknown" } = input as {
      metric: Array<{ timestamp: string; value: number }> | string;
      metricName: string;
      expectedPattern?: "steady" | "seasonal" | "trending-up" | "trending-down" | "unknown";
    };

    const metricPayload =
      typeof metric === "string"
        ? metric.slice(0, 20_000)
        : JSON.stringify(metric.slice(0, 1000), null, 2);

    const prompt = `Analyze this metric for anomalies. Return ONLY valid JSON matching the schema.

METRIC NAME: ${metricName}
EXPECTED PATTERN: ${expectedPattern}

DATA:
"""
${metricPayload}
"""

SCHEMA:
{
  "anomalies": [
    {
      "timestamp": string,
      "value": number,
      "expectedRange": [ number, number ],
      "severity": "critical" | "notable" | "minor",
      "hypotheses": [ string ]
    }
  ],
  "overallHealth": "healthy" | "warning" | "critical",
  "investigationSteps": [ string ]
}`;

    const response = await ai(prompt, {
      system: ANOMALY_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Anomaly detection failed: model returned non-JSON output");
    }

    return { success: true, report: parsed };
  },
});
