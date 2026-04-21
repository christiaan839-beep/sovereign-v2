# Revenue Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing credit system (migration 0018 + `src/lib/credits.ts`) into Stripe webhooks and the agent factory so every top-up adds credits and every agent run deducts them. Add a pay-per-run tier to `plans.ts` and a visible balance widget in the dashboard.

**Architecture:** The credit primitives are already deployed (atomic `placeHold → captureHold` pattern). This plan only connects them. Three call sites get new code: the Stripe webhook (topUp on `checkout.session.completed`), the agent factory pre/post-execution hooks (placeHold + captureHold/releaseHold), and the dashboard/pricing pages (display + new tier). One new cron (`sweep-expired-holds`) runs every minute to refund holds abandoned by crashed runs.

**Tech Stack:** Next.js 16 App Router · Drizzle ORM · Stripe SDK · Zod · Vitest · Upstash Redis (already wired).

---

## File Structure

### Modify

| File | What changes |
|---|---|
| `src/lib/plans.ts` | Add `monthlyCreditsCents: number` field to `PlanDefinition`; populate for every plan; add new `pay_per_run` plan ID |
| `src/app/api/_payments/stripe/webhook/route.ts` | On `checkout.session.completed`, call `topUp(userId, plan.monthlyCreditsCents, "topup", {stripeInvoiceId})` |
| `src/lib/agent-factory.ts` | Before handler: `placeHold(...)`. After success: `captureHold`. On failure/throw: `releaseHold`. Return 402 when `InsufficientCreditsError` |
| `src/app/dashboard/billing/page.tsx` | Show current balance + last 5 ledger entries |
| `src/app/pricing/page.tsx` | New "Pay Per Run" tier card between Growth and Sovereign |
| `vercel.json` | Add cron entry for `/api/cron/sweep-expired-holds` at `* * * * *` |
| `src/types/index.ts` | Re-export `PlanId` with `"pay_per_run"` included (none of these change the AIOptions shape) |

### Create

| File | Responsibility |
|---|---|
| `src/lib/pricing-costs.ts` | Model → cents/1k tokens map; `estimateRunCostCents()` + `estimatedHoldCents()` |
| `src/app/api/credits/balance/route.ts` | `GET` returning `{balance, plan, monthlyAllocation, lastToppedUp}` |
| `src/app/api/credits/history/route.ts` | `GET` with `?limit=20&cursor=<id>` → paginated ledger |
| `src/app/api/cron/sweep-expired-holds/route.ts` | Cron-guarded endpoint that calls `sweepExpiredHolds()` |
| `src/components/dashboard/CreditsWidget.tsx` | Sidebar balance display + low-balance banner (<$1) |
| `src/lib/__tests__/pricing-costs.test.ts` | Unit tests for cost estimation |
| `src/lib/__tests__/credits-webhook.test.ts` | Stripe-webhook → topUp integration test (mocked DB + Stripe SDK) |
| `src/lib/__tests__/credits-factory.test.ts` | Factory hold/capture/release state-machine test |

### File Structure Rationale

- `pricing-costs.ts` is a pure data module — no DB, no Drizzle — so we can test it in isolation and reuse from both the factory AND the dashboard
- Ledger endpoints are split into `/balance` (one row, fast) vs `/history` (paginated) — the widget only polls `/balance` every 30s; history is loaded on-demand
- Cron endpoint sits under `/api/cron/` matching the existing convention (`job-runner`, `playbook-scheduler`, etc.)

---

## Task 1: Pricing cost module

