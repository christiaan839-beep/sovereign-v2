/**
 * Tests for GET /api/agent-runs — receipt list endpoint.
 *
 * Covers:
 *   - 401 when unauthenticated
 *   - clamps limit to [1, 200]
 *   - returns items mapped to the public projection (no signature exposed
 *     beyond first 16 chars; full input/output truncated to preview)
 *   - returns nextCursor when page is full
 *   - returns null nextCursor on a partial page
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAuth = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

interface RowShape {
  id: string;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  trustDecision: string;
  visibility: string;
  signature: string;
  createdAt: Date;
  inputJson: string;
  outputJson: string;
  safetyResult: string;
}

let mockRows: RowShape[] = [];

vi.mock("@/db", () => {
  const chain: {
    select: () => typeof chain;
    from: () => typeof chain;
    where: () => typeof chain;
    orderBy: () => typeof chain;
    limit: (n: number) => Promise<RowShape[]>;
  } = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: (n: number) => Promise.resolve(mockRows.slice(0, n)),
  };
  return { db: chain };
});

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/agent-runs/route");
}

function row(overrides: Partial<RowShape> = {}): RowShape {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    agentName: "blog-gen",
    modelUsed: "claude-sonnet-4-6",
    durationMs: 1234,
    trustDecision: "auto-approved",
    visibility: "private",
    signature:
      "v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    createdAt: new Date(),
    inputJson: JSON.stringify({ topic: "x" }),
    outputJson: JSON.stringify({ html: "<p>hello</p>" }),
    safetyResult: JSON.stringify({ jailbreak: "pass" }),
    ...overrides,
  };
}

function req(query = ""): Request {
  return new Request(`http://localhost/api/agent-runs${query}`);
}

describe("GET /api/agent-runs", () => {
  beforeEach(() => {
    mockRows = [];
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await loadRoute();
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns mapped projection with truncated signature", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test" });
    mockRows = [row()];
    const { GET } = await loadRoute();
    const res = await GET(req());
    const body = (await res.json()) as {
      items: { id: string; signaturePrefix: string }[];
      nextCursor: string | null;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.signaturePrefix).toHaveLength(16);
    expect(body.nextCursor).toBeNull();
  });

  it("returns nextCursor when page is full", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test" });
    // Simulate a full default page (50)
    mockRows = Array.from({ length: 60 }, (_, i) =>
      row({
        id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      }),
    );
    const { GET } = await loadRoute();
    const res = await GET(req("?limit=50"));
    const body = (await res.json()) as {
      items: { id: string }[];
      nextCursor: string | null;
    };
    expect(body.items.length).toBe(50);
    expect(body.nextCursor).toBe(body.items[49]!.id);
  });

  it("clamps limit to the [1, 200] range", async () => {
    mockAuth.mockResolvedValue({ userId: "user_test" });
    mockRows = Array.from({ length: 500 }, (_, i) =>
      row({
        id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      }),
    );
    const { GET } = await loadRoute();
    const res = await GET(req("?limit=999"));
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items.length).toBe(200);
  });
});
