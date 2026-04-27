/**
 * /api/playbooks/run-dag — endpoint tests.
 *
 * Verifies the synchronous DAG executor:
 *   - Auth gating via requireAuth
 *   - Zod validation of the request body
 *   - Topological execution against an injected agent runner (we mock
 *     the global fetch so we don't actually call /api/agents/<slug>)
 *   - Audit-log write through the SHA-256 hash chain
 *   - Per-node error propagation into the results array
 *   - Synchronous-cap enforcement (>20 nodes is a 400)
 *
 * Why mock fetch instead of executeDag(): the route's job is to wire
 * auth → validate → run → audit. The unit test for executeDag itself
 * lives in playbook-dag.test.ts; here we verify the route does the
 * gluing right.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockAuditLog } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));
vi.mock("@/lib/audit-log", () => ({ auditLog: mockAuditLog }));
vi.mock("@/lib/base-url", () => ({ getBaseUrl: () => "http://localhost:3000" }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { POST } from "@/app/api/playbooks/run-dag/route";

function req(body: unknown): Request {
  return new Request("http://l/api/playbooks/run-dag", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validDag = {
  nodes: [
    { id: "n1", agent: "leads", position: { x: 0, y: 0 }, config: { count: 5 } },
    { id: "n2", agent: "outreach", position: { x: 200, y: 0 }, config: {} },
  ],
  edges: [{ from: "n1.leads", to: "n2.target" }],
};

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockAuditLog.mockReset();
  mockAuditLog.mockResolvedValue(undefined);
});

describe("POST /api/playbooks/run-dag", () => {
  it("returns 401 when auth fails", async () => {
    mockRequireAuth.mockResolvedValue({
      error: new Response("{}", { status: 401 }),
    });
    const res = await POST(req({ dag: validDag }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const malformed = new Request("http://l/api/playbooks/run-dag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(malformed as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 on missing dag field", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const res = await POST(req({}) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("rejects DAGs over the 100-node hard cap (validation)", async () => {
    // Round 12 raised the cap from 20 to 100 (the async path can
    // run much larger DAGs than sync). 100 is now the absolute
    // hard cap from the Zod schema; over that returns 400.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });
    const huge = {
      nodes: Array.from({ length: 101 }, (_, i) => ({
        id: `n${i}`,
        agent: "leads",
        position: { x: i * 50, y: 0 },
        config: {},
      })),
      edges: [],
    };
    const res = await POST(req({ dag: huge }) as never);
    expect(res.status).toBe(400);
  });

  it("executes the DAG, writes audit log, and returns results on success", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });

    // Mock global fetch for the self-fetch to /api/agents/<slug>.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/agents/leads")) {
          return new Response(
            JSON.stringify({ success: true, leads: [{ id: 1 }, { id: 2 }] }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ success: true, sent: 2 }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );

    try {
      const res = await POST(req({ dag: validDag }) as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.status).toBe("completed");
      expect(body.results).toHaveLength(2);
      expect(body.results[0].status).toBe("completed");
      expect(body.results[1].status).toBe("completed");
      expect(typeof body.totalDurationMs).toBe("number");

      // Audit log fired with the right shape.
      expect(mockAuditLog).toHaveBeenCalledTimes(1);
      const auditCall = mockAuditLog.mock.calls[0][0];
      expect(auditCall.action).toBe("agent.execute");
      expect(auditCall.resource).toBe("playbook_dag.run");
      expect(auditCall.details.kind).toBe("playbook_dag.run");
      expect(auditCall.details.nodeCount).toBe(2);
      expect(auditCall.userId).toBe("user_1");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("captures per-node errors when an agent gateway returns 500", async () => {
    // Critical contract: a failing node does NOT crash the whole route;
    // the response body documents WHICH node failed and why. This is
    // the behavior the visual editor's results panel renders.
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/agents/leads")) {
          return new Response("upstream model 503", { status: 503 });
        }
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200 },
        );
      },
    );

    try {
      const res = await POST(req({ dag: validDag }) as never);
      // Note: the route returns 200 even on per-node failure — the
      // failure is in the response body. This is deliberate; UI clients
      // should look at body.success / body.failedAt, not the HTTP code.
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.status).toBe("failed");
      expect(body.failedAt).toBe("n1");
      // Default behavior is fail-stop: n2 is "skipped", not "failed".
      const n1 = body.results.find((r: { nodeId: string }) => r.nodeId === "n1");
      const n2 = body.results.find((r: { nodeId: string }) => r.nodeId === "n2");
      expect(n1.status).toBe("failed");
      expect(n2.status).toBe("skipped");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("merges request inputs into the first node's config", async () => {
    mockRequireAuth.mockResolvedValue({ userId: "user_1" });

    let capturedInput: unknown = null;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init) => {
        capturedInput = init?.body ? JSON.parse(init.body as string) : null;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      },
    );

    try {
      // Single-node DAG so we only see the merge to node[0].
      const dagSingle = {
        nodes: [
          {
            id: "only",
            agent: "leads",
            position: { x: 0, y: 0 },
            config: { count: 5 },
          },
        ],
        edges: [],
      };
      const res = await POST(
        req({ dag: dagSingle, inputs: { region: "EMEA", priority: "high" } }) as never,
      );
      expect(res.status).toBe(200);
      // The first node's config should be the merge of the literal
      // config plus the user-supplied inputs.
      expect(capturedInput).toMatchObject({
        count: 5,
        region: "EMEA",
        priority: "high",
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
