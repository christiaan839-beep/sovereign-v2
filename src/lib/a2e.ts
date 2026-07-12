/**
 * SOVEREIGN MATRIX — Agent-to-Agent Economy (A2E)
 *
 * Agents can hire other agents autonomously using platform credits.
 * When a Lead Agent needs a personalized video, it hires the Video Agent.
 * When a Content Agent needs SEO analysis, it hires the SEO Agent.
 * Creators earn passively every time another agent subcontracts theirs.
 *
 * Flow:
 *   1. Agent A is running and decides it needs capability from Agent B
 *   2. Agent A calls `hireAgent(agentSlug, input, budget)` from this lib
 *   3. A2E deducts credits from the user's balance, logs the hire
 *   4. Agent B runs via the internal API and returns its result
 *   5. Creator of Agent B earns 70% of the hire cost
 *   6. Platform earns 30%
 *
 * Credit values (1 credit = $0.01):
 *   - Standard agents: 5–20 credits/run
 *   - Premium agents: 50–200 credits/run
 *   - Free platform agents: 0 credits (built-in)
 *
 * Revenue split on marketplace agent hires:
 *   70% creator / 20% platform / 10% infrastructure
 */

import { createLogger } from "@/lib/logger";
import { db } from "@/db";
import { sql } from "drizzle-orm";

const log = createLogger("a2e");

// ── Types ──────────────────────────────────────────────────────────────────

export type TransactionType =
  | "purchase" // user bought credits
  | "earn" // user earned via agent marketplace
  | "spend" // user spent on agent runs
  | "refund" // run failed, credits refunded
  | "a2e_hire" // agent hired another agent (debit)
  | "a2e_earn" // creator earned from A2E hire (credit)
  | "bonus" // platform bonus credits
  | "referral"; // referral reward