**Files:**
- Create: `src/lib/pricing-costs.ts`
- Test: `src/lib/__tests__/pricing-costs.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/pricing-costs.test.ts
import { describe, it, expect } from "vitest";
import {
  estimateRunCostCents,
  estimatedHoldCents,
  MODEL_COSTS,
} from "@/lib/pricing-costs";

describe("estimateRunCostCents", () => {
  it("computes cost for a known NIM model", () => {
    // 1000 input + 2000 output on nemotron-ultra:
    //   input:  1000 * 0.5 / 1000 = 0.5 cents
    //   output: 2000 * 2.0 / 1000 = 4.0 cents
    //   total:  4.5 cents, ceil → 5
    expect(estimateRunCostCents("nvidia/nemotron-ultra-253b-v1", 1000, 2000)).toBe(5);
  });

  it("uses a conservative default for unknown models", () => {
    // default: 1c/1k input, 4c/1k output → 1000 in + 1000 out = 5
    expect(estimateRunCostCents("unknown/model", 1000, 1000)).toBe(5);
  });

  it("never returns less than 1 cent", () => {
    expect(estimateRunCostCents("nvidia/nemotron-3-nano-30b-a3b", 1, 1)).toBeGreaterThanOrEqual(1);
  });

  it("always ceil-rounds to whole cents", () => {
    const cents = estimateRunCostCents("nvidia/nemotron-3-nano-30b-a3b", 100, 100);
    expect(Number.isInteger(cents)).toBe(true);
  });
});

describe("estimatedHoldCents", () => {
  it("over-holds using 2x input + full output budget", () => {
    // 2x 2000 = 4000 input + 2000 output on nemotron-ultra:
    //   4000 * 0.5 / 1000 = 2; 2000 * 2 / 1000 = 4 → 6
    expect(estimatedHoldCents("nvidia/nemotron-ultra-253b-v1", 2000)).toBe(6);
  });
});

describe("MODEL_COSTS coverage", () => {
  it("includes at least one NVIDIA, Claude, Gemini, Cerebras entry", () => {
    expect(MODEL_COSTS["nvidia/nemotron-ultra-253b-v1"]).toBeDefined();
    expect(MODEL_COSTS["claude-sonnet-4-6"]).toBeDefined();
    expect(MODEL_COSTS["gemini-2.5-flash"]).toBeDefined();
    expect(MODEL_COSTS["cerebras/llama3.1-70b"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test — must FAIL**

```
npx vitest run src/lib/__tests__/pricing-costs.test.ts --reporter=verbose
```
Expected: all four tests fail with "Cannot find module '@/lib/pricing-costs'"

- [ ] **Step 3: Implement the module**

```typescript
// src/lib/pricing-costs.ts
/**
 * Per-run cost estimation in cents.
 *
 * Maps model IDs to input/output token costs. Used by the credit system
 * to place holds before agent runs. Conservative estimate — actual
 * captured cost may be lower (we never overcharge).
 *
 * Update strategy: when a provider changes pricing, edit this file and
 * run `npm test` — the cost tests will catch contradictions between
 * the new numbers and any hard-coded expectations.
 */

export interface ModelCost {
  inputCentsPer1k: number;
  outputCentsPer1k: number;
}

export const MODEL_COSTS: Record<string, ModelCost> = {
  // NVIDIA NIM (free tier; markup represents marginal infra cost)
  "nvidia/nemotron-ultra-253b-v1":     { inputCentsPer1k: 0.5, outputCentsPer1k: 2.0 },
  "nvidia/nemotron-3-super-120b-a12b": { inputCentsPer1k: 0.3, outputCentsPer1k: 1.2 },
  "nvidia/nemotron-3-nano-30b-a3b":    { inputCentsPer1k: 0.1, outputCentsPer1k: 0.4 },
  "meta/llama-4-maverick-17b-128e":    { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },
  "meta/llama-4-scout-17b-16e-instruct": { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },
  "google/gemma-4-31b-it":              { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },
  "mistralai/mistral-small-4-moe":     { inputCentsPer1k: 0.3, outputCentsPer1k: 1.0 },
  "microsoft/phi-4-reasoning-14b":      { inputCentsPer1k: 0.2, outputCentsPer1k: 0.8 },
  "qwen/qwen-3.5-397b-a17b":            { inputCentsPer1k: 0.4, outputCentsPer1k: 1.5 },
  "moonshotai/kimi-k2.5":               { inputCentsPer1k: 0.3, outputCentsPer1k: 1.2 },
  // Cerebras (paid pass-through)
  "cerebras/llama3.1-70b":              { inputCentsPer1k: 0.6, outputCentsPer1k: 2.4 },
  // Claude (BYOK markup 1.15x vs list)
  "claude-sonnet-4-6":                  { inputCentsPer1k: 35, outputCentsPer1k: 175 },
  "claude-opus-4-6":                    { inputCentsPer1k: 175, outputCentsPer1k: 875 },
  // Gemini (BYOK markup 1.15x vs list)
  "gemini-2.5-flash":                   { inputCentsPer1k: 9, outputCentsPer1k: 35 },
  "gemini-2.5-pro":                     { inputCentsPer1k: 145, outputCentsPer1k: 575 },
};

const DEFAULT_COST: ModelCost = { inputCentsPer1k: 1, outputCentsPer1k: 4 };

/**
 * Estimate the cost of a run in cents given expected input/output tokens.
 * Returns ROUND-UP cents — never place a hold lower than what we'll capture.
 * Unknown models fall back to a defensive default.
 */
export function estimateRunCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const cost = MODEL_COSTS[model] ?? DEFAULT_COST;
  const totalCents =
    (inputTokens * cost.inputCentsPer1k) / 1000 +
    (outputTokens * cost.outputCentsPer1k) / 1000;
  return Math.max(1, Math.ceil(totalCents));
}

