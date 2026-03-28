import { db } from "@/db";
import { usage, generations, leads, globalTelemetry } from "@/db/schema";
import { sql, gte, lte, and, count, sum } from "drizzle-orm";
import { ai } from "@/lib/ai";

// ─── Types ──────────────────────────────────────────────────

export interface ReportOptions {
  type: "weekly" | "monthly";
  orgId?: string;
  dateRange?: { start: Date; end: Date };
}

export interface ReportOutput {
  title: string;
  summary: string;
  metrics: { label: string; value: string; change?: string }[];
  agentActivity: { agent: string; calls: number; avgTime: number }[];
  highlights: string[];
  generatedAt: Date;
}

// ─── Helpers ────────────────────────────────────────────────

function getDefaultDateRange(type: "weekly" | "monthly"): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (type === "weekly") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(start.getDate() - 30);
  }
  return { start, end };
}

// ─── Main Function ──────────────────────────────────────────

export async function generateReport(options: ReportOptions): Promise<ReportOutput> {
  const { type } = options;
  const { start, end } = options.dateRange ?? getDefaultDateRange(type);
  const periodLabel = type === "weekly" ? "Weekly" : "Monthly";

  // 1. Query usage stats (agent calls, tokens)
  const usageRows = await db
    .select({
      agentId: usage.agentId,
      callCount: count(),
      totalTokens: sum(usage.tokensUsed),
    })
    .from(usage)
    .where(and(gte(usage.createdAt, start), lte(usage.createdAt, end)))
    .groupBy(usage.agentId)
    .orderBy(sql`count(*) desc`)
    .limit(20);

  const totalAgentCalls = usageRows.reduce((acc, r) => acc + Number(r.callCount), 0);
  const totalTokens = usageRows.reduce((acc, r) => acc + Number(r.totalTokens || 0), 0);

  // 2. Query generations
  const genRows = await db
    .select({ total: count() })
    .from(generations)
    .where(and(gte(generations.createdAt, start), lte(generations.createdAt, end)));
  const totalGenerations = Number(genRows[0]?.total || 0);

  // 3. Query leads
  const leadRows = await db
    .select({ total: count() })
    .from(leads)
    .where(and(gte(leads.createdAt, start), lte(leads.createdAt, end)));
  const totalLeads = Number(leadRows[0]?.total || 0);

  // 4. Query telemetry events
  const telemetryRows = await db
    .select({ total: count() })
    .from(globalTelemetry)
    .where(and(gte(globalTelemetry.timestamp, start), lte(globalTelemetry.timestamp, end)));
  const totalEvents = Number(telemetryRows[0]?.total || 0);

  // 5. Calculate time saved (15 min avg per agent call)
  const timeSavedHours = Math.round((totalAgentCalls * 15) / 60);

  // 6. Build agent activity list
  const agentActivity = usageRows.map((r) => ({
    agent: r.agentId,
    calls: Number(r.callCount),
    avgTime: 0, // avg response time not stored in usage table
  }));

  // 7. Build raw data summary for AI
  const rawDataSummary = [
    `Period: ${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`,
    `Total agent calls: ${totalAgentCalls}`,
    `Total tokens consumed: ${totalTokens.toLocaleString()}`,
    `Content pieces generated: ${totalGenerations}`,
    `New leads captured: ${totalLeads}`,
    `Telemetry events logged: ${totalEvents}`,
    `Estimated time saved: ${timeSavedHours} hours`,
    `Top agent: ${usageRows[0]?.agentId || "N/A"} (${usageRows[0]?.callCount || 0} calls)`,
  ].join(". ");

  // 8. Generate AI executive summary
  let summary: string;
  try {
    summary = await ai(
      `You are a senior analytics consultant writing a ${periodLabel.toLowerCase()} executive report for a SaaS agency platform. Based on this data, write exactly 3 concise sentences summarizing performance, key wins, and one area of opportunity. Data: ${rawDataSummary}`,
      { model: "gemini", system: "You write concise, data-driven executive summaries. No fluff. Use specific numbers.", maxTokens: 300 }
    );
  } catch {
    summary = `This ${periodLabel.toLowerCase()} period saw ${totalAgentCalls} agent calls processing ${totalTokens.toLocaleString()} tokens, generating ${totalGenerations} content pieces and capturing ${totalLeads} leads. An estimated ${timeSavedHours} hours of manual work was automated. Continue optimizing top-performing agents for maximum ROI.`;
  }

  // 9. Build highlights
  const highlights: string[] = [];
  if (totalAgentCalls > 0) highlights.push(`${totalAgentCalls} agent calls executed — ${timeSavedHours}h of manual work automated`);
  if (totalGenerations > 0) highlights.push(`${totalGenerations} content pieces generated across all tools`);
  if (totalLeads > 0) highlights.push(`${totalLeads} new leads captured and added to pipeline`);
  if (highlights.length === 0) highlights.push("No significant activity recorded in this period");

  // 10. Build metrics array
  const metrics = [
    { label: "Agent Calls", value: totalAgentCalls.toLocaleString() },
    { label: "Tokens Used", value: totalTokens.toLocaleString() },
    { label: "Content Pieces", value: totalGenerations.toLocaleString() },
    { label: "Leads Generated", value: totalLeads.toLocaleString() },
    { label: "Time Saved", value: `${timeSavedHours}h` },
    { label: "Telemetry Events", value: totalEvents.toLocaleString() },
  ];

  return {
    title: `${periodLabel} Performance Report`,
    summary: summary.trim(),
    metrics,
    agentActivity,
    highlights,
    generatedAt: new Date(),
  };
}
