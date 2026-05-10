import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  nodeId: text("node_id").notNull().unique(), // e.g., UMB-NX-77492
  createdAt: timestamp("created_at").defaultNow(),
  plan: text("plan").notNull().default("black-card"), // Future-proofing for tiering
  // Onboarding capture (consumed by /api/user/onboarding)
  onboardingGoal: text("onboarding_goal"),
  onboardingIndustry: text("onboarding_industry"),
  companyUrl: text("company_url"),
});

export const activeSwarms = pgTable(
  "active_swarms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    agentAlias: text("agent_alias").notNull(), // COMMANDER, AD-BUYER, etc.
    status: text("status").notNull().default("idle"),
    uptime: timestamp("uptime").defaultNow(),
  },
  (table) => [index("idx_active_swarms_tenant").on(table.tenantId)],
);

export const globalTelemetry = pgTable(
  "global_telemetry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    eventType: text("event_type").notNull(), // e.g., "lead_scraped", "video_synthesized"
    payload: text("payload").notNull(), // JSON string representing the asset/data
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => [
    index("idx_telemetry_tenant").on(table.tenantId),
    index("idx_telemetry_timestamp").on(table.timestamp),
  ],
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("sovereign"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userEmail: text("user_email").notNull().unique(), // not doing formal FK to allow standalone keys
  config: text("config").notNull().default("{}"), // JSON object stringified
  apiKeys: text("api_keys").default("{}"), // Store Gemini/Tavily etc
  webhooks: text("webhooks").default("{}"), // Store user saved webhooks
  weeklyReportOptIn: text("weekly_report_opt_in").default("false"), // "true" | "false" — opt-in for Proposal R
});

export const scheduledContent = pgTable("scheduled_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, {
    onDelete: "set null",
  }), // nullable — some routes don't have tenant context
  topic: text("topic").notNull(),
  caption: text("caption"),
  platform: text("platform").notNull().default("instagram"), // instagram, youtube, tiktok
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("draft"), // draft, scheduled, published, failed
  imagePrompt: text("image_prompt"), // Imagen-generated description
  createdAt: timestamp("created_at").defaultNow(),
});

export const whitelabelConfig = pgTable("whitelabel_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  userEmail: text("user_email").notNull().unique(),
  agencyName: text("agency_name").notNull().default("SOVEREIGN"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#00B7FF"),
  supportEmail: text("support_email"),
  domain: text("domain").notNull().unique().default(""),
  tenantId: text("tenant_id").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customSkills = pgTable("custom_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ═══════════════════════════════════════════
// Phase 5: Revenue Engine Tables
// ═══════════════════════════════════════════

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(), // agency owner
    leadName: text("lead_name").notNull(),
    leadEmail: text("lead_email").notNull(),
    leadPhone: text("lead_phone"),
    businessName: text("business_name"),
    date: text("date").notNull(), // ISO date string for the appointment
    time: text("time").notNull(), // time slot like "10:00 AM"
    status: text("status").notNull().default("confirmed"), // confirmed, completed, no-show, cancelled
    qualificationNotes: text("qualification_notes"), // AI agent's notes from the conversation
    source: text("source").default("website"), // website, instagram, whatsapp, manual
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bookings_user").on(table.userEmail),
    index("idx_bookings_date").on(table.date),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    businessName: text("business_name"),
    source: text("source").default("organic"), // organic, paid, referral, scraper
    status: text("status").notNull().default("new"), // new, contacted, qualified, booked, closed, lost
    score: text("score").default("0"), // 0-100 lead quality score
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_leads_user_email").on(table.userEmail),
    index("idx_leads_status").on(table.status),
  ],
);

export const adCreatives = pgTable(
  "ad_creatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    platform: text("platform").notNull().default("meta"), // meta, tiktok, google
    headline: text("headline").notNull(),
    primaryText: text("primary_text").notNull(),
    callToAction: text("call_to_action").default("Learn More"),
    targetAudience: text("target_audience"),
    hook: text("hook"), // the opening line / attention grabber
    style: text("style").default("direct-response"), // direct-response, storytelling, ugc, testimonial
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_ad_creatives_user_email").on(table.userEmail)],
);

// ═══════════════════════════════════════════
// Phase 6: Email Sequence Engine
// ═══════════════════════════════════════════

export const emailSequences = pgTable(
  "email_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    name: text("name").notNull(), // e.g., "Welcome Sequence", "Upsell Drip"
    trigger: text("trigger").notNull().default("manual"), // manual, stripe_checkout, lead_qualified, booking_confirmed
    status: text("status").notNull().default("draft"), // draft, active, paused
    totalSteps: text("total_steps").default("0"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_email_sequences_user_email").on(table.userEmail)],
);

export const sequenceSteps = pgTable("sequence_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceId: uuid("sequence_id")
    .references(() => emailSequences.id, { onDelete: "cascade" })
    .notNull(),
  stepNumber: text("step_number").notNull(), // "1", "2", "3"
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML or plain text
  delayDays: text("delay_days").notNull().default("0"), // days after previous step
  createdAt: timestamp("created_at").defaultNow(),
});

// ═══════════════════════════════════════════
// Phase 7: Result History & Usage Metering
// ═══════════════════════════════════════════

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userEmail: text("user_email").notNull(),
    tool: text("tool").notNull(), // "seo-dominator", "content-factory", etc.
    action: text("action").notNull(), // "xray", "blog", "email", etc.
    inputSummary: text("input_summary"), // Brief input description for library display
    output: text("output").notNull(), // Full AI output
    tokens: integer("tokens").default(0), // Estimated token count
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("gen_user_email_idx").on(table.userEmail),
    index("gen_created_at_idx").on(table.createdAt),
  ],
);

