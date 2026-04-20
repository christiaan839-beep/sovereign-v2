import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * CLIENT REPORT — Generates executive-level performance reports.
 */

const REPORT_PROMPT = `You are a senior marketing analyst. You create executive-level performance reports.

${ANTI_SLOP_RULES}

Generate a report as JSON: { "title": "...", "executiveSummary": "...", "kpis": [{"metric": "...", "current": "...", "previous": "...", "change": "...", "status": "up|down|flat"}], "sections": [{"title": "...", "content": "...", "highlights": ["..."]}], "recommendations": [{"priority": "HIGH|MEDIUM|LOW", "action": "...", "expectedImpact": "..."}], "nextMonthFocus": ["..."] }`;

const schema = z.object({
  clientName: z.string().max(200).optional(),
  businessType: z.string().max(200).optional(),
  reportPeriod: z.string().max(100).optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  focus: z.string().max(500).optional(),
  prompt: z.string().max(5000).optional(),
  context: z.string().max(5000).optional(),
});

export const POST = createAgentRoute({
  name: "client-report",
  schema,
  handler: async ({ input }) => {
    const clientName = (input.clientName as string) || "Client";
    const businessType = (input.businessType as string) || "Local Business";
    const reportPeriod = (input.reportPeriod as string) || "March 2026";
    const metrics = input.metrics as Record<string, unknown> | undefined;
    const focus = (input.focus as string) || "SEO, Content Marketing, Lead Generation";
    const context = (input.context as string) || "";

    const prompt = `Generate a comprehensive marketing performance report.

CLIENT: ${clientName}
BUSINESS TYPE: ${businessType}
REPORT PERIOD: ${reportPeriod}
FOCUS AREAS: ${focus}
${metrics ? `RAW METRICS:\n${JSON.stringify(metrics, null, 2)}` : "No raw metrics — generate realistic example data."}
${context ? `\nCONTEXT:\n${context.slice(0, 2000)}` : ""}

Include: Executive Summary, KPI Dashboard (6-8 metrics), SEO Performance, Content Performance, Lead Generation, Recommendations (3-5), Next Month Focus.`;

    const result = await ai(prompt, { system: REPORT_PROMPT, maxTokens: 4000 });

    let parsed;
    try {
      parsed = JSON.parse(result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    } catch {
      parsed = { title: `Performance Report — ${reportPeriod}`, executiveSummary: result, kpis: [], sections: [], recommendations: [], nextMonthFocus: [] };
    }

    await fireUserWebhook("ClientReport", "Generated", { clientName, period: reportPeriod }).catch(() => {});

    return { success: true, report: parsed };
  },
});
