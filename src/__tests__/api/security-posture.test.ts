/**
 * Tests for /api/security/posture — public security envelope.
 *
 * This endpoint is read by procurement / vendor-security questionnaires
 * (theirs and ours). The shape contract MUST be stable: a regression
 * that drops a documented key silently breaks those automations.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetEd25519 = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/lib/agent-runs", () => ({
  getEd25519PublicKeyPem: () => mockGetEd25519(),
}));

// Drizzle chain stub: select().from().orderBy().limit() returns []
// unless mockOrderBy is configured for the test.
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(mockOrderBy()),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  auditLogAnchors: {
    chainHead: "chain-head-col",
    rowCount: "row-count-col",
    attestedAt: "attested-at-col",
    proofs: "proofs-col",
  },
}));

vi.mock("drizzle-orm", () => ({
  desc: (col: unknown) => col,
  eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/security/posture/route");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEd25519.mockReturnValue(null);
  mockOrderBy.mockReturnValue([]);
  // Clean slate — each test sets only what it needs.
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  delete process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY;
  delete process.env.AGENT_RUN_SIGNING_SECRET;
  delete process.env.CRON_SECRET;
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_REQUIRED;
});

describe("GET /api/security/posture", () => {
  it("returns the documented top-level shape", async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    for (const key of [
      "generatedAt",
      "issuer",
      "receipts",
      "chainOfCustody",
      "transportSecurity",
      "authentication",
      "compliance",
      "sbom",
      "openSourcePrimitives",
    ]) {
      expect(body).toHaveProperty(key);
    }
  });

  it("enumerates all three receipt schemes regardless of which keys are configured", async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    const body = (await res.json()) as {
      receipts: { schemes: Record<string, { enabled: boolean }> };
    };
    expect(Object.keys(body.receipts.schemes).sort()).toEqual([
      "v1_hmac_sha256",
      "v2_ed25519",
      "v3_ed25519_mldsa65",
    ]);
    // No keys set in the beforeEach reset → all schemes report disabled.
    expect(body.receipts.schemes.v1_hmac_sha256.enabled).toBe(false);
    expect(body.receipts.schemes.v2_ed25519.enabled).toBe(false);
    expect(body.receipts.schemes.v3_ed25519_mldsa65.enabled).toBe(false);
  });

  it("reports v2 enabled when Ed25519 key is configured and surfaces the pubkey URL", async () => {
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = "fake-pem";
    mockGetEd25519.mockReturnValue(
      "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAabc\n-----END PUBLIC KEY-----",
    );
    const { GET } = await loadRoute();
    const res = await GET();
    const body = (await res.json()) as {
      receipts: {
        schemes: {
          v2_ed25519: {
            enabled: boolean;
            publicKeyUrl: string | null;
            publicKeyPemPreview: string | null;
          };
        };
      };
    };
    expect(body.receipts.schemes.v2_ed25519.enabled).toBe(true);
    expect(body.receipts.schemes.v2_ed25519.publicKeyUrl).toBe(
      "/.well-known/sovereign-receipts/ed25519.pem",
    );
    expect(body.receipts.schemes.v2_ed25519.publicKeyPemPreview).toContain(
      "BEGIN PUBLIC KEY",
    );
  });

  it("reports v3 enabled only when BOTH Ed25519 and ML-DSA-65 are configured", async () => {
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = "fake-pem";
    mockGetEd25519.mockReturnValue(
      "-----BEGIN PUBLIC KEY-----\nx\n-----END PUBLIC KEY-----",
    );
    const { GET: getNoPq } = await loadRoute();
    const body1 = (await (await getNoPq()).json()) as {
      receipts: { schemes: { v3_ed25519_mldsa65: { enabled: boolean } } };
    };
    expect(body1.receipts.schemes.v3_ed25519_mldsa65.enabled).toBe(false);

    process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY = "fake-mldsa";
    const { GET: getWithPq } = await loadRoute();
    const body2 = (await (await getWithPq()).json()) as {
      receipts: { schemes: { v3_ed25519_mldsa65: { enabled: boolean } } };
    };
    expect(body2.receipts.schemes.v3_ed25519_mldsa65.enabled).toBe(true);
  });

  it("returns null anchor fields when the audit-log anchor table is empty", async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    const body = (await res.json()) as {
      chainOfCustody: { auditChainHead: null; lastAnchoredAt: null };
    };
    expect(body.chainOfCustody.auditChainHead).toBeNull();
    expect(body.chainOfCustody.lastAnchoredAt).toBeNull();
  });

  it("surfaces the latest anchor row when present + flags stale anchors", async () => {
    const eightHoursAgo = new Date(Date.now() - 8 * 3600 * 1000);
    mockOrderBy.mockReturnValue([
      {
        chainHead: "abc123",
        rowCount: 42,
        attestedAt: eightHoursAgo,
        proofs: JSON.stringify([{ calendar: "alice" }, { calendar: "bob" }]),
      },
    ]);
    const { GET } = await loadRoute();
    const res = await GET();
    const body = (await res.json()) as {
      chainOfCustody: {
        auditChainHead: string;
        auditChainRowCount: number;
        bitcoinCalendarProofs: number;
        stale: boolean;
      };
    };
    expect(body.chainOfCustody.auditChainHead).toBe("abc123");
    expect(body.chainOfCustody.auditChainRowCount).toBe(42);
    expect(body.chainOfCustody.bitcoinCalendarProofs).toBe(2);
    // 8h > 6h staleness threshold — should flag.
    expect(body.chainOfCustody.stale).toBe(true);
  });

  it("sets Access-Control-Allow-Origin: * for cross-origin questionnaire automation", async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("sets a cache header so a vendor-questionnaire bulk-fetch doesn't hammer the DB", async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.headers.get("cache-control")).toMatch(/max-age=300/);
  });

  it("WebAuthn block reflects environment configuration", async () => {
    const { GET: getOff } = await loadRoute();
    const off = (await (await getOff()).json()) as {
      authentication: {
        webauthnStepUp: { enabled: boolean; required: boolean };
      };
    };
    expect(off.authentication.webauthnStepUp.enabled).toBe(false);
    expect(off.authentication.webauthnStepUp.required).toBe(false);

    process.env.WEBAUTHN_RP_ID = "sovereignmatrix.agency";
    process.env.WEBAUTHN_REQUIRED = "true";
    const { GET: getOn } = await loadRoute();
    const on = (await (await getOn()).json()) as {
      authentication: {
        webauthnStepUp: { enabled: boolean; required: boolean };
      };
    };
    expect(on.authentication.webauthnStepUp.enabled).toBe(true);
    expect(on.authentication.webauthnStepUp.required).toBe(true);
  });

  it("fails soft when the anchor table doesn't exist (rest of envelope still renders)", async () => {
    mockOrderBy.mockImplementation(() => {
      throw new Error('relation "audit_log_anchors" does not exist');
    });
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      chainOfCustody: { auditChainHead: null };
      receipts: unknown;
    };
    expect(body.chainOfCustody.auditChainHead).toBeNull();
    expect(body.receipts).toBeDefined();
  });
});
