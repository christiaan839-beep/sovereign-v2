/**
 * Integration Connector Registry
 *
 * Central registry of all platform integrations.
 * Each connector defines its auth flow, base URL, available actions,
 * and current availability status.
 */

// ─── Types ─────────────────────────────────────────────────────

export type AuthType = "oauth2" | "api_key" | "webhook";

export type IntegrationCategory =
  | "CRM"
  | "Email"
  | "Communication"
  | "Productivity"
  | "Analytics"
  | "E-commerce"
  | "Social"
  | "Developer"
  | "Support"
  | "Scheduling"
  | "Database"
  | "Payments";

export type IntegrationStatus = "available" | "coming_soon";

export interface IntegrationAction {
  /** Machine-readable action identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** Brief description of what the action does */
  description: string;
  /** HTTP method used when invoking */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

export interface IntegrationConnector {
  /** Unique slug (kebab-case) */
  id: string;
  /** Display name */
  name: string;
  /** One-liner explaining the integration */
  description: string;
  /** Functional category */
  category: IntegrationCategory;
  /** Authentication mechanism */
  authType: AuthType;
  /** Root API URL */
  baseUrl: string;
  /** Actions this connector exposes */
  actions: IntegrationAction[];
  /** Whether the connector is live or planned */
  status: IntegrationStatus;
  /** Hex brand colour for UI badges */
  brandColor: string;
  /** Internal API endpoint path (only set for available connectors) */
  endpoint?: string;
}

// ─── Registry ──────────────────────────────────────────────────

export const INTEGRATION_REGISTRY: IntegrationConnector[] = [
  // ── CRM ────────────────────────────────────────────────────
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Sync contacts, deals, companies, and lists with the HubSpot CRM",
    category: "CRM",
    authType: "oauth2",
    baseUrl: "https://api.hubapi.com",
    brandColor: "#FF7A59",
    status: "available",
    endpoint: "/api/_integrations/hubspot",
    actions: [
      { id: "list-contacts", label: "List Contacts", description: "Retrieve CRM contacts with filters", method: "GET" },
      { id: "create-contact", label: "Create Contact", description: "Add a new contact record", method: "POST" },
      { id: "list-deals", label: "List Deals", description: "Retrieve deals pipeline", method: "GET" },
      { id: "create-deal", label: "Create Deal", description: "Open a new deal", method: "POST" },
      { id: "list-companies", label: "List Companies", description: "Retrieve company records", method: "GET" },
      { id: "create-company", label: "Create Company", description: "Add a new company record", method: "POST" },
      { id: "manage-lists", label: "Manage Lists", description: "Create or update contact lists", method: "POST" },
      { id: "track-email", label: "Track Email", description: "Retrieve email tracking events (opens, clicks, bounces)", method: "GET" },
      { id: "send-email", label: "Send Email", description: "Send a single transactional email via HubSpot", method: "POST" },
    ],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Access leads, opportunities, and accounts in Salesforce",
    category: "CRM",
    authType: "oauth2",
    baseUrl: "https://login.salesforce.com",
    brandColor: "#00A1E0",
    status: "coming_soon",
    actions: [
      { id: "list-leads", label: "List Leads", description: "Query lead records", method: "GET" },
      { id: "create-lead", label: "Create Lead", description: "Insert a new lead", method: "POST" },
      { id: "list-opportunities", label: "List Opportunities", description: "Query open opportunities", method: "GET" },
      { id: "create-opportunity", label: "Create Opportunity", description: "Open a new opportunity", method: "POST" },
      { id: "list-accounts", label: "List Accounts", description: "Query account records", method: "GET" },
      { id: "create-account", label: "Create Account", description: "Insert a new account", method: "POST" },
      { id: "list-campaigns", label: "List Campaigns", description: "Query Salesforce campaigns", method: "GET" },
      { id: "create-campaign", label: "Create Campaign", description: "Create a new marketing campaign", method: "POST" },
    ],
  },

