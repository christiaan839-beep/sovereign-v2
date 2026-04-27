import { pgTable, text, timestamp, uuid, integer, index, boolean, uniqueIndex, jsonb, primaryKey, date } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  nodeId: text("node_id").notNull().unique(), // e.g., UMB-NX-77492
  createdAt: timestamp("created_at").defaultNow(),
  plan: text("plan").notNull().default("black-card"), // Future-proofing for tiering
});

export const activeSwarms = pgTable("active_swarms", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  agentAlias: text("agent_alias").notNull(), // COMMANDER, AD-BUYER, etc.
  status: text("status").notNull().default("idle"),
  uptime: timestamp("uptime").defaultNow(),
}, (table) => [
  index("idx_active_swarms_tenant").on(table.tenantId),
]);

export const globalTelemetry = pgTable("global_telemetry", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  eventType: text("event_type").notNull(), // e.g., "lead_scraped", "video_synthesized"
  payload: text("payload").notNull(), // JSON string representing the asset/data
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_telemetry_tenant").on(table.tenantId),
  index("idx_telemetry_timestamp").on(table.timestamp),
]);

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
  config: text("config").notNull().default('{}'), // JSON object stringified
  apiKeys: text("api_keys").default('{}'), // Store Gemini/Tavily etc
  webhooks: text("webhooks").default('{}'), // Store user saved webhooks
  weeklyReportOptIn: text("weekly_report_opt_in").default("false"), // "true" | "false" — opt-in for Proposal R
});

export const scheduledContent = pgTable("scheduled_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }), // nullable — some routes don't have tenant context
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

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userEmail: text("user_email").notNull(), // agency owner
  leadName: text("lead_name").notNull(),
  leadEmail: text("lead_email").notNull(),
  leadPhone: text("lead_phone"),
  businessName: text("business_name"),
  date: text("date").notNull(),        // ISO date string for the appointment
  time: text("time").notNull(),        // time slot like "10:00 AM"
  status: text("status").notNull().default("confirmed"), // confirmed, completed, no-show, cancelled
  qualificationNotes: text("qualification_notes"), // AI agent's notes from the conversation
  source: text("source").default("website"), // website, instagram, whatsapp, manual
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bookings_user").on(table.userEmail),
  index("idx_bookings_date").on(table.date),
]);

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  businessName: text("business_name"),
  source: text("source").default("organic"), // organic, paid, referral, scraper
  status: text("status").notNull().default("new"), // new, contacted, qualified, booked, closed, lost
  score: text("score").default("0"),   // 0-100 lead quality score
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_leads_user_email").on(table.userEmail),
  index("idx_leads_status").on(table.status),
]);

export const adCreatives = pgTable("ad_creatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  userEmail: text("user_email").notNull(),
  platform: text("platform").notNull().default("meta"), // meta, tiktok, google
  headline: text("headline").notNull(),
  primaryText: text("primary_text").notNull(),
  callToAction: text("call_to_action").default("Learn More"),
  targetAudience: text("target_audience"),
  hook: text("hook"),                  // the opening line / attention grabber
  style: text("style").default("direct-response"), // direct-response, storytelling, ugc, testimonial
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ad_creatives_user_email").on(table.userEmail),
]);

// ═══════════════════════════════════════════
// Phase 6: Email Sequence Engine
// ═══════════════════════════════════════════

export const emailSequences = pgTable("email_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(), // e.g., "Welcome Sequence", "Upsell Drip"
  trigger: text("trigger").notNull().default("manual"), // manual, stripe_checkout, lead_qualified, booking_confirmed
  status: text("status").notNull().default("draft"), // draft, active, paused
  totalSteps: text("total_steps").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_email_sequences_user_email").on(table.userEmail),
]);

export const sequenceSteps = pgTable("sequence_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceId: uuid("sequence_id").references(() => emailSequences.id, { onDelete: "cascade" }).notNull(),
  stepNumber: text("step_number").notNull(), // "1", "2", "3"
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML or plain text
  delayDays: text("delay_days").notNull().default("0"), // days after previous step
  createdAt: timestamp("created_at").defaultNow(),
});

// ═══════════════════════════════════════════
// Phase 7: Result History & Usage Metering
// ═══════════════════════════════════════════

