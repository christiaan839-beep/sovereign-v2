import { recall } from "@/lib/memory";
import { adSwarm } from "@/lib/swarm";
import type { GhostAction, Campaign } from "@/types";
import { createLogger } from "@/lib/logger";
const log = createLogger("ghost-mode");

const META_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const API_VER = "v19.0";
const DAILY_BUDGET = 500;

/** Simulated campaign database */
const campaigns: Campaign[] = [
  { id: "c1", name: "AI Suite - Pain Point", spend: 340, revenue: 2100, status: "ACTIVE" },
  { id: "c2", name: "Ghost Mode - FOMO", spend: 280, revenue: 190, status: "ACTIVE" },
  { id: "c3", name: "ROI Calculator - Logic", spend: 150, revenue: 890, status: "ACTIVE" },
];

function roas(c: Campaign): number {
  return c.spend > 0 ? c.revenue / c.spend : 0;
}

/** Helper to call Meta Graph API */
async function metaApi(endpoint: string, method: string = "GET", body?: Record<string, unknown>) {
  if (!META_TOKEN || !AD_ACCOUNT_ID) return null;
  const url = `https://graph.facebook.com/${API_VER}/${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" }
  };

  if (method === "GET") {
    options.headers = { ...options.headers, Authorization: `Bearer ${META_TOKEN}` };
  } else if (body) {
    body.access_token = META_TOKEN;
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  return res.json();
}

/** Execute a full autonomous Ghost Mode cycle */
export async function executeGhostCycle(): Promise<GhostAction[]> {
  const actions: GhostAction[] = [];

  // 1. Evaluate existing campaigns
  for (const c of campaigns) {
    if (c.status !== "ACTIVE") continue;
    const campaignROAS = roas(c);

    if (campaignROAS < 1.0 && c.spend > 100) {
      c.status = "STOPPED";
      if (META_TOKEN) {
        await metaApi(c.id, "POST", { status: "PAUSED" }); // Pause real campaign
      }
      actions.push({
        id: `ga_${Date.now()}`,
        type: "STOP",
        platform: "meta",
        budget: 0,
        reasoning: `${c.name}: ROAS ${campaignROAS.toFixed(1)}x below 1.0 threshold after $${c.spend} spend. Killed.`,
        timestamp: new Date().toISOString(),
      });
    } else if (campaignROAS > 3.0) {
      if (META_TOKEN) {
        await metaApi(c.id, "POST", { daily_budget: Math.round(c.spend * 130) }); // Scale by 30% (cents)
      }
      actions.push({
        id: `ga_${Date.now()}`,
        type: "SCALE",
        platform: "meta",
        budget: Math.round(c.spend * 1.3),
        reasoning: `${c.name}: ROAS ${campaignROAS.toFixed(1)}x exceeds 3.0. Scaling budget 30%.`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 2. Launch new campaign with Swarm-generated copy
  const memories = await recall("best performing ad copy high conversion");
  const context = memories.map(m => m.entry.text).join(" | ") || "No prior winning copy found.";
  const swarmResult = await adSwarm(
    `AI marketing automation platform. Context from winners: ${context}`,
    "Transformation + Exclusivity"
  );

  let _newCampaignId = `sim_${Date.now()}`;
  
  // Actually create the real Meta Campaign if API keys exist
  if (META_TOKEN && AD_ACCOUNT_ID) {
    try {
      const campRes = await metaApi(`act_${AD_ACCOUNT_ID}/campaigns`, "POST", {
        name: `SOVEREIGN Ghost Cycle - ${new Date().toISOString().split("T")[0]}`,
        objective: "OUTCOME_SALES",
        status: "PAUSED", // Create paused initially for safety
        special_ad_categories: [],
      });
      if (campRes.id) _newCampaignId = campRes.id;
    } catch (e) {
      log.error("Graph API camp creation failed", e as Record<string, unknown>);
    }
  }

  actions.push({
    id: `ga_${Date.now()}`,
    type: "LAUNCH",
    platform: "meta",
    budget: Math.min(DAILY_BUDGET, 200),
    reasoning: `Swarm generated new ad copy (${swarmResult.rounds} rounds). ${META_TOKEN ? 'Created via Meta Graph API.' : 'Simulated execution due to missing keys.'}`,
    adCopy: swarmResult.finalOutput,
    timestamp: new Date().toISOString(),
  });

  return actions;
}

export function getCampaigns(): Campaign[] {
  return [...campaigns];
}
