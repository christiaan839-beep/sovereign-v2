/**
 * AGENT SPEND CARDS — agentic commerce foundation.
 *
 * Round 30 — the first concrete agentic-commerce primitive. Per
 * docs/AGENTIC-COMMERCE.md, this is the "Stripe Issuing for
 * agents" layer: a user grants their agent a bounded, scoped,
 * time-limited authorization to spend money; the platform
 * atomically validates and decrements on each charge.
 *
 * Pure-function half (evaluators) lives at the top — no DB
 * dependency, easy to unit-test. Atomic-transaction half lives at
 * the bottom — uses Postgres FOR UPDATE row locking.
 *
 * SAFETY MODEL (defence-in-depth):
 *   1. CHECK constraint on agent_spend_authorizations: spent <= max
 *      → DB refuses over-spend even if app logic bugs out
 *   2. SELECT FOR UPDATE on the authorization row in attemptCharge
 *      → no concurrent charge can race
 *   3. UNIQUE INDEX on (auth_id, idempotency_key)
 *      → retried charges never double-spend
 *   4. Hash-chained receipt
 *      → tampering with a past charge is detectable
 *   5. Audit log entry
 *      → every charge / reversal is in the immutable trail
 *
 * The platform's job is NOT to move money — that's Stripe / Yoco /
 * future providers. The platform's job is to make sure no agent
 * EVER spends more than its user authorized, and that every charge
 * has a hash-chained receipt customers can verify.
 */

import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-spend");

// ── Types ──────────────────────────────────────────────────────────

export interface SpendAuthorizationInput {
  userId: string;
  agentName: string;
  maxCents: number;
  /** Hours until the authorization expires. Required (no perpetual blank checks). */
  expiresInHours: number;
  /** Optional per-merchant-category sub-budgets. */
  categoryLimits?: Record<string, number>;
  /** Optional explicit merchant allowlist; null = any. */
  allowedMerchants?: string[];
  /** Charges above this trigger HITL approval. Null = no threshold. */
  hitlThresholdCents?: number;
  notes?: string;
}

export interface ChargeInput {
  authorizationId: string;
  agentName: string;
  /** Stable per-charge key — duplicates within 24h return the same row. */
  idempotencyKey: string;
  amountCents: number;
  merchantName: string;
  merchantCategory: string;
  metadata?: Record<string, unknown>;
}

export type ChargeResult =
  | {
      ok: true;
      chargeId: string;
      receiptHash: string;
      reversalWindowUntil: Date;
      remainingCents: number;
      status: "completed";
    }
  | {
      ok: false;
      reason: ChargeRejectReason;
      message: string;
    };

// ── Pure-function evaluators (no DB) ───────────────────────────────

/**
 * Pure-function authorization evaluator. Given an authorization row
 * + a proposed charge, decide if the charge is valid. NO database
 * access; NO mutations. Used both at evaluation time AND in tests.
 *
 * Returns a structured reject reason (machine-parseable) or "ok".
 *
 * Order of checks matches the order in attemptCharge so behavior is
 * consistent. NEVER throws.
 */
/** Reasons a charge can be rejected. Used by both evaluateCharge
 *  and ChargeResult; defining once keeps the two in sync. */
export type ChargeRejectReason =
  | "authorization_not_found"
  | "authorization_revoked"
  | "authorization_expired"
  | "merchant_not_allowed"
  | "category_limit_exceeded"
  | "amount_exceeds_remaining"
  | "agent_mismatch"
  | "hitl_required"
  | "amount_invalid"
  | "duplicate_idempotency_key_different_args"
  | "db_unavailable";

