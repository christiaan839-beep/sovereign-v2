CREATE TABLE "active_swarms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_alias" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"uptime" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ad_creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"platform" text DEFAULT 'meta' NOT NULL,
	"headline" text NOT NULL,
	"primary_text" text NOT NULL,
	"call_to_action" text DEFAULT 'Learn More',
	"target_audience" text,
	"hook" text,
	"style" text DEFAULT 'direct-response',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"lead_name" text NOT NULL,
	"lead_email" text NOT NULL,
	"lead_phone" text,
	"business_name" text,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"qualification_notes" text,
	"source" text DEFAULT 'website',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"agent_label" text,
	"response_time_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"title" text DEFAULT 'New Mission' NOT NULL,
	"model" text DEFAULT 'auto' NOT NULL,
	"system_prompt" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"system_prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"name" text NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_steps" text DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"tool" text NOT NULL,
	"action" text NOT NULL,
	"input_summary" text,
	"output" text NOT NULL,
	"tokens" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "global_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"business_name" text,
	"source" text DEFAULT 'organic',
	"status" text DEFAULT 'new' NOT NULL,
	"score" text DEFAULT '0',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid,
	"author_email" text NOT NULL,
	"author_name" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"system_prompt" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"installs" integer DEFAULT 0 NOT NULL,
	"rating" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text,
	"email" text NOT NULL,
	"gateway" text DEFAULT 'payfast' NOT NULL,
	"external_id" text,
	"plan" text NOT NULL,
	"amount" text NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"topic" text NOT NULL,
	"caption" text,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"image_prompt" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"step_number" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"delay_days" text DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"api_keys" text DEFAULT '{}',
	"webhooks" text DEFAULT '{}',
	CONSTRAINT "settings_user_email_unique" UNIQUE("user_email")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"node_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"plan" text DEFAULT 'black-card' NOT NULL,
	CONSTRAINT "tenants_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "tenants_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"model" text NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"tier" text DEFAULT 'sovereign' NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "voice_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"target_phone" text NOT NULL,
	"context" text,
	"status" text DEFAULT 'initiated' NOT NULL,
	"duration_seconds" integer DEFAULT 0,
	"transcript" text,
	"disposition" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whitelabel_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"agency_name" text DEFAULT 'SOVEREIGN' NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#00B7FF',
	"support_email" text,
	"domain" text DEFAULT '' NOT NULL,
	"tenant_id" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "whitelabel_config_user_email_unique" UNIQUE("user_email"),
	CONSTRAINT "whitelabel_config_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "active_swarms" ADD CONSTRAINT "active_swarms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_telemetry" ADD CONSTRAINT "global_telemetry_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_agents" ADD CONSTRAINT "marketplace_agents_skill_id_custom_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."custom_skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_content" ADD CONSTRAINT "scheduled_content_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "msg_conv_idx" ON "chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conv_clerk_user_idx" ON "conversations" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "gen_user_email_idx" ON "generations" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "gen_created_at_idx" ON "generations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_email_idx" ON "payments" USING btree ("email");--> statement-breakpoint
CREATE INDEX "payments_clerk_user_idx" ON "payments" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "usage_user_id_idx" ON "usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_created_at_idx" ON "usage" USING btree ("created_at");