// ═══════════════════════════════════════════
// Phase 8: NVIDIA NIM Voice Agent (SOVEREIGN Siren)
// ═══════════════════════════════════════════

export const voiceCalls = pgTable("voice_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  userEmail: text("user_email").notNull(),
  targetPhone: text("target_phone").notNull(),
  context: text("context"), // The system prompt / objective
  status: text("status").notNull().default("initiated"), // initiated, ringing, connected, completed, failed
  durationSeconds: integer("duration_seconds").default(0),
  transcript: text("transcript"), // Full text transcript of the call
  disposition: text("disposition"), // e.g., "Meeting Booked", "Left Voicemail", "Not Interested"
  createdAt: timestamp("created_at").defaultNow(),
});

// ═══════════════════════════════════════════
// Phase 21: Usage Metering & Token Tracking
// ═══════════════════════════════════════════

export const usage = pgTable(
  "usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    agentId: text("agent_id").notNull(),
    model: text("model").notNull(),
    tokensUsed: integer("tokens_used").notNull().default(0),
    // v9 cost-ledger columns — populated from model-costs.ts at request
    // time. Legacy rows have NULL for the three columns and that's fine;
    // aggregations filter them out.
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costCents: integer("cost_cents"),
    provider: text("provider"), // matches model-attribution.ts buckets: anthropic/nvidia-nim/...
    requestId: text("request_id"), // links to the request-context requestId for cross-log correlation
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("usage_user_id_idx").on(table.userId),
    index("usage_created_at_idx").on(table.createdAt),
    index("usage_provider_idx").on(table.provider),
    index("usage_request_id_idx").on(table.requestId),
  ],
);

// ═══════════════════════════════════════════
// Payments & Subscription Tracking
// ═══════════════════════════════════════════

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id"), // null for pre-auth payments
    email: text("email").notNull(),
    gateway: text("gateway").notNull().default("payfast"), // payfast, paystack, stripe
    externalId: text("external_id"), // PayFast m_payment_id, Stripe pi_xxx
    plan: text("plan").notNull(), // node, array, enterprise
    amount: text("amount").notNull(), // gross amount as string (R499.00)
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull().default("pending"), // pending, complete, failed, refunded
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("payments_email_idx").on(table.email),
    index("payments_clerk_user_idx").on(table.clerkUserId),
  ],
);

