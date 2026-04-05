/**
 * Tests for src/lib/error-reporter.ts — in-memory + DB dual-write error log
 *
 * Covers the pure in-memory buffer: reportError, getErrorLog, getErrorSummary,
 * clearErrorLog. The DB-persist path is non-blocking and silently fails in
 * tests (no DB connection) — that's by design. Error reporting should never
 * throw.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  reportError,
  getErrorLog,
  getErrorSummary,
  clearErrorLog,
} from "@/lib/error-reporter";

describe("error-reporter", () => {
  beforeEach(() => {
    clearErrorLog();
    vi.useRealTimers();
  });

  describe("reportError", () => {
    it("captures Error objects with message and stack", () => {
      const err = new Error("Something broke");
      reportError(err);
      const log = getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].message).toBe("Something broke");
      expect(log[0].stack).toBeDefined();
      expect(log[0].stack).toContain("Error");
    });

    it("captures non-Error values via String() coercion", () => {
      reportError("string error");
      reportError(42);
      reportError({ foo: "bar" });
      const log = getErrorLog();
      expect(log).toHaveLength(3);
      expect(log[0].message).toBe("string error");
      expect(log[1].message).toBe("42");
      expect(log[2].message).toBe("[object Object]");
    });

    it("stack is undefined for non-Error values", () => {
      reportError("plain string");
      const log = getErrorLog();
      expect(log[0].stack).toBeUndefined();
    });

    it("records an ISO timestamp", () => {
      const before = Date.now();
      reportError(new Error("x"));
      const after = Date.now();
      const log = getErrorLog();
      const ts = new Date(log[0].timestamp).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("records context string when provided", () => {
      reportError(new Error("oops"), "agent-execution");
      const log = getErrorLog();
      expect(log[0].context).toBe("agent-execution");
    });

    it("defaults severity to 'medium' when not specified", () => {
      reportError(new Error("x"));
      expect(getErrorLog()[0].severity).toBe("medium");
    });

    it("accepts severity override via meta", () => {
      reportError(new Error("x"), "ctx", { severity: "critical" });
      expect(getErrorLog()[0].severity).toBe("critical");
    });

    it("captures userId and agentId via meta", () => {
      reportError(new Error("x"), "ctx", { userId: "user_123", agentId: "agent_abc" });
      const entry = getErrorLog()[0];
      expect(entry.userId).toBe("user_123");
      expect(entry.agentId).toBe("agent_abc");
    });

    it("sets pageUrl to 'server' when window is undefined", () => {
      // In the Node test env, window is undefined
      reportError(new Error("x"));
      expect(getErrorLog()[0].pageUrl).toBe("server");
    });
  });

  describe("buffer cap (MAX_ERRORS = 100)", () => {
    it("preserves entries when log size is at the cap", () => {
      for (let i = 0; i < 100; i++) {
        reportError(new Error(`err-${i}`));
      }
      const log = getErrorLog();
      expect(log).toHaveLength(100);
      expect(log[0].message).toBe("err-0");
      expect(log[99].message).toBe("err-99");
    });

    it("evicts oldest when more than 100 entries are pushed", () => {
      for (let i = 0; i < 150; i++) {
        reportError(new Error(`err-${i}`));
      }
      const log = getErrorLog();
      expect(log).toHaveLength(100);
      // First 50 should have been evicted
      expect(log[0].message).toBe("err-50");
      expect(log[99].message).toBe("err-149");
    });

    it("always keeps the MOST RECENT entries (FIFO eviction)", () => {
      for (let i = 0; i < 105; i++) {
        reportError(new Error(`err-${i}`));
      }
      const log = getErrorLog();
      // First 5 evicted; oldest kept is err-5
      expect(log[0].message).toBe("err-5");
      // Newest is err-104
      expect(log[log.length - 1].message).toBe("err-104");
    });
  });

  describe("getErrorLog", () => {
    it("returns empty array when no errors reported", () => {
      expect(getErrorLog()).toEqual([]);
    });

    it("returns a COPY, not the internal array (caller cannot mutate internal state)", () => {
      reportError(new Error("x"));
      const log = getErrorLog();
      log.push({
        timestamp: "fake",
        message: "injected",
        stack: undefined,
        pageUrl: "fake",
      });
      // Internal state unaffected
      expect(getErrorLog()).toHaveLength(1);
      expect(getErrorLog()[0].message).toBe("x");
    });

    it("preserves insertion order (oldest first, newest last)", () => {
      reportError(new Error("first"));
      reportError(new Error("second"));
      reportError(new Error("third"));
      const log = getErrorLog();
      expect(log.map(e => e.message)).toEqual(["first", "second", "third"]);
    });
  });

  describe("getErrorSummary", () => {
    it("returns all-zero summary for empty log", () => {
      expect(getErrorSummary()).toEqual({
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      });
    });

    it("counts entries by severity", () => {
      reportError(new Error("a"), "x", { severity: "critical" });
      reportError(new Error("b"), "x", { severity: "critical" });
      reportError(new Error("c"), "x", { severity: "high" });
      reportError(new Error("d"), "x", { severity: "medium" });
      reportError(new Error("e"), "x", { severity: "low" });
      reportError(new Error("f"), "x", { severity: "low" });
      reportError(new Error("g"), "x", { severity: "low" });

      const summary = getErrorSummary();
      expect(summary).toEqual({
        total: 7,
        critical: 2,
        high: 1,
        medium: 1,
        low: 3,
      });
    });

    it("totals match getErrorLog().length", () => {
      reportError(new Error("a"));
      reportError(new Error("b"), undefined, { severity: "critical" });
      reportError(new Error("c"), undefined, { severity: "high" });

      const summary = getErrorSummary();
      expect(summary.total).toBe(getErrorLog().length);
    });
  });

  describe("clearErrorLog", () => {
    it("empties the log", () => {
      reportError(new Error("a"));
      reportError(new Error("b"));
      expect(getErrorLog()).toHaveLength(2);
      clearErrorLog();
      expect(getErrorLog()).toEqual([]);
    });

    it("is a no-op on an already-empty log", () => {
      clearErrorLog();
      clearErrorLog();
      expect(getErrorLog()).toEqual([]);
    });

    it("resets severity summary to all zeros", () => {
      reportError(new Error("a"), "x", { severity: "critical" });
      reportError(new Error("b"), "x", { severity: "high" });
      clearErrorLog();
      expect(getErrorSummary()).toEqual({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
    });
  });

  describe("never throws (error reporting is best-effort)", () => {
    it("handles undefined input", () => {
      expect(() => reportError(undefined)).not.toThrow();
      expect(getErrorLog()[0].message).toBe("undefined");
    });

    it("handles null input", () => {
      expect(() => reportError(null)).not.toThrow();
      expect(getErrorLog()[0].message).toBe("null");
    });

    it("handles circular object references", () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;
      expect(() => reportError(circular)).not.toThrow();
    });
  });
});
