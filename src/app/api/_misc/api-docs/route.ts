import { NextResponse } from "next/server";
import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { PLAYBOOKS } from "@/lib/playbooks";
import { PLANS } from "@/lib/plans";
import { getAvailableConnectors } from "@/lib/integrations/connector";

/**
 * AUTO-GENERATED API DOCUMENTATION — /api/_misc/api-docs
 *
 * Returns the full OpenAPI-style capability manifest.
 * Always in sync with the actual agent registry, playbooks, and plans.
 */

export async function GET() {
  const agentNames = Object.keys(AGENT_REGISTRY).sort();
  const playbookIds = Object.keys(PLAYBOOKS).sort();
  const connectors = getAvailableConnectors();

  return NextResponse.json({
    openapi: "3.0.0",
    info: {
      title: "Sovereign Matrix API",
      version: "2.0.0",
      description: "Multi-agent AI platform with 129 agents, 29 playbooks, and 15 integration connectors.",
    },
    servers: [
      { url: "https://sovereignmatrix.agency", description: "Production" },
    ],
    stats: {
      agents: agentNames.length,
      playbooks: playbookIds.length,
      integrations: connectors.length,
      plans: Object.keys(PLANS).length,
    },
    agents: {
      description: "All available agents. Call via POST /api/agents/{name} or POST /api/v1/agents/{name} (with API key).",
      count: agentNames.length,
      names: agentNames,
      authentication: "Bearer token via Authorization header (Clerk session or API key)",
      example: {
        endpoint: "POST /api/agents/leads",
        body: { niche: "SaaS", location: "Austin, TX" },
        headers: { "Content-Type": "application/json", "Authorization": "Bearer sk_your_key" },
      },
    },
    playbooks: {
      description: "Multi-agent workflows. Execute via POST /api/agents/coordinator with playbook_id.",
      count: playbookIds.length,
      ids: playbookIds,
      example: {
        endpoint: "POST /api/agents/coordinator",
        body: { playbook_id: "lead-blitz", niche: "Real Estate", location: "London", auto_execute: true },
      },
      details: Object.fromEntries(
        Object.entries(PLAYBOOKS).map(([id, pb]) => [
          id,
          {
            name: pb.name,
            description: pb.description,
            category: pb.category,
            steps: pb.steps.map((s) => ({ agent: s.agent, reason: s.reason })),
            fields: pb.fields,
          },
        ])
      ),
    },
    integrations: {
      description: "External service connectors. Execute via POST /api/_integrations/execute.",
      count: connectors.length,
      available: connectors,
      example: {
        endpoint: "POST /api/_integrations/execute",
        body: { integrationId: "hubspot", actionId: "list-contacts", params: { limit: 10 } },
      },
    },
    plans: {
      description: "Available pricing tiers.",
      tiers: Object.fromEntries(
        Object.entries(PLANS).map(([id, plan]) => [
          id,
          {
            name: plan.name,
            priceUsd: plan.priceDisplayUsd,
            runsPerMonth: plan.runsPerMonth,
            apiRatePerDay: plan.apiRatePerDay,
            purchasable: plan.purchasable,
          },
        ])
      ),
    },
    endpoints: {
      agents: "POST /api/agents/{name}",
      agentsV1: "POST /api/v1/agents/{name} (API key auth)",
      coordinator: "POST /api/agents/coordinator",
      streaming: "POST /api/ai/stream",
      integrations: "POST /api/_integrations/execute",
      health: "GET /api/health",
      usage: "GET /api/_misc/usage",
      marketplace: "GET /api/_misc/marketplace",
      docs: "GET /api/_misc/api-docs (this endpoint)",
    },
  });
}
