/**
 * Tests for /api/me/audit-root and /api/me/audit-bundle —
 * the tenant Merkle-root + signed evidence-pack endpoints.
 *
 * Covers:
 *   - 401 unauthenticated on both endpoints
 *   - audit-root returns envelope + canonical + signature
 *   - audit-root envelope.count matches receipt count
 *   - audit-root returns EMPTY_ROOT envelope for a user with no receipts
 *   - audit-bundle returns Content-Disposition: attachment
 *   - audit-bundle bundleVersion + chainRoot present
 *   - audit-bundle ?since/?until clip the receipt set
 *   - audit-bundle audit-logs the call (per GDPR Art. 15)
 *   - audit-bundle is gated on the auditLogExport entitlement, and points
 *     a denied caller at the ungated data-subject access route
 *   - graceful empty result when DB blips
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.AGENT_RUN_SIGNING_SECRET = "test_secret_with_enough_entropy_aaaa";
});

const mockAuth = vi.fn();
const mockAuditLog = vi.fn().mockResolvedValue(undefined);
/** Entitled by default; the gate itself is asserted in its own cases below. */
const mockRequireEntitlement = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));
vi.mock("@/lib/plan-enforcement", () => ({
  requireEntitlement: (...args: unknown[]) => mockRequireEntitlement(...args),
}));
vi.mock("@/lib/audit-log", () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

interface ChainRow {
  id: string;
  signature: string;
  createdAt: Date;
}

interface BundleRow extends ChainRow {
  agentName: string;
  modelUsed: string;
  inputJson: string;
  outputJson: string;
  safetyResult: string;
  durationMs: number;
  chainDepth: number;
  trustDecision: string;
  visibility: string;
}

let mockChainRows: ChainRow[] = [];
let mockBundleRows: BundleRow[] = [];
let dbShouldThrow = false;

vi.mock("@/db", () => {
  // Both routes select different field shapes; we route by
  // detecting the presence of agentName in the .select() call's
  // shape via the route's requested columns.
  let lastSelectShape: "chain" | "bundle" = "chain";
  const chain = {
    select: (cols: Record<string, unknown> = {}) => {
      lastSelectShape = "agentName" in cols ? "bundle" : "chain";
      return chain;
    },
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => {
      if (dbShouldThrow) return Promise.reject(new Error("DB blip"));
      return Promise.resolve(
        lastSelectShape === "bundle" ? mockBundleRows : mockChainRows,
      );
    },
    // The audit-root path doesn't call .limit(), so .orderBy returns
    // the rows directly via thenable. Both `resolve` and `reject` are
    // handled — without the reject branch, an `await` against this
    // object would hang forever in the dbShouldThrow case.
    then: (
      onResolve: (rows: ChainRow[] | BundleRow[]) => unknown,
      onReject?: (err: unknown) => unknown,
    ): Promise<unknown> => {
      if (dbShouldThrow) {
        const err = new Error("DB blip");
        if (onReject) return Promise.resolve(onReject(err));
        return Promise.reject(err);
      }
      return Promise.resolve(
        onResolve(
          lastSelectShape === "bundle" ? mockBundleRows : mockChainRows,
        ),
      );
    },
  };
  return { db: chain };
});

async function loadRoot() {
  vi.resetModules();
  return await import("@/app/api/me/audit-root/route");
}

async function loadBundle() {
  vi.resetModules();
  return await import("@/app/api/me/audit-bundle/route");
}

function chainRow(
  id: string,
  sig: string,
  iso: string = "2026-05-10T00:00:00.000Z",
): ChainRow {
  return { id, signature: `v1=${sig}`, createdAt: new Date(iso) };
}

function bundleRow(
  id: string,
  sig: string,
  iso: string = "2026-05-10T00:00:00.000Z",
): BundleRow {
  return {
    id,
    signature: `v1=${sig}`,
    createdAt: new Date(iso),
    agentName: "blog-gen",
    modelUsed: "claude",
    inputJson: '{"topic":"x"}',
    outputJson: '{"html":"<p>y</p>"}',
    safetyResult: '{"jailbreak":"pass"}',
    durationMs: 1000,
    chainDepth: 0,
    trustDecision: "auto-approved",
    visibility: "private",
  };
}

// ─── GET /api/me/audit-root ────────────────────────────────────────────

describe("GET /api/me/audit-root", () => {
  beforeEach(() => {
    mockChainRows = [];
    dbShouldThrow = false;
    vi.clearAllMocks();
  });

  it("401 unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await loadRoot();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns envelope + canonical + signature for an empty user", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockChainRows = [];
    const { GET } = await loadRoot();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      envelope: { count: number; root: string; v: number };
      canonical: string;
      signature: string;
    };
    expect(body.envelope.count).toBe(0);
    expect(body.envelope.v).toBe(1);
    expect(body.envelope.root).toMatch(/^0{64}$/); // EMPTY_ROOT
    expect(body.signature).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it("count matches receipt count + root is non-empty", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockChainRows = [
      chainRow("a", "111"),
      chainRow("b", "222"),
      chainRow("c", "333"),
    ];
    const { GET } = await loadRoot();
    const res = await GET();
    const body = (await res.json()) as {
      envelope: { count: number; root: string };
    };
    expect(body.envelope.count).toBe(3);
    expect(body.envelope.root).not.toMatch(/^0{64}$/);
  });

  it("returns empty root when DB blips (no 500)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    dbShouldThrow = true;
    const { GET } = await loadRoot();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { envelope: { count: number } };
    expect(body.envelope.count).toBe(0);
  });
});

