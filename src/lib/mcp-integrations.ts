import { createLogger } from "@/lib/logger";

const log = createLogger("mcp-integrations");

/**
 * MCP INTEGRATION LAYER — Connect agents to every tool the user has.
 *
 * Claude Managed Agents has Stripe, Notion, Figma built-in.
 * Sovereign has ALL of those + 20 more — AND multi-model routing.
 *
 * This module maps agent capabilities to MCP tool calls,
 * making every agent truly autonomous across external systems.
 *
 * Available MCPs:
 * - Slack: send messages, read channels, search
 * - Gmail: draft emails, search messages, read threads
 * - Google Calendar: create events, find free time
 * - Google Drive: search files, fetch documents
 * - Notion: create pages, search, update databases
 * - Figma: get designs, screenshots, design context
 * - Canva: generate designs, list themes
 * - Supabase: execute SQL, manage databases, deploy functions
 * - Vercel: deploy, check builds, manage projects
 * - Apollo: prospect leads, enrich contacts
 */

// ─── Integration Registry ───────────────────────────────────

export interface MCPIntegration {
  id: string;
  name: string;
  category: "communication" | "productivity" | "design" | "data" | "deployment" | "sales";
  description: string;
  capabilities: string[];
  isConnected: boolean; // Determined at runtime
}

export const MCP_INTEGRATIONS: MCPIntegration[] = [
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    description: "Send messages, read channels, search conversations",
    capabilities: ["send_message", "read_channel", "search", "create_canvas"],
    isConnected: false,
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "communication",
    description: "Draft emails, search inbox, read threads",
    capabilities: ["create_draft", "search_messages", "read_thread", "get_profile"],
    isConnected: false,
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "productivity",
    description: "Schedule meetings, find free time, manage events",
    capabilities: ["create_event", "find_free_time", "list_events", "update_event"],
    isConnected: false,
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "productivity",
    description: "Search files, fetch documents, manage storage",
    capabilities: ["search_files", "fetch_document"],
    isConnected: false,
  },
  {
    id: "notion",
    name: "Notion",
    category: "productivity",
    description: "Create pages, manage databases, search workspace",
    capabilities: ["create_page", "search", "update_page", "create_database"],
    isConnected: false,
  },
  {
    id: "figma",
    name: "Figma",
    category: "design",
    description: "Get design context, screenshots, component info",
    capabilities: ["get_design_context", "get_screenshot", "search_design_system"],
    isConnected: false,
  },
  {
    id: "canva",
    name: "Canva",
    category: "design",
    description: "Generate designs, presentations, social media graphics",
    capabilities: ["generate", "get_themes", "get_folders"],
    isConnected: false,
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "data",
    description: "Execute SQL, manage tables, deploy edge functions",
    capabilities: ["execute_sql", "list_tables", "deploy_edge_function", "create_project"],
    isConnected: false,
  },
  {
    id: "vercel",
    name: "Vercel",
    category: "deployment",
    description: "Deploy sites, check builds, manage domains",
    capabilities: ["deploy", "list_deployments", "get_build_logs", "check_domain"],
    isConnected: false,
  },
  {
    id: "apollo",
    name: "Apollo",
    category: "sales",
    description: "Find leads, enrich contacts, build prospect lists",
    capabilities: ["prospect", "enrich_lead", "sequence_load"],
    isConnected: false,
  },
];

// ─── Agent-to-Integration Mapping ───────────────────────────
// Which agents can use which integrations

export const AGENT_INTEGRATION_MAP: Record<string, string[]> = {
  // Sales agents
  "lead-hunter": ["apollo", "gmail", "google-calendar", "slack", "notion"],
  "email-sequencer": ["gmail", "google-calendar", "slack"],
  "voice-closer": ["google-calendar", "slack", "notion"],
  "lead-scorer": ["apollo", "notion"],

  // Content agents
  "blog-gen": ["notion", "google-drive", "slack"],
  "social-content": ["canva", "slack", "notion"],
  "email-writer": ["gmail", "notion"],

  // SEO agents
  "seo-dominator": ["google-drive", "notion", "slack"],
  "competitor-scan": ["notion", "slack"],

  // Design agents
  "page-builder": ["figma", "vercel", "canva"],
  "brand-voice": ["notion", "google-drive"],

  // Operations agents
  "workflow-engine": ["slack", "gmail", "google-calendar", "notion"],
  "report-gen": ["notion", "google-drive", "slack", "gmail"],

  // Code agents
  "code-agent": ["vercel", "supabase", "slack"],
  "deploy-agent": ["vercel", "supabase", "slack"],
};

// ─── Integration Health Check ───────────────────────────────

export function getIntegrationStatus(): {
  total: number;
  connected: number;
  integrations: MCPIntegration[];
} {
  // In production, this would check which MCPs are actually connected
  // by calling a health endpoint or checking MCP server availability
  return {
    total: MCP_INTEGRATIONS.length,
    connected: 0, // Updated when MCPs are detected
    integrations: MCP_INTEGRATIONS,
  };
}

// ─── Get Available Integrations for Agent ────────────────────

export function getAgentIntegrations(agentName: string): MCPIntegration[] {
  const integrationIds = AGENT_INTEGRATION_MAP[agentName] || [];
  return MCP_INTEGRATIONS.filter(i => integrationIds.includes(i.id));
}

// ─── Log Integration Usage ──────────────────────────────────

export function logIntegrationUse(params: {
  agentName: string;
  integrationId: string;
  action: string;
  success: boolean;
  durationMs: number;
}): void {
  log.info(`Integration: ${params.agentName} → ${params.integrationId}.${params.action} [${params.success ? "OK" : "FAIL"}] ${params.durationMs}ms`);
}