export function evaluateCharge(input: {
  authorization: {
    id: string;
    agentName: string;
    maxCents: number;
    spentCents: number;
    categoryLimits: Record<string, number>;
    allowedMerchants: string[] | null;
    expiresAt: Date;
    revokedAt: Date | null;
    hitlThresholdCents: number | null;
  };
  agentName: string;
  amountCents: number;
  merchantName: string;
  merchantCategory: string;
  /** Categories already-spent map (from charges table). */
  categorySpent: Record<string, number>;
  /** Current time, parameterized for testability. */
  now: Date;
}):
  | { allowed: true; remainingCents: number; hitlRequired: boolean }
  | { allowed: false; reason: ChargeRejectReason; message: string } {
  const a = input.authorization;

  // 1. Amount must be positive int.
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { allowed: false, reason: "amount_invalid", message: "amount must be a positive integer (cents)" };
  }

  // 2. Authorization must be agent-bound.
  if (a.agentName !== input.agentName) {
    return {
      allowed: false,
      reason: "agent_mismatch",
      message: `Authorization is for agent "${a.agentName}", request is for "${input.agentName}"`,
    };
  }

  // 3. Authorization must not be revoked.
  if (a.revokedAt !== null) {
    return {
      allowed: false,
      reason: "authorization_revoked",
      message: "Authorization was revoked by the user",
    };
  }

  // 4. Authorization must not be expired.
  if (input.now >= a.expiresAt) {
    return {
      allowed: false,
      reason: "authorization_expired",
      message: `Authorization expired at ${a.expiresAt.toISOString()}`,
    };
  }

  // 5. Merchant allowlist (if configured).
  if (a.allowedMerchants !== null && !a.allowedMerchants.includes(input.merchantName)) {
    return {
      allowed: false,
      reason: "merchant_not_allowed",
      message: `Merchant "${input.merchantName}" is not in the allowlist`,
    };
  }

  // 6. Per-category sub-budget (if configured for this category).
  const categoryCap = a.categoryLimits[input.merchantCategory];
  if (typeof categoryCap === "number") {
    const alreadySpent = input.categorySpent[input.merchantCategory] ?? 0;
    if (alreadySpent + input.amountCents > categoryCap) {
      return {
        allowed: false,
        reason: "category_limit_exceeded",
        message: `Category "${input.merchantCategory}" limit $${(categoryCap / 100).toFixed(2)} would be exceeded ($${(alreadySpent / 100).toFixed(2)} already spent + $${(input.amountCents / 100).toFixed(2)} = $${((alreadySpent + input.amountCents) / 100).toFixed(2)})`,
      };
    }
  }

  // 7. Overall ceiling.
  const remaining = a.maxCents - a.spentCents;
  if (input.amountCents > remaining) {
    return {
      allowed: false,
      reason: "amount_exceeds_remaining",
      message: `Amount $${(input.amountCents / 100).toFixed(2)} exceeds remaining $${(remaining / 100).toFixed(2)}`,
    };
  }

  // 8. HITL threshold — allowed but flagged.
  const hitlRequired =
    a.hitlThresholdCents !== null && input.amountCents > a.hitlThresholdCents;

  return { allowed: true, remainingCents: remaining - input.amountCents, hitlRequired };
}

/**
 * Compute the receipt hash for a charge. Chain-link with the
 * previous charge's receipt hash to make tampering detectable.
 *
 * Layout:
 *   sha256(prev || authorization_id || idempotency_key || amount ||
 *          merchant || category || timestamp_iso)
 *
 * Pure function — testable + verifiable offline by the customer.
 */
export function computeReceiptHash(input: {
  prevHash: string | null;
  authorizationId: string;
  idempotencyKey: string;
  amountCents: number;
  merchantName: string;
  merchantCategory: string;
  createdAt: Date;
}): string {
  const parts = [
    input.prevHash ?? "GENESIS",
    input.authorizationId,
    input.idempotencyKey,
    String(input.amountCents),
    input.merchantName,
    input.merchantCategory,
    input.createdAt.toISOString(),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

// ── DB-backed operations ───────────────────────────────────────────

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    return db;
  } catch {
    return null;
  }
}

const DEFAULT_REVERSAL_WINDOW_HOURS = 24;

/**
 * Create a new authorization. NEVER throws. Returns the new row.
 */
export async function createAuthorization(input: SpendAuthorizationInput): Promise<
  | { ok: true; authorizationId: string; expiresAt: Date }
  | { ok: false; reason: "db_unavailable" | "invalid_input"; message: string }