  // ── Communication ──────────────────────────────────────────
  {
    id: "slack",
    name: "Slack",
    description: "Send messages, manage channels, and automate Slack workflows",
    category: "Communication",
    authType: "webhook",
    baseUrl: "https://slack.com/api",
    brandColor: "#4A154B",
    status: "available",
    endpoint: "/api/_integrations/slack",
    actions: [
      { id: "send-message", label: "Send Message", description: "Post a message to a channel or DM", method: "POST" },
      { id: "create-channel", label: "Create Channel", description: "Create a new Slack channel", method: "POST" },
      { id: "list-channels", label: "List Channels", description: "Retrieve workspace channels", method: "GET" },
    ],
  },
  {
    id: "whatsapp-business",
    name: "WhatsApp Business",
    description: "Send messages and templates via the WhatsApp Business API",
    category: "Communication",
    authType: "api_key",
    baseUrl: "https://graph.facebook.com/v19.0",
    brandColor: "#25D366",
    status: "coming_soon",
    actions: [
      { id: "send-message", label: "Send Message", description: "Send a text or media message", method: "POST" },
      { id: "send-template", label: "Send Template", description: "Send an approved message template", method: "POST" },
    ],
  },
  {
    id: "intercom",
    name: "Intercom",
    description: "Manage conversations, contacts, and help articles in Intercom",
    category: "Support",
    authType: "oauth2",
    baseUrl: "https://api.intercom.io",
    brandColor: "#6AFDEF",
    status: "coming_soon",
    actions: [
      { id: "list-conversations", label: "List Conversations", description: "Retrieve open conversations", method: "GET" },
      { id: "reply-conversation", label: "Reply to Conversation", description: "Send a reply in a conversation", method: "POST" },
      { id: "list-contacts", label: "List Contacts", description: "Retrieve Intercom contacts", method: "GET" },
      { id: "create-contact", label: "Create Contact", description: "Add a new contact", method: "POST" },
      { id: "list-articles", label: "List Articles", description: "Retrieve help center articles", method: "GET" },
      { id: "create-article", label: "Create Article", description: "Publish a new help center article", method: "POST" },
      { id: "search-help-center", label: "Search Help Center", description: "Search published help center content", method: "GET" },
    ],
  },

