/**
 * Tests for marketplace-invoke — graceful no-DB + input validation.
 *
 * The full ai()-backed path needs integration tests against a real
 * agent row + NIM key, which is staging-only. Here we test:
 *   - missing DATABASE_URL → structured { ok:false, code:"no_db" }
 *   - empty input          → { ok:false, code:"bad_input" }
 *   - non-existent agent   → { ok:false, code:"not_found" } after DB up
 *     (only covered in integration; unit tests stop at no_db)
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { invokeMarketplaceAgent } from "../marketplace-invoke";

describe("invokeMarketplaceAgent() — graceful guards", () => {
  const ORIG = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIG;
  });

  it("rejects empty input BEFORE touching the DB", async () => {
    const r = await invokeMarketplaceAgent({
      agentIdOrSlug: "whatever",
      input: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("bad_input");
  });

  it("rejects whitespace-only input", async () => {
    const r = await invokeMarketplaceAgent({
      agentIdOrSlug: "any",
      input: "   \n\t  ",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("bad_input");
  });

  it("returns no_db when DATABASE_URL is unset (preserves message)", async () => {
    const r = await invokeMarketplaceAgent({
      agentIdOrSlug: "invoice-ocr",
      input: "extract this",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("no_db");
      expect(r.message).toMatch(/offline/);
    }
  });

  it("never throws, even on pathological inputs", async () => {
    await expect(
      invokeMarketplaceAgent({ agentIdOrSlug: "", input: "" }),
    ).resolves.toEqual(expect.objectContaining({ ok: false }));
    await expect(
      invokeMarketplaceAgent({
        agentIdOrSlug: "x".repeat(1000),
        input: "x".repeat(20_000),
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: false }));
  });
});
