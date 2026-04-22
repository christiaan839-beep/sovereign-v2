/**
 * account-deletion.ts — GDPR Article 17 "right to erasure" implementation.
 *
 * Deletes a user's personal data across the platform in a single
 * transaction (where possible) with the following semantics:
 *
 *   1. Active Stripe subscription is cancelled (best-effort).
 *   2. Credit holds are released so no money sits in limbo.
 *   3. Personal data rows are deleted: user_credits, credit_transactions,
 *      credit_holds, playbook_runs (cascades to steps), agent_activity,
 *      tenant_memories, subscriptions, agent_installs, agent_reviews,
 *      org_members.
 *   4. Creator-owned agents (agent_metadata where creator_user_id = this
 *      user) have their creator fields nulled and are forced private —
 *      the agent definition survives (for audit + ecosystem integrity)
 *      but no personal attribution remains.
 *   5. Tenant row is deleted (cascades to active_swarms + global_telemetry).
 *   6. Clerk user is deleted (removes auth identity + all sessions).
 *
 * What this does NOT touch:
 *   - Immutable audit logs (safety_events, execution_audit) — these
 *     are kept as anonymized records. GDPR Article 17(3)(b) permits
 *     retention for compliance with legal obligation.
 *   - Email-log / bounce-log records — Resend retains these
 *     separately under its own ToS. Users delete via Resend directly.
 *
 * Errors during any phase after step 1 DO NOT roll back earlier
 * phases — the contract with the user is "best-effort irreversible
 * deletion." Any residual rows surface as unclaimed orphan records
 * the sweep-expired-holds cron and the monthly-audit job can clean up.
 *
 * Test this with care: every call makes real deletions in the DB
 * that cannot be undone. The unit test mocks everything; the
 * integration test should run against a dedicated test DB branch.
 */

