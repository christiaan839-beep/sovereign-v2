/**
 * Tests for src/lib/idempotency-middleware.ts — Cook 103.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  check,
  recordResponse,
} from "../idempotency-middleware";

beforeEach(() => {
  _resetForTests();
});

describe("check", () => {
  it("returns 'new' when key is missing", () => {
    const o = check("/api/x", null, "body");
    expect(o.kind).toBe("new");
  });

  it("returns 'new' on first call with a key", () => {
    const o = check("/api/x", "key-1", "body");
    expect(o.kind).toBe("new");
    if (o.kind === "new") expect(o.fingerprint.length).toBeGreaterThan(0);
  });

  it("returns 'replay' on repeat call with same body", () => {
    const first = check("/api/x", "key-1", "body");
    if (first.kind === "new") {
      recordResponse(first.fingerprint, "body", {
        status: 200,
        body: '{"ok":true}',
        contentType: "application/json",
      });
    }
    const second = check("/api/x", "key-1", "body");
    expect(second.kind).toBe("replay");
  });

  it("returns 'conflict' when key reused with different body", () => {
    const first = check("/api/x", "key-1", "body-a");
    if (first.kind === "new") {
      recordResponse(first.fingerprint, "body-a", {
        status: 200,
        body: "x",
        contentType: "text/plain",
      });
    }
    const second = check("/api/x", "key-1", "body-b");
    expect(second.kind).toBe("conflict");
  });

  it("scopes fingerprints per-route — same key on different routes is independent", () => {
    const a = check("/api/a", "key-1", "body");
    if (a.kind === "new") {
      recordResponse(a.fingerprint, "body", {
        status: 200,
        body: "",
        contentType: "application/json",
      });
    }
    const b = check("/api/b", "key-1", "body");
    expect(b.kind).toBe("new");
  });

  it("treats expired records as new", () => {
    const first = check("/api/x", "key-1", "body", 1000);
    if (first.kind === "new") {
      recordResponse(
        first.fingerprint,
        "body",
        {
          status: 200,
          body: "x",
          contentType: "application/json",
        },
        1000,
      );
    }
    // Day later: re-check at now > createdAt + 24h
    const later = check(
      "/api/x",
      "key-1",
      "body",
      1000 + 24 * 60 * 60 * 1000 + 1,
    );
    expect(later.kind).toBe("new");
  });
});

describe("recordResponse", () => {
  it("ignores empty fingerprint (opt-out)", () => {
    recordResponse("", "body", {
      status: 200,
      body: "x",
      contentType: "text/plain",
    });
    const o = check("/api/x", null, "body");
    expect(o.kind).toBe("new");
  });
});