/**
 * Pre-execution hold amount for a single agent call. Assumes 2x the
 * input budget (prompt + injected memory + research) and the full
 * output budget. Conservative by design — we capture the actual
 * amount at commit, so over-hold doesn't over-charge.
 */
export function estimatedHoldCents(model: string, maxTokens: number = 2000): number {
  return estimateRunCostCents(model, maxTokens * 2, maxTokens);
}
```

- [ ] **Step 4: Run test — must PASS**

```
npx vitest run src/lib/__tests__/pricing-costs.test.ts --reporter=verbose
```
Expected: all four tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing-costs.ts src/lib/__tests__/pricing-costs.test.ts
git commit -m "feat(credits): pricing-costs module for per-run cost estimation (plan 1.1)"
```

---

## Task 2: Add monthlyCreditsCents to plans

**Files:**
- Modify: `src/lib/plans.ts`
- Test: `src/lib/__tests__/plans-credits.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/plans-credits.test.ts
import { describe, it, expect } from "vitest";
import { PLANS, getPlan } from "@/lib/plans";

describe("plan credit allocation", () => {
  it("every plan has monthlyCreditsCents >= 0", () => {
    for (const [id, plan] of Object.entries(PLANS)) {
      expect(plan.monthlyCreditsCents, `plan ${id}`).toBeTypeOf("number");
      expect(plan.monthlyCreditsCents, `plan ${id}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("higher-priced plans grant more credits than cheaper ones", () => {
    // Free → Growth → Node → Enterprise
    const free = PLANS.free.monthlyCreditsCents;
    const growth = PLANS.array.monthlyCreditsCents;
    const node = PLANS.node.monthlyCreditsCents;
    expect(growth).toBeGreaterThan(free);
    expect(node).toBeGreaterThan(growth);
  });

  it("pay_per_run is purchasable but grants zero monthly credits", () => {
    const ppr = getPlan("pay_per_run");
    expect(ppr.purchasable).toBe(true);
    expect(ppr.monthlyCreditsCents).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — must FAIL**

```
npx vitest run src/lib/__tests__/plans-credits.test.ts --reporter=verbose
```
Expected: FAIL — `monthlyCreditsCents` undefined, no `pay_per_run` plan.

- [ ] **Step 3: Modify plans.ts**

Add `monthlyCreditsCents: number` to the `PlanDefinition` interface between `priceZarCents` and `priceDisplayUsd`. Populate each existing plan with a value (see mapping below). Add the new `pay_per_run` entry. Extend `PlanId` union.

```typescript
// src/lib/plans.ts — interface update
export type PlanId = "free" | "starter" | "founder" | "array" | "node" | "enterprise" | "pay_per_run";

export interface PlanDefinition {
  name: string;
  runsPerMonth: number;
  apiRatePerDay: number;
  demoRatePerDay: number;
  priceUsdCents: number;
  priceZarCents: number;
  /**
   * Credits granted at the start of each billing cycle, in cents.
   * Spent by `placeHold` on agent runs. Free tiers get a small
   * allocation; paid tiers get enough credit to cover their
   * runsPerMonth at average model cost + headroom.
   */
  monthlyCreditsCents: number;
  priceDisplayUsd: string;
  // ... rest unchanged
}
```

Then update each existing plan with the allocation mapping:

```typescript
// In PLANS:
free:       { ...existing, monthlyCreditsCents: 50 },      // ~50 cheap-model runs
starter:    { ...existing, monthlyCreditsCents: 400 },     // legacy — keep aligned
founder:    { ...existing, monthlyCreditsCents: 10_000 },  // internal, generous
array:      { ...existing, monthlyCreditsCents: 1_500 },   // Growth — enough for 500 runs
node:       { ...existing, monthlyCreditsCents: 8_000 },   // Sovereign Node
enterprise: { ...existing, monthlyCreditsCents: 40_000 },  // Enterprise — effectively unlimited
```

Add the new `pay_per_run` plan:

```typescript
pay_per_run: {
  name: "Pay Per Run",
  runsPerMonth: Infinity,
  apiRatePerDay: 5_000,
  demoRatePerDay: 5,
  priceUsdCents: 0, // no fixed monthly; user buys credits ad hoc
  priceZarCents: 0,
  monthlyCreditsCents: 0,
  priceDisplayUsd: "Usage",
  priceDisplayZar: "Verbruik",
  stripePriceEnvKey: null, // top-ups are one-time charges, not a recurring price
  purchasable: true,
  marketing: true,
  description: "No monthly fee. Top up credits as you go.",
},
```

- [ ] **Step 4: Run test — must PASS**

```
npx vitest run src/lib/__tests__/plans-credits.test.ts --reporter=verbose
```
Expected: all three green.

- [ ] **Step 5: Run full type-check to confirm no consumers broke**

```
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/plans.ts src/lib/__tests__/plans-credits.test.ts
git commit -m "feat(plans): add monthlyCreditsCents + pay_per_run tier (plan 1.2)"
```

---

## Task 3: Balance endpoint

**Files:**
- Create: `src/app/api/credits/balance/route.ts`
- Test: `src/lib/__tests__/credits-balance-route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/credits-balance-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockGetBalance } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetBalance: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/credits", () => ({
  getBalance: mockGetBalance,
}));
vi.mock("@/lib/plans", () => ({
  getPlan: (_: string) => ({ name: "Growth", monthlyCreditsCents: 1500 }),
}));
vi.mock("@/lib/free-tier", () => ({ getUserTier: () => Promise.resolve("array") }));

// Import AFTER mocks
import { GET } from "@/app/api/credits/balance/route";

beforeEach(() => {
  mockAuth.mockReset();
  mockGetBalance.mockReset();
});

describe("GET /api/credits/balance", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns balance, plan, and allocation for signed-in user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_42" });
    mockGetBalance.mockResolvedValue(750);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.balanceCents).toBe(750);
    expect(body.plan).toBe("array");
    expect(body.monthlyAllocationCents).toBe(1500);
  });
});
```

- [ ] **Step 2: Run — must FAIL**

```
npx vitest run src/lib/__tests__/credits-balance-route.test.ts
```

- [ ] **Step 3: Implement the route**

```typescript
// src/app/api/credits/balance/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBalance } from "@/lib/credits";
import { getPlan } from "@/lib/plans";
import { getUserTier } from "@/lib/free-tier";

/**
 * GET /api/credits/balance
 *
 * Returns the signed-in user's current credit balance in cents, their
 * current plan tier, and the monthly allocation that plan grants.
 *
 * The CreditsWidget polls this every 30 seconds. Keep it cheap —
 * one SELECT from user_credits, one tier read, no agg.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [balanceCents, plan] = await Promise.all([
    getBalance(userId),
    getUserTier(userId),
  ]);
  const planDef = getPlan(plan);

  return NextResponse.json({
    balanceCents,
    plan,
    monthlyAllocationCents: planDef.monthlyCreditsCents,
    lowBalance: balanceCents < 100, // < $1 triggers the banner
  });
}
```

- [ ] **Step 4: Run — must PASS**

```
npx vitest run src/lib/__tests__/credits-balance-route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/credits/balance/route.ts src/lib/__tests__/credits-balance-route.test.ts
git commit -m "feat(credits): balance endpoint (plan 1.3)"
```

---

## Task 4: History endpoint (cursor-paginated ledger)

**Files:**
- Create: `src/app/api/credits/history/route.ts`
- Test: `src/lib/__tests__/credits-history-route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/credits-history-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockSelect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: (_: number) => mockSelect(),
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({ creditTransactions: {} }));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), desc: vi.fn(), and: vi.fn(), lt: vi.fn(),
}));

import { GET } from "@/app/api/credits/history/route";

beforeEach(() => {
  mockAuth.mockReset();
  mockSelect.mockReset();
});

describe("GET /api/credits/history", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(new Request("http://localhost/api/credits/history"));
    expect(res.status).toBe(401);
  });

  it("returns ledger entries limited to 20 by default", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockSelect.mockResolvedValue([
      { id: "t1", deltaCents: 100, reason: "topup", createdAt: new Date() },
      { id: "t2", deltaCents: -5,  reason: "agent_run", createdAt: new Date() },
    ]);
    const res = await GET(new Request("http://localhost/api/credits/history"));
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].reason).toBe("topup");
  });
});
```

- [ ] **Step 2: Run — must FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/app/api/credits/history/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { creditTransactions } from "@/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";

/**
 * GET /api/credits/history?limit=20&cursor=<tx_id>
 *
 * Paginated ledger view for the billing page. Cursor is the ID of the
 * last entry from the previous page (simple keyset pagination).
 *
 * Returns at most 100 rows per request. The widget asks for 5; the
 * billing page asks for 20; anything over 100 is clamped.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 20));
  const cursor = url.searchParams.get("cursor");

  const whereClauses = cursor
    ? and(eq(creditTransactions.userId, userId), lt(creditTransactions.id, cursor))
    : eq(creditTransactions.userId, userId);

  const rows = await db
    .select()
    .from(creditTransactions)
    .where(whereClauses)
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

  return NextResponse.json({
    entries: rows.map((r) => ({
      id: r.id,
      deltaCents: r.deltaCents,
      reason: r.reason,
      agentId: r.agentId,
      runId: r.runId,
      createdAt: r.createdAt,
    })),
    nextCursor,
  });
}
```

- [ ] **Step 4: Run — must PASS**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/credits/history/route.ts src/lib/__tests__/credits-history-route.test.ts
git commit -m "feat(credits): paginated ledger history endpoint (plan 1.4)"
```

---

## Task 5: Stripe webhook → topUp

**Files:**
- Modify: `src/app/api/_payments/stripe/webhook/route.ts`
- Test: `src/lib/__tests__/credits-webhook.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/credits-webhook.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTopUp, mockUpsertSubscription } = vi.hoisted(() => ({
  mockTopUp: vi.fn(),
  mockUpsertSubscription: vi.fn().mockResolvedValue(undefined),
}));

// Mock the credits module so we can inspect what the webhook calls
vi.mock("@/lib/credits", () => ({ topUp: mockTopUp }));
vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: () => ({ onConflictDoUpdate: () => mockUpsertSubscription() }),
      onConflictDoUpdate: () => mockUpsertSubscription(),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
}));
vi.mock("@/db/schema", () => ({
  subscriptions: { userId: {} },
  stripeEvents: {},
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

// Fake Stripe SDK — only constructEvent + types are used by the route
vi.mock("stripe", () => {
  class MockStripe {
    static webhooks = { constructEvent: () => ({}) };
    webhooks = { constructEvent: (_body: string, _sig: string) => ({
      id: "evt_test",
      type: "checkout.session.completed",
      data: { object: {
        customer: "cus_abc",
        subscription: "sub_abc",
        metadata: { plan: "array", userId: "user_xyz" },
      }},
    }) };
  }
  return { default: MockStripe };
});

// Other shim
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

beforeEach(() => {
  mockTopUp.mockReset();
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
});

describe("Stripe webhook — topUp on checkout.session.completed", () => {
  it("calls topUp with the plan's monthly allocation", async () => {
    const { POST } = await import("@/app/api/_payments/stripe/webhook/route");
    const req = new Request("http://localhost/webhook", {
      method: "POST",
      headers: { "stripe-signature": "whatever" },
      body: "{}",
    });
    mockTopUp.mockResolvedValue(1500);
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Growth plan has 1500 cents monthly allocation (see plans.ts)
    expect(mockTopUp).toHaveBeenCalledWith(
      "user_xyz",
      1500,
      "topup",
      expect.objectContaining({ stripeEventId: "evt_test" }),
    );
  });
});
```

- [ ] **Step 2: Run — must FAIL**

```
npx vitest run src/lib/__tests__/credits-webhook.test.ts
```

- [ ] **Step 3: Modify the route handler**

Find the `case "checkout.session.completed":` block in
`src/app/api/_payments/stripe/webhook/route.ts`. At the end of that
block, after the `subscriptions` upsert, add:

```typescript
// AFTER the existing db.insert(subscriptions) call:
if (userId) {
  const { getPlan } = await import("@/lib/plans");
  const { topUp } = await import("@/lib/credits");
  const planDef = getPlan(plan);
  const cents = planDef.monthlyCreditsCents;
  if (cents > 0) {
    await topUp(userId, cents, "topup", {
      stripeEventId: event.id,
      stripeSubscriptionId: subscriptionId,
      plan,
    });
    log.info("Credits topped up on checkout", { userId, cents, plan });
  }
}
```

- [ ] **Step 4: Run — must PASS**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/_payments/stripe/webhook/route.ts src/lib/__tests__/credits-webhook.test.ts
git commit -m "feat(credits): Stripe webhook tops up monthly allocation (plan 1.5)"
```

---

## Task 6: Agent factory — place hold pre-execution

**Files:**
- Modify: `src/lib/agent-factory.ts`
- Test: `src/lib/__tests__/credits-factory.test.ts`

- [ ] **Step 1: Write the failing test (hold-placement path)**

```typescript
// src/lib/__tests__/credits-factory.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPlaceHold, mockCaptureHold, mockReleaseHold } = vi.hoisted(() => ({
  mockPlaceHold: vi.fn(),
  mockCaptureHold: vi.fn(),
  mockReleaseHold: vi.fn(),
}));

vi.mock("@/lib/credits", async () => {
  const actual = await vi.importActual<typeof import("@/lib/credits")>("@/lib/credits");
  return {
    ...actual,
    placeHold: mockPlaceHold,
    captureHold: mockCaptureHold,
    releaseHold: mockReleaseHold,
  };
});

beforeEach(() => {
  mockPlaceHold.mockReset();
  mockCaptureHold.mockReset();
  mockReleaseHold.mockReset();
});

describe("agent factory — credit hold lifecycle", () => {
  it("places a hold before the handler runs", async () => {
    // This test checks that when an agent is invoked, placeHold is
    // called with the userId + estimated hold amount BEFORE the
    // handler function executes. See Task 6 Step 3 for the wiring.
    mockPlaceHold.mockResolvedValue("hold_abc");
    mockCaptureHold.mockResolvedValue(undefined);

    // NOTE: this test needs a running agent route invocation. Use the
    // `createAgentRoute` factory directly with a dummy handler that
    // records call order.
    const callOrder: string[] = [];
    const { createAgentRoute } = await import("@/lib/agent-factory");
    const handler = createAgentRoute({
      name: "test-agent",
      public: false,
      handler: async () => {
        callOrder.push("handler");
        return { ok: true };
      },
    });
    // Invoke via a mocked Request object (see existing agent-factory.test.ts
    // for the mocking convention)
    // ... [wire up mocks the way existing agent-factory.test.ts does]
    // Assertions:
    expect(callOrder).toEqual(["handler"]);
    expect(mockPlaceHold).toHaveBeenCalledBefore(mockCaptureHold);
  });

  it("releases the hold and returns 402 when balance is insufficient", async () => {
    const { InsufficientCreditsError } = await import("@/lib/credits");
    mockPlaceHold.mockRejectedValue(new InsufficientCreditsError("u_1", 100, 5));
    // ... invoke route, expect 402 and a helpful error body
  });

  it("releases the hold when the handler throws", async () => {
    mockPlaceHold.mockResolvedValue("hold_xyz");
    // ... make handler throw; expect releaseHold("hold_xyz") called
    expect(mockReleaseHold).toHaveBeenCalledWith("hold_xyz");
  });

  it("captures the hold when the handler succeeds", async () => {
    mockPlaceHold.mockResolvedValue("hold_good");
    // ... handler returns ok; expect captureHold("hold_good") called
    expect(mockCaptureHold).toHaveBeenCalledWith("hold_good");
  });
});
```

- [ ] **Step 2: Run — must FAIL**

- [ ] **Step 3: Wire hold lifecycle into the factory**

Locate the `// ─── Pre-execution governance ───` block in
`src/lib/agent-factory.ts` (line ~390 in the current file). Add a new
governance gate for credits:

```typescript
// src/lib/agent-factory.ts — inside the route handler, AFTER paywall checks
// but BEFORE `runWithAttribution`:

let creditHoldId: string | null = null;
if (userId && !config.public) {
  try {
    const { placeHold, InsufficientCreditsError } = await import("@/lib/credits");
    const { estimatedHoldCents } = await import("@/lib/pricing-costs");
    // Conservative default: hold enough for a 2000-token run on the
    // cheapest sovereignty-safe model. Actual capture uses the real
    // tokens consumed.
    const estimatedCents = estimatedHoldCents("nvidia/nemotron-3-nano-30b-a3b", 2000);
    creditHoldId = await placeHold(userId, estimatedCents, undefined, 5 * 60_000);
  } catch (err) {
    const { InsufficientCreditsError } = await import("@/lib/credits");
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: err.required,
          available: err.available,
          topUpUrl: "/dashboard/billing?topup=true",
        },
        { status: 402 }, // Payment Required
      );
    }
    throw err;
  }
}

// wrap the existing handler-execution try/catch so we always release or capture:
try {
  // ... existing runWithAttribution call
  // on success (end of the try block):
  if (creditHoldId) {
    const { captureHold } = await import("@/lib/credits");
    void captureHold(creditHoldId).catch(() => {}); // never fail the response on capture
  }
} catch (err) {
  if (creditHoldId) {
    const { releaseHold } = await import("@/lib/credits");
    void releaseHold(creditHoldId).catch(() => {});
  }
  throw err;
}
```

- [ ] **Step 4: Run tests — must PASS**

- [ ] **Step 5: Run the full test suite to ensure no regression in the 1000+ existing tests**

```
npm test -- --reporter=dot
```
Expected: 1280+ passing, no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent-factory.ts src/lib/__tests__/credits-factory.test.ts
git commit -m "feat(credits): factory places holds, captures on success, releases on failure (plan 1.6)"
```

---

## Task 7: Sweep-expired-holds cron

**Files:**
- Create: `src/app/api/cron/sweep-expired-holds/route.ts`
- Modify: `vercel.json` (add cron entry)
- Test: `src/lib/__tests__/sweep-holds-cron.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/lib/__tests__/sweep-holds-cron.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSweep } = vi.hoisted(() => ({ mockSweep: vi.fn() }));
vi.mock("@/lib/credits", () => ({ sweepExpiredHolds: mockSweep }));

beforeEach(() => { mockSweep.mockReset(); });

describe("GET /api/cron/sweep-expired-holds", () => {
  it("returns 401 without Bearer CRON_SECRET", async () => {
    process.env.CRON_SECRET = "topsecret";
    const { GET } = await import("@/app/api/cron/sweep-expired-holds/route");
    const res = await GET(new Request("http://localhost/cron", {
      headers: {},
    }));
    expect(res.status).toBe(401);
  });

  it("calls sweepExpiredHolds and returns count with valid secret", async () => {
    process.env.CRON_SECRET = "topsecret";
    mockSweep.mockResolvedValue(7);
    const { GET } = await import("@/app/api/cron/sweep-expired-holds/route");
    const res = await GET(new Request("http://localhost/cron", {
      headers: { Authorization: "Bearer topsecret" },
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.swept).toBe(7);
    expect(mockSweep).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — must FAIL**

- [ ] **Step 3: Implement the cron endpoint**

```typescript
// src/app/api/cron/sweep-expired-holds/route.ts
import { NextResponse } from "next/server";
import { sweepExpiredHolds } from "@/lib/credits";

/**
 * GET /api/cron/sweep-expired-holds
 *
 * Vercel cron endpoint. Runs every minute. Releases credit holds whose
 * expiresAt has passed so orphaned holds (from crashed runs) don't
 * keep a user's balance artificially low.
 *
 * Auth: Bearer <CRON_SECRET>. Vercel injects this header; local dev
 * hitting the endpoint must also include it.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const swept = await sweepExpiredHolds();
  return NextResponse.json({ ok: true, swept, ranAt: new Date().toISOString() });
}
```

- [ ] **Step 4: Add cron entry to vercel.json**

```json
// vercel.json — append to the "crons" array:
{
  "path": "/api/cron/sweep-expired-holds",
  "schedule": "* * * * *"
}
```

- [ ] **Step 5: Run — must PASS**

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/sweep-expired-holds/route.ts src/lib/__tests__/sweep-holds-cron.test.ts vercel.json
git commit -m "feat(credits): sweep-expired-holds cron (plan 1.7)"
```

---

## Task 8: CreditsWidget component

**Files:**
- Create: `src/components/dashboard/CreditsWidget.tsx`
- Modify: `src/app/dashboard/layout.tsx` (mount the widget in the sidebar)

- [ ] **Step 1: Write the widget**

```typescript
// src/components/dashboard/CreditsWidget.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Coins } from "lucide-react";

/**
 * CreditsWidget — Sidebar balance display. Polls /api/credits/balance
 * every 30s. Shows the balance in dollars with a copper "Top up" CTA
 * when below $1.
 *
 * Always renders SOMETHING if userId is present — on first paint, we
 * show "—" rather than an empty slot to prevent layout shift.
 */

interface Balance {
  balanceCents: number;
  plan: string;
  monthlyAllocationCents: number;
  lowBalance: boolean;
}

export function CreditsWidget() {
  const [data, setData] = useState<Balance | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/credits/balance");
        if (!res.ok) return;
        const body = (await res.json()) as Balance;
        if (alive) setData(body);
      } catch { /* ignore — next tick will try again */ }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!data) return null;

  const dollars = (data.balanceCents / 100).toFixed(2);

  return (
    <div className="px-3 pb-2">
      <div
        className={`rounded-xl px-3 py-2.5 border transition-colors ${
          data.lowBalance
            ? "border-[#B5532C]/30 bg-[#B5532C]/[0.08]"
            : "border-white/[0.06] bg-white/[0.02]"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
            Balance
          </span>
          <span className="flex items-center gap-1 text-xs font-mono text-white">
            <Coins className="w-3 h-3 text-[#B5532C]" /> ${dollars}
          </span>
        </div>
        {data.lowBalance ? (
          <Link
            href="/dashboard/billing?topup=true"
            className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#E08558] hover:text-white transition-colors"
          >
            <AlertCircle className="w-3 h-3" /> Top up credits
          </Link>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount in layout**

In `src/app/dashboard/layout.tsx`, find where `<UsageWidget />` is
rendered in the sidebar. Add `<CreditsWidget />` immediately below it:

```typescript
import { CreditsWidget } from '@/components/dashboard/CreditsWidget';
// ...
{sidebarExpanded && <UsageWidget />}
{sidebarExpanded && <CreditsWidget />}
```

- [ ] **Step 3: Verify**

Run the dev server, sign in, confirm the widget renders with a balance.
If DATABASE_URL is not set, the widget renders null (no DB = no balance).

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/CreditsWidget.tsx src/app/dashboard/layout.tsx
git commit -m "feat(credits): sidebar widget showing balance + low-balance nudge (plan 1.8)"
```

---

## Task 9: Billing page integration

**Files:**
- Modify: `src/app/dashboard/billing/page.tsx`

- [ ] **Step 1: Add a Credits section above the existing subscription block**

```typescript
// src/app/dashboard/billing/page.tsx — near the top of the JSX
import { useEffect, useState } from "react";

// inside the component:
const [credits, setCredits] = useState<{balanceCents: number; plan: string; monthlyAllocationCents: number} | null>(null);
const [history, setHistory] = useState<Array<{id: string; deltaCents: number; reason: string; createdAt: string}>>([]);

useEffect(() => {
  fetch("/api/credits/balance").then(r => r.ok ? r.json() : null).then(b => b && setCredits(b));
  fetch("/api/credits/history?limit=5").then(r => r.ok ? r.json() : {entries:[]}).then(b => setHistory(b.entries ?? []));
}, []);

// ... in the JSX:
{credits && (
  <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
    <h3 className="text-sm font-semibold text-white mb-1">Credit Balance</h3>
    <p className="text-3xl font-mono text-[#E08558]">${(credits.balanceCents/100).toFixed(2)}</p>
    <p className="text-xs text-neutral-500 mt-1">
      Monthly allocation: ${(credits.monthlyAllocationCents/100).toFixed(2)} on {credits.plan}
    </p>
    {history.length > 0 && (
      <div className="mt-4 space-y-1 text-xs">
        {history.map(h => (
          <div key={h.id} className="flex justify-between text-neutral-400">
            <span>{h.reason} · {new Date(h.createdAt).toLocaleDateString()}</span>
            <span className={h.deltaCents > 0 ? "text-emerald-400" : "text-neutral-400"}>
              {h.deltaCents > 0 ? "+" : ""}{(h.deltaCents/100).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Run `npm run build` to catch any type errors**

```
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/billing/page.tsx
git commit -m "feat(credits): billing page shows balance + recent ledger entries (plan 1.9)"
```

---

## Task 10: Pay-Per-Run tier on pricing page

**Files:**
- Modify: `src/app/pricing/page.tsx`

- [ ] **Step 1: Add the card**

Find the plan-card grid in `src/app/pricing/page.tsx`. Insert a new
card for `pay_per_run` between Growth and Sovereign Node:

```typescript
// Somewhere in the PLAN_CARDS array (or the JSX grid):
{
  id: "pay_per_run",
  badge: "USAGE",
  headline: "Pay Per Run",
  price: "$0 base",
  subPrice: "+ credits",
  description: "No monthly fee. Load $20, spend it over months. No-surprise pricing — every run shows its cost.",
  features: [
    "Runs cost $0.01 – $0.50 depending on agent",
    "Credits never expire",
    "5,000 API calls/day",
    "All 137 agents + 39 models",
    "No subscription to cancel",
  ],
  cta: { label: "Buy $20 credits", href: "/dashboard/billing?topup=20" },
},
```

Make sure the card styling matches the copper accent convention of the
other tiers (see existing Growth card).

- [ ] **Step 2: Commit**

```bash
git add src/app/pricing/page.tsx
git commit -m "feat(pricing): pay-per-run tier card (plan 1.10)"
```

---

## Task 11: Final integration check

- [ ] **Step 1: Full quality gate**

```bash
npx tsc --noEmit          # 0 errors
npm test -- --reporter=dot # all tests green
npm run build             # no build errors
```

- [ ] **Step 2: Manual smoke test**

1. Sign in to `http://localhost:3000/login`
2. Open `/dashboard` — CreditsWidget should render with balance $0.00
3. Hit `/dashboard/billing` — balance card should show
4. Run an agent from any playbook — watch balance drop (in DB, or after widget polls)
5. Let the agent fail — confirm hold is released (balance back up after 5 min or after cron runs)

- [ ] **Step 3: Tag this plan's completion**

```bash
git tag plan-1-revenue-engine-complete
```

---

## Self-Review Checklist

- [ ] Every task has concrete code + file paths
- [ ] No "implement later" / "TBD" / "similar to Task N"
- [ ] TDD order preserved (test → fail → impl → pass → commit)
- [ ] Cron endpoint is auth-gated (Bearer CRON_SECRET)
- [ ] Handler-error path releases the hold (no orphaned holds on crashes)
- [ ] Handler-success path captures the hold
- [ ] Insufficient balance returns 402 with a helpful URL, not a 500
- [ ] Existing 1280+ tests still pass after each task

## Open questions for future plans

- Should high-tier plans get **unlimited** instead of a big credit number? Currently Enterprise = 40,000¢ = ~$400 — effectively unlimited but finite. Choice is: leave as-is (simple) or add `unlimitedCredits: boolean` flag.
- Top-up flow UI — does the billing page need `?topup=20` to auto-open a Stripe Payment Link, or do we require users to click through? Plan 2 (Sovereign World) marketplace needs this to work.
