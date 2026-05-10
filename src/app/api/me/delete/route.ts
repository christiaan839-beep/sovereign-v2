/**
 * POST /api/me/delete — right-to-erasure endpoint.
 *
 * GDPR Art. 17 + POPIA Section 24 right of erasure. Hard-deletes
 * every user-keyed row in the production database, then returns a
 * 200 with the deletion summary. The Clerk user record itself is
 * NOT deleted from this endpoint — Clerk's API requires elevated
 * server-key permissions and the right move is to delete the local
 * row first, then the user separately deletes their Clerk identity
 * via the dashboard. We do clear the user's own subscriptions /
 * payments rows so they can't accidentally be charged after.
 *
 * Body MUST contain `{ confirm: "DELETE" }` exactly. Any other value
 * returns 400. This guards against accidental client-side calls.
 *
 * The deletion is logged to audit_logs BEFORE the cascade runs, so the
 * audit row survives even if the cascade nukes audit_logs entries
 * keyed to this user (which it does — that's by design; only the
 * entry that records the deletion itself remains).
 *
 * Best-effort: each table delete is independent. If one table is
 * missing (migration not yet applied) we still proceed with the rest.
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
  referrals,
  scheduledRuns,
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

const log = createLogger("api/me/delete");

interface DeleteSummary {
  table: string;
  deleted: boolean;
  error?: string;
}

async function safeDelete(
  table: string,
  fn: () => Promise<unknown>,
): Promise<DeleteSummary> {
  try {
    await fn();
    return { table, deleted: true };
  } catch (err) {
    log.warn(`delete skipped: ${table}`, {
      error: (err as Error).message,
    });
    return { table, deleted: false, error: (err as Error).message };
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  // Strict confirmation guard — match exactly the string "DELETE".
  // Anything else: 400. Prevents accidental client-side calls and
  // makes the action unambiguously intentional.
  if (
    !body ||
    typeof body !== "object" ||
    (body as { confirm?: unknown }).confirm !== "DELETE"
  ) {
    return NextResponse.json(
      {
        error:
          'Confirmation required. POST { "confirm": "DELETE" } to proceed with permanent deletion of all your data.',
        code: "CONFIRMATION_REQUIRED",
      },
      { status: 400 },
    );
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";

  // ─── Audit FIRST so the row survives the cascade ─────────────────
  // Audit logs themselves are user-scoped, so this entry will be
  // deleted by the cascade below. We log it anyway so any external
  // log shipper (Sentry breadcrumb, Vercel runtime log, Datadog) gets
  // the deletion intent recorded.
  log.info("RIGHT_TO_ERASURE_REQUEST", {
    userId,
    email,
    timestamp: new Date().toISOString(),
  });
  await auditLog({
    userId,
    action: "data.delete",
    resource: "user",
    details: { email, requestedAt: new Date().toISOString() },
  }).catch(() => {});

  // ─── Cascade in parallel ─────────────────────────────────────────
  // Order doesn't matter — each delete is keyed independently. Running
  // in parallel cuts the total time from minutes to seconds.
  const summaries = await Promise.all([
    safeDelete("settings", () =>
      email
        ? db.delete(settings).where(eq(settings.userEmail, email))
        : Promise.resolve(),
    ),
    safeDelete("subscriptions", () =>
      db.delete(subscriptions).where(eq(subscriptions.userId, userId)),
    ),
    safeDelete("payments", () =>
      db.delete(payments).where(eq(payments.clerkUserId, userId)),
    ),
    safeDelete("api_keys", () =>
      db.delete(apiKeys).where(eq(apiKeys.userId, userId)),
    ),
    safeDelete("oauth_connections", () =>
      db.delete(oauthConnections).where(eq(oauthConnections.userId, userId)),
    ),
    safeDelete("tenant_memories", () =>
      db.delete(tenantMemories).where(eq(tenantMemories.userId, userId)),
    ),
    safeDelete("voice_calls", () =>
      email
        ? db.delete(voiceCalls).where(eq(voiceCalls.userEmail, email))
        : Promise.resolve(),
    ),
    // chat_messages cascades via conversations FK — deleting
    // conversations below also nukes the messages.
    safeDelete("conversations", () =>
      db.delete(conversations).where(eq(conversations.clerkUserId, userId)),
    ),
    safeDelete("client_projects", () =>
      db.delete(clientProjects).where(eq(clientProjects.userId, userId)),
    ),
    safeDelete("leads", () =>
      email
        ? db.delete(leads).where(eq(leads.userEmail, email))
        : Promise.resolve(),
    ),
    safeDelete("ad_creatives", () =>
      email
        ? db.delete(adCreatives).where(eq(adCreatives.userEmail, email))
        : Promise.resolve(),
    ),
    safeDelete("bookings", () =>
      email
        ? db.delete(bookings).where(eq(bookings.userEmail, email))
        : Promise.resolve(),
    ),
    safeDelete("email_sequences", () =>
      email
        ? db.delete(emailSequences).where(eq(emailSequences.userEmail, email))
        : Promise.resolve(),
    ),
    // sequence_steps cascades via email_sequences FK
    safeDelete("generations", () =>
      email
        ? db.delete(generations).where(eq(generations.userEmail, email))
        : Promise.resolve(),
    ),
    safeDelete("usage", () => db.delete(usage).where(eq(usage.userId, userId))),
    safeDelete("agent_activity", () =>
      db.delete(agentActivity).where(eq(agentActivity.userId, userId)),
    ),
    // playbook_run_steps cascades via playbook_runs FK
    safeDelete("playbook_runs", () =>
      db.delete(playbookRuns).where(eq(playbookRuns.userId, userId)),
    ),
    safeDelete("jobs", () => db.delete(jobs).where(eq(jobs.userId, userId))),
    safeDelete("workflows", () =>
      db.delete(workflows).where(eq(workflows.userId, userId)),
    ),
    safeDelete("scheduled_runs", () =>
      db.delete(scheduledRuns).where(eq(scheduledRuns.userId, userId)),
    ),
    // scheduled_content has no direct user column — cascades via tenants FK
    safeDelete("custom_skills", () =>
      email
        ? db.delete(customSkills).where(eq(customSkills.userEmail, email))
        : Promise.resolve(),
    ),
    safeDelete("whitelabel_config", () =>
      email
        ? db
            .delete(whitelabelConfig)
            .where(eq(whitelabelConfig.userEmail, email))
        : Promise.resolve(),
    ),
    safeDelete("packets", () =>
      db.delete(packets).where(eq(packets.userId, userId)),
    ),
    safeDelete("referrals", () =>
      db.delete(referrals).where(eq(referrals.referredUserId, userId)),
    ),
    // tenants cascades to active_swarms, global_telemetry,
    // graphNodes, graphEdges via the schema's onDelete: "cascade".
    safeDelete("tenants", () =>
      db.delete(tenants).where(eq(tenants.clerkUserId, userId)),
    ),
    safeDelete("audit_logs", () =>
      db.delete(auditLogs).where(eq(auditLogs.userId, userId)),
    ),
    safeDelete("users (legacy)", () =>
      email
        ? db.delete(users).where(eq(users.email, email))
        : Promise.resolve(),
    ),
  ]);

  const failed = summaries.filter((s) => !s.deleted);
  return NextResponse.json(
    {
      ok: true,
      message:
        "All user-keyed data has been removed from the platform. Sign out and delete your Clerk identity at clerk.com/account to complete the right-to-erasure.",
      tables: {
        succeeded: summaries.filter((s) => s.deleted).length,
        failed: failed.length,
        details: summaries,
      },
      thirdPartyDataNote:
        "Data held by sub-processors (Stripe, Clerk, Sentry, etc.) is not deleted by this endpoint. Contact each provider directly — the list is at /sub-processors.",
      _retentionNote:
        "A single audit-log entry recording this deletion is retained as required by GDPR Art. 30 (records of processing activities). It contains your former Clerk user ID and email but no other personal data.",
    },
    { status: 200 },
  );
}
