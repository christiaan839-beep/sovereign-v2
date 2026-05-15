/**
 * Tests for src/lib/heartbeat.ts — Cook 100.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  evaluateAll,
  evaluateJob,
  getHeartbeat,
  HEARTBEAT_THRESHOLDS,
  listHeartbeats,
  recordHeartbeat,
} from "../heartbeat";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-05-15T10:00:00Z");

beforeEach(() => {
  _resetForTests();
});

describe("recordHeartbeat", () => {
  it("rejects missing job name", () => {
    expect(() =>
      recordHeartbeat({ job: "", lastSuccessMs: NOW, cadenceMs: HOUR }),
    ).toThrow();
  });

  it("rejects non-positive cadence", () => {
    expect(() =>
      recordHeartbeat({ job: "x", lastSuccessMs: NOW, cadenceMs: 0 }),
    ).toThrow();
  });

  it("stores + retrieves a heartbeat", () => {
    recordHeartbeat({
      job: "/api/_cron/audit-bundles",
      lastSuccessMs: NOW,
      cadenceMs: HOUR,
    });
    expect(getHeartbeat("/api/_cron/audit-bundles")?.lastSuccessMs).toBe(NOW);
  });
});

describe("listHeartbeats", () => {
  it("returns every recorded heartbeat", () => {
    recordHeartbeat({ job: "a", lastSuccessMs: NOW, cadenceMs: HOUR });
    recordHeartbeat({ job: "b", lastSuccessMs: NOW, cadenceMs: HOUR });
    expect(listHeartbeats().length).toBe(2);
  });
});

describe("evaluateJob — verdicts", () => {
  it("returns unknown for jobs with no heartbeat", () => {
    expect(evaluateJob("/api/_cron/never-ran", NOW).status).toBe("unknown");
  });

  it("returns ok when within one cadence window", () => {
    recordHeartbeat({
      job: "/api/_cron/audit-bundles",
      lastSuccessMs: NOW,
      cadenceMs: HOUR,
    });
    expect(
      evaluateJob("/api/_cron/audit-bundles", NOW + 30 * 60_000).status,
    ).toBe("ok");
  });

  it("returns stale when 1 window missed", () => {
    recordHeartbeat({
      job: "/api/_cron/audit-bundles",
      lastSuccessMs: NOW,
      cadenceMs: HOUR,
    });
    const verdict = evaluateJob("/api/_cron/audit-bundles", NOW + 2 * HOUR + 1);
    expect(verdict.status).toBe("stale");
    expect(verdict.missedWindows).toBeGreaterThanOrEqual(
      HEARTBEAT_THRESHOLDS.STALE_THRESHOLD,
    );
    expect(verdict.missedWindows).toBeLessThan(
      HEARTBEAT_THRESHOLDS.CRITICAL_THRESHOLD,
    );
  });

  it("returns critical when ≥ 2 windows missed", () => {
    recordHeartbeat({
      job: "/api/_cron/audit-bundles",
      lastSuccessMs: NOW,
      cadenceMs: HOUR,
    });
    const verdict = evaluateJob("/api/_cron/audit-bundles", NOW + 4 * HOUR);
    expect(verdict.status).toBe("critical");
    expect(verdict.missedWindows).toBeGreaterThanOrEqual(
      HEARTBEAT_THRESHOLDS.CRITICAL_THRESHOLD,
    );
  });
});

describe("evaluateAll", () => {
  it("returns a verdict per recorded job", () => {
    recordHeartbeat({ job: "ok", lastSuccessMs: NOW, cadenceMs: HOUR });
    recordHeartbeat({
      job: "critical",
      lastSuccessMs: NOW - 4 * HOUR,
      cadenceMs: HOUR,
    });
    const verdicts = evaluateAll(NOW);
    expect(verdicts.length).toBe(2);
    expect(verdicts.find((v) => v.job === "ok")?.status).toBe("ok");
    expect(verdicts.find((v) => v.job === "critical")?.status).toBe("critical");
  });
});