export const generations = pgTable("generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userEmail: text("user_email").notNull(),
  tool: text("tool").notNull(),           // "seo-dominator", "content-factory", etc.
  action: text("action").notNull(),        // "xray", "blog", "email", etc.
  inputSummary: text("input_summary"),     // Brief input description for library display
  output: text("output").notNull(),        // Full AI output
  tokens: integer("tokens").default(0),    // Estimated token count
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("gen_user_email_idx").on(table.userEmail),
  index("gen_created_at_idx").on(table.createdAt),
]);

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

export const usage = pgTable("usage", {
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
}, (table) => [
  index("usage_user_id_idx").on(table.userId),
  index("usage_created_at_idx").on(table.createdAt),
  index("usage_provider_idx").on(table.provider),
  index("usage_request_id_idx").on(table.requestId),
]);

// ═══════════════════════════════════════════
// Payments & Subscription Tracking
// ═══════════════════════════════════════════

export const payments = pgTable("payments", {
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
}, (table) => [
  index("payments_email_idx").on(table.email),
  index("payments_clerk_user_idx").on(table.clerkUserId),
]);

// ═══════════════════════════════════════════
// Conversation Persistence
// ═══════════════════════════════════════════

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull(),
  title: text("title").notNull().default("New Mission"),
  model: text("model").notNull().default("auto"),
  systemPrompt: text("system_prompt"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  archived: boolean("archived").notNull().default(false),
}, (table) => [
  index("conv_clerk_user_idx").on(table.clerkUserId),
]);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(), // user, assistant
  content: text("content").notNull(),
  agentLabel: text("agent_label"),
  responseTimeMs: integer("response_time_ms"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("msg_conv_idx").on(table.conversationId),
]);

// ═══════════════════════════════════════════
// Agent Marketplace
// ═══════════════════════════════════════════

export const marketplaceAgents = pgTable("marketplace_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  skillId: uuid("skill_id").references(() => customSkills.id, { onDelete: "set null" }),

  // Author
  authorEmail: text("author_email").notNull(),
  authorName: text("author_name").notNull(),
  creatorUserId: text("creator_user_id"),            // Clerk user ID — persists across email changes

  // Content
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),              // sales|content|seo|code|automation|research|voice|data
  systemPrompt: text("system_prompt").notNull(),
  tags: text("tags").notNull().default("[]"),        // JSON string[]

  // Discovery
  isPublic: boolean("is_public").notNull().default(true),
  installs: integer("installs").notNull().default(0),
  rating: integer("rating").default(0),              // 0-5 star average
  featured: boolean("featured").notNull().default(false),
  featuredAt: timestamp("featured_at"),

  // Monetisation
  pricePerRun: integer("price_per_run").notNull().default(0),            // cents — 0 = free
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  stripeConnectAccountId: text("stripe_connect_account_id"),            // creator's Connect account

  // Usage stats (denormalised for fast leaderboard queries)
  totalRunCount: integer("total_run_count").notNull().default(0),
  weeklyRunCount: integer("weekly_run_count").notNull().default(0),
  revenueCents: integer("revenue_cents").notNull().default(0),           // gross
  creatorRevenueCents: integer("creator_revenue_cents").notNull().default(0), // 70% share

  // Verification pipeline
  verificationStatus: text("verification_status").notNull().default("pending"),
  // pending | in_review | verified | rejected | suspended
  verifiedAt: timestamp("verified_at"),
  testRunPassed: boolean("test_run_passed"),
  safetyScore: integer("safety_score"),              // 0-100 from 5-layer check
  rejectionReason: text("rejection_reason"),

  // User-facing URL slug — /marketplace/{slug}. Nullable for legacy
  // rows with no SAM provenance; populated from manifest.slug for SAM
  // submissions. Unique (partial index) among non-null values.
  // See drizzle/0026_marketplace_slug.sql.
  slug: text("slug"),

  // Semantic-search embedding (migration 0029). Produced by
  // nvidia/llama-3.2-nv-embedqa-1b-v2 (2048-dim). Stored as JSONB
  // because pg_vector is opt-in on Neon; we run cosine similarity
  // in app code for now. When agent count exceeds ~10k, migrate to
  // pg_vector without touching call sites.
  embedding: jsonb("embedding"),
  embeddingModel: text("embedding_model"),
  embeddingUpdatedAt: timestamp("embedding_updated_at", { withTimezone: true }),

  // SAM v1.0 submission fields (null for rows created pre-SAM / via
  // /api/marketplace/submit). See drizzle/0025_sam_submission_fields.sql
  // for the migration. `submissionSource` discriminates the entry point:
  //   "dashboard"  — logged-in user via /api/marketplace/submit
  //   "sam-v1"     — external creator via /api/creators/submit
  samVersion: text("sam_version"),
  manifestRaw: jsonb("manifest_raw"),
  referenceId: text("reference_id"),                 // SAM-xxxxxxxx-xxxx
  submissionPolicy: text("submission_policy"),        // open | curated | trust-tiered
  submissionReason: text("submission_reason"),
  submissionSource: text("submission_source").default("dashboard"),

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_marketplace_creator").on(table.creatorUserId),
  index("idx_marketplace_category").on(table.category),
  index("idx_marketplace_status").on(table.verificationStatus),
  index("idx_marketplace_runs").on(table.totalRunCount),
  index("idx_marketplace_reference_id").on(table.referenceId),
  index("idx_marketplace_author_status").on(table.authorEmail, table.verificationStatus),
  index("idx_marketplace_slug").on(table.slug),
]);