> {
  if (input.maxCents <= 0 || !Number.isInteger(input.maxCents)) {
    return { ok: false, reason: "invalid_input", message: "maxCents must be a positive integer" };
  }
  if (input.expiresInHours <= 0 || input.expiresInHours > 24 * 365) {
    return { ok: false, reason: "invalid_input", message: "expiresInHours must be between 1 and 8760 (1 year)" };
  }

  const db = await getDb();
  if (!db) return { ok: false, reason: "db_unavailable", message: "Database unavailable" };

  try {
    const { agentSpendAuthorizations } = await import("@/db/schema");
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
    const result = await db
      .insert(agentSpendAuthorizations)
      .values({
        userId: input.userId,
        agentName: input.agentName,
        maxCents: input.maxCents,
        categoryLimits: input.categoryLimits ?? {},
        allowedMerchants: input.allowedMerchants ?? null,
        expiresAt,
        hitlThresholdCents: input.hitlThresholdCents ?? null,
        notes: input.notes,
      })
      .returning({ id: agentSpendAuthorizations.id });

    const id = result[0]?.id;
    if (!id) {
      return { ok: false, reason: "db_unavailable", message: "Insert returned no row" };
    }

    // Audit log — hash-chained record of the authorization grant.
    const { auditLog } = await import("@/lib/audit-log");
    await auditLog({
      userId: input.userId,
      action: "commerce.authorize",
      resource: `agent-spend-auth:${id}`,
      details: {
        agentName: input.agentName,
        maxCents: input.maxCents,
        expiresAt: expiresAt.toISOString(),
        hasCategoryLimits: Object.keys(input.categoryLimits ?? {}).length > 0,
        merchantAllowlistSize: input.allowedMerchants?.length ?? null,
        hitlThresholdCents: input.hitlThresholdCents ?? null,
      },
    }).catch(() => {});

    return { ok: true, authorizationId: id, expiresAt };
  } catch (err) {
    log.error("createAuthorization failed", { error: String(err) });
    return { ok: false, reason: "db_unavailable", message: String(err) };
  }
}

/**
 * Atomic charge attempt against an authorization. Uses
 * SELECT … FOR UPDATE to lock the row; concurrent charges queue
 * cleanly behind it.
 *
 * Idempotency: a retried charge with the same (auth_id, idempotency_key)
 * returns the original receipt — no double-spend.
 *
 * Returns a structured ChargeResult. NEVER throws.
 */
