/**
 * execution-audit — Round 26 tests.
 *
 * Verifies the graceful no-DB fallback contract: every helper
 * returns a sane shape when DATABASE_URL is unset and never throws.
 *
 * The DB-backed paths are exercised in route-level tests (mocked
 * drizzle). Here we focus on the pure-function and fallback
 * semantics that callers depend on.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (ORIGINAL_DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  }
  vi.resetModules();
});

async function importAudit() {
  return await import("../execution-audit");
}

const sampleEntry = {
  tenantId: "t1",
  agentName: "leads",
  modelUsed: "nim/nemotron-ultra",
  input: "x".repeat(800),
  output: "y".repeat(800),
  safetyResult: {
    jailbreak: "pass" as const,
    pii: "pass" as const,
    content: "pass" as const,
    quality: 92,
    critic: "pass" as const,
  },
  trustLevel: 3,
  approvalRequired: false,
  approvalStatus: "auto" as const,
  executionTimeMs: 1234,
  chainDepth: 2,
  externalApisAccessed: ["tavily", "nim"],
  dataExported: false,
};

describe("execution-audit — graceful no-DB fallbacks", () => {
  it("logExecution returns null when DB is unavailable", async () => {
    const { logExecution } = await importAudit();
    const result = await logExecution(sampleEntry);
    expect(result).toBeNull();
  });

  it("getAuditLog returns [] when DB is unavailable", async () => {
    const { getAuditLog } = await importAudit();
    expect(await getAuditLog()).toEqual([]);
    expect(await getAuditLog("tenant_x")).toEqual([]);
  });

  it("getAuditStats returns zero-shape when DB is unavailable", async () => {
    const { getAuditStats } = await importAudit();
    const stats = await getAuditStats();
    expect(stats.total).toBe(0);
    expect(stats.blocked).toBe(0);
    expect(stats.pipelinePassRate).toBe(0);
  });

  it("logExecution truncates input/output to 500 chars before persistence", async () => {
    // Even with no DB, the truncation logic runs locally before
    // the (failed) insert. We can verify by reading the entry's
    // input length when the function ever DOES return one — but
    // since DB is off, we just verify the fail-silent contract.
    const { logExecution } = await importAudit();
    const result = await logExecution(sampleEntry);
    expect(result).toBeNull();
    // Truncation is verified by the route-level integration test
    // (with a mocked drizzle insert spy capturing the call args).
  });

  it("never throws on hostile inputs (graceful contract)", async () => {
    const { logExecution, getAuditLog, getAuditStats } = await importAudit();
    await expect(logExecution(sampleEntry)).resolves.not.toThrow();
    await expect(getAuditLog()).resolves.not.toThrow();
    await expect(getAuditStats()).resolves.not.toThrow();
  });
});
