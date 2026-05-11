/**
 * Tests for /api/verify/badge.svg — shields.io-style verify badge.
 *
 * Covers:
 *   - returns 200 + image/svg+xml + open CORS for any input
 *   - missing/malformed id → neutral "loading" badge (60s cache)
 *   - valid id + valid signature → "verified" badge w/ agent name
 *   - valid id + tampered signature → "tampered" badge
 *   - private receipts → "private" (no cross-origin leak of metadata)
 *   - 404 receipt → "not found" badge
 *   - XML metacharacters in agent name are escaped (no XSS via SVG title)
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

beforeAll(() => {
  process.env.AGENT_RUN_SIGNING_SECRET = "test_secret_with_enough_entropy_aaaa";
});

const mockGetRun = vi.fn();

vi.mock("@/lib/agent-runs", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/agent-runs")>(
      "@/lib/agent-runs",
    );
  return {
    ...actual,
    getRun: (...args: unknown[]) => mockGetRun(...args),
  };
});

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/verify/badge.svg/route");
}

function makeReq(query = ""): Request {
  return new Request(`http://localhost/api/verify/badge.svg${query}`);
}

const VALID_ID = "00000000-0000-0000-0000-000000000001";

describe("GET /api/verify/badge.svg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 + image/svg+xml + open CORS for any input", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/image\/svg\+xml/);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("malformed id → neutral 'loading' badge with short TTL", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeReq("?id=not-a-uuid"));
    const body = await res.text();
    expect(body).toContain("loading");
    expect(res.headers.get("cache-control")).toMatch(/max-age=60/);
  });

  it("missing id → neutral 'loading' badge", async () => {
    const { GET } = await loadRoute();
    const body = await (await GET(makeReq())).text();
    expect(body).toContain("loading");
  });

  it("unknown receipt → 'not found' badge", async () => {
    mockGetRun.mockResolvedValue(null);
    const { GET } = await loadRoute();
    const body = await (await GET(makeReq(`?id=${VALID_ID}`))).text();
    expect(body).toContain("not found");
  });

  it("private receipt collapses to 'not found' (no cross-origin enumeration)", async () => {
    // Security: a cross-origin enumerator hitting /api/verify/badge.svg with
    // arbitrary ids must NOT be able to distinguish "this id exists but is
    // private" from "this id doesn't exist." Both render as "not found."
    mockGetRun.mockResolvedValue({
      id: VALID_ID,
      userId: "u_owner",
      tenantId: null,
      agentName: "secret-internal-agent",
      modelUsed: "claude",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 0,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "private",
      signature: "v1=abc",
      createdAt: new Date(),
    });
    const { GET } = await loadRoute();
    const body = await (await GET(makeReq(`?id=${VALID_ID}`))).text();
    expect(body).toContain("not found");
    expect(body).not.toContain("secret-internal-agent");
    expect(body).not.toContain("private"); // no enumeration signal
  });

  it("valid signature → 'verified' with agent name", async () => {
    const { signRun, canonicalizeRun } = await import("@/lib/agent-runs");
    const created = new Date("2026-05-10T00:00:00Z");
    const canonical = canonicalizeRun({
      id: VALID_ID,
      agentName: "blog-gen",
      modelUsed: "claude-sonnet-4-6",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 0,
      createdAt: created,
    });
    const signature = signRun(canonical);
    mockGetRun.mockResolvedValue({
      id: VALID_ID,
      userId: "u_owner",
      tenantId: null,
      agentName: "blog-gen",
      modelUsed: "claude-sonnet-4-6",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 0,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "public",
      signature,
      createdAt: created,
    });
    const { GET } = await loadRoute();
    const body = await (await GET(makeReq(`?id=${VALID_ID}`))).text();
    expect(body).toContain("blog-gen");
    expect(body).toContain("✓"); // ✓ icon — proves "verified" state was rendered
  });

  it("invalid signature → 'tampered' badge", async () => {
    const created = new Date("2026-05-10T00:00:00Z");
    mockGetRun.mockResolvedValue({
      id: VALID_ID,
      userId: "u_owner",
      tenantId: null,
      agentName: "blog-gen",
      modelUsed: "claude-sonnet-4-6",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 0,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "public",
      signature: "v1=garbage", // mismatch
      createdAt: created,
    });
    const { GET } = await loadRoute();
    const body = await (await GET(makeReq(`?id=${VALID_ID}`))).text();
    expect(body).toContain("tampered");
  });

  it("escapes XML metacharacters in agent names", async () => {
    const { signRun, canonicalizeRun } = await import("@/lib/agent-runs");
    const created = new Date("2026-05-10T00:00:00Z");
    const evilName = "<script>alert(1)</script>";
    const canonical = canonicalizeRun({
      id: VALID_ID,
      agentName: evilName,
      modelUsed: "x",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 0,
      createdAt: created,
    });
    const signature = signRun(canonical);
    mockGetRun.mockResolvedValue({
      id: VALID_ID,
      userId: null,
      tenantId: null,
      agentName: evilName,
      modelUsed: "x",
      input: {},
      output: {},
      safetyResult: {},
      durationMs: 0,
      chainDepth: 0,
      trustDecision: "auto-approved",
      visibility: "public",
      signature,
      createdAt: created,
    });
    const { GET } = await loadRoute();
    const body = await (await GET(makeReq(`?id=${VALID_ID}`))).text();
    expect(body).not.toContain(evilName);
    expect(body).toContain("&lt;script&gt;");
  });
});
