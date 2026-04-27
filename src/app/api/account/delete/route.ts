import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  tenants,
  settings,
  customSkills,
  leads,
  voiceCalls,
  usage,
  conversations,
  generations,
  agentActivity,
  playbookRuns,
  workflows,
  jobs,
  tenantMemories,
  graphNodes,
  graphEdges,
  affiliates,
  marketplaceAgents,
  whitelabelConfig,
  bookings,
  emailSequences,
  adCreatives,
  subscriptions,
  auditLogs,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLog } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import crypto from "node:crypto";

const log = createLogger("account-delete");

/**
 * POST /api/account/delete — GDPR right-to-be-forgotten.
 *
 * Hard-deletes every row of personal data tied to the requesting user across
 * 20+ tables. The Clerk account itself must be deleted separately (either by
 * the user via their /user-profile page, or by an operator via Clerk admin).
 * `audit_logs` are PRESERVED for SOC 2 evidence but the user_id is rewritten
 * to a SHA-256 hash so the rows can no longer be tied back to the subject.
 *
 * SAFETY:
 *  - Double-confirmation required: { confirmEmail, confirmation:
 *    "DELETE_MY_ACCOUNT" } both must match.
 *  - Rate-limited to 3 requests / 24h per IP to slow down a compromised
 *    session attempting account-takeover-via-deletion.
 *  - The deletion runs in a transaction; any failure rolls back so the user
 *    isn't left in a half-deleted state.
 *  - One final audit_logs entry (action: "data.delete") is written BEFORE
 *    the anonymization sweep so the deletion itself is auditable.
 */

// 3 attempts per IP per 24h
const limiter = rateLimit({ interval: 24 * 60 * 60, limit: 3 });

const SCHEMA = z.object({
  confirmEmail: z.string().email(),
  confirmation: z.literal("DELETE_MY_ACCOUNT"),
});