// ═══════════════════════════════════════════
// Webhook Subscriptions (migration 0031)
// ═══════════════════════════════════════════
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  agentSlug: text("agent_slug").notNull(),
  callbackUrl: text("callback_url").notNull(),
  secret: text("secret").notNull(),
  ownerEmail: text("owner_email").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  triggerCount: integer("trigger_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
}, (table) => [
  index("idx_webhooks_active_agent").on(table.agentSlug, table.isActive),
  index("idx_webhooks_owner").on(table.ownerEmail),
]);

export const webhookDeliveryAttempts = pgTable("webhook_delivery_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
  invocationId: text("invocation_id").notNull(),
  attemptNumber: integer("attempt_number").notNull().default(1),
  responseStatus: integer("response_status"),
  responseBodyPreview: text("response_body_preview"),
  delivered: boolean("delivered").notNull().default(false),
  errorMessage: text("error_message"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_deliveries_subscription").on(table.subscriptionId, table.attemptedAt),
  index("idx_deliveries_failed").on(table.delivered, table.attemptedAt),
]);

// ═══════════════════════════════════════════
// Agent Bundles (migration 0030)
// ═══════════════════════════════════════════
// Curated sets of agents published as one unit. See
// drizzle/0030_agent_bundles.sql. Membership shares sum to 100.
export const agentBundles = pgTable("agent_bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  publisherEmail: text("publisher_email").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  creatorSharePct: integer("creator_share_pct").notNull().default(70),
  isPublic: boolean("is_public").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_bundles_public").on(table.isPublic, table.category),
  index("idx_bundles_publisher").on(table.publisherEmail),
]);

export const agentBundleMemberships = pgTable("agent_bundle_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  bundleId: uuid("bundle_id")
    .notNull()
    .references(() => agentBundles.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => marketplaceAgents.id, { onDelete: "cascade" }),
  agentSlug: text("agent_slug").notNull(),
  sharePct: integer("share_pct").notNull(),
  position: integer("position").notNull().default(0),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ux_bundle_memberships_pair").on(table.bundleId, table.agentId),
  index("idx_bundle_memberships_bundle").on(table.bundleId, table.position),
  index("idx_bundle_memberships_agent").on(table.agentId),
]);

// ═══════════════════════════════════════════
// Creator Earnings Ledger
// ═══════════════════════════════════════════
// See drizzle/0028_creator_earnings.sql. Immutable append-only ledger;
// one row per agent invocation. The 70/30 split (creator / platform)
// is stored as cents per row for audit + query speed.
export const creatorEarnings = pgTable("creator_earnings", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => marketplaceAgents.id, { onDelete: "cascade" }),
  creatorEmail: text("creator_email").notNull(),
  invocationId: text("invocation_id"),

  grossCents: integer("gross_cents").notNull(),
  creatorCents: integer("creator_cents").notNull(),
  platformCents: integer("platform_cents").notNull(),

  status: text("status").notNull().default("pending"), // pending | paid | reversed
  payoutBatchId: uuid("payout_batch_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
}, (table) => [
  index("idx_earnings_creator").on(table.creatorEmail, table.createdAt),
  index("idx_earnings_agent").on(table.agentId, table.createdAt),
  index("idx_earnings_status").on(table.status),
  index("idx_earnings_batch").on(table.payoutBatchId),
]);

