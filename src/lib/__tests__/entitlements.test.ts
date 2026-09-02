/**
 * Tests for the entitlement authority in src/lib/plan-enforcement.ts.
 *
 * These assert enforcement behaviour, not that a constant equals itself:
 *   - a free user is denied white-label
 *   - an entitled (enterprise) user is allowed
 *   - an expired subscription falls back to free and is denied
 *   - a DB error DENIES rather than allows (fail closed)
 *   - the GDPR/POPIA data-export route stays ungated for every plan
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// ── Module-level mocks of drizzle pieces (mirrors
//    plan-enforcement.unified.test.ts) ─────────────────────────────────────

let subscriptionRow: {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
} | null = null;
let subscriptionThrows: Error | null = null;

const usageTable = { __name: "usage" };
const playbookRunsTable = { __name: "playbook_runs" };
const subscriptionsTable = { __name: "subscriptions" };

function makeSelectChain(table: unknown) {
  return {
    from: (_t: unknown) => ({
      where: (_w: unknown) => ({
        limit: () => {
          if (table === subscriptionsTable) {
            if (subscriptionThrows) throw subscriptionThrows;
            return Promise.resolve(subscriptionRow ? [subscriptionRow] : []);
          }
          return Promise.resolve([]);
        },
        then: (resolve: (rows: unknown[]) => void) => {
          resolve([]);
          return { catch: () => Promise.resolve() };
        },
      }),
    }),
  };
}

const dbMock = {
  select: (_cols: unknown) => ({
    from: (table: unknown) => makeSelectChain(table).from(table),
  }),
};

vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@/db/schema", () => ({
  usage: usageTable,
  playbookRuns: playbookRunsTable,
  subscriptions: subscriptionsTable,
}));
vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
  and: (..._args: unknown[]) => ({}),
  gte: () => ({}),
  sql: (strings: TemplateStringsArray, ..._values: unknown[]) =>
    strings.join(""),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

async function load() {
  vi.resetModules();
  return await import("@/lib/plan-enforcement");
}

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

beforeEach(() => {
  subscriptionRow = null;
  subscriptionThrows = null;
});

// ── getUserEntitlements ───────────────────────────────────────────────────

describe("getUserEntitlements — one resolution path", () => {
  it("a user with no subscription row gets the free tier's flags (all off)", async () => {
    const { getUserEntitlements } = await load();
    const flags = await getUserEntitlements("user_free");
    expect(flags.whiteLabel).toBe(false);
    expect(flags.auditLogExport).toBe(false);
    expect(flags.slaUptimeBps).toBe(0);
  });

  it("an active enterprise subscription carries white-label + audit export", async () => {
    subscriptionRow = {
      plan: "enterprise",
      status: "active",
      currentPeriodEnd: FUTURE,
    };
    const { getUserEntitlements } = await load();
    const flags = await getUserEntitlements("user_ent");
    expect(flags.whiteLabel).toBe(true);
    expect(flags.auditLogExport).toBe(true);
  });

  it("node carries audit export but NOT white-label", async () => {
    subscriptionRow = {
      plan: "node",
      status: "active",
      currentPeriodEnd: null,
    };
    const { getUserEntitlements } = await load();
    const flags = await getUserEntitlements("user_node");
    expect(flags.auditLogExport).toBe(true);
    expect(flags.whiteLabel).toBe(false);
  });
});

// ── requireEntitlement ────────────────────────────────────────────────────

describe("requireEntitlement — the guard", () => {
  it("denies white-label to a free user and points at the Enterprise plan", async () => {
    const { requireEntitlement } = await load();
    const gate = await requireEntitlement("user_free", "whiteLabel");
    expect(gate.allowed).toBe(false);
    expect(gate.plan).toBe("free");
    expect(gate.requiredPlan).toBe("enterprise");
    expect(gate.upgradeUrl).toBe("/pricing");
    expect(gate.message).toMatch(/Enterprise/);
  });

  it("allows white-label to an entitled enterprise user", async () => {
    subscriptionRow = {
      plan: "enterprise",
      status: "active",
      currentPeriodEnd: FUTURE,
    };
    const { requireEntitlement } = await load();
    const gate = await requireEntitlement("user_ent", "whiteLabel");
    expect(gate.allowed).toBe(true);
    expect(gate.plan).toBe("enterprise");
    expect(gate.message).toBeUndefined();
  });

  it("denies white-label once the paid period has ended", async () => {
    subscriptionRow = {
      plan: "enterprise",
      status: "active",
      currentPeriodEnd: PAST,
    };
    const { requireEntitlement } = await load();
    const gate = await requireEntitlement("user_lapsed", "whiteLabel");
    expect(gate.allowed).toBe(false);
    expect(gate.plan).toBe("free");
  });

  it("denies audit-log export to free/starter and allows it from node up", async () => {
    const mod = await load();
    const free = await mod.requireEntitlement("user_free", "auditLogExport");
    expect(free.allowed).toBe(false);
    expect(free.requiredPlan).toBe("node");

    subscriptionRow = {
      plan: "starter",
      status: "active",
      currentPeriodEnd: FUTURE,
    };
    const starter = await mod.requireEntitlement("u_s", "auditLogExport");
    expect(starter.allowed).toBe(false);

    subscriptionRow = {
      plan: "node",
      status: "active",
      currentPeriodEnd: FUTURE,
    };
    const node = await mod.requireEntitlement("u_n", "auditLogExport");
    expect(node.allowed).toBe(true);
  });

  it("FAILS CLOSED — a database error denies rather than allows", async () => {
    subscriptionThrows = new Error("connection terminated unexpectedly");
    const { requireEntitlement, getUserEntitlements } = await load();
    const gate = await requireEntitlement("user_ent", "whiteLabel");
    expect(gate.allowed).toBe(false);
    expect(gate.plan).toBe("free");
    const flags = await getUserEntitlements("user_ent");
    expect(flags.whiteLabel).toBe(false);
    expect(flags.auditLogExport).toBe(false);
  });

  it("a missing subscriptions table (42P01) degrades to free, not to enterprise", async () => {
    const missing = Object.assign(
      new Error('relation "subscriptions" does not exist'),
      {
        code: "42P01",
      },
    );
    subscriptionThrows = missing;
    const { requireEntitlement } = await load();
    const gate = await requireEntitlement("user_x", "auditLogExport");
    expect(gate.allowed).toBe(false);
    expect(gate.plan).toBe("free");
  });
});

// ── Compliance invariant ──────────────────────────────────────────────────

describe("data-subject access stays open to every plan", () => {
  it("/api/data-export carries no entitlement gate", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../app/api/data-export/route.ts"),
      "utf8",
    );
    // Gating a GDPR Art. 15 / POPIA s. 23 access request behind a paid
    // tier is a compliance violation, not a monetisation win. The signed
    // evidence bundle at /api/me/audit-bundle is the commercial artifact.
    expect(src).not.toMatch(/requireEntitlement/);
    expect(src).not.toMatch(/auditLogExport/);
  });
});
