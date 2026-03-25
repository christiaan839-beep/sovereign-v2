import { NextResponse } from "next/server";

/**
 * USAGE-BASED BILLING — Calculates per-agent-call charges.
 * Tracks consumption and generates invoices.
 * 
 * Pricing per call (ZAR):
 * - Translate: R0.50
 * - PII Redactor: R1.00
 * - Blog Gen: R5.00
 * - Swarm: R10.00
 * - Collab Room: R15.00
 * - Case Study: R5.00
 * - Page Builder: R3.00
 * - Image Gen: R2.00
 * - Voice Synth: R1.50
 * - Voicechat: R2.00
 * - Benchmark: R3.00
 * - Other: R0.50
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

export async function POST(request: Request) {
  try {
    const { action, clientId, agent } = await request.json();

    if (action === "record") {
      if (!clientId || !agent) {
        return NextResponse.json({ error: "clientId and agent required." }, { status: 400 });
      }

      const cost = AGENT_PRICING[agent] || 0.50;
      const record: UsageRecord = {
        clientId,
        agent,
        cost,
        timestamp: new Date().toISOString(),
      };

      const existing = BILLING_STORE.get(clientId) || [];
      existing.push(record);
      BILLING_STORE.set(clientId, existing);

      return NextResponse.json({ success: true, recorded: record, total_usage: existing.length });
    }

    if (action === "invoice") {
      if (!clientId) {
        return NextResponse.json({ error: "clientId required." }, { status: 400 });
      }

      const records = BILLING_STORE.get(clientId) || [];
      const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

      // Group by agent
      const byAgent: Record<string, { calls: number; cost: number }> = {};
      for (const r of records) {
        if (!byAgent[r.agent]) byAgent[r.agent] = { calls: 0, cost: 0 };
        byAgent[r.agent].calls += 1;
        byAgent[r.agent].cost += r.cost;
      }

      return NextResponse.json({
        success: true,
        invoice: {
          clientId,
          period: `${records[0]?.timestamp?.substring(0, 10) || "N/A"} → ${records[records.length - 1]?.timestamp?.substring(0, 10) || "N/A"}`,
          total_calls: records.length,
          total_cost_zar: totalCost,
          breakdown: Object.entries(byAgent).map(([agent, data]) => ({
            agent,
            calls: data.calls,
            unit_price: AGENT_PRICING[agent] || 0.50,
            total: data.cost,
          })).sort((a, b) => b.total - a.total),
        },
      });
    }

    return NextResponse.json({ error: "action must be 'record' or 'invoice'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Billing error", details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  const allClients: Array<{ clientId: string; calls: number; spend: number }> = [];
  for (const [clientId, records] of BILLING_STORE.entries()) {
    allClients.push({
      clientId,
      calls: records.length,
      spend: records.reduce((s, r) => s + r.cost, 0),
    });
  }

  return NextResponse.json({
    status: "Usage Billing — Active",
    pricing: AGENT_PRICING,
    clients: allClients.sort((a, b) => b.spend - a.spend),
    total_revenue: allClients.reduce((s, c) => s + c.spend, 0),
  });
}