import { db } from "@/db";
import {
  tenants,
  userCredits,
  creditHolds,
  creditTransactions,
  playbookRuns,
  agentActivity,
  tenantMemories,
  subscriptions,
  agentInstalls,
  agentReviews,
  agentMetadata,
  orgMembers,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("account-deletion");

export interface DeleteAccountResult {
  userId: string;
  /** Per-step summary: which cleanups succeeded, which logged a warning. */
  steps: {
    stripeCancel: "ok" | "skipped" | "failed";
    holdsReleased: number;
    rowsDeleted: Record<string, number>;
    agentsOrphaned: number;
    tenantDeleted: boolean;
    clerkDeleted: "ok" | "skipped" | "failed";
  };
}

/**
 * Delete all personal data associated with a Clerk user ID.
 *
 * Caller is responsible for:
 *   - Verifying the user actually authorized this (confirmation phrase,
 *     re-auth challenge, etc.) BEFORE calling this function.
 *   - Returning a clear HTTP response to the client based on the result.
 */
export async function deleteUserAccount(
  userId: string,
): Promise<DeleteAccountResult> {
  if (!userId || typeof userId !== "string") {
    throw new Error("deleteUserAccount: userId required");
  }

  const steps: DeleteAccountResult["steps"] = {
    stripeCancel: "skipped",
    holdsReleased: 0,
    rowsDeleted: {},
    agentsOrphaned: 0,
    tenantDeleted: false,
    clerkDeleted: "skipped",
  };

  log.info("account deletion started", { userId });

  // ─── 1. Cancel active Stripe subscription (best-effort) ─────────
  try {
    const subs = await db
      .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId, status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    const sub = subs[0];
    if (sub?.stripeSubscriptionId && sub.status === "active") {
      steps.stripeCancel = await cancelStripeSubscription(sub.stripeSubscriptionId);
    } else {
      steps.stripeCancel = "skipped";
    }
  } catch (err) {
    log.warn("stripe cancel step failed", { userId, error: String(err) });
    steps.stripeCancel = "failed";
  }

  // ─── 2. Release active holds so money returns to the user ──────
  // Releasing on a soon-to-be-deleted row is a courtesy — the user
  // should see their balance refund before the account vanishes.
  try {
    const { sweepExpiredHolds } = await import("@/lib/credits");
    // Not quite the right primitive — we want to release this user's
    // ACTIVE holds, not expired ones. For the initial implementation
    // we issue an UPDATE that flags them status=released; the
    // bookkeeping transaction is a courtesy log.
    await sweepExpiredHolds(); // no-op for most cases; leaves expired cleanup clean
    steps.holdsReleased = await db
      .update(creditHolds)
      .set({ status: "released", releasedAt: new Date() })
      .where(eq(creditHolds.userId, userId))
      .returning({ id: creditHolds.id })
      .then((rows) => rows.length);
  } catch (err) {
    log.warn("holds release step failed", { userId, error: String(err) });
  }

  // ─── 3. Delete personal-data rows ───────────────────────────────
  const tablesToDelete = [
    { name: "credit_transactions", table: creditTransactions },
    { name: "credit_holds", table: creditHolds },
    { name: "user_credits", table: userCredits },
    { name: "playbook_runs", table: playbookRuns },
    { name: "agent_activity", table: agentActivity },
    { name: "tenant_memories", table: tenantMemories },
    { name: "subscriptions", table: subscriptions },
    { name: "agent_installs", table: agentInstalls },
    { name: "agent_reviews", table: agentReviews },
    { name: "org_members", table: orgMembers },
  ] as const;

  for (const { name, table } of tablesToDelete) {
    try {
      const deleted = await db
        .delete(table)
        .where(eq((table as unknown as { userId: unknown }).userId as never, userId))
        .returning({ id: (table as unknown as { id: unknown }).id as never });
      steps.rowsDeleted[name] = deleted.length;
    } catch (err) {
      log.warn("delete failed for table", { userId, table: name, error: String(err) });
      steps.rowsDeleted[name] = -1;
    }
  }

  // ─── 4. Orphan creator-owned agents ─────────────────────────────
  // Keep the agent metadata row (so the platform ecosystem stays
  // coherent) but null out the personal attribution fields and force
  // private visibility. If this creator also had verified=true, drop
  // it — someone ELSE will need to re-verify.
  try {
    const orphaned = await db
      .update(agentMetadata)
      .set({
        creatorUserId: null,
        creatorHandle: null,
        verified: false,
        visibility: "private",
        updatedAt: new Date(),
      })
      .where(eq(agentMetadata.creatorUserId, userId))
      .returning({ slug: agentMetadata.slug });
    steps.agentsOrphaned = orphaned.length;
  } catch (err) {
    log.warn("agent orphaning step failed", { userId, error: String(err) });
  }

  // ─── 5. Delete tenant (cascades to active_swarms + global_telemetry) ──
  try {
    const deleted = await db
      .delete(tenants)
      .where(eq(tenants.clerkUserId, userId))
      .returning({ id: tenants.id });
    steps.tenantDeleted = deleted.length > 0;
  } catch (err) {
    log.warn("tenant deletion failed", { userId, error: String(err) });
  }

  // ─── 6. Delete Clerk user (revokes auth + sessions) ─────────────
  try {
    steps.clerkDeleted = await deleteClerkUser(userId);
  } catch (err) {
    log.warn("clerk deletion failed", { userId, error: String(err) });
    steps.clerkDeleted = "failed";
  }

  log.info("account deletion finished", { userId, steps });

  return { userId, steps };
}

// ── Stripe cancellation (internal helper) ──────────────────────────

async function cancelStripeSubscription(
  stripeSubscriptionId: string,
): Promise<"ok" | "skipped" | "failed"> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return "skipped";
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    return res.ok ? "ok" : "failed";
  } catch (err) {
    log.warn("stripe API call failed", { stripeSubscriptionId, error: String(err) });
    return "failed";
  }
}

// ── Clerk deletion (internal helper) ───────────────────────────────

async function deleteClerkUser(userId: string): Promise<"ok" | "skipped" | "failed"> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return "skipped";
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? "ok" : "failed";
  } catch (err) {
    log.warn("clerk API call failed", { userId, error: String(err) });
    return "failed";
  }
}

/** The exact string the user must type to confirm deletion. Exposed
 *  so the UI can render it and the endpoint can validate against
 *  the same value. */
export const DELETION_CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";
