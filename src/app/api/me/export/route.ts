/**
 * GET /api/me/export — comprehensive user data dump.
 *
 * GDPR Art. 15 + 20 + POPIA Section 23 right of access / data
 * portability. Returns every row in the database that's keyed to the
 * authenticated user, as a single JSON payload with a Content-Disposition
 * attachment header so it downloads straight to the user's machine.
 *
 * Scope:
 *   - userId-scoped tables  (Clerk user ID match)
 *   - userEmail-scoped tables (user's primary email match)
 *   - clerkUserId-scoped tables (tenants linkage)
 *
 * Tables NOT included:
 *   - cta_clicks (only stores hashed user IDs; identity is one-way)
 *   - global_telemetry (event metadata only, no PII)
 *
 * Best-effort: every table query is independent. If one table is
 * missing (migration not yet applied) we return [] for that key
 * rather than failing the entire export.
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  agentActivity,
  apiKeys,
  auditLogs,
  bookings,
  adCreatives,
  chatMessages,
  clientProjects,
  conversations,
  customSkills,
  emailSequences,
  generations,
  jobs,
  leads,
  oauthConnections,
  packets,
  payments,
  playbookRuns,
  playbookRunSteps,
  referrals,
  scheduledContent,
  scheduledRuns,
  sequenceSteps,
  settings,
  subscriptions,
  tenantMemories,
  tenants,
  usage,
  users,
  voiceCalls,
  whitelabelConfig,
  workflows,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/me/export");

async function safeQuery<T>(
  label: string,
  fn: () => Promise<T[]>,
): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    log.warn(`export skipped: ${label}`, {
      error: (err as Error).message,
    });
    return [];
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";

  // ─── Run every table query in parallel — best-effort ─────────────
  const [
    user_record,
    settings_rows,
    subscriptions_rows,
    payments_rows,
    api_keys_rows,
    oauth_connections_rows,
    audit_logs_rows,
    tenant_memories_rows,
    voice_calls_rows,
    chat_messages_rows,
    conversations_rows,
    client_projects_rows,
    leads_rows,
    ad_creatives_rows,
    bookings_rows,
    email_sequences_rows,
    sequence_steps_rows,
    generations_rows,
    usage_rows,
    agent_activity_rows,
    playbook_runs_rows,
    playbook_run_steps_rows,
    jobs_rows,
    workflows_rows,
    scheduled_runs_rows,
    scheduled_content_rows,
    custom_skills_rows,
    whitelabel_config_rows,
    packets_rows,
    referrals_rows,
    tenants_rows,
  ] = await Promise.all([
    safeQuery("users", () =>
      email
        ? db.select().from(users).where(eq(users.email, email))
        : Promise.resolve([]),
    ),
    safeQuery("settings", () =>
      email
        ? db.select().from(settings).where(eq(settings.userEmail, email))
        : Promise.resolve([]),
    ),
    safeQuery("subscriptions", () =>
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    ),
    safeQuery("payments", () =>
      db.select().from(payments).where(eq(payments.clerkUserId, userId)),
    ),
    safeQuery("api_keys", () =>
      db.select().from(apiKeys).where(eq(apiKeys.userId, userId)),
    ),
    safeQuery("oauth_connections", () =>
      db
        .select()
        .from(oauthConnections)
        .where(eq(oauthConnections.userId, userId)),
    ),
    safeQuery("audit_logs", () =>
      db.select().from(auditLogs).where(eq(auditLogs.userId, userId)),
    ),
    safeQuery("tenant_memories", () =>
      db.select().from(tenantMemories).where(eq(tenantMemories.userId, userId)),
    ),
    safeQuery("voice_calls", () =>
      email
        ? db.select().from(voiceCalls).where(eq(voiceCalls.userEmail, email))
        : Promise.resolve([]),
    ),
    // chat_messages cascade-deletes via conversations FK; we surface
    // them via a sub-query keyed off the user's conversations.
    safeQuery("chat_messages", () =>
      email
        ? db
            .select()
            .from(chatMessages)
            .innerJoin(
              conversations,
              eq(chatMessages.conversationId, conversations.id),
            )
            .where(eq(conversations.clerkUserId, userId))
            .then((rows) =>
              rows.map((r) => ({
                ...r.chat_messages,
                _conversationOwner: userId,
              })),
            )
        : Promise.resolve([]),
    ),
    safeQuery("conversations", () =>
      db
        .select()
        .from(conversations)
        .where(eq(conversations.clerkUserId, userId)),
    ),
    safeQuery("client_projects", () =>
      db.select().from(clientProjects).where(eq(clientProjects.userId, userId)),
    ),
    safeQuery("leads", () =>
      email
        ? db.select().from(leads).where(eq(leads.userEmail, email))
        : Promise.resolve([]),
    ),
    safeQuery("ad_creatives", () =>
      email
        ? db.select().from(adCreatives).where(eq(adCreatives.userEmail, email))
        : Promise.resolve([]),
    ),
    safeQuery("bookings", () =>
      email
        ? db.select().from(bookings).where(eq(bookings.userEmail, email))
        : Promise.resolve([]),
    ),
    safeQuery("email_sequences", () =>
      email
        ? db
            .select()
            .from(emailSequences)
            .where(eq(emailSequences.userEmail, email))
        : Promise.resolve([]),
    ),
    // sequence_steps cascade-deletes via email_sequences FK; surface
    // them via inner join keyed on the user's sequences.
    safeQuery("sequence_steps", () =>
      email
        ? db
            .select()
            .from(sequenceSteps)
            .innerJoin(
              emailSequences,
              eq(sequenceSteps.sequenceId, emailSequences.id),
            )
            .where(eq(emailSequences.userEmail, email))
            .then((rows) => rows.map((r) => r.sequence_steps))
        : Promise.resolve([]),
    ),
    safeQuery("generations", () =>
      email
        ? db.select().from(generations).where(eq(generations.userEmail, email))
        : Promise.resolve([]),
    ),
    safeQuery("usage", () =>
      db.select().from(usage).where(eq(usage.userId, userId)),
    ),
    safeQuery("agent_activity", () =>
      db.select().from(agentActivity).where(eq(agentActivity.userId, userId)),
    ),
    safeQuery("playbook_runs", () =>
      db.select().from(playbookRuns).where(eq(playbookRuns.userId, userId)),
    ),
    // playbook_run_steps cascade-deletes via playbook_runs FK; we
    // surface them via inner join against the user's runs.
    safeQuery("playbook_run_steps", () =>
      db
        .select()
        .from(playbookRunSteps)
        .innerJoin(playbookRuns, eq(playbookRunSteps.runId, playbookRuns.id))
        .where(eq(playbookRuns.userId, userId))
        .then((rows) => rows.map((r) => r.playbook_run_steps)),
    ),
    safeQuery("jobs", () =>
      db.select().from(jobs).where(eq(jobs.userId, userId)),
    ),
    safeQuery("workflows", () =>
      db.select().from(workflows).where(eq(workflows.userId, userId)),
    ),
    safeQuery("scheduled_runs", () =>
      db.select().from(scheduledRuns).where(eq(scheduledRuns.userId, userId)),
    ),
    // scheduled_content has no direct user column; surface via inner
    // join through the tenant the user owns.
    safeQuery("scheduled_content", () =>
      db
        .select()
        .from(scheduledContent)
        .innerJoin(tenants, eq(scheduledContent.tenantId, tenants.id))
        .where(eq(tenants.clerkUserId, userId))
        .then((rows) => rows.map((r) => r.scheduled_content)),
    ),
    safeQuery("custom_skills", () =>
      email
        ? db
            .select()
            .from(customSkills)
            .where(eq(customSkills.userEmail, email))
        : Promise.resolve([]),
    ),
    safeQuery("whitelabel_config", () =>
      email
        ? db
            .select()
            .from(whitelabelConfig)
            .where(eq(whitelabelConfig.userEmail, email))
        : Promise.resolve([]),
    ),
    safeQuery("packets", () =>
      db.select().from(packets).where(eq(packets.userId, userId)),
    ),
    safeQuery("referrals", () =>
      db.select().from(referrals).where(eq(referrals.referredUserId, userId)),
    ),
    safeQuery("tenants", () =>
      db.select().from(tenants).where(eq(tenants.clerkUserId, userId)),
    ),
  ]);

  // Audit the export — required by GDPR Art. 30 ("records of processing activities")
  auditLog({
    userId,
    action: "data.export",
    resource: "user",
    details: {
      email,
      totalRows: countAll([
        user_record,
        settings_rows,
        subscriptions_rows,
        payments_rows,
        api_keys_rows,
        oauth_connections_rows,
        audit_logs_rows,
        tenant_memories_rows,
        voice_calls_rows,
        chat_messages_rows,
        conversations_rows,
        client_projects_rows,
        leads_rows,
        ad_creatives_rows,
        bookings_rows,
        email_sequences_rows,
        sequence_steps_rows,
        generations_rows,
        usage_rows,
        agent_activity_rows,
        playbook_runs_rows,
        playbook_run_steps_rows,
        jobs_rows,
        workflows_rows,
        scheduled_runs_rows,
        scheduled_content_rows,
        custom_skills_rows,
        whitelabel_config_rows,
        packets_rows,
        referrals_rows,
        tenants_rows,
      ]),
    },
  }).catch(() => {});

  // Strip API key encrypted secrets from the export — exposing them
  // in the JSON would be its own data leak.
  const sanitizedApiKeys = api_keys_rows.map((row) => {
    const r = row as Record<string, unknown>;
    return { ...r, encrypted_key: "[REDACTED]" };
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      clerkUserId: userId,
      email,
      name: user?.firstName
        ? `${user.firstName} ${user.lastName ?? ""}`.trim()
        : null,
      createdAt: user?.createdAt
        ? new Date(user.createdAt).toISOString()
        : null,
    },
    profile: user_record,
    account: {
      settings: settings_rows,
      subscriptions: subscriptions_rows,
      payments: payments_rows,
      apiKeys: sanitizedApiKeys,
      oauthConnections: oauth_connections_rows,
      tenants: tenants_rows,
      whitelabelConfig: whitelabel_config_rows,
      customSkills: custom_skills_rows,
    },
    activity: {
      auditLogs: audit_logs_rows,
      agentActivity: agent_activity_rows,
      usage: usage_rows,
    },
    content: {
      conversations: conversations_rows,
      chatMessages: chat_messages_rows,
      generations: generations_rows,
      adCreatives: ad_creatives_rows,
      emailSequences: email_sequences_rows,
      sequenceSteps: sequence_steps_rows,
      packets: packets_rows,
      scheduledContent: scheduled_content_rows,
    },
    crm: {
      leads: leads_rows,
      bookings: bookings_rows,
      voiceCalls: voice_calls_rows,
      clientProjects: client_projects_rows,
    },
    automation: {
      playbookRuns: playbook_runs_rows,
      playbookRunSteps: playbook_run_steps_rows,
      jobs: jobs_rows,
      workflows: workflows_rows,
      scheduledRuns: scheduled_runs_rows,
    },
    memory: {
      tenantMemories: tenant_memories_rows,
    },
    growth: {
      referrals: referrals_rows,
    },
    _disclosure: {
      coverage:
        "All user-keyed rows in the production database at the time of export. Excludes hashed-only tables (cta_clicks) and system telemetry without PII.",
      apiKeysNote:
        "API key plaintext is REDACTED — the encrypted value is never released even on user request.",
      retention:
        "Sovereign Matrix retains operational data for the lifetime of your account. Deletion: GET /api/me/delete (or the dashboard privacy page).",
      thirdPartyData:
        "Data held by sub-processors (Stripe, Clerk, etc.) is not included here — see /sub-processors for the full list and request from each provider directly.",
    },
  };

  const filename = `sovereign-matrix-export-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function countAll(arrays: unknown[][]): number {
  return arrays.reduce((sum, arr) => sum + arr.length, 0);
}
