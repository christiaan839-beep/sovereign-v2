/**
 * SOVEREIGN MATRIX — Single Source of Truth
 *
 * Every page, section, meta tag, and FAQ answer MUST reference these constants.
 * When a number changes, change it here once — it propagates everywhere.
 */

export const PLATFORM = {
  name: "Sovereign Matrix",
  tagline: "Your AI workforce.",
  url: "https://sovereignmatrix.agency",
  email: "hello@sovereignmatrix.agency",
  location: "Cape Town, South Africa",
  year: 2026,
} as const;

export const METRICS = {
  agentCount: 132,
  modelCount: "51+",
  perTokenCost: "$0",
  avgLatency: "<200ms",
  safetyLayers: 5,
  nimModelCount: 26,
  agentEndpoints: 118,
} as const;

export const MODELS = {
  nemotronUltra: "Nemotron Ultra 253B",
  claude: "Claude MCP",
  gemini: "Gemini 2.5 Pro",
  deepseekV3: "DeepSeek V3.2",
  deepseekR1: "DeepSeek R1",
  flux: "FLUX.2",
  nemoClaw: "NemoClaw",
  kimiK25: "Kimi K2.5",
  cosmosVLM: "Cosmos VLM",
  nemoGuardrails: "NeMo Guardrails",
} as const;

export const PRICING = {
  currency: "ZAR",
  node: { name: "Sovereign Node", price: "R9,997", priceUsd: "~$550", period: "/mo" },
  array: { name: "Sovereign Array", price: "R24,997", priceUsd: "~$1,375", period: "/mo" },
  enterprise: { name: "Enterprise License", price: "R49,997", priceUsd: "~$2,750", period: "/mo" },
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