export const creatorPayoutBatches = pgTable("creator_payout_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorEmail: text("creator_email").notNull(),
  totalCents: integer("total_cents").notNull(),
  stripeTransferId: text("stripe_transfer_id"),
  status: text("status").notNull().default("pending"), // pending | sent | failed
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_payout_batch_creator").on(table.creatorEmail, table.createdAt),
  index("idx_payout_batch_status").on(table.status),
]);

// ═══════════════════════════════════════════
// Marketplace View Tracking (privacy-minimal)
// ═══════════════════════════════════════════
// See drizzle/0027_marketplace_agent_views.sql. No IP, no raw UA, no
// referrer path — only the host. Identity is an anonymous UUID
// minted client-side in localStorage.
export const marketplaceAgentViews = pgTable("marketplace_agent_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => marketplaceAgents.id, { onDelete: "cascade" }),
  slug: text("slug"),
  anonymousId: text("anonymous_id").notNull(),
  referrerHost: text("referrer_host"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_views_agent_time").on(table.agentId, table.createdAt),
  index("idx_views_time").on(table.createdAt),
  index("idx_views_anon_agent").on(table.anonymousId, table.agentId, table.createdAt),
]);

// ═══════════════════════════════════════════
// Stripe Subscriptions
// ═══════════════════════════════════════════

export const subscriptions = pgTable("subscriptions", {
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
}, (table) => [
  index("idx_subscriptions_user").on(table.userId),
  index("idx_subscriptions_stripe").on(table.stripeCustomerId),
  index("idx_subscriptions_founder_network").on(table.founderNetworkJoinedAt),
  index("idx_subscriptions_acq_source").on(table.acquisitionSource),
  index("idx_subscriptions_acquired_at").on(table.acquiredAt),
]);

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
export const oauthConnections = pgTable("oauth_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),        // "slack", "gmail", "hubspot", ...
  workspaceId: text("workspace_id").notNull(), // Slack team id / Gmail account id
  workspaceName: text("workspace_name"),
  accessToken: text("access_token").notNull(), // safeEncrypt'd
  refreshToken: text("refresh_token"),         // safeEncrypt'd (nullable for non-rotating providers)
  scopes: text("scopes").array(),
  botUserId: text("bot_user_id"),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
}, (table) => [
  uniqueIndex("uniq_oauth_user_provider_workspace").on(
    table.userId, table.provider, table.workspaceId,
  ),
  index("idx_oauth_user_provider").on(table.userId, table.provider),
]);

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
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
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
  // Added in migration 0017_semantic_memory.sql
  embeddingJson: text("embedding_json"),       // JSON-stringified float32[1024]
  importanceScore: text("importance_score"),   // REAL — stored as text for broad PG compat
  memoryType: text("memory_type"),             // 'execution' | 'insight' | 'preference' | 'fact'
  sourceAgent: text("source_agent"),
  sessionId: text("session_id"),
});

// ═══════════════════════════════════════════
// Audit Logs — SOC 2 Compliance
// ═══════════════════════════════════════════

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  resource: text("resource"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_user").on(table.userId),
  index("idx_audit_action").on(table.action),
  index("idx_audit_created").on(table.createdAt),
]);

// ═══════════════════════════════════════════
// Error Monitoring
// ═══════════════════════════════════════════

export const errorLogs = pgTable("error_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  message: text("message").notNull(),
  stack: text("stack"),
  context: text("context"),
  severity: text("severity").notNull().default("medium"),
  userId: text("user_id"),
  agentId: text("agent_id"),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_errors_severity").on(table.severity),
  index("idx_errors_created").on(table.createdAt),
]);

// ═══════════════════════════════════════════
// API Keys — validated against DB, not prefix
// ═══════════════════════════════════════════

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  key: text("key").notNull().unique(),          // hashed API key
  keyPrefix: text("key_prefix").notNull(),      // first 8 chars for display (sk_pro_ab)
  plan: text("plan").notNull().default("free"), // free, pro, enterprise
  label: text("label"),                         // user-defined label
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),           // null = never expires
  revokedAt: timestamp("revoked_at"),           // null = active
  // ─── Scope columns (added in migration 0034) ───
  // NULL on `scopes` = legacy full-access. Empty array = revoked-in-place.
  // Per-agent scopes ("agent:execute:<slug>") take precedence over generic.
  // Evaluated by src/lib/api-key-scopes.ts → evaluateScope().
  scopes: jsonb("scopes").$type<string[] | null>(),
  allowedAgents: jsonb("allowed_agents").$type<string[] | null>(),
  allowedIps: jsonb("allowed_ips").$type<string[] | null>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_api_keys_key").on(table.key),
  index("idx_api_keys_user").on(table.userId),
]);