  // ── Productivity ───────────────────────────────────────────
  {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Read, write, and append rows in Google Sheets",
    category: "Productivity",
    authType: "api_key",
    baseUrl: "https://sheets.googleapis.com/v4",
    brandColor: "#0F9D58",
    status: "available",
    endpoint: "/api/_integrations/sheets",
    actions: [
      { id: "read-range", label: "Read Range", description: "Read cell values from a range", method: "GET" },
      { id: "write-range", label: "Write Range", description: "Write values to a range", method: "PUT" },
      { id: "append-rows", label: "Append Rows", description: "Append rows to the end of a sheet", method: "POST" },
    ],
  },
  {
    id: "airtable",
    name: "Airtable",
    description: "Read, create, and update records in Airtable bases",
    category: "Productivity",
    authType: "api_key",
    baseUrl: "https://api.airtable.com/v0",
    brandColor: "#18BFFF",
    status: "available",
    endpoint: "/api/_integrations/airtable",
    actions: [
      { id: "list-records", label: "List Records", description: "Retrieve records from a table", method: "GET" },
      { id: "create-record", label: "Create Record", description: "Insert a new record", method: "POST" },
      { id: "update-record", label: "Update Record", description: "Patch an existing record", method: "PATCH" },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Interact with Notion pages, databases, and blocks",
    category: "Productivity",
    authType: "api_key",
    baseUrl: "https://api.notion.com/v1",
    brandColor: "#000000",
    status: "available",
    endpoint: "/api/_integrations/notion",
    actions: [
      { id: "list-pages", label: "List Pages", description: "Search and list pages", method: "POST" },
      { id: "create-page", label: "Create Page", description: "Create a new page in a database", method: "POST" },
      { id: "query-database", label: "Query Database", description: "Query a Notion database", method: "POST" },
      { id: "append-blocks", label: "Append Blocks", description: "Append content blocks to a page", method: "PATCH" },
    ],
  },
  {
    id: "calendly",
    name: "Calendly",
    description: "Access scheduled events, invitees, and availability from Calendly",
    category: "Scheduling",
    authType: "oauth2",
    baseUrl: "https://api.calendly.com",
    brandColor: "#006BFF",
    status: "coming_soon",
    actions: [
      { id: "list-events", label: "List Events", description: "Retrieve scheduled events", method: "GET" },
      { id: "list-invitees", label: "List Invitees", description: "Get invitees for an event", method: "GET" },
      { id: "get-availability", label: "Get Availability", description: "Check scheduling availability for a user", method: "GET" },
      { id: "list-booking-links", label: "List Booking Links", description: "Retrieve scheduling links for a user", method: "GET" },
      { id: "create-booking-link", label: "Create Booking Link", description: "Generate a new one-off scheduling link", method: "POST" },
    ],
  },

  // ── Email ──────────────────────────────────────────────────
  {
    id: "gmail",
    name: "Gmail",
    description: "Send emails and search inbox via the Gmail API",
    category: "Email",
    authType: "oauth2",
    baseUrl: "https://gmail.googleapis.com/gmail/v1",
    brandColor: "#EA4335",
    status: "available",
    endpoint: "/api/_integrations/gmail",
    actions: [
      { id: "send-email", label: "Send Email", description: "Send an email from your account", method: "POST" },
      { id: "list-messages", label: "List Messages", description: "Search and list inbox messages", method: "GET" },
    ],
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Manage campaigns, lists, and subscribers in Mailchimp",
    category: "Email",
    authType: "oauth2",
    baseUrl: "https://server.api.mailchimp.com/3.0",
    brandColor: "#FFE01B",
    status: "coming_soon",
    actions: [
      { id: "list-campaigns", label: "List Campaigns", description: "Retrieve email campaigns", method: "GET" },
      { id: "create-campaign", label: "Create Campaign", description: "Draft a new campaign", method: "POST" },
      { id: "list-audiences", label: "List Audiences", description: "Retrieve audience lists", method: "GET" },
      { id: "add-subscriber", label: "Add Subscriber", description: "Add a member to an audience", method: "POST" },
      { id: "list-templates", label: "List Templates", description: "Retrieve email templates", method: "GET" },
      { id: "list-automations", label: "List Automations", description: "Retrieve automated email workflows", method: "GET" },
      { id: "create-automation", label: "Create Automation", description: "Set up a new email automation workflow", method: "POST" },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    description: "Send transactional emails and manage templates via SendGrid",
    category: "Email",
    authType: "api_key",
    baseUrl: "https://api.sendgrid.com/v3",
    brandColor: "#1A82E2",
    status: "coming_soon",
    actions: [
      { id: "send-email", label: "Send Email", description: "Send a transactional email", method: "POST" },
      { id: "list-templates", label: "List Templates", description: "Retrieve dynamic templates", method: "GET" },
      { id: "list-contacts", label: "List Contacts", description: "Retrieve marketing contacts", method: "GET" },
      { id: "add-contact", label: "Add Contact", description: "Add or update a marketing contact", method: "PUT" },
      { id: "list-suppressions", label: "List Suppressions", description: "Retrieve suppressed email addresses (bounces, blocks, spam reports)", method: "GET" },
      { id: "delete-suppression", label: "Delete Suppression", description: "Remove an email address from a suppression list", method: "DELETE" },
    ],
  },

  // ── E-commerce ─────────────────────────────────────────────
  {
    id: "shopify",
    name: "Shopify",
    description: "Access products, orders, and customers in a Shopify store",
    category: "E-commerce",
    authType: "oauth2",
    baseUrl: "https://{store}.myshopify.com/admin/api/2024-01",
    brandColor: "#96BF48",
    status: "coming_soon",
    actions: [
      { id: "list-products", label: "List Products", description: "Retrieve store products", method: "GET" },
      { id: "list-orders", label: "List Orders", description: "Retrieve recent orders", method: "GET" },
      { id: "list-customers", label: "List Customers", description: "Retrieve customer records", method: "GET" },
      { id: "create-product", label: "Create Product", description: "Add a new product listing", method: "POST" },
      { id: "list-inventory", label: "List Inventory", description: "Retrieve inventory levels across locations", method: "GET" },
      { id: "update-inventory", label: "Update Inventory", description: "Adjust inventory levels for a product variant", method: "POST" },
      { id: "get-analytics", label: "Get Analytics", description: "Retrieve store analytics and sales reports", method: "GET" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payments, subscriptions, and invoices via Stripe (already integrated)",
    category: "E-commerce",
    authType: "api_key",
    baseUrl: "https://api.stripe.com/v1",
    brandColor: "#635BFF",
    status: "available",
    endpoint: "/api/_billing/webhook",
    actions: [
      { id: "list-payments", label: "List Payments", description: "Retrieve payment intents", method: "GET" },
      { id: "create-checkout", label: "Create Checkout", description: "Generate a checkout session", method: "POST" },
      { id: "list-subscriptions", label: "List Subscriptions", description: "Retrieve active subscriptions", method: "GET" },
      { id: "list-invoices", label: "List Invoices", description: "Retrieve invoices", method: "GET" },
      { id: "list-customers", label: "List Customers", description: "Retrieve customer records", method: "GET" },
      { id: "create-customer", label: "Create Customer", description: "Create a new customer", method: "POST" },
      { id: "list-charges", label: "List Charges", description: "Retrieve payment charges", method: "GET" },
      { id: "create-refund", label: "Create Refund", description: "Issue a refund for a charge", method: "POST" },
    ],
  },

  // ── Analytics ──────────────────────────────────────────────
  {
    id: "google-analytics",
    name: "Google Analytics",
    description: "Pull pageviews, events, and reports from Google Analytics",
    category: "Analytics",
    authType: "oauth2",
    baseUrl: "https://analyticsdata.googleapis.com/v1beta",
    brandColor: "#E37400",
    status: "coming_soon",
    actions: [
      { id: "run-report", label: "Run Report", description: "Execute an analytics report", method: "POST" },
      { id: "get-realtime", label: "Get Realtime", description: "Fetch realtime active users", method: "GET" },
      { id: "list-events", label: "List Events", description: "Retrieve tracked events", method: "GET" },
    ],
  },

  // ── Social ─────────────────────────────────────────────────
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Publish posts and manage company pages on LinkedIn",
    category: "Social",
    authType: "oauth2",
    baseUrl: "https://api.linkedin.com/v2",
    brandColor: "#0A66C2",
    status: "coming_soon",
    actions: [
      { id: "create-post", label: "Create Post", description: "Publish a post on LinkedIn", method: "POST" },
      { id: "get-company-page", label: "Get Company Page", description: "Retrieve company page details", method: "GET" },
      { id: "list-posts", label: "List Posts", description: "Retrieve recent posts from a company page", method: "GET" },
      { id: "send-message", label: "Send Message", description: "Send a direct message via LinkedIn messaging", method: "POST" },
      { id: "list-connections", label: "List Connections", description: "Retrieve first-degree connections", method: "GET" },
      { id: "get-analytics", label: "Get Post Analytics", description: "Retrieve engagement analytics for a post", method: "GET" },
    ],
  },
  {
    id: "twitter-x",
    name: "Twitter / X",
    description: "Post tweets and read mentions on X (Twitter)",
    category: "Social",
    authType: "oauth2",
    baseUrl: "https://api.twitter.com/2",
    brandColor: "#000000",
    status: "coming_soon",
    actions: [
      { id: "create-tweet", label: "Create Tweet", description: "Post a new tweet", method: "POST" },
      { id: "list-mentions", label: "List Mentions", description: "Retrieve recent mentions", method: "GET" },
    ],
  },

  // ── Developer ──────────────────────────────────────────────
  {
    id: "webhook",
    name: "Generic Webhook",
    description: "Fire signed webhooks to any URL — connect to any service with an HTTP endpoint",
    category: "Developer",
    authType: "webhook",
    baseUrl: "",
    brandColor: "#6366F1",
    status: "available",
    endpoint: "/api/_integrations/webhook",
    actions: [
      { id: "fire-webhook", label: "Fire Webhook", description: "Send a signed HTTP request to any URL", method: "POST" },
    ],
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Trigger Zaps and receive webhooks from Zapier",
    category: "Developer",
    authType: "webhook",
    baseUrl: "https://hooks.zapier.com",
    brandColor: "#FF4F00",
    status: "coming_soon",
    actions: [
      { id: "trigger-zap", label: "Trigger Zap", description: "Fire a Zapier webhook trigger", method: "POST" },
      { id: "receive-webhook", label: "Receive Webhook", description: "Accept inbound Zapier webhook", method: "POST" },
    ],
  },
  {
    id: "make",
    name: "Make (Integromat)",
    description: "Trigger scenarios and process webhooks from Make",
    category: "Developer",
    authType: "webhook",
    baseUrl: "https://hook.make.com",
    brandColor: "#6D00CC",
    status: "coming_soon",
    actions: [
      { id: "trigger-scenario", label: "Trigger Scenario", description: "Fire a Make webhook trigger", method: "POST" },
      { id: "receive-webhook", label: "Receive Webhook", description: "Accept inbound Make webhook", method: "POST" },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Manage issues, pull requests, and repositories on GitHub",
    category: "Developer",
    authType: "oauth2",
    baseUrl: "https://api.github.com",
    brandColor: "#181717",
    status: "coming_soon",
    actions: [
      { id: "list-issues", label: "List Issues", description: "Retrieve repository issues", method: "GET" },
      { id: "create-issue", label: "Create Issue", description: "Open a new issue", method: "POST" },
      { id: "list-prs", label: "List Pull Requests", description: "Retrieve open PRs", method: "GET" },
      { id: "list-repos", label: "List Repos", description: "Retrieve user repositories", method: "GET" },
      { id: "list-commits", label: "List Commits", description: "Retrieve commit history for a repository", method: "GET" },
      { id: "list-actions", label: "List Actions", description: "Retrieve GitHub Actions workflow runs", method: "GET" },
      { id: "trigger-action", label: "Trigger Action", description: "Dispatch a GitHub Actions workflow", method: "POST" },
      { id: "create-pr", label: "Create Pull Request", description: "Open a new pull request", method: "POST" },
    ],
  },
  {
    id: "jira",
    name: "Jira",
    description: "Access issues, sprints, and boards in Jira",
    category: "Developer",
    authType: "oauth2",
    baseUrl: "https://your-domain.atlassian.net/rest/api/3",
    brandColor: "#0052CC",
    status: "coming_soon",
    actions: [
      { id: "list-issues", label: "List Issues", description: "Search Jira issues with JQL", method: "GET" },
      { id: "create-issue", label: "Create Issue", description: "Create a new Jira issue", method: "POST" },
      { id: "list-sprints", label: "List Sprints", description: "Retrieve board sprints", method: "GET" },
      { id: "list-boards", label: "List Boards", description: "Retrieve Jira boards", method: "GET" },
      { id: "list-projects", label: "List Projects", description: "Retrieve all Jira projects", method: "GET" },
      { id: "transition-issue", label: "Transition Issue", description: "Move an issue to a new status", method: "POST" },
      { id: "list-transitions", label: "List Transitions", description: "Get available transitions for an issue", method: "GET" },
    ],
  },

  // ── Communication (additional) ────────────────────────────────
  {
    id: "discord",
    name: "Discord",
    description: "Send messages, manage channels, roles, and webhooks in Discord servers",
    category: "Communication",
    authType: "oauth2",
    baseUrl: "https://discord.com/api/v10",
    brandColor: "#5865F2",
    status: "coming_soon",
    actions: [
      { id: "send-message", label: "Send Message", description: "Post a message to a channel", method: "POST" },
      { id: "list-channels", label: "List Channels", description: "Retrieve server channels", method: "GET" },
      { id: "create-channel", label: "Create Channel", description: "Create a new channel in a server", method: "POST" },
      { id: "list-roles", label: "List Roles", description: "Retrieve server roles", method: "GET" },
      { id: "assign-role", label: "Assign Role", description: "Assign a role to a member", method: "PUT" },
      { id: "create-webhook", label: "Create Webhook", description: "Create a channel webhook for automated messages", method: "POST" },
      { id: "list-members", label: "List Members", description: "Retrieve server members", method: "GET" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "Send SMS, make voice calls, WhatsApp messages, and verify users via Twilio",
    category: "Communication",
    authType: "api_key",
    baseUrl: "https://api.twilio.com/2010-04-01",
    brandColor: "#F22F46",
    status: "coming_soon",
    actions: [
      { id: "send-sms", label: "Send SMS", description: "Send an SMS text message", method: "POST" },
      { id: "make-call", label: "Make Call", description: "Initiate an outbound voice call", method: "POST" },
      { id: "send-whatsapp", label: "Send WhatsApp", description: "Send a WhatsApp message via Twilio", method: "POST" },
      { id: "verify-start", label: "Start Verification", description: "Send a verification code via SMS, call, or email", method: "POST" },
      { id: "verify-check", label: "Check Verification", description: "Validate a user-provided verification code", method: "POST" },
      { id: "list-messages", label: "List Messages", description: "Retrieve sent and received messages", method: "GET" },
      { id: "list-calls", label: "List Calls", description: "Retrieve call logs", method: "GET" },
    ],
  },

  // ── Database ──────────────────────────────────────────────────
  {
    id: "mongodb",
    name: "MongoDB",
    description: "Query, insert, update, and aggregate documents in MongoDB Atlas",
    category: "Database",
    authType: "api_key",
    baseUrl: "https://data.mongodb-api.com/app/data-api/endpoint/data/v1",
    brandColor: "#47A248",
    status: "coming_soon",
    actions: [
      { id: "find-documents", label: "Find Documents", description: "Query documents with filters and projections", method: "POST" },
      { id: "find-one", label: "Find One", description: "Retrieve a single document by filter", method: "POST" },
      { id: "insert-one", label: "Insert One", description: "Insert a single document", method: "POST" },
      { id: "insert-many", label: "Insert Many", description: "Insert multiple documents in bulk", method: "POST" },
      { id: "update-one", label: "Update One", description: "Update a single document matching a filter", method: "POST" },
      { id: "update-many", label: "Update Many", description: "Update all documents matching a filter", method: "POST" },
      { id: "delete-one", label: "Delete One", description: "Delete a single document matching a filter", method: "POST" },
      { id: "aggregate", label: "Aggregate", description: "Run an aggregation pipeline", method: "POST" },
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Query tables, insert records, subscribe to realtime changes, and manage storage in Supabase",
    category: "Database",
    authType: "api_key",
    baseUrl: "https://{project}.supabase.co/rest/v1",
    brandColor: "#3ECF8E",
    status: "coming_soon",
    actions: [
      { id: "query", label: "Query", description: "Select rows from a table with filters", method: "GET" },
      { id: "insert", label: "Insert", description: "Insert one or more rows into a table", method: "POST" },
      { id: "update", label: "Update", description: "Update rows matching a filter", method: "PATCH" },
      { id: "delete", label: "Delete", description: "Delete rows matching a filter", method: "DELETE" },
      { id: "rpc", label: "Call Function", description: "Invoke a Postgres function via RPC", method: "POST" },
      { id: "realtime-subscribe", label: "Realtime Subscribe", description: "Subscribe to realtime changes on a table", method: "POST" },
      { id: "storage-upload", label: "Storage Upload", description: "Upload a file to Supabase Storage", method: "POST" },
      { id: "storage-list", label: "Storage List", description: "List files in a storage bucket", method: "GET" },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────

/** Get all integrations grouped by category */
export function getIntegrationsByCategory(): Record<IntegrationCategory, IntegrationConnector[]> {
  const grouped = {} as Record<IntegrationCategory, IntegrationConnector[]>;
  for (const connector of INTEGRATION_REGISTRY) {
    if (!grouped[connector.category]) grouped[connector.category] = [];
    grouped[connector.category].push(connector);
  }
  return grouped;
}

/** Look up a single connector by id */
export function getIntegrationById(id: string): IntegrationConnector | undefined {
  return INTEGRATION_REGISTRY.find((c) => c.id === id);
}

/** Return only available (already integrated) connectors */
export function getAvailableIntegrations(): IntegrationConnector[] {
  return INTEGRATION_REGISTRY.filter((c) => c.status === "available");
}

/** Return coming-soon connectors */
export function getComingSoonIntegrations(): IntegrationConnector[] {
  return INTEGRATION_REGISTRY.filter((c) => c.status === "coming_soon");
}
