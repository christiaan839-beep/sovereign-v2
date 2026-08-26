/**
 * SOVEREIGN MATRIX — Single Source of Truth
 *
 * Every page, section, meta tag, and FAQ answer MUST reference these constants.
 * When a number changes, change it here once — it propagates everywhere.
 *
 * agentCount used to be a hand-typed 130 that nothing read, so ~40 pages
 * hard-coded their own figure and drifted to 124/126/129/130/131/135/145
 * while the platform actually shipped 140. It is now derived from the
 * generated slug list, which `npm run gen:registry -- --check` verifies
 * against the routes on disk — so the number cannot be wrong without CI
 * failing first. AGENT_SLUGS is a frozen string array with no imports of
 * its own, safe in client and edge bundles alike.
 */
import { AGENT_SLUGS } from "@/lib/agent-slugs";

export const PLATFORM = {
  name: "Sovereign Matrix",
  tagline: "Your AI workforce.",
  url: "https://sovereignmatrix.agency",
  email: "hello@sovereignmatrix.agency",
  location: "Cape Town, South Africa",
  year: 2026,
} as const;

export const METRICS = {
  agentCount: AGENT_SLUGS.length,
  modelCount: "39+",
  perTokenCost: "$0",
  avgLatency: "<200ms",
  safetyLayers: 5,
  nimModelCount: 26,
  agentEndpoints: AGENT_SLUGS.length,
} as const;

export const MODELS = {
  nemotronUltra: "Nemotron Ultra 253B",
  claude: "Claude MCP",
  gemini: "Gemini 2.5 Pro",
  deepseekV3: "DeepSeek V3.2",
  deepseekR1: "DeepSeek R1",
  flux: "FLUX.1 Pro",
  nemoClaw: "NemoClaw",
  kimiK25: "Kimi K2.5",
  cosmosVLM: "Cosmos VLM",
  nemoGuardrails: "NeMo Guardrails",
} as const;

export const PRICING = {
  currency: "USD",
  starter: { name: "Starter", price: "$19", period: "/mo" },
  growth: { name: "Growth", price: "$49", period: "/mo" },
  node: { name: "Sovereign Node", price: "$199", period: "/mo" },
  enterprise: { name: "Enterprise License", price: "$499", period: "/mo" },
} as const;

export const LINKS = {
  getStarted: "/onboarding",
  dashboard: "/dashboard",
  showcase: "/showcase",
  docs: "/docs",
  pricing: "#pricing",
  caseStudies: "/case-studies",
} as const;

export const NAMING = {
  nemoClaw: "NemoClaw",
  whiteLabel: "White-label",
} as const;

export const META = {
  title: `${PLATFORM.name} — Your AI Workforce`,
  description: `${METRICS.agentCount} autonomous agents that find leads, write content, build pages, make calls, and close deals. ${METRICS.modelCount} open-source models. ${METRICS.perTokenCost} per-token cost. Built on NVIDIA NIM.`,
  ogDescription: `${METRICS.agentCount} autonomous AI agents. ${METRICS.modelCount} open-source models. ${METRICS.perTokenCost} per token. ${NAMING.whiteLabel} ready. Your competitors hire. You deploy.`,
} as const;