// ═══════════════════════════════════════════
// Workflow Builder — Persistent Pipelines
// ═══════════════════════════════════════════

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  nodes: text("nodes").notNull(), // JSON string of AgentNode[]
  status: text("status").notNull().default("draft"), // draft, active, archived
  lastRunAt: timestamp("last_run_at"),
  runCount: integer("run_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_workflows_user").on(table.userId),
]);

// ═══════════════════════════════════════════
// Graph Memory Fabric — Knowledge Graph for Agent Intelligence
// ═══════════════════════════════════════════

/** Graph nodes — entities in the knowledge graph */
export const graphNodes = pgTable("graph_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(), // tenant isolation
  nodeType: text("node_type").notNull(), // agent, task, document, user, tool, outcome, concept
  label: text("label").notNull(), // human-readable name
  properties: text("properties").notNull().default("{}"), // JSON — flexible metadata
  confidence: integer("confidence").default(100), // 0-100 confidence score
  embedding: text("embedding"), // JSON array for vector search (serialized float[])
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_graph_nodes_user").on(table.userId),
  index("idx_graph_nodes_type").on(table.nodeType),
  index("idx_graph_nodes_label").on(table.label),
]);

/** Graph edges — relationships between nodes */
export const graphEdges = pgTable("graph_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  sourceId: uuid("source_id").references(() => graphNodes.id, { onDelete: "cascade" }).notNull(),
  targetId: uuid("target_id").references(() => graphNodes.id, { onDelete: "cascade" }).notNull(),
  edgeType: text("edge_type").notNull(), // EXECUTED, DEPENDS_ON, CITED, LEADS_TO, SIMILAR_TO, CAUSED, PRECEDED
  weight: integer("weight").default(100), // 0-100 — temporal decay reduces this
  properties: text("properties").notNull().default("{}"), // JSON metadata
  confidence: integer("confidence").default(100),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_graph_edges_user").on(table.userId),
  index("idx_graph_edges_source").on(table.sourceId),
  index("idx_graph_edges_target").on(table.targetId),
  index("idx_graph_edges_type").on(table.edgeType),
]);

// ═══════════════════════════════════════════
// Affiliate / Referral Program
// ═══════════════════════════════════════════

export const affiliates = pgTable("affiliates", {
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
}, (table) => [
  index("idx_affiliates_code").on(table.referralCode),
  index("idx_affiliates_user").on(table.userId),
]);

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  affiliateId: uuid("affiliate_id").references(() => affiliates.id, { onDelete: "cascade" }).notNull(),
  referredUserId: text("referred_user_id").notNull(),
  referredEmail: text("referred_email").notNull(),
  plan: text("plan").default("free"), // plan they signed up for
  revenue: integer("revenue").notNull().default(0), // cents earned from this referral
  status: text("status").notNull().default("signed_up"), // signed_up, converted, churned
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_referrals_affiliate").on(table.affiliateId),
]);

// ═══════════════════════════════════════════
// Playbook Runs — Persistent multi-agent execution history
// Every step is written to DB in real-time so the UI can poll for live progress.
// ═══════════════════════════════════════════

export const playbookRuns = pgTable("playbook_runs", {
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
  // Added in migration 0023 — links a run back to the scheduled_playbooks
  // row that triggered it. NULL for user-triggered runs.
  scheduledId: uuid("scheduled_id"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_playbook_runs_user").on(table.userId),
  index("idx_playbook_runs_status").on(table.status),
  index("idx_playbook_runs_created").on(table.createdAt),
  index("idx_playbook_runs_scheduled").on(table.scheduledId),
]);

export const playbookRunSteps = pgTable("playbook_run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => playbookRuns.id, { onDelete: "cascade" }).notNull(),
  stepIndex: integer("step_index").notNull(),
  agentName: text("agent_name").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending | running | done | failed | skipped
  result: text("result"), // JSON stringified
  error: text("error"),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_playbook_steps_run").on(table.runId),
]);