// ═══════════════════════════════════════════
// Conversation Persistence
// ═══════════════════════════════════════════

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    title: text("title").notNull().default("New Mission"),
    model: text("model").notNull().default("auto"),
    systemPrompt: text("system_prompt"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    archived: boolean("archived").notNull().default(false),
  },
  (table) => [index("conv_clerk_user_idx").on(table.clerkUserId)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull(), // user, assistant
    content: text("content").notNull(),
    agentLabel: text("agent_label"),
    responseTimeMs: integer("response_time_ms"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("msg_conv_idx").on(table.conversationId)],
);

// ═══════════════════════════════════════════
// Agent Marketplace
// ═══════════════════════════════════════════

export const marketplaceAgents = pgTable(
  "marketplace_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id").references(() => customSkills.id, {
      onDelete: "set null",
    }),

    // Author
    authorEmail: text("author_email").notNull(),
    authorName: text("author_name").notNull(),
    creatorUserId: text("creator_user_id"), // Clerk user ID — persists across email changes

    // Content
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(), // sales|content|seo|code|automation|research|voice|data
    systemPrompt: text("system_prompt").notNull(),
    tags: text("tags").notNull().default("[]"), // JSON string[]

    // Discovery
    isPublic: boolean("is_public").notNull().default(true),
    installs: integer("installs").notNull().default(0),
    rating: integer("rating").default(0), // 0-5 star average
    featured: boolean("featured").notNull().default(false),
    featuredAt: timestamp("featured_at"),

    // Monetisation
    pricePerRun: integer("price_per_run").notNull().default(0), // cents — 0 = free
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    stripeConnectAccountId: text("stripe_connect_account_id"), // creator's Connect account

    // Usage stats (denormalised for fast leaderboard queries)
    totalRunCount: integer("total_run_count").notNull().default(0),
    weeklyRunCount: integer("weekly_run_count").notNull().default(0),
    revenueCents: integer("revenue_cents").notNull().default(0), // gross
    creatorRevenueCents: integer("creator_revenue_cents").notNull().default(0), // 70% share

    // Verification pipeline
    verificationStatus: text("verification_status")
      .notNull()
      .default("pending"),
    // pending | in_review | verified | rejected | suspended
    verifiedAt: timestamp("verified_at"),
    testRunPassed: boolean("test_run_passed"),
    safetyScore: integer("safety_score"), // 0-100 from 5-layer check
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_marketplace_creator").on(table.creatorUserId),
    index("idx_marketplace_category").on(table.category),
    index("idx_marketplace_status").on(table.verificationStatus),
    index("idx_marketplace_runs").on(table.totalRunCount),
  ],
);

// ═══════════════════════════════════════════
// Stripe Subscriptions
// ═══════════════════════════════════════════

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("active"),
    currentPeriodEnd: timestamp("current_period_end"),
    /**
     * Founder Network membership (Proposal L) — separate from the free
     * 10-slot Founders program. `null` means not a member; a timestamp
     * marks when they joined. Used for the 50% lifetime discount +
     * 30% referral commission + badge perks.
     */
    founderNetworkJoinedAt: timestamp("founder_network_joined_at"),
    /** Sequential slot number within the 100-member cohort — purely for display. */
    founderNetworkSlot: integer("founder_network_slot"),
    // v10 acquisition attribution — migration 0013. Written ONCE at
    // signup; immutable after. Lets us answer "did HN or LinkedIn
    // drive this week's signups?" without guessing.
    acquisitionSource: text("acquisition_source"),
    acquisitionMedium: text("acquisition_medium"),
    acquisitionCampaign: text("acquisition_campaign"),
    acquisitionReferrer: text("acquisition_referrer"),
    acquiredAt: timestamp("acquired_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_subscriptions_user").on(table.userId),
    index("idx_subscriptions_stripe").on(table.stripeCustomerId),
    index("idx_subscriptions_founder_network").on(table.founderNetworkJoinedAt),
    index("idx_subscriptions_acq_source").on(table.acquisitionSource),
    index("idx_subscriptions_acquired_at").on(table.acquiredAt),
  ],
);

