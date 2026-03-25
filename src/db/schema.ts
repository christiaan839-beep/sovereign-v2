import { pgTable, text, timestamp, uuid, integer, index, boolean } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  nodeId: text("node_id").notNull().unique(), // e.g., UMB-NX-77492
  createdAt: timestamp("created_at").defaultNow(),
  plan: text("plan").notNull().default("black-card"), // Future-proofing for tiering
});

export const activeSwarms = pgTable("active_swarms", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  agentAlias: text("agent_alias").notNull(), // COMMANDER, AD-BUYER, etc.
  status: text("status").notNull().default("idle"),
  uptime: timestamp("uptime").defaultNow(),
});

export const globalTelemetry = pgTable("global_telemetry", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  eventType: text("event_type").notNull(), // e.g., "lead_scraped", "video_synthesized"
  payload: text("payload").notNull(), // JSON string representing the asset/data
  timestamp: timestamp("timestamp").defaultNow(),
});

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
});

export const scheduledContent = pgTable("scheduled_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
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
});

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
});

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
});

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
});

export const sequenceSteps = pgTable("sequence_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceId: uuid("sequence_id").references(() => emailSequences.id).notNull(),
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
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("usage_user_id_idx").on(table.userId),
  index("usage_created_at_idx").on(table.createdAt),
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
  plan: text("plan").notNull(), // node, array, cartel
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
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
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
  skillId: uuid("skill_id").references(() => customSkills.id),
  authorEmail: text("author_email").notNull(),
  authorName: text("author_name").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // sales, content, seo, code, automation, research
  systemPrompt: text("system_prompt").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  installs: integer("installs").notNull().default(0),
  rating: integer("rating").default(0), // 0-5
  createdAt: timestamp("created_at").defaultNow(),
});

// ═══════════════════════════════════════════
// Stripe Subscriptions
// ═══════════════════════════════════════════

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"), // owner, admin, member, viewer
  joinedAt: timestamp("joined_at").defaultNow(),
});