// ═══════════════════════════════════════════
// Visual-editor DAG playbooks (D1 — drizzle/0036)
//
// Two tables:
//   playbookDags     — definitions authored in the visual editor
//   playbookDagRuns  — execution history with frozen DAG snapshot
//
// Separated from playbookRuns because the latter is for code-defined
// playbook runs (linear pipelines from src/lib/playbooks.ts). DAG-shaped
// playbooks have a different shape (graph not list) and a different
// lifecycle (authored in-app vs. shipped in-code).
// ═══════════════════════════════════════════

export const playbookDags = pgTable("playbook_dags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // The full DAG payload — { nodes: [...], edges: [...] }. Type lives
  // in src/lib/playbook-dag.ts as PlaybookDag.
  dag: jsonb("dag").notNull(),
  status: text("status").notNull().default("draft"), // draft | published | archived
  // Denormalized counts so list endpoints don't parse JSONB per row.
  nodeCount: integer("node_count").notNull().default(0),
  edgeCount: integer("edge_count").notNull().default(0),
  // Last-run telemetry. NULL until first execution. Powers the
  // "My playbooks" panel status pills.
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: text("last_run_status"), // completed | failed | NULL
  lastRunDurationMs: integer("last_run_duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_playbook_dags_user_updated").on(table.userId, table.updatedAt),
  index("idx_playbook_dags_user_status").on(table.userId, table.status),
]);

export const playbookDagRuns = pgTable("playbook_dag_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  // SET NULL on delete so the run history survives parent deletion.
  // The dagSnapshot below freezes the shape that actually ran, so
  // forensics work even after the DAG is gone.
  dagId: uuid("dag_id").references(() => playbookDags.id, { onDelete: "set null" }),
  // Frozen DAG shape at execution time. Cannot be answered by reading
  // the live `dag` column on the parent because the user may have
  // edited it since this run completed.
  dagSnapshot: jsonb("dag_snapshot").notNull(),
  // running | completed | failed. running = in-flight async execution.
  status: text("status").notNull(),
  nodeCount: integer("node_count").notNull(),
  edgeCount: integer("edge_count").notNull(),
  // Per-node NodeRunResult[] — see src/lib/playbook-dag.ts. The
  // store layer truncates large per-node outputs before insertion
  // (~32KB cap per result) so rows don't bloat.
  results: jsonb("results").notNull(),
  totalDurationMs: integer("total_duration_ms").notNull(),
  // nodeId of the first failing node (mirrors ExecuteDagResult.failedAt).
  failedAt: text("failed_at"),
  // ─── Round 12 / drizzle 0037: async-execution telemetry ──────────
  // Number of nodes whose status is "completed" or "failed" so far.
  // Updated incrementally during async runs so the editor's polling
  // client can render "5 of 12 nodes" without re-parsing results.
  progressNodesCompleted: integer("progress_nodes_completed").notNull().default(0),
  // Distinct from createdAt because async runs may queue briefly
  // before pickup. For sync runs the two are effectively equal.
  startedAt: timestamp("started_at"),
  // Touched on every node-complete write. Orphan-detection cleanup
  // (future cron) uses this to find stuck "running" rows.
  lastProgressAt: timestamp("last_progress_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_playbook_dag_runs_user_created").on(table.userId, table.createdAt),
  index("idx_playbook_dag_runs_dag").on(table.dagId, table.createdAt),
  index("idx_playbook_dag_runs_user_status").on(table.userId, table.status),
]);

// ═══════════════════════════════════════════
// Async Job Queue
// Fire-and-forget agent execution — user submits a goal,
// gets a job ID back immediately, result arrives via Telegram.
// ═══════════════════════════════════════════

export const jobs = pgTable("jobs", {
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
}, (table) => [
  index("idx_jobs_user").on(table.userId),
  index("idx_jobs_status").on(table.status),
  index("idx_jobs_created").on(table.createdAt),
]);


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
export const caseStudies = pgTable("case_studies", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  company: text("company").notNull(),
  industry: text("industry"),
  outcome: text("outcome").notNull(),    // one-line headline result
  metric: text("metric").notNull(),      // the number leading the card
  playbook: text("playbook").notNull(),  // which playbook delivered it
  body: text("body"),                     // full markdown narrative
  approvedByCompany: boolean("approved_by_company").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_case_studies_published_at").on(table.publishedAt),
  index("idx_case_studies_slug").on(table.slug),
]);

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

// ═══════════════════════════════════════════
// Sovereign World (migration 0020)
// ═══════════════════════════════════════════
// Metadata + user interactions for the 137 agents in the registry.
// Powers /world constellation, /marketplace, /agents/[slug], /leaderboard.
// slug (text PK) couples to the code registry — rename-as-migration.

