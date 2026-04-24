/**
 * Tests for src/lib/audit-log.ts
 *
 * Two layers:
 *
 *   1. Fail-open semantics — auditLog() never throws, so audit failures
 *      can't break the user-facing request path.
 *   2. Hash-chain integrity — the SOC-2 trail's whole job is to detect
 *      tampering. We drive a real chain end-to-end (write → verify),
 *      then mutate the captured rows in three ways and prove the
 *      verifier flags the exact broken row.
 *
 * Implementation note: drizzle's `sql` tagged template returns a chunk
 * object whose first arg is the TemplateStringsArray. We inspect the
 * leading SQL keyword (SELECT vs INSERT) inside the mock to dispatch.
 * That lets a single `db.execute` mock simulate both the read-prev-row
 * lookup and the verify-chain bulk read while sharing the same captured
 * row store.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Mocks — `vi.mock` is hoisted to the top of the module, so any state
// the factory closes over must also be hoisted via `vi.hoisted()`. The
// shared `mockRows`/`nextId` lives there so test cases can mutate the
// captured chain to simulate tampering.
// ────────────────────────────────────────────────────────────

const mockState = vi.hoisted(() => {
  interface MockRow {
    id: string;
    user_id: string;
    action: string;
    resource: string | null;
    details: string | null;
    created_at: string;
    prev_hash: string | null;
    row_hash: string | null;
  }

  const mockRows: MockRow[] = [];
  const counter = { next: 1 };

  function classifyQuery(
    args: unknown[],
  ): "select-prev" | "select-all" | "insert" | "other" {
    const head = String((args[0] as readonly string[])?.[0] ?? "").trim();
    if (head.startsWith("SELECT row_hash FROM audit_logs ORDER BY created_at DESC LIMIT")) {
      return "select-prev";
    }
    if (head.startsWith("SELECT id, user_id, action")) {
      return "select-all";
    }
    if (head.startsWith("INSERT INTO audit_logs")) {
      return "insert";
    }
    return "other";
  }

  function extractInsertValues(args: unknown[]): MockRow {
    // Drizzle sql template:
    //   INSERT ... VALUES (${userId}, ${action}, ${resource}, ${details},
    //                      ${ipAddress}, ${createdAt}, ${prevHash}, ${rowHash})
    // → args = [stringsArray, userId, action, resource, details,
    //           ipAddress, createdAt, prevHash, rowHash]
    const [, userId, action, resource, details, , createdAt, prevHash, rowHash] = args;
    return {
      id: `row-${counter.next++}`,
      user_id: String(userId ?? ""),
      action: String(action ?? ""),
      resource: (resource as string | null) ?? null,
      details: (details as string | null) ?? null,
      created_at: String(createdAt ?? new Date().toISOString()),
      prev_hash: (prevHash as string | null) ?? null,
      row_hash: (rowHash as string | null) ?? null,
    };
  }

  return { mockRows, counter, classifyQuery, extractInsertValues };
});

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(async (q: { queryChunks: unknown[] }) => {
      const args = q.queryChunks ?? [];
      const kind = mockState.classifyQuery(args);
      if (kind === "select-prev") {
        const last = mockState.mockRows[mockState.mockRows.length - 1];
        return last ? [{ row_hash: last.row_hash }] : [];
      }
      if (kind === "select-all") {
        return mockState.mockRows.filter((r) => r.row_hash !== null);
      }
      if (kind === "insert") {
        mockState.mockRows.push(mockState.extractInsertValues(args));
        return undefined;
      }
      return undefined;
    }),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (...args: unknown[]) => ({ queryChunks: args }),
    { raw: (s: string) => s },
  ),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { auditLog, verifyAuditChain } from "@/lib/audit-log";
import { db } from "@/db";

const dbExecute = vi.mocked(db.execute);
// Convenience alias — `mockState` is hoisted by `vi.hoisted()` above.
const mockRows = mockState.mockRows;

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("audit-log · fail-open semantics (SOC-2)", () => {
  beforeEach(() => {
    mockRows.length = 0;
    mockState.counter.next = 1;
    dbExecute.mockClear();
  });

  it("logs an audit event to the database", async () => {
    await auditLog({
      userId: "user_123",
      action: "agent.execute",
      resource: "leads",
      details: { durationMs: 1200, success: true },
    });
    expect(dbExecute).toHaveBeenCalled();
    expect(mockRows).toHaveLength(1);
    expect(mockRows[0].user_id).toBe("user_123");
    expect(mockRows[0].action).toBe("agent.execute");
    expect(mockRows[0].row_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not throw on DB failure (fail-open)", async () => {
    dbExecute.mockRejectedValueOnce(new Error("DB down"));
    await expect(
      auditLog({ userId: "user_123", action: "agent.execute" }),
    ).resolves.not.toThrow();
  });

  it("starts the chain at GENESIS for the first row", async () => {
    await auditLog({ userId: "u1", action: "user.login" });
    expect(mockRows[0].prev_hash).toBe("GENESIS");
  });
});

describe("audit-log · hash chain integrity", () => {
  beforeEach(() => {
    mockRows.length = 0;
    mockState.counter.next = 1;
    dbExecute.mockClear();
  });

  /**
   * Helper — write three real audit events. After this returns,
   * mockRows holds three rows that form a verifiable chain:
   *   row 1: prev_hash = GENESIS, row_hash = h1
   *   row 2: prev_hash = h1,      row_hash = h2
   *   row 3: prev_hash = h2,      row_hash = h3
   */
  async function seedThreeRowChain() {
    await auditLog({ userId: "u1", action: "user.login", details: { ip: "1.2.3.4" } });
    await auditLog({ userId: "u1", action: "agent.execute", resource: "leads", details: { tokens: 1200 } });
    await auditLog({ userId: "u1", action: "settings.update", details: { field: "email" } });
  }

  it("verifies a clean chain end-to-end", async () => {
    await seedThreeRowChain();

    const result = await verifyAuditChain({ limit: 100 });
    expect(result.valid).toBe(true);
    expect(result.checked).toBe(3);
    expect(result.brokenAt).toBeNull();
  });

  it("DETECTS in-place edit of a row's `details` field (the core SOC-2 claim)", async () => {
    await seedThreeRowChain();

    // Simulate an attacker editing row 2's details to hide what happened.
    // (E.g., changing tokens: 1200 → tokens: 0 to suppress a billing event.)
    // Row 2's stored row_hash was computed from the ORIGINAL details, so
    // the verifier — which recomputes the hash from the current contents
    // and compares to row_hash — will catch the mismatch.
    mockRows[1].details = JSON.stringify({ tokens: 0 });

    const result = await verifyAuditChain({ limit: 100 });
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe("row-2");
    expect(result.checked).toBe(1); // checked row 1 successfully, then broke at row 2
  });

  it("DETECTS a forged prev_hash (chain re-anchoring attempt)", async () => {
    await seedThreeRowChain();

    // Attacker tries to insert a forged row 2.5 between row 2 and 3 by
    // rewriting row 3's prev_hash to point at their fake row instead.
    // Even without changing row 3's other fields, the verifier sees
    // prev_hash != lastHash and flags it.
    mockRows[2].prev_hash = "0".repeat(64);

    const result = await verifyAuditChain({ limit: 100 });
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe("row-3");
    expect(result.foundPrev).toBe("0".repeat(64));
    expect(result.expectedPrev).toBe(mockRows[1].row_hash);
  });

  it("DETECTS a forged row_hash (signature substitution attempt)", async () => {
    await seedThreeRowChain();

    // Attacker edits row 1's row_hash to a value they control. The
    // verifier recomputes the expected hash from the row's other fields
    // and sees the mismatch.
    mockRows[0].row_hash = "deadbeef".repeat(8);

    const result = await verifyAuditChain({ limit: 100 });
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe("row-1");
    expect(result.checked).toBe(0);
  });

  it("skips pre-migration rows (NULL row_hash) without breaking", async () => {
    // Pre-migration rows have row_hash = null. They predate the chain,
    // so they're invisible to the verifier — its WHERE row_hash IS NOT
    // NULL filter omits them. The chain just anchors at the first
    // hashed row.
    mockRows.push({
      id: "legacy-1",
      user_id: "u_old",
      action: "user.login",
      resource: null,
      details: "{}",
      created_at: new Date().toISOString(),
      prev_hash: null,
      row_hash: null,
    });
    await seedThreeRowChain();

    const result = await verifyAuditChain({ limit: 100 });
    expect(result.valid).toBe(true);
    expect(result.checked).toBe(3); // legacy row excluded
  });
});