/**
 * Stripe webhook deduplication with TWO-STATE processing (received → completed).
 *
 * Stripe delivers events at-least-once. A single-state dedup (INSERT-and-skip-
 * on-conflict) has a race: if we insert at t=0 then crash at t=1ms before
 * processing, the Stripe retry at t=5s hits the duplicate path and silently
 * skips a legitimate unprocessed event.
 *
 * Two-state fix:
 *   1. INSERT with status='received' as the first action.
 *   2. Run the handler switch.
 *   3. UPDATE status='completed' on success.
 *
 * On duplicate-insert: check status.
 *   - If 'completed' → return 200, skip (real dup, already handled).
 *   - If 'received' AND received_at > 5 min ago → re-process (stale crash).
 *   - If 'received' AND received_at ≤ 5 min ago → return 202 (concurrent
 *     processing; Stripe will retry and we'll pick it up cleanly).
 */
export const stripeEvents = pgTable("stripe_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("received"), // 'received' | 'completed' | 'failed'
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  /** Serialized error from the handler when status='failed'. */
  errorMessage: text("error_message"),
});

/**
 * OAuth connections — per-user access tokens for Slack / Gmail / HubSpot /
 * etc. Tokens are encrypted at rest via safeEncrypt. See
 * docs/adr/0003-slack-oauth-first-integration.md.
 */
export const oauthConnections = pgTable(
  "oauth_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(), // "slack", "gmail", "hubspot", ...
    workspaceId: text("workspace_id").notNull(), // Slack team id / Gmail account id
    workspaceName: text("workspace_name"),
    accessToken: text("access_token").notNull(), // safeEncrypt'd
    refreshToken: text("refresh_token"), // safeEncrypt'd (nullable for non-rotating providers)
    scopes: text("scopes").array(),
    botUserId: text("bot_user_id"),
    installedAt: timestamp("installed_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("uniq_oauth_user_provider_workspace").on(
      table.userId,
      table.provider,
      table.workspaceId,
    ),
    index("idx_oauth_user_provider").on(table.userId, table.provider),
  ],
);

// ═══════════════════════════════════════════
// Team / Organization Workspaces
// ═══════════════════════════════════════════

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id").notNull(), // Clerk user ID
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orgMembers = pgTable("org_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"), // owner, admin, member, viewer
  joinedAt: timestamp("joined_at").defaultNow(),
});

// ─── Client Projects ───────────────────────────────────────
export const clientProjects = pgTable("client_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  clientName: text("client_name").notNull(),
  industry: text("industry"),
  website: text("website"),
  status: text("status").notNull().default("active"), // active, paused, completed
  color: text("color").default("#10b981"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Scheduled Agent Runs ──────────────────────────────────
export const scheduledRuns = pgTable("scheduled_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id"),
  agentType: text("agent_type").notNull(), // lead-gen, content, seo, etc.
  agentName: text("agent_name").notNull(),
  prompt: text("prompt").notNull(),
  schedule: text("schedule").notNull(), // cron expression
  timezone: text("timezone").default("UTC"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  runCount: integer("run_count").default(0),
  lastResult: text("last_result"),
  lastStatus: text("last_status").default("pending"), // pending, running, success, failed
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Agent Activity Log (Smart Inbox) ──────────────────────
export const agentActivity = pgTable("agent_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id"),
  agentName: text("agent_name").notNull(),
  agentType: text("agent_type").notNull(),
  action: text("action").notNull(), // executed, completed, failed, scheduled
  summary: text("summary").notNull(),
  result: text("result"),
  metadata: text("metadata"), // JSON string for extra data
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ═══════════════════════════════════════════
// Tenant Memory — persistent agent execution history
// ═══════════════════════════════════════════

export const tenantMemories = pgTable("tenant_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  agentName: text("agent_name").notNull(),
  inputSummary: text("input_summary"),
  outputSummary: text("output_summary"),
  tags: text("tags"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ═══════════════════════════════════════════
// Audit Logs — SOC 2 Compliance
// ═══════════════════════════════════════════

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    resource: text("resource"),
    details: text("details"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_audit_user").on(table.userId),
    index("idx_audit_action").on(table.action),
    index("idx_audit_created").on(table.createdAt),
  ],
);

// ═══════════════════════════════════════════
// Error Monitoring
// ═══════════════════════════════════════════

export const errorLogs = pgTable(
  "error_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    message: text("message").notNull(),
    stack: text("stack"),
    context: text("context"),
    severity: text("severity").notNull().default("medium"),
    userId: text("user_id"),
    agentId: text("agent_id"),
    url: text("url"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_errors_severity").on(table.severity),
    index("idx_errors_created").on(table.createdAt),
  ],
);

// ═══════════════════════════════════════════
// API Keys — validated against DB, not prefix
// ═══════════════════════════════════════════

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    key: text("key").notNull().unique(), // hashed API key
    keyPrefix: text("key_prefix").notNull(), // first 8 chars for display (sk_pro_ab)
    plan: text("plan").notNull().default("free"), // free, pro, enterprise
    label: text("label"), // user-defined label
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"), // null = never expires
    revokedAt: timestamp("revoked_at"), // null = active
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_api_keys_key").on(table.key),
    index("idx_api_keys_user").on(table.userId),
  ],
);

// ═══════════════════════════════════════════
// Workflow Builder — Persistent Pipelines
// ═══════════════════════════════════════════

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    nodes: text("nodes").notNull(), // JSON string of AgentNode[]
    status: text("status").notNull().default("draft"), // draft, active, archived
    lastRunAt: timestamp("last_run_at"),
    runCount: integer("run_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_workflows_user").on(table.userId)],
);