export const agentMetadata = pgTable("agent_metadata", {
  slug: text("slug").primaryKey(),
  displayName: text("display_name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  category: text("category").notNull().default("general"),
  subcategory: text("subcategory"),
  icon: text("icon"),          // emoji OR lucide name
  heroColor: text("hero_color"),
  creatorUserId: text("creator_user_id"),
  creatorHandle: text("creator_handle"),
  pricingCents: integer("pricing_cents").notNull().default(0),
  tags: text("tags").array(),
  featured: boolean("featured").notNull().default(false),
  verified: boolean("verified").notNull().default(false),
  published: boolean("published").notNull().default(true),
  visibility: text("visibility").notNull().default("public"),
  useCases: jsonb("use_cases").$type<Array<{
    title: string;
    description: string;
    exampleInput?: string;
    exampleOutput?: string;
  }>>(),
  faq: jsonb("faq").$type<Array<{ question: string; answer: string }>>(),
  sampleOutputRunId: uuid("sample_output_run_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_agent_metadata_category").on(table.category),
  index("idx_agent_metadata_featured").on(table.featured),
  index("idx_agent_metadata_visibility").on(table.visibility),
]);

export const agentInstalls = pgTable("agent_installs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  agentSlug: text("agent_slug").notNull(),
  installedAt: timestamp("installed_at").defaultNow(),
}, (table) => [
  uniqueIndex("agent_installs_unique").on(table.userId, table.agentSlug),
  index("idx_agent_installs_user").on(table.userId),
  index("idx_agent_installs_agent").on(table.agentSlug),
]);

export const agentReviews = pgTable("agent_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  agentSlug: text("agent_slug").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("agent_reviews_one_per_user").on(table.userId, table.agentSlug),
  index("idx_agent_reviews_agent").on(table.agentSlug, table.createdAt),
]);

export const agentStatsDaily = pgTable("agent_stats_daily", {
  agentSlug: text("agent_slug").notNull(),
  day: date("day").notNull(),
  runs: integer("runs").notNull().default(0),
  successes: integer("successes").notNull().default(0),
  avgDurationMs: integer("avg_duration_ms"),
  totalCostCents: integer("total_cost_cents").notNull().default(0),
  uniqueUsers: integer("unique_users").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.agentSlug, table.day] }),
  index("idx_agent_stats_day").on(table.day),
]);

// ═══════════════════════════════════════════
// CTA click tracking — which surfaces convert
// ═══════════════════════════════════════════
export const ctaClicks = pgTable("cta_clicks", {
  id: uuid("id").primaryKey().defaultRandom(),
  ctaName: text("cta_name").notNull(),
  sourcePath: text("source_path"),
  referrerDomain: text("referrer_domain"),
  userIdHash: text("user_id_hash"),
  sessionId: text("session_id"),
  userAgentFamily: text("user_agent_family"),
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
}, (table) => [
  index("idx_cta_clicks_clicked_at").on(table.clickedAt),
  index("idx_cta_clicks_cta").on(table.ctaName),
  index("idx_cta_clicks_source_path").on(table.sourcePath),
]);

// ═══════════════════════════════════════════
// Credit System (migration 0018)
// ═══════════════════════════════════════════
// Tracks balance, ledger, and in-flight holds for AI agent runs.
// All amounts are CENTS (integer) — no float arithmetic, no drift.

/**
 * Current balance per user. One row per user; service-role writes only.
 * Balance is non-negative (DB constraint). Plan tier drives pricing +
 * entitlements elsewhere in the app.
 */
export const userCredits = pgTable("user_credits", {
  userId: text("user_id").primaryKey(),
  balanceCents: integer("balance_cents").notNull().default(0),
  planTier: text("plan_tier").notNull().default("free"),
  lastToppedUpAt: timestamp("last_topped_up_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_credits_tier").on(table.planTier),
]);

/**
 * Append-only ledger. Every balance change has a matching row here so
 * balances can be reconstructed from zero at any point in time. This is
 * the audit trail for SOC 2 + the user-facing transaction history.
 *
 * `reason` enum (DB-constrained):
 *   topup          — deposit via Stripe/Yoco
 *   agent_run      — direct deduction for a run
 *   refund         — credit returned to user
 *   adjustment     — manual (admin) correction
 *   promo          — promotional/signup bonus
 *   hold_capture   — hold converted to real deduction
 *   hold_release   — hold cancelled, balance restored
 */