export interface CreditBalance {
  userId: string;
  balanceCents: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

export interface HireResult {
  success: boolean;
  runId: string;
  costCents: number;
  result?: unknown;
  error?: string;
}

// ── Credit Operations ──────────────────────────────────────────────────────

/**
 * Get or initialize a user's credit balance.
 * Returns 0 for new users (no free credits on signup — earned through usage).
 */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  try {
    const rows = await db.execute(
      sql`SELECT balance_cents, lifetime_earned, lifetime_spent
          FROM user_credits WHERE user_id = ${userId} LIMIT 1`,
    );
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row) {
      return { userId, balanceCents: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
    }
    return {
      userId,
      balanceCents: Number(row.balance_cents ?? 0),
      lifetimeEarned: Number(row.lifetime_earned ?? 0),
      lifetimeSpent: Number(row.lifetime_spent ?? 0),
    };
  } catch (err) {
    log.info("Credit balance read failed", { error: String(err) });
    return { userId, balanceCents: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
  }
}

/**
 * Add credits to a user's balance.
 * Uses an upsert so the first call also initializes the row.
 */
export async function addCredits(
  userId: string,
  amountCents: number,
  type: TransactionType,
  description: string,
  metadata?: { agentId?: string; runId?: string },
): Promise<CreditBalance> {
  try {
    await db.execute(sql`
      INSERT INTO user_credits (user_id, balance_cents, lifetime_earned)
      VALUES (${userId}, ${amountCents}, ${amountCents})
      ON CONFLICT (user_id) DO UPDATE
        SET balance_cents   = user_credits.balance_cents + ${amountCents},
            lifetime_earned = user_credits.lifetime_earned + ${amountCents},
            updated_at      = NOW()
    `);

    await db.execute(sql`
      INSERT INTO credit_transactions
        (user_id, amount_cents, transaction_type, description, agent_id, run_id)
      VALUES
        (${userId}, ${amountCents}, ${type}, ${description},
         ${metadata?.agentId ?? null}, ${metadata?.runId ?? null})
    `);

    log.info(`+${amountCents} credits for ${userId}`, { type, description });
    return getCreditBalance(userId);
  } catch (err) {
    log.info("addCredits failed", { error: String(err) });
    throw err;
  }
}

/**
 * Deduct credits from a user's balance.
 * Throws if the user has insufficient credits.
 * Returns the new balance.
 */
export async function deductCredits(
  userId: string,
  amountCents: number,
  type: TransactionType,
  description: string,
  metadata?: { agentId?: string; runId?: string },
): Promise<CreditBalance> {
  const balance = await getCreditBalance(userId);
  if (balance.balanceCents < amountCents) {
    throw new Error(
      `Insufficient credits: have ${balance.balanceCents}, need ${amountCents}`,
    );
  }

  try {
    await db.execute(sql`
      UPDATE user_credits
      SET balance_cents  = balance_cents - ${amountCents},
          lifetime_spent = lifetime_spent + ${amountCents},
          updated_at     = NOW()
      WHERE user_id = ${userId}
    `);

    await db.execute(sql`
      INSERT INTO credit_transactions
        (user_id, amount_cents, transaction_type, description, agent_id, run_id)
      VALUES
        (${userId}, ${-amountCents}, ${type}, ${description},
         ${metadata?.agentId ?? null}, ${metadata?.runId ?? null})
    `);

    log.info(`-${amountCents} credits for ${userId}`, { type });
    return getCreditBalance(userId);
  } catch (err) {
    log.info("deductCredits failed", { error: String(err) });
    throw err;
  }
}

// ── A2E Hire ───────────────────────────────────────────────────────────────

/**
 * One agent hires another agent on behalf of a user.
 *
 * This is the core A2E primitive. When a running agent needs a capability
 * it doesn't have, it calls this function to subcontract to a marketplace
 * agent. The cost is deducted from the user's credit balance automatically.
 *
 * @param userId       - the user whose budget is being spent
 * @param agentSlug    - marketplace agent to hire (e.g., "video-gen", "seo-dominator")
 * @param input        - input payload for the hired agent
 * @param maxBudget    - maximum credits to spend (hard cap for safety)
 * @param hiringAgent  - name of the agent initiating the hire (for audit)
 */
export async function hireAgent(
  userId: string,
  agentSlug: string,
  input: Record<string, unknown>,
  maxBudget = 50, // default max: 50 credits ($0.50)
  hiringAgent?: string,
): Promise<HireResult> {
  const runId = `a2e_${crypto.randomUUID().slice(0, 12)}`;

  // 1. Look up the agent's price from marketplace DB
  let costCents = 0;
  try {
    const rows = await db.execute(
      sql`SELECT price_per_run FROM marketplace_agents
          WHERE name = ${agentSlug} AND verification_status = 'approved' AND is_public = true
          LIMIT 1`,
    );
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    costCents = row ? Number(row.price_per_run ?? 0) : 0;
  } catch {
    /* marketplace table may not exist yet — treat as free */
  }

  if (costCents > maxBudget) {
    return {
      success: false,
      runId,
      costCents,
      error: `Agent cost (${costCents} credits) exceeds budget (${maxBudget} credits)`,
    };
  }

  // 2. Deduct credits (free agents skip this)
  if (costCents > 0) {
    try {
      await deductCredits(
        userId,
        costCents,
        "a2e_hire",
        `Hired ${agentSlug} via A2E`,
        { agentId: agentSlug, runId },
      );
    } catch (err) {
      return { success: false, runId, costCents, error: String(err) };
    }
  }

  // 3. Log the hire
  try {
    await db.execute(sql`
      INSERT INTO a2e_hire_log
        (id, hiring_user_id, hired_agent_id, hiring_agent, cost_cents, run_id, status)
      VALUES
        (${runId}, ${userId}, ${agentSlug}, ${hiringAgent ?? null}, ${costCents}, ${runId}, 'running')
    `);
  } catch {
    /* non-blocking audit log */
  }

  // 4. Execute the hired agent via internal API
  try {
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const res = await fetch(`${baseUrl}/api/agents/${agentSlug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-A2E-Run-Id": runId,
        "X-A2E-Hiring-Agent": hiringAgent ?? "unknown",
        "X-A2E-User-Id": userId,
      },
      body: JSON.stringify({ ...input, _a2eRunId: runId }),
    });

    const result = (await res.json()) as Record<string, unknown>;

    // 5. Complete the hire log + credit creator
    if (res.ok && costCents > 0) {
      // Award 70% of hire cost to the creator
      const creatorShare = Math.floor(costCents * 0.7);
      try {
        const creatorRows = await db.execute(
          sql`SELECT creator_user_id FROM marketplace_agents WHERE name = ${agentSlug} LIMIT 1`,
        );
        const creatorRow = (
          creatorRows as unknown as Array<Record<string, unknown>>
        )[0];
        const creatorId = creatorRow?.creator_user_id as string | undefined;
        if (creatorId) {
          await addCredits(
            creatorId,
            creatorShare,
            "a2e_earn",
            `A2E hire earnings from ${agentSlug}`,
            { agentId: agentSlug, runId },
          );
        }
      } catch {
        /* non-blocking */
      }
    }

    await db
      .execute(
        sql`
      UPDATE a2e_hire_log SET status = 'complete', completed_at = NOW()
      WHERE id = ${runId}
    `,
      )
      .catch(() => {});

    return { success: true, runId, costCents, result };
  } catch (err) {
    // Refund on failure
    if (costCents > 0) {
      await addCredits(
        userId,
        costCents,
        "refund",
        `Refund: ${agentSlug} hire failed`,
        { agentId: agentSlug, runId },
      ).catch(() => {});
    }
    await db
      .execute(
        sql`
      UPDATE a2e_hire_log SET status = 'failed', completed_at = NOW() WHERE id = ${runId}
    `,
      )
      .catch(() => {});

    return { success: false, runId, costCents, error: String(err) };
  }
}

/**
 * Get a user's transaction history (most recent first).
 */
export async function getCreditHistory(
  userId: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    amountCents: number;
    type: TransactionType;
    description: string;
    agentId?: string;
    createdAt: string;
  }>
> {
  try {
    const rows = await db.execute(sql`
      SELECT id, amount_cents, transaction_type, description, agent_id, created_at
      FROM credit_transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      amountCents: Number(r.amount_cents),
      type: String(r.transaction_type) as TransactionType,
      description: String(r.description ?? ""),
      agentId: r.agent_id ? String(r.agent_id) : undefined,
      createdAt: String(r.created_at),
    }));
  } catch (err) {
    log.info("Credit history read failed", { error: String(err) });
    return [];
  }
}