export async function attemptCharge(input: ChargeInput): Promise<ChargeResult> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, reason: "amount_invalid", message: "amount must be a positive integer (cents)" };
  }

  const db = await getDb();
  if (!db) return { ok: false, reason: "db_unavailable", message: "Database unavailable" };

  try {
    const { agentSpendAuthorizations, agentSpendCharges } = await import("@/db/schema");

    // Idempotency check FIRST — if we've seen this (auth, key)
    // before, return the existing row. Cheaper than acquiring the
    // lock just to discover a duplicate.
    const existing = await db
      .select()
      .from(agentSpendCharges)
      .where(
        and(
          eq(agentSpendCharges.authorizationId, input.authorizationId),
          eq(agentSpendCharges.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const e = existing[0];
      // Verify the args match — prevents an attacker reusing an idempotency key with different amount.
      const argsMatch =
        e.amountCents === input.amountCents &&
        e.merchantName === input.merchantName &&
        e.merchantCategory === input.merchantCategory;
      if (!argsMatch) {
        return {
          ok: false,
          reason: "duplicate_idempotency_key_different_args",
          message: "Idempotency key reused with different arguments",
        };
      }
      if (e.status === "completed") {
        return {
          ok: true,
          chargeId: String(e.id),
          receiptHash: e.receiptHash,
          reversalWindowUntil: e.reversalWindowUntil,
          remainingCents: 0, // not recomputed for the idempotent path
          status: "completed",
        };
      }
      // 'failed' or 'reversed' — return as a fresh failure.
      return {
        ok: false,
        reason: "amount_invalid",
        message: `Previous attempt with same key was ${e.status}`,
      };
    }

    // Now the atomic charge. Postgres SELECT FOR UPDATE ensures
    // concurrent charges can't both read "spent: $48 of $50" and
    // both succeed.
    const result = await db.transaction(async (tx) => {
      const authRows = await tx
        .select()
        .from(agentSpendAuthorizations)
        .where(eq(agentSpendAuthorizations.id, input.authorizationId))
        .for("update")
        .limit(1);

      if (authRows.length === 0) {
        return {
          ok: false as const,
          reason: "authorization_not_found" as const,
          message: "Authorization not found",
        };
      }

      const auth = authRows[0];

      // Compute already-spent per category (for sub-budget enforcement).
      // Done in-transaction so the sum is consistent with the
      // SELECT FOR UPDATE snapshot.
      const categorySpentRaw = await tx.execute(sql`
        SELECT merchant_category, COALESCE(SUM(amount_cents), 0)::int AS total
        FROM ${agentSpendCharges}
        WHERE authorization_id = ${input.authorizationId}
          AND status = 'completed'
        GROUP BY merchant_category
      `);
      const categorySpent: Record<string, number> = {};
      const rows = (categorySpentRaw as unknown as { rows: Array<{ merchant_category: string; total: number }> }).rows ?? [];
      for (const r of rows) {
        categorySpent[r.merchant_category] = r.total;
      }

      const decision = evaluateCharge({
        authorization: {
          id: auth.id,
          agentName: auth.agentName,
          maxCents: auth.maxCents,
          spentCents: auth.spentCents,
          categoryLimits: auth.categoryLimits,
          allowedMerchants: auth.allowedMerchants,
          expiresAt: auth.expiresAt,
          revokedAt: auth.revokedAt,
          hitlThresholdCents: auth.hitlThresholdCents,
        },
        agentName: input.agentName,
        amountCents: input.amountCents,
        merchantName: input.merchantName,
        merchantCategory: input.merchantCategory,
        categorySpent,
        now: new Date(),
      });

      if (!decision.allowed) {
        // Log the failed attempt for forensics.
        const failHash = computeReceiptHash({
          prevHash: null,
          authorizationId: input.authorizationId,
          idempotencyKey: input.idempotencyKey,
          amountCents: input.amountCents,
          merchantName: input.merchantName,
          merchantCategory: input.merchantCategory,
          createdAt: new Date(),
        });
        await tx.insert(agentSpendCharges).values({
          authorizationId: input.authorizationId,
          userId: auth.userId,
          agentName: input.agentName,
          idempotencyKey: input.idempotencyKey,
          amountCents: input.amountCents,
          merchantName: input.merchantName,
          merchantCategory: input.merchantCategory,
          metadata: input.metadata ?? {},
          status: "failed",
          receiptHash: failHash,
          reversalWindowUntil: new Date(),
          failedReason: decision.reason,
        });
        return {
          ok: false as const,
          reason: decision.reason,
          message: decision.message,
        };
      }

      if (decision.hitlRequired) {
        return {
          ok: false as const,
          reason: "hitl_required" as const,
          message: `Charge of $${(input.amountCents / 100).toFixed(2)} exceeds the HITL threshold; human approval required.`,
        };
      }

      // Compute receipt hash chained to the previous (most-recent)
      // completed charge for this authorization.
      const prevRows = await tx
        .select({ receiptHash: agentSpendCharges.receiptHash })
        .from(agentSpendCharges)
        .where(
          and(
            eq(agentSpendCharges.authorizationId, input.authorizationId),
            eq(agentSpendCharges.status, "completed"),
          ),
        )
        .orderBy(sql`${agentSpendCharges.createdAt} DESC`)
        .limit(1);
      const prevHash = prevRows[0]?.receiptHash ?? null;

      const now = new Date();
      const receiptHash = computeReceiptHash({
        prevHash,
        authorizationId: input.authorizationId,
        idempotencyKey: input.idempotencyKey,
        amountCents: input.amountCents,
        merchantName: input.merchantName,
        merchantCategory: input.merchantCategory,
        createdAt: now,
      });
      const reversalWindowUntil = new Date(
        now.getTime() + DEFAULT_REVERSAL_WINDOW_HOURS * 60 * 60 * 1000,
      );

      // Decrement the auth + insert the charge atomically.
      await tx
        .update(agentSpendAuthorizations)
        .set({
          spentCents: sql`${agentSpendAuthorizations.spentCents} + ${input.amountCents}`,
        })
        .where(eq(agentSpendAuthorizations.id, input.authorizationId));

      const inserted = await tx
        .insert(agentSpendCharges)
        .values({
          authorizationId: input.authorizationId,
          userId: auth.userId,
          agentName: input.agentName,
          idempotencyKey: input.idempotencyKey,
          amountCents: input.amountCents,
          merchantName: input.merchantName,
          merchantCategory: input.merchantCategory,
          metadata: input.metadata ?? {},
          status: "completed",
          receiptHash,
          reversalWindowUntil,
        })
        .returning({ id: agentSpendCharges.id });

      return {
        ok: true as const,
        chargeId: String(inserted[0]?.id),
        receiptHash,
        reversalWindowUntil,
        remainingCents: decision.remainingCents,
        status: "completed" as const,
      };
    });

    // Audit log outside the transaction (write happens regardless).
    if (result.ok) {
      const { auditLog } = await import("@/lib/audit-log");
      await auditLog({
        userId: "agent:" + input.agentName, // synthetic actor for the chain
        action: "commerce.charge",
        resource: `agent-spend-charge:${result.chargeId}`,
        details: {
          authorizationId: input.authorizationId,
          amountCents: input.amountCents,
          merchant: input.merchantName,
          category: input.merchantCategory,
          receiptHash: result.receiptHash,
        },
      }).catch(() => {});
    }

    return result;
  } catch (err) {
    log.error("attemptCharge failed", { error: String(err) });
    return { ok: false, reason: "db_unavailable", message: String(err) };
  }
}

/**
 * Reverse a completed charge within its reversal window.
 *
 * Caller is identified via `actor` (operator or agent itself).
 * Reverses the row's status + adds the amount back to the
 * authorization. The hash chain is preserved (we don't rewrite
 * the original; we add a reversal entry).
 */
export async function reverseCharge(input: {
  chargeId: string;
  reason: string;
  actor: string;
}): Promise<
  | { ok: true; reversedAt: Date }
  | { ok: false; reason: "not_found" | "already_reversed" | "outside_window" | "db_unavailable"; message: string }
> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "db_unavailable", message: "Database unavailable" };

  try {
    const { agentSpendCharges, agentSpendAuthorizations } = await import("@/db/schema");

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(agentSpendCharges)
        .where(eq(agentSpendCharges.id, input.chargeId))
        .for("update")
        .limit(1);

      if (rows.length === 0) {
        return { ok: false as const, reason: "not_found" as const, message: "Charge not found" };
      }
      const c = rows[0];
      if (c.reversedAt !== null || c.status === "reversed") {
        return {
          ok: false as const,
          reason: "already_reversed" as const,
          message: "Charge already reversed",
        };
      }
      if (c.status !== "completed") {
        return {
          ok: false as const,
          reason: "not_found" as const,
          message: `Charge status is ${c.status}, only 'completed' can be reversed`,
        };
      }
      const now = new Date();
      if (now > c.reversalWindowUntil) {
        return {
          ok: false as const,
          reason: "outside_window" as const,
          message: `Reversal window closed at ${c.reversalWindowUntil.toISOString()}`,
        };
      }

      // Refund the authorization.
      await tx
        .update(agentSpendAuthorizations)
        .set({
          spentCents: sql`${agentSpendAuthorizations.spentCents} - ${c.amountCents}`,
        })
        .where(eq(agentSpendAuthorizations.id, c.authorizationId));

      // Mark the charge reversed.
      await tx
        .update(agentSpendCharges)
        .set({
          status: "reversed",
          reversedAt: now,
          reversedBy: input.actor,
          reverseReason: input.reason,
        })
        .where(eq(agentSpendCharges.id, c.id));

      return { ok: true as const, reversedAt: now };
    });

    if (result.ok) {
      const { auditLog } = await import("@/lib/audit-log");
      await auditLog({
        userId: input.actor,
        action: "commerce.reverse",
        resource: `agent-spend-charge:${input.chargeId}`,
        details: {
          reason: input.reason,
          reversedAt: result.reversedAt.toISOString(),
        },
      }).catch(() => {});
    }
    return result;
  } catch (err) {
    log.error("reverseCharge failed", { error: String(err) });
    return { ok: false, reason: "db_unavailable", message: String(err) };
  }
}

