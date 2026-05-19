/**
 * Tests for /api/transparency/threshold-status — public TRS registry.
 *
 * The endpoint's shape is contracted by federation members + vendor
 * questionnaire automation. A regression that drops a documented key
 * silently breaks those consumers.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { GET } from "@/app/api/transparency/threshold-status/route";

const originalEnv = { ...process.env };

beforeEach(() => {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("THRESHOLD_") || k.startsWith("TRS_ED25519_")) {
      delete process.env[k];
    }
  }
});

afterAll(() => {
  Object.assign(process.env, originalEnv);
});

describe("/api/transparency/threshold-status", () => {
  it("returns enabled=false when no THRESHOLD_ISSUERS is set", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.scheme).toBe("trs1");
    expect(body.quorum.m).toBe(0);
    expect(body.quorum.n).toBe(0);
    expect(body.authorizedIssuers).toEqual([]);
  });

  it("returns the configured quorum + issuer set when enabled", async () => {
    process.env.THRESHOLD_ISSUERS =
      "sovereign-prod,witness-cra,witness-eu,witness-us";
    process.env.THRESHOLD_M = "3";
    const res = await GET();
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.quorum.m).toBe(3);
    expect(body.quorum.n).toBe(4);
    expect(body.authorizedIssuers).toEqual([
      "sovereign-prod",
      "witness-cra",
      "witness-eu",
      "witness-us",
    ]);
  });

  it("does NOT leak which issuers this server holds local keys for", async () => {
    process.env.THRESHOLD_ISSUERS = "a,b,c,d";
    process.env.THRESHOLD_M = "2";
    process.env.TRS_ED25519_SK_A = "fake-pem-a";
    process.env.TRS_ED25519_SK_C = "fake-pem-c";
    const res = await GET();
    const body = await res.json();
    // Body must NOT contain any key whose name hints at local possession.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/local|holds|sk_|secret/i);
    // localCosignerCount is exposed via /api/security/posture (admin
    // observability) but NOT via the public transparency endpoint.
    expect(body.localCosignerCount).toBeUndefined();
  });

  it("sets open CORS + nosniff headers for federation consumption", async () => {
    const res = await GET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toContain("max-age=300");
  });

  it("documents the compromise model in human-readable notes", async () => {
    process.env.THRESHOLD_ISSUERS = "a,b,c,d,e";
    process.env.THRESHOLD_M = "3";
    const res = await GET();
    const body = await res.json();
    expect(body.notes.compromiseModel).toContain("3");
    expect(body.notes.compromiseModel).toContain("5");
  });
});