export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  deltaCents: integer("delta_cents").notNull(),
  reason: text("reason").notNull(),
  agentId: text("agent_id"),
  runId: uuid("run_id"),
  holdId: uuid("hold_id"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_credit_tx_user_created").on(table.userId, table.createdAt),
  index("idx_credit_tx_agent").on(table.agentId),
  index("idx_credit_tx_run").on(table.runId),
]);

/**
 * Pre-reserves credits before a run starts so concurrent requests can't
 * oversubscribe. On success the hold is captured (becomes a tx row).
 * On failure/timeout it's released (balance restored). TTL is enforced
 * by a cleanup job, not a DB trigger.
 *
 * `status` enum: active | captured | released | expired
 */
export const creditHolds = pgTable("credit_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  agentRunId: uuid("agent_run_id"),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  capturedAt: timestamp("captured_at"),
  releasedAt: timestamp("released_at"),
}, (table) => [
  index("idx_credit_holds_user").on(table.userId),
  index("idx_credit_holds_expires").on(table.expiresAt),
  index("idx_credit_holds_run").on(table.agentRunId),
]);

// ═══════════════════════════════════════════
// Continuous Evals (migration 0021)
// ═══════════════════════════════════════════
// Persists the results of every golden-set eval run so we can track
// pass-rate trends and detect silent drift via output_hash changes.

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  trigger: text("trigger").notNull(), // 'scheduled' | 'manual' | 'ci'
  total: integer("total").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  durationMs: integer("duration_ms"),
  // REAL in Postgres; Drizzle reads/writes as string to preserve precision
  passRate: text("pass_rate"),
}, (table) => [
  index("idx_eval_runs_started").on(table.startedAt),
]);

export const evalRunResults = pgTable("eval_run_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => evalRuns.id, { onDelete: "cascade" }).notNull(),
  evalSlug: text("eval_slug").notNull(),
  agentSlug: text("agent_slug").notNull(),
  status: text("status").notNull(), // 'passed' | 'failed' | 'skipped'
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  outputHash: text("output_hash"), // SHA-256 of canonical-JSON output
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_eval_results_run").on(table.runId),
  index("idx_eval_results_agent").on(table.agentSlug),
  index("idx_eval_results_status").on(table.status),
]);

// ═══════════════════════════════════════════
// Scheduled Playbooks (migration 0022)
// ═══════════════════════════════════════════
// Users can schedule any playbook on a cron expression. The
// dispatcher cron (runs every minute) picks rows where next_run_at
// has passed, enqueues via the existing QStash queue, and recomputes
// next_run_at from the cron_expression + timezone.

export const scheduledPlaybooks = pgTable("scheduled_playbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  playbookId: text("playbook_id").notNull(),
  inputs: text("inputs").notNull().default("{}"),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  active: boolean("active").notNull().default(true),
  nextRunAt: timestamp("next_run_at").notNull(),
  lastRunAt: timestamp("last_run_at"),
  lastRunId: uuid("last_run_id"),
  runCount: integer("run_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_scheduled_user").on(table.userId),
  index("idx_scheduled_next_run").on(table.nextRunAt),
]);

// ═══════════════════════════════════════════
// Safety Events (migration 0019)
// ═══════════════════════════════════════════
// Audit log for every block/warn from the NemoGuard pipeline.
// Prompts are SHA-256 hashed — we never store raw flagged content.

/**
 * Blocked-content audit trail for SOC 2 and dispute resolution.
 *
 * `stage` enum: jailbreak | content_in | content_out | pii | topic | quality
 * `outcome` enum: blocked | warned | skipped | passed
 *
 * Retention: 90 days via scheduled cleanup job.
 */
export const safetyEvents = pgTable("safety_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  agentId: text("agent_id").notNull(),
  stage: text("stage").notNull(),
  reason: text("reason").notNull(),
  category: text("category"),
  promptHash: text("prompt_hash").notNull(),
  promptLen: integer("prompt_len").notNull(),
  outcome: text("outcome").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_safety_events_user_created").on(table.userId, table.createdAt),
  index("idx_safety_events_agent").on(table.agentId),
  index("idx_safety_events_stage").on(table.stage),
  index("idx_safety_events_created").on(table.createdAt),
]);