// ═══════════════════════════════════════════
// Graph Memory Fabric — Knowledge Graph for Agent Intelligence
// ═══════════════════════════════════════════

/** Graph nodes — entities in the knowledge graph */
export const graphNodes = pgTable(
  "graph_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(), // tenant isolation
    nodeType: text("node_type").notNull(), // agent, task, document, user, tool, outcome, concept
    label: text("label").notNull(), // human-readable name
    properties: text("properties").notNull().default("{}"), // JSON — flexible metadata
    confidence: integer("confidence").default(100), // 0-100 confidence score
    embedding: text("embedding"), // JSON array for vector search (serialized float[])
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_graph_nodes_user").on(table.userId),
    index("idx_graph_nodes_type").on(table.nodeType),
    index("idx_graph_nodes_label").on(table.label),
  ],
);

/** Graph edges — relationships between nodes */
export const graphEdges = pgTable(
  "graph_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    sourceId: uuid("source_id")
      .references(() => graphNodes.id, { onDelete: "cascade" })
      .notNull(),
    targetId: uuid("target_id")
      .references(() => graphNodes.id, { onDelete: "cascade" })
      .notNull(),
    edgeType: text("edge_type").notNull(), // EXECUTED, DEPENDS_ON, CITED, LEADS_TO, SIMILAR_TO, CAUSED, PRECEDED
    weight: integer("weight").default(100), // 0-100 — temporal decay reduces this
    properties: text("properties").notNull().default("{}"), // JSON metadata
    confidence: integer("confidence").default(100),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_graph_edges_user").on(table.userId),
    index("idx_graph_edges_source").on(table.sourceId),
    index("idx_graph_edges_target").on(table.targetId),
    index("idx_graph_edges_type").on(table.edgeType),
  ],
);

// ═══════════════════════════════════════════
// Affiliate / Referral Program
// ═══════════════════════════════════════════

export const affiliates = pgTable(
  "affiliates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().unique(), // Clerk user ID
    email: text("email").notNull(),
    referralCode: text("referral_code").notNull().unique(), // e.g., "john-smith-abc123"
    commissionRate: integer("commission_rate").notNull().default(20), // 20% default
    totalReferrals: integer("total_referrals").notNull().default(0),
    totalEarnings: integer("total_earnings").notNull().default(0), // cents
    payoutMethod: text("payout_method").default("paypal"), // paypal, bank, crypto
    payoutDetails: text("payout_details"), // encrypted
    status: text("status").notNull().default("active"), // active, suspended, pending
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_affiliates_code").on(table.referralCode),
    index("idx_affiliates_user").on(table.userId),
  ],
);

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .references(() => affiliates.id, { onDelete: "cascade" })
      .notNull(),
    referredUserId: text("referred_user_id").notNull(),
    referredEmail: text("referred_email").notNull(),
    plan: text("plan").default("free"), // plan they signed up for
    revenue: integer("revenue").notNull().default(0), // cents earned from this referral
    status: text("status").notNull().default("signed_up"), // signed_up, converted, churned
    convertedAt: timestamp("converted_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_referrals_affiliate").on(table.affiliateId)],
);

