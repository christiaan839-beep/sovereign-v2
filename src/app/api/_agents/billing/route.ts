import { NextResponse } from "next/server";
import { createAgentRoute } from "@/lib/agent-factory";

/**
 * USAGE-BASED BILLING — Calculates per-agent-call charges.
 * Tracks consumption and generates invoices.
 * POST wrapped in security factory for auth + safety pipeline.
 */

interface UsageRecord {
  clientId: string;
  agent: string;
  cost: number;
  timestamp: string;
}

const BILLING_STORE = new Map<string, UsageRecord[]>();

const AGENT_PRICING: Record<string, number> = {
  "translate": 0.50,
  "pii-redactor": 1.00,
  "gliner-pii": 1.50,
  "blog-gen": 5.00,
  "swarm": 10.00,
  "collab-room": 15.00,
  "case-study": 5.00,
  "page-builder": 3.00,
  "image-gen": 2.00,
  "voice-synth": 1.50,
  "voicechat": 2.00,
  "cosmos-video": 5.00,
  "benchmark": 3.00,
  "florence-ocr": 1.00,
  "doc-intel": 2.00,
  "abm-artillery": 3.00,
};

export const POST = createAgentRoute({
  name: "billing",
  requiredFields: ["action"],
  skipJailbreakCheck: true,   // Billing data, not user prompts
  skipSafetyCheck: true,
  skipQualityCheck: true,
  handler: async ({ input }) => {
    const action = input.action as string;
    const clientId = input.clientId as string;
    const agent = input.agent as string;

    if (action === "record") {
      if (!clientId || !agent) throw new Error("clientId and agent required");

      const cost = AGENT_PRICING[agent] || 0.50;
      const record: UsageRecord = { clientId, agent, cost, timestamp: new Date().toISOString() };

      const existing = BILLING_STORE.get(clientId) || [];
      existing.push(record);
      BILLING_STORE.set(clientId, existing);

      return { success: true, recorded: record, total_usage: existing.length };
    }

    if (action === "invoice") {
      if (!clientId) throw new Error("clientId required");

      const records = BILLING_STORE.get(clientId) || [];
      const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

      const byAgent: Record<string, { calls: number; cost: number }> = {};
      for (const r of records) {
        if (!byAgent[r.agent]) byAgent[r.agent] = { calls: 0, cost: 0 };
        byAgent[r.agent].calls += 1;
        byAgent[r.agent].cost += r.cost;
      }

      return {
        success: true,
        invoice: {
          clientId,
          period: `${records[0]?.timestamp?.substring(0, 10) || "N/A"} → ${records[records.length - 1]?.timestamp?.substring(0, 10) || "N/A"}`,
          total_calls: records.length,
          total_cost_zar: totalCost,
          breakdown: Object.entries(byAgent)
            .map(([agent, data]) => ({ agent, calls: data.calls, unit_price: AGENT_PRICING[agent] || 0.50, total: data.cost }))
            .sort((a, b) => b.total - a.total),
        },
      };
    }

    throw new Error("action must be 'record' or 'invoice'");
  },
});

export async function GET() {
  const allClients: Array<{ clientId: string; calls: number; spend: number }> = [];
  for (const [clientId, records] of BILLING_STORE.entries()) {
    allClients.push({ clientId, calls: records.length, spend: records.reduce((s, r) => s + r.cost, 0) });
  }

  return NextResponse.json({
    status: "Usage Billing — Active",
    pricing: AGENT_PRICING,
    clients: allClients.sort((a, b) => b.spend - a.spend),
    total_revenue: allClients.reduce((s, c) => s + c.spend, 0),
  });
}
