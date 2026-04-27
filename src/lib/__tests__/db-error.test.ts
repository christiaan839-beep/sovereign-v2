/**
 * Tests for src/lib/db-error.ts — Unified DB error translation.
 *
 * Locks in the contract that table-missing returns 503 with a migration
 * hint (or `emptyOnMissing` for read-only routes that prefer soft fallback),
 * column-missing also returns 503, and any other error returns a generic 500
 * without leaking the underlying message.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  handleDBError,
  isPgTableMissing,
  isPgColumnMissing,
} from "@/lib/db-error";

function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

describe("isPgTableMissing", () => {
  it("matches 42P01", () => {
    expect(isPgTableMissing(pgError("42P01", "relation does not exist"))).toBe(
      true,
    );
  });
  it("matches plain Error whose message says 'does not exist'", () => {
    expect(isPgTableMissing(new Error('relation "foo" does not exist'))).toBe(
      true,
    );
  });
  it("does not match unrelated errors", () => {
    expect(isPgTableMissing(new Error("connection refused"))).toBe(false);
    expect(isPgTableMissing(null)).toBe(false);
    expect(isPgTableMissing(undefined)).toBe(false);
  });
});

describe("isPgColumnMissing", () => {
  it("matches 42703", () => {
    expect(isPgColumnMissing(pgError("42703", "column does not exist"))).toBe(
      true,
    );
  });
  it("does not match table-missing", () => {
    expect(isPgColumnMissing(pgError("42P01", "x"))).toBe(false);
  });
});

describe("handleDBError", () => {
  it("table-missing → 503 with migration hint by default", async () => {
    const res = handleDBError(pgError("42P01", "x"), { route: "/api/jobs" });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("MIGRATION_REQUIRED");
    expect(body.hint).toContain("apply-pending-migrations");
  });

  it("table-missing + emptyOnMissing → 200 with the supplied empty payload", async () => {
    const res = handleDBError(pgError("42P01", "x"), {
      route: "/api/jobs",
      emptyOnMissing: { jobs: [] },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jobs: [] });
  });

  it("column-missing → 503 with migration hint", async () => {
    const res = handleDBError(pgError("42703", "column missing"), {
      route: "/api/x",
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("MIGRATION_REQUIRED");
  });

  it("generic error → 500 with sanitized payload (never leaks internals)", async () => {
    const res = handleDBError(
      new Error("password authentication failed for user 'admin'"),
      { route: "/api/secret" },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("DB_ERROR");
    expect(body.error).toBe("Internal database error");
    // Sanity: the password-leak message must NOT be returned to the client.
    expect(JSON.stringify(body)).not.toContain("password");
    expect(JSON.stringify(body)).not.toContain("admin");
  });
});