// ═══════════════════════════════════════════
// Playbook Runs — Persistent multi-agent execution history
// Every step is written to DB in real-time so the UI can poll for live progress.
// ═══════════════════════════════════════════

export const playbookRuns = pgTable(
  "playbook_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    playbookId: text("playbook_id").notNull(),
    playbookName: text("playbook_name").notNull(),
    inputs: text("inputs").notNull().default("{}"), // JSON: user-provided field values
    status: text("status").notNull().default("running"), // running | done | failed
    stepCount: integer("step_count").notNull().default(0),
    stepsSucceeded: integer("steps_succeeded").notNull().default(0),
    stepsFailed: integer("steps_failed").notNull().default(0),
    durationMs: integer("duration_ms"),
    notifyTelegram: boolean("notify_telegram").default(false),
    telegramChatId: text("telegram_chat_id"),
    createdAt: timestamp("created_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_playbook_runs_user").on(table.userId),
    index("idx_playbook_runs_status").on(table.status),
    index("idx_playbook_runs_created").on(table.createdAt),
  ],
);

export const playbookRunSteps = pgTable(
  "playbook_run_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .references(() => playbookRuns.id, { onDelete: "cascade" })
      .notNull(),
    stepIndex: integer("step_index").notNull(),
    agentName: text("agent_name").notNull(),
    reason: text("reason"),
    status: text("status").notNull().default("pending"), // pending | running | done | failed | skipped
    result: text("result"), // JSON stringified
    error: text("error"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_playbook_steps_run").on(table.runId)],
);

// ═══════════════════════════════════════════
// Async Job Queue
// Fire-and-forget agent execution — user submits a goal,
// gets a job ID back immediately, result arrives via Telegram.
// ═══════════════════════════════════════════

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    goal: text("goal").notNull(),
    status: text("status").notNull().default("pending"), // pending | running | done | failed
    progress: integer("progress").default(0), // 0–100
    result: text("result"), // JSON stringified result
    error: text("error"),
    agentsUsed: text("agents_used"), // JSON array of agent names
    notifyTelegram: boolean("notify_telegram").default(false),
    telegramChatId: text("telegram_chat_id"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_jobs_user").on(table.userId),
    index("idx_jobs_status").on(table.status),
    index("idx_jobs_created").on(table.createdAt),
  ],
);

// ═══════════════════════════════════════════
// Case Studies — public /customers feed
// ═══════════════════════════════════════════

/**
 * Rows in this table drive the public /customers page. A row with
 * published_at != NULL appears live; published_at = NULL means it's
 * a draft. Companies must approve_by_company before publishing —
 * the /customers page filters on both `approvedByCompany && publishedAt`.
 *
 * Insertion flow (intended):
 *   1. Founder writes the case study as a markdown body during the
 *      customer's month-end review call
 *   2. Drafts land here via an admin POST endpoint (v12+)
 *   3. Customer reviews the rendered draft at /customers/preview/[slug]
 *   4. On approval, the row gets approvedByCompany=true + published_at=now()
 *   5. /customers shows it on the next edge-cache revalidation (1 hr)
 */
export const caseStudies = pgTable(
  "case_studies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    company: text("company").notNull(),
    industry: text("industry"),
    outcome: text("outcome").notNull(), // one-line headline result
    metric: text("metric").notNull(), // the number leading the card
    playbook: text("playbook").notNull(), // which playbook delivered it
    body: text("body"), // full markdown narrative
    approvedByCompany: boolean("approved_by_company").notNull().default(false),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_case_studies_published_at").on(table.publishedAt),
    index("idx_case_studies_slug").on(table.slug),
  ],
);