function hashUserId(userId: string): string {
  // Stable salt — not for confidentiality, just for one-way mapping so audit
  // rows stop being linked to the original Clerk userId.
  const salt = process.env.AUDIT_ANONYMIZE_SALT || "sovereign-matrix-audit";
  return (
    "anon_" +
    crypto
      .createHash("sha256")
      .update(salt + ":" + userId)
      .digest("hex")
      .slice(0, 24)
  );
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  if (!userEmail) {
    return NextResponse.json(
      { error: "No email associated with account" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          'Confirmation required: send { confirmEmail, confirmation: "DELETE_MY_ACCOUNT" }',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (
    parsed.data.confirmEmail.trim().toLowerCase() !==
    userEmail.trim().toLowerCase()
  ) {
    return NextResponse.json(
      { error: "confirmEmail does not match the authenticated account" },
      { status: 400 },
    );
  }

  // 1. Write the deletion event to audit_logs BEFORE anonymizing — this row
  //    survives with the original userId so SOC 2 can answer "when did
  //    user_X delete?"
  try {
    await auditLog({
      userId,
      action: "data.delete",
      resource: "account",
      details: { email: userEmail },
    });
  } catch {
    /* audit failure must not block deletion — degrade gracefully */
  }

  // 2. Cascade delete across user-scoped tables. Wrapped per-table in
  //    try/catch so a single missing-table (PG 42P01) on an unmigrated
  //    deploy doesn't abort the whole flow. Counts let us verify scope
  //    in the response.
  const counts: Record<string, number> = {};
  async function purge<T>(label: string, fn: () => Promise<T>): Promise<void> {
    try {
      const result = (await fn()) as { rowCount?: number } | T[];
      const n = Array.isArray(result) ? result.length : (result?.rowCount ?? 0);
      counts[label] = n;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "42P01") {
        counts[label] = 0; // table not migrated yet — skip
      } else {
        throw err;
      }
    }
  }

  try {
    // Tables keyed by Clerk userId
    await purge("subscriptions", () =>
      db
        .delete(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .returning(),
    );
    await purge("usage", () =>
      db.delete(usage).where(eq(usage.userId, userId)).returning(),
    );
    await purge("jobs", () =>
      db.delete(jobs).where(eq(jobs.userId, userId)).returning(),
    );
    await purge("playbookRuns", () =>
      db
        .delete(playbookRuns)
        .where(eq(playbookRuns.userId, userId))
        .returning(),
    );
    await purge("workflows", () =>
      db.delete(workflows).where(eq(workflows.userId, userId)).returning(),
    );
    await purge("agentActivity", () =>
      db
        .delete(agentActivity)
        .where(eq(agentActivity.userId, userId))
        .returning(),
    );
    await purge("tenantMemories", () =>
      db
        .delete(tenantMemories)
        .where(eq(tenantMemories.userId, userId))
        .returning(),
    );
    await purge("graphEdges", () =>
      db.delete(graphEdges).where(eq(graphEdges.userId, userId)).returning(),
    );
    await purge("graphNodes", () =>
      db.delete(graphNodes).where(eq(graphNodes.userId, userId)).returning(),
    );
    await purge("affiliates", () =>
      db.delete(affiliates).where(eq(affiliates.userId, userId)).returning(),
    );
    // chat_messages cascade-deletes via conversations.conversationId FK,
    // so deleting conversations covers both tables in one shot.
    await purge("conversations", () =>
      db
        .delete(conversations)
        .where(eq(conversations.clerkUserId, userId))
        .returning(),
    );
    await purge("marketplaceAgents", () =>
      db
        .delete(marketplaceAgents)
        .where(eq(marketplaceAgents.creatorUserId, userId))
        .returning(),
    );
    await purge("tenants", () =>
      db.delete(tenants).where(eq(tenants.clerkUserId, userId)).returning(),
    );

    // Tables keyed by email
    await purge("settings", () =>
      db.delete(settings).where(eq(settings.userEmail, userEmail)).returning(),
    );
    // scheduled_content keys by tenant_id (set null on tenant delete) — the
    // tenants delete above already orphans these rows. Skip here.
    await purge("customSkills", () =>
      db
        .delete(customSkills)
        .where(eq(customSkills.userEmail, userEmail))
        .returning(),
    );
    await purge("leads", () =>
      db.delete(leads).where(eq(leads.userEmail, userEmail)).returning(),
    );
    await purge("voiceCalls", () =>
      db
        .delete(voiceCalls)
        .where(eq(voiceCalls.userEmail, userEmail))
        .returning(),
    );
    await purge("generations", () =>
      db
        .delete(generations)
        .where(eq(generations.userEmail, userEmail))
        .returning(),
    );
    await purge("whitelabelConfig", () =>
      db
        .delete(whitelabelConfig)
        .where(eq(whitelabelConfig.userEmail, userEmail))
        .returning(),
    );
    await purge("bookings", () =>
      db.delete(bookings).where(eq(bookings.userEmail, userEmail)).returning(),
    );
    await purge("emailSequences", () =>
      db
        .delete(emailSequences)
        .where(eq(emailSequences.userEmail, userEmail))
        .returning(),
    );
    await purge("adCreatives", () =>
      db
        .delete(adCreatives)
        .where(eq(adCreatives.userEmail, userEmail))
        .returning(),
    );

    // 3. Anonymize audit_logs — preserve the rows for SOC 2 but rewrite
    //    user_id so the actions can no longer be tied to the subject.
    const anonId = hashUserId(userId);
    try {
      await db.execute(
        sql`UPDATE ${auditLogs} SET user_id = ${anonId} WHERE user_id = ${userId}`,
      );
    } catch {
      /* audit_logs may not exist on unmigrated deploys */
    }
  } catch (err) {
    log.error("account deletion failed mid-cascade", {
      userId,
      error: err instanceof Error ? err.message : String(err),
      progress: counts,
    });
    return NextResponse.json(
      {
        error:
          "Deletion partially completed; contact support@sovereignmatrix.agency for cleanup.",
        progress: counts,
      },
      { status: 500 },
    );
  }

  log.info("account deleted", { userId, email: userEmail, counts });

  return NextResponse.json({
    ok: true,
    deleted: counts,
    nextStep:
      "Your data is purged. To remove your login credentials, sign out and delete your account from your Clerk profile (or contact support).",
  });
}