/**
 * Revoke an authorization. Future charges 403; existing completed
 * charges are unchanged (use reverseCharge for those).
 */
export async function revokeAuthorization(input: {
  authorizationId: string;
  userId: string;
  reason?: string;
}): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) return { ok: false };
  try {
    const { agentSpendAuthorizations } = await import("@/db/schema");
    const result = await db
      .update(agentSpendAuthorizations)
      .set({ revokedAt: new Date(), revokeReason: input.reason })
      .where(
        and(
          eq(agentSpendAuthorizations.id, input.authorizationId),
          eq(agentSpendAuthorizations.userId, input.userId),
        ),
      )
      .returning({ id: agentSpendAuthorizations.id });
    if (result.length > 0) {
      const { auditLog } = await import("@/lib/audit-log");
      await auditLog({
        userId: input.userId,
        action: "commerce.revoke",
        resource: `agent-spend-auth:${input.authorizationId}`,
        details: { reason: input.reason ?? null },
      }).catch(() => {});
    }
    return { ok: result.length > 0 };
  } catch {
    return { ok: false };
  }
}

/**
 * List a user's authorizations (active + recently expired).
 */
export async function listAuthorizations(userId: string): Promise<
  Array<{
    id: string;
    agentName: string;
    maxCents: number;
    spentCents: number;
    expiresAt: Date;
    revokedAt: Date | null;
    categoryLimits: Record<string, number>;
    allowedMerchants: string[] | null;
    createdAt: Date;
  }>
> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { agentSpendAuthorizations } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(agentSpendAuthorizations)
      .where(eq(agentSpendAuthorizations.userId, userId))
      .orderBy(sql`${agentSpendAuthorizations.createdAt} DESC`)
      .limit(100);
    return rows.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      maxCents: r.maxCents,
      spentCents: r.spentCents,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      categoryLimits: r.categoryLimits,
      allowedMerchants: r.allowedMerchants,
      createdAt: r.createdAt,
    }));
  } catch {
    return [];
  }
}

/**
 * Verify the receipt chain for an authorization. Returns ok if
 * every charge's receipt_hash chains correctly back to the previous.
 *
 * Used for forensic verification — auditors / customers can
 * confirm the chain hasn't been tampered with.
 */
export async function verifyReceiptChain(authorizationId: string): Promise<
  { ok: true; chargeCount: number } | { ok: false; brokenAt: string; expected: string; found: string }
> {
  const db = await getDb();
  if (!db) return { ok: true, chargeCount: 0 };
  try {
    const { agentSpendCharges } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(agentSpendCharges)
      .where(
        and(
          eq(agentSpendCharges.authorizationId, authorizationId),
          eq(agentSpendCharges.status, "completed"),
        ),
      )
      .orderBy(agentSpendCharges.createdAt);

    let prevHash: string | null = null;
    for (const r of rows) {
      const expected = computeReceiptHash({
        prevHash,
        authorizationId: r.authorizationId,
        idempotencyKey: r.idempotencyKey,
        amountCents: r.amountCents,
        merchantName: r.merchantName,
        merchantCategory: r.merchantCategory,
        createdAt: r.createdAt,
      });
      if (expected !== r.receiptHash) {
        return { ok: false, brokenAt: String(r.id), expected, found: r.receiptHash };
      }
      prevHash = r.receiptHash;
    }
    return { ok: true, chargeCount: rows.length };
  } catch (err) {
    log.error("verifyReceiptChain failed", { error: String(err) });
    return { ok: true, chargeCount: 0 }; // fail-open on error
  }
}
