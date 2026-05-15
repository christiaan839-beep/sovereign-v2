/**
 * Tests for src/lib/privilege-alerts.ts — Cook 107.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  _resetForTests,
  maybeAlert,
  PRIVILEGE_CONSTANTS,
} from "../privilege-alerts";

beforeEach(() => {
  _resetForTests();
});

describe("maybeAlert — first occurrence", () => {
  it("pages on first admin.grant per tenant+actor", async () => {
    const pager = vi.fn().mockResolvedValue(undefined);
    const out = await maybeAlert(
      {
        tenantId: "t1",
        actorId: "u1",
        event: "admin.grant",
        occurredAt: 1000,
      },
      pager,
    );
    expect(out.paged).toBe(true);
    expect(pager).toHaveBeenCalledTimes(1);
    const [msg, sev] = pager.mock.calls[0];
    expect(sev).toBe("crit");
    expect(msg).toContain("admin.grant");
    expect(msg).toContain("t1");
  });

  it("does NOT page within the quiet window", async () => {
    const pager = vi.fn().mockResolvedValue(undefined);
    await maybeAlert(
      {
        tenantId: "t1",
        actorId: "u1",
        event: "admin.grant",
        occurredAt: 1000,
      },
      pager,
    );
    const out = await maybeAlert(
      {
        tenantId: "t1",
        actorId: "u1",
        event: "admin.grant",
        occurredAt: 2000,
      },
      pager,
    );
    expect(out.paged).toBe(false);
    expect(out.reason).toBe("in-quiet-window");
    expect(pager).toHaveBeenCalledTimes(1);
  });

  it("pages again AFTER the quiet window", async () => {
    const pager = vi.fn().mockResolvedValue(undefined);
    await maybeAlert(
      {
        tenantId: "t1",
        actorId: "u1",
        event: "admin.grant",
        occurredAt: 1000,
      },
      pager,
    );
    const out = await maybeAlert(
      {
        tenantId: "t1",
        actorId: "u1",
        event: "admin.grant",
        occurredAt: 1000 + PRIVILEGE_CONSTANTS.QUIET_WINDOW_MS + 1,
      },
      pager,
    );
    expect(out.paged).toBe(true);
    expect(pager).toHaveBeenCalledTimes(2);
  });
});

describe("maybeAlert — independent scoping", () => {
  it("pages per-tenant — different tenants don't suppress each other", async () => {
    const pager = vi.fn().mockResolvedValue(undefined);
    await maybeAlert(
      {
        tenantId: "t1",
        actorId: "u1",
        event: "admin.grant",
        occurredAt: 1000,
      },
      pager,
    );
    const out = await maybeAlert(
      {
        tenantId: "t2",
        actorId: "u1",
        event: "admin.grant",
        occurredAt: 1500,
      },
      pager,
    );
    expect(out.paged).toBe(true);
    expect(pager).toHaveBeenCalledTimes(2);
  });

  it("pages per-actor — different actors in same tenant don't suppress", async () => {
    const pager = vi.fn().mockResolvedValue(undefined);
    await maybeAlert(
      {
        tenantId: "t1",
        actorId: "u1",
        event: "admin.grant",
        occurredAt: 1000,
      },
      pager,
    );
    const out = await maybeAlert(
      {
        tenantId: "t1",
        actorId: "u2",
        event: "admin.grant",
        occurredAt: 1500,
      },
      pager,
    );
    expect(out.paged).toBe(true);
  });
});

describe("maybeAlert — severity mapping", () => {
  it("admin.grant is crit", async () => {
    const pager = vi.fn().mockResolvedValue(undefined);
    await maybeAlert(
      { tenantId: "t", actorId: "u", event: "admin.grant", occurredAt: 0 },
      pager,
    );
    expect(pager.mock.calls[0][1]).toBe("crit");
  });

  it("admin.revoke is warn", async () => {
    const pager = vi.fn().mockResolvedValue(undefined);
    await maybeAlert(
      { tenantId: "t", actorId: "u", event: "admin.revoke", occurredAt: 0 },
      pager,
    );
    expect(pager.mock.calls[0][1]).toBe("warn");
  });

  it("marketplace.connect is info", async () => {
    const pager = vi.fn().mockResolvedValue(undefined);
    await maybeAlert(
      {
        tenantId: "t",
        actorId: "u",
        event: "marketplace.connect",
        occurredAt: 0,
      },
      pager,
    );
    expect(pager.mock.calls[0][1]).toBe("info");
  });
});

describe("maybeAlert — pager failure", () => {
  it("returns paged=false when pager throws", async () => {
    const pager = vi.fn().mockRejectedValue(new Error("pager down"));
    const out = await maybeAlert(
      {
        tenantId: "t1",
        actorId: "u1",
        event: "admin.grant",
        occurredAt: 1000,
      },
      pager,
    );
    expect(out.paged).toBe(false);
    expect(out.message).toContain("admin.grant");
  });
});

describe("maybeAlert — missing tenant", () => {
  it("returns duplicate-event when tenantId is empty", async () => {
    const pager = vi.fn();
    const out = await maybeAlert(
      { tenantId: "", actorId: "u1", event: "admin.grant", occurredAt: 1000 },
      pager,
    );
    expect(out.paged).toBe(false);
    expect(pager).not.toHaveBeenCalled();
  });
});