// ═══════════════════════════════════════════
// CTA click tracking — which surfaces convert
// ═══════════════════════════════════════════

/**
 * Tracks clicks on named CTAs (FounderCTA, primary hero button,
 * final-CTA button). Used for launch-week channel analysis paired
 * with the acquisition pipeline: "visitors from HN clicked the
 * FounderCTA at 12%, vs LinkedIn at 3%."
 *
 * Privacy: no raw user IDs, no PII, only browser-generated session
 * IDs + hashed user IDs. Referrer is normalized to domain only
 * before storage. Retention: 180 days via scheduled cleanup job.
 */
export const ctaClicks = pgTable(
  "cta_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ctaName: text("cta_name").notNull(),
    sourcePath: text("source_path"),
    referrerDomain: text("referrer_domain"),
    userIdHash: text("user_id_hash"),
    sessionId: text("session_id"),
    userAgentFamily: text("user_agent_family"),
    clickedAt: timestamp("clicked_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_cta_clicks_clicked_at").on(table.clickedAt),
    index("idx_cta_clicks_cta").on(table.ctaName),
    index("idx_cta_clicks_source_path").on(table.sourcePath),
  ],
);

/**
 * packets — persistence for the four vertical-packet runs.
 *
 *   kind  · which packet was generated:
 *           "agency-content-packet" | "recruiting-sourcing-sprint" |
 *           "growth-pulse" | "listing-pulse"
 *   inputJson  · the user-supplied form values (JSON string)
 *   outputJson · the full structured packet response (JSON string)
 *   errorCount · count of sub-asset failures (Promise.allSettled rejections)
 *   durationMs · server-measured run time
 *
 * Each row is a single user-visible artifact. Users browse their own
 * packets at /dashboard/packets and re-open a single one at
 * /dashboard/packets/[id]. The output is stored verbatim so re-rendering
 * doesn't re-charge the LLM.
 *
 * Privacy / retention: scoped by userId. Retention is unbounded today
 * — pruning policy is on the operator's roadmap once first paying
 * customers exist.
 */
export const packets = pgTable(
  "packets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    inputJson: text("input_json").notNull().default("{}"),
    outputJson: text("output_json").notNull().default("{}"),
    errorCount: integer("error_count").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_packets_user").on(table.userId),
    index("idx_packets_kind").on(table.kind),
    index("idx_packets_created").on(table.createdAt),
  ],
);

/**
 * agent_runs — persistent, signed receipts of every agent execution.
 *
 * Powers the public verifiable receipt URL (/r/[id]) — the differentiator
 * that lets users prove what an agent did, with which models, against
 * which safety checks. Every row is HMAC-signed at write time using
 * AGENT_RUN_SIGNING_SECRET so tampering is detectable.
 *
 * Privacy gate: rows default to private (visibility="private"). Users
 * opt to publish individual receipts via /api/agent-runs/[id]/publish,
 * which flips visibility to "public" and unlocks the unauthenticated
 * read path. Private rows always require Clerk auth.
 *
 * Retention: bounded only by user demand. Add a pruning job once we
 * have enough volume to justify it.
 */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"), // nullable — public/anonymous runs allowed for demos
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    agentName: text("agent_name").notNull(),
    modelUsed: text("model_used").notNull().default("unknown"),
    inputJson: text("input_json").notNull().default("{}"),
    outputJson: text("output_json").notNull().default("{}"),
    safetyResult: text("safety_result").notNull().default("{}"), // serialized verifyOutput result
    durationMs: integer("duration_ms").notNull().default(0),
    chainDepth: integer("chain_depth").notNull().default(0),
    trustDecision: text("trust_decision").notNull().default("auto-approved"), // auto-approved | needs-approval | blocked
    visibility: text("visibility").notNull().default("private"), // private | public | unlisted
    signature: text("signature").notNull(), // HMAC-SHA256 over canonical run data
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_agent_runs_user").on(table.userId),
    index("idx_agent_runs_agent").on(table.agentName),
    index("idx_agent_runs_created").on(table.createdAt),
    index("idx_agent_runs_visibility").on(table.visibility),
  ],
);