// ─── GET /api/me/audit-bundle ──────────────────────────────────────────

describe("GET /api/me/audit-bundle", () => {
  beforeEach(() => {
    mockBundleRows = [];
    dbShouldThrow = false;
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
  });

  beforeEach(() => {
    mockRequireEntitlement.mockResolvedValue({
      allowed: true,
      flag: "auditLogExport",
      plan: "node",
      planName: "Node",
      requiredPlan: null,
    });
  });

  it("401 unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await loadBundle();
    const res = await GET(new Request("http://localhost/api/me/audit-bundle"));
    expect(res.status).toBe(401);
  });

  it("returns Content-Disposition: attachment + JSON", async () => {
    mockAuth.mockResolvedValue({ userId: "u_test_12345678" });
    mockBundleRows = [bundleRow("a", "111")];
    const { GET } = await loadBundle();
    const res = await GET(new Request("http://localhost/api/me/audit-bundle"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    expect(res.headers.get("content-disposition")).toMatch(/sovereign-audit/);
  });

  it("body has bundleVersion + receipts + chainRoot", async () => {
    mockAuth.mockResolvedValue({ userId: "u_test" });
    mockBundleRows = [bundleRow("a", "111"), bundleRow("b", "222")];
    const { GET } = await loadBundle();
    const res = await GET(new Request("http://localhost/api/me/audit-bundle"));
    const body = (await res.json()) as {
      bundleVersion: number;
      receipts: { id: string; agentName: string }[];
      chainRoot: { envelope: { count: number } };
      spec: { receiptFormat: string };
    };
    expect(body.bundleVersion).toBe(1);
    expect(body.receipts.length).toBe(2);
    expect(body.chainRoot.envelope.count).toBe(2);
    expect(body.spec.receiptFormat).toBe("VAOS 1.0");
  });

  it("audit-logs the bundle pull (per GDPR Art. 15)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_test" });
    mockBundleRows = [bundleRow("a", "111")];
    const { GET } = await loadBundle();
    await GET(new Request("http://localhost/api/me/audit-bundle"));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "data.audit-bundle",
        resource: "agent_runs",
      }),
    );
  });

  it("respects ?since and ?until query params (parsed and forwarded)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_test" });
    mockBundleRows = [bundleRow("a", "111")];
    const { GET } = await loadBundle();
    const res = await GET(
      new Request(
        "http://localhost/api/me/audit-bundle?since=2026-05-01T00:00:00Z&until=2026-05-31T23:59:59Z",
      ),
    );
    const body = (await res.json()) as {
      range: { since: string | null; until: string | null };
    };
    expect(body.range.since).toBe("2026-05-01T00:00:00.000Z");
    expect(body.range.until).toBe("2026-05-31T23:59:59.000Z");
  });

  it("ignores malformed since/until rather than 500ing", async () => {
    mockAuth.mockResolvedValue({ userId: "u_test" });
    mockBundleRows = [];
    const { GET } = await loadBundle();
    const res = await GET(
      new Request("http://localhost/api/me/audit-bundle?since=not-a-date"),
    );
    expect(res.status).toBe(200);
  });

  it("returns empty bundle when DB blips (no 500)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_test" });
    dbShouldThrow = true;
    const { GET } = await loadBundle();
    const res = await GET(new Request("http://localhost/api/me/audit-bundle"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { receipts: unknown[] };
    expect(body.receipts).toEqual([]);
  });

  it("402s when the caller lacks the auditLogExport entitlement", async () => {
    mockAuth.mockResolvedValue({ userId: "u_free" });
    mockRequireEntitlement.mockResolvedValue({
      allowed: false,
      flag: "auditLogExport",
      plan: "free",
      planName: "Free",
      requiredPlan: "node",
      message: "This feature requires Node plan ($99/mo). You are on Free.",
      upgradeUrl: "/pricing",
    });
    const { GET } = await loadBundle();
    const res = await GET(new Request("http://localhost/api/me/audit-bundle"));
    expect(res.status).toBe(402);
    const body = (await res.json()) as {
      requiredPlan: string;
      upgradeUrl: string;
      dataSubjectAccess: string;
    };
    expect(body.requiredPlan).toBe("node");
    expect(body.upgradeUrl).toBe("/pricing");
    // The paywall covers the signed evidence pack, never the right of access.
    expect(body.dataSubjectAccess).toBe("/api/data-export");
  });

  it("checks entitlement for the authenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: "u_test" });
    mockBundleRows = [];
    const { GET } = await loadBundle();
    await GET(new Request("http://localhost/api/me/audit-bundle"));
    expect(mockRequireEntitlement).toHaveBeenCalledWith(
      "u_test",
      "auditLogExport",
    );
  });

  it("does not consult the entitlement gate before authentication", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await loadBundle();
    const res = await GET(new Request("http://localhost/api/me/audit-bundle"));
    expect(res.status).toBe(401);
    expect(mockRequireEntitlement).not.toHaveBeenCalled();
  });
});
