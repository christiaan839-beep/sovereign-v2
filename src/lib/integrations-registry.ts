/**
 * SOVEREIGN MATRIX — Integrations Registry
 *
 * Maps all available MCP-connected services to agent capabilities.
 * When a user connects a service (Gmail, Slack, Notion, Calendar, Canva),
 * the platform's agents can use that service natively.
 *
 * This is what makes Sovereign Matrix more powerful than Claude alone —
 * Claude can think, but Sovereign Matrix can think AND act across
 * your entire business stack.
 */

export interface Integration {
  id: string;
  name: string;
  icon: string;
  category: "communication" | "productivity" | "design" | "data" | "commerce";
  description: string;
  capabilities: string[];
  status: "connected" | "available" | "coming_soon";
  agentsThatUse: string[];
}

export const INTEGRATIONS: Integration[] = [
  // ── Communication ──
  {
    id: "gmail",
    name: "Gmail",
    icon: "Mail",
    category: "communication",
    description: "Send emails, read inbox, create drafts, search messages. Agents can send outreach, follow-ups, and reports via your Gmail.",
    capabilities: [
      "Send emails on your behalf",
      "Read and search inbox",
      "Create drafts for review",
      "Search message history",
    ],
    status: "connected",
    agentsThatUse: ["email-sequence", "outbound", "auto-onboard", "weekly-report", "client-report"],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "MessageSquare",
    category: "communication",
    description: "Send messages, search channels, read threads. Agents report results and alerts directly to your Slack workspace.",
    capabilities: [
      "Send messages to channels",
      "Search across channels",
      "Read thread context",
      "Schedule messages",
      "Create canvases",
    ],
    status: "connected",
    agentsThatUse: ["comms", "feedback", "weekly-report", "support-bot", "war-room"],
  },

  // ── Productivity ──
  {
    id: "notion",
    name: "Notion",
    icon: "FileText",
    category: "productivity",
    description: "Create pages, search databases, update content. Agents store research, reports, and documentation in your Notion workspace.",
    capabilities: [
      "Create and update pages",
      "Search across workspace",
      "Manage databases",
      "Add comments",
      "Organize in folders",
    ],
    status: "connected",
    agentsThatUse: ["doc-intel", "blog-gen", "case-study", "proposal-generator", "meeting-notes"],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: "Calendar",
    category: "productivity",
    description: "Create events, find free time, manage meetings. Voice agents and lead agents book meetings directly onto your calendar.",
    capabilities: [
      "Create and update events",
      "Find available meeting times",
      "Check free/busy status",
      "Send meeting invitations",
      "Manage RSVPs",
    ],
    status: "connected",
    agentsThatUse: ["booking", "calendar", "voice-closer", "meeting-notes", "meeting-transcriber"],
  },

  // ── Design ──
  {
    id: "canva",
    name: "Canva",
    icon: "Palette",
    category: "design",
    description: "Generate designs, create presentations, export assets. Content agents can produce branded visuals without manual design work.",
    capabilities: [
      "Generate designs from prompts",
      "Create presentations",
      "Export in multiple formats",
      "Apply brand kit styles",
      "Search design templates",
    ],
    status: "connected",
    agentsThatUse: ["creative-director", "page-builder", "social-router", "case-study"],
  },
  {
    id: "figma",
    name: "Figma",
    icon: "Layers",
    category: "design",
    description: "Read designs, extract components, generate screenshots. Agents can reference your design system for pixel-perfect output.",
    capabilities: [
      "Read design files",
      "Extract component metadata",
      "Generate screenshots",
      "Search design system",
      "Get variable definitions",
    ],
    status: "connected",
    agentsThatUse: ["designer", "page-builder", "creative-director"],
  },

  // ── Data ──
  {
    id: "supabase",
    name: "Supabase",
    icon: "Database",
    category: "data",
    description: "Execute SQL, manage tables, deploy edge functions. Agents can query and write to your database directly.",
    capabilities: [
      "Execute SQL queries",
      "Manage database schema",
      "Deploy edge functions",
      "Generate TypeScript types",
      "View logs and analytics",
    ],
    status: "available",
    agentsThatUse: ["code-agent", "rag-pipeline", "analytics"],
  },

  // ── Commerce ──
  {
    id: "stripe",
    name: "Stripe",
    icon: "CreditCard",
    category: "commerce",
    description: "Create checkout sessions, manage subscriptions, process payments. The billing system uses Stripe for all transactions.",
    capabilities: [
      "Create checkout sessions",
      "Manage subscriptions",
      "Process refunds",
      "Generate invoices",
    ],
    status: "connected",
    agentsThatUse: ["billing", "auto-onboard", "whitelabel"],
  },
];

/**
 * Get integrations by status
 */
export function getConnectedIntegrations(): Integration[] {
  return INTEGRATIONS.filter(i => i.status === "connected");
}

/**
 * Get integrations that a specific agent can use
 */
export function getAgentIntegrations(agentName: string): Integration[] {
  return INTEGRATIONS.filter(i => i.agentsThatUse.includes(agentName));
}

/**
 * Get all integrations for a category
 */
export function getCategoryIntegrations(category: Integration["category"]): Integration[] {
  return INTEGRATIONS.filter(i => i.category === category);
}

/**
 * Get integration stats for dashboard
 */
export function getIntegrationStats() {
  return {
    total: INTEGRATIONS.length,
    connected: INTEGRATIONS.filter(i => i.status === "connected").length,
    available: INTEGRATIONS.filter(i => i.status === "available").length,
    totalCapabilities: INTEGRATIONS.reduce((sum, i) => sum + i.capabilities.length, 0),
    byCategory: {
      communication: INTEGRATIONS.filter(i => i.category === "communication").length,
      productivity: INTEGRATIONS.filter(i => i.category === "productivity").length,
      design: INTEGRATIONS.filter(i => i.category === "design").length,
      data: INTEGRATIONS.filter(i => i.category === "data").length,
      commerce: INTEGRATIONS.filter(i => i.category === "commerce").length,
    },
  };
}
