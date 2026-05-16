/**
 * Tests for src/lib/webauthn.ts — covers the configuration helpers and
 * the `assertHasRecentMfa` invariant that gates admin step-up.
 *
 * The full registration / authentication ceremonies require a live
 * authenticator and a `navigator.credentials.{create,get}` shim — those
 * are exercised at integration time (Playwright + virtual authenticator)
 * rather than in unit tests. The fail-open / fail-closed behaviour, the
 * env-config invariants, and the "no credentials = no recent MFA" path
 * are the security-critical surfaces and they're covered here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalRpId = process.env.WEBAUTHN_RP_ID;
const originalOrigin = process.env.WEBAUTHN_ORIGIN;
const originalRequired = process.env.WEBAUTHN_REQUIRED;

beforeEach(() => {
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_ORIGIN;
  delete process.env.WEBAUTHN_REQUIRED;
  vi.resetModules();
});

afterEach(() => {
  if (originalRpId !== undefined) process.env.WEBAUTHN_RP_ID = originalRpId;
  else delete process.env.WEBAUTHN_RP_ID;
  if (originalOrigin !== undefined)
    process.env.WEBAUTHN_ORIGIN = originalOrigin;
  else delete process.env.WEBAUTHN_ORIGIN;
  if (originalRequired !== undefined)
    process.env.WEBAUTHN_REQUIRED = originalRequired;
  else delete process.env.WEBAUTHN_REQUIRED;
});

// ── Mock the database — assertHasRecentMfa queries webauthn_credentials.

// Drizzle's chain ultimately resolves to a Promise. Tests need to match
// that — the `assertHasRecentMfa` code does `.limit(1).catch(...)`.
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]), // default: no credentials registered
        }),
      }),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  webauthnCredentials: { userId: "userId-col", lastUsedAt: "lastUsedAt-col" },
  webauthnChallenges: {},
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _and: args }),
  eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
  gt: (a: unknown, b: unknown) => ({ _gt: [a, b] }),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe("isWebauthnConfigured", () => {
  it("returns false when WEBAUTHN_RP_ID is unset", async () => {
    process.env.WEBAUTHN_ORIGIN = "https://example.com";
    const { isWebauthnConfigured } = await import("@/lib/webauthn");
    expect(isWebauthnConfigured()).toBe(false);
  });

  it("returns false when WEBAUTHN_ORIGIN is unset", async () => {
    process.env.WEBAUTHN_RP_ID = "example.com";
    const { isWebauthnConfigured } = await import("@/lib/webauthn");
    expect(isWebauthnConfigured()).toBe(false);
  });

  it("returns true when both are set", async () => {
    process.env.WEBAUTHN_RP_ID = "example.com";
    process.env.WEBAUTHN_ORIGIN = "https://example.com";
    const { isWebauthnConfigured } = await import("@/lib/webauthn");
    expect(isWebauthnConfigured()).toBe(true);
  });
});

describe("isWebauthnRequired", () => {
  it("returns false when WEBAUTHN_REQUIRED is unset", async () => {
    const { isWebauthnRequired } = await import("@/lib/webauthn");
    expect(isWebauthnRequired()).toBe(false);
  });

  it("returns false when WEBAUTHN_REQUIRED is anything except 'true'", async () => {
    process.env.WEBAUTHN_REQUIRED = "1";
    const { isWebauthnRequired } = await import("@/lib/webauthn");
    expect(isWebauthnRequired()).toBe(false);
  });

  it("returns true only on exact string 'true'", async () => {
    process.env.WEBAUTHN_REQUIRED = "true";
    const { isWebauthnRequired } = await import("@/lib/webauthn");
    expect(isWebauthnRequired()).toBe(true);
  });
});

describe("assertHasRecentMfa", () => {
  it("falls OPEN when WebAuthn is unconfigured AND not required (dev)", async () => {
    // No env set at all — dev environment.
    const { assertHasRecentMfa } = await import("@/lib/webauthn");
    expect(await assertHasRecentMfa("u1")).toBe(true);
  });

  it("falls CLOSED when WebAuthn is unconfigured BUT required (prod misconfig)", async () => {
    process.env.WEBAUTHN_REQUIRED = "true";
    const { assertHasRecentMfa } = await import("@/lib/webauthn");
    expect(await assertHasRecentMfa("u1")).toBe(false);
  });

  it("falls CLOSED when configured but the user has no recent credential use", async () => {
    process.env.WEBAUTHN_RP_ID = "example.com";
    process.env.WEBAUTHN_ORIGIN = "https://example.com";
    process.env.WEBAUTHN_REQUIRED = "true";
    const { assertHasRecentMfa } = await import("@/lib/webauthn");
    // db mock returns [] from the limit chain — user has no credentials.
    expect(await assertHasRecentMfa("u-no-creds")).toBe(false);
  });

  it("returns true when the db returns at least one row inside the recent window", async () => {
    process.env.WEBAUTHN_RP_ID = "example.com";
    process.env.WEBAUTHN_ORIGIN = "https://example.com";
    process.env.WEBAUTHN_REQUIRED = "true";

    // Re-mock db just for this test to return a recent-use row.
    vi.doMock("@/db", () => ({
      db: {
        select: vi.fn(() => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: "cred_1" }]),
            }),
          }),
        })),
      },
    }));
    vi.resetModules();
    const { assertHasRecentMfa } = await import("@/lib/webauthn");
    expect(await assertHasRecentMfa("u-has-recent")).toBe(true);
  });
});
