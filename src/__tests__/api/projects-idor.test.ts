/**
 * Regression guard for the `_misc/projects` tenancy bug (BACKLOG
 * idor-projects).
 *
 * The handlers keyed every query on a caller-supplied `x-user-id`
 * header, with an `|| "anonymous"` fallback. Today the file is shadowed
 * by `src/app/api/projects/route.ts` (which re-exports the Clerk-guarded
 * `/api/clients` handlers) so it is not reachable — but the shadow only
 * covers GET and POST, and the two sibling routes that were NOT shadowed
 * (`_misc/inbox`, `_misc/scheduled-runs`) shipped this exact bug as a
 * live cross-tenant read/write.
 *
 * These tests pin the fix so the landmine can't be re-armed: identity
 * comes from the Clerk session only, and the header is inert.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockAuth = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

/** Every userId the handlers filtered or wrote on. */
let observedUserIds: string[] = [];
let insertedValues: Record<string, unknown> | null = null;

vi.mock("drizzle-orm", () => ({
  // Record the right-hand side of each equality so we can assert which
  // identity actually reached the query.
  eq: (_col: unknown, value: unknown) => {
    if (typeof value === "string") observedUserIds.push(value);
    return { _tag: "eq", value };
  },
  and: (...parts: unknown[]) => ({ _tag: "and", parts }),
}));

vi.mock("@/db/schema", () => ({
  clientProjects: {
    id: "id",
    userId: "user_id",
    createdAt: "created_at",
  },
}));

vi.mock("@/db", () => {
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    orderBy: () => Promise.resolve([]),
  };
  const insertChain = {
    values: (v: Record<string, unknown>) => {
      insertedValues = v;
      return insertChain;
    },
    returning: () => Promise.resolve([{ id: "p1", ...insertedValues }]),
  };
  const updateChain = {
    set: () => updateChain,
    where: () => updateChain,
    returning: () => Promise.resolve([{ id: "p1" }]),
  };
  const deleteChain = {
    where: () => deleteChain,
    returning: () => Promise.resolve([{ id: "p1" }]),
  };
  return {
    db: {
      select: () => selectChain,
      insert: () => insertChain,
      update: () => updateChain,
      delete: () => deleteChain,
    },
  };
});

import { GET, POST, PUT, DELETE } from "@/app/api/_misc/projects/route";
import type { NextRequest } from "next/server";

const req = (
  url: string,
  init: { headers?: Record<string, string>; body?: unknown } = {},
) =>
  ({
    url,
    headers: new Headers(init.headers ?? {}),
    json: async () => init.body ?? {},
  }) as unknown as NextRequest;

const VICTIM = "user_victim";
const CALLER = "user_caller";

beforeEach(() => {
  observedUserIds = [];
  insertedValues = null;
  mockAuth.mockReset();
});

describe("_misc/projects — identity is session-derived, never header-derived", () => {
  it("GET rejects an unauthenticated caller even with x-user-id set", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(
      req("http://x/api/projects", { headers: { "x-user-id": VICTIM } }),
    );
    expect(res.status).toBe(401);
    // The victim's id must never have reached a query.
    expect(observedUserIds).not.toContain(VICTIM);
  });

  it("POST rejects an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(
      req("http://x/api/projects", {
        headers: { "x-user-id": VICTIM },
        body: { name: "n", clientName: "c" },
      }),
    );
    expect(res.status).toBe(401);
    expect(insertedValues).toBeNull();
  });

  it("PUT rejects an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PUT(
      req("http://x/api/projects", {
        headers: { "x-user-id": VICTIM },
        body: { id: "p1", name: "hijacked" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("DELETE rejects an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(
      req("http://x/api/projects?id=p1", {
        headers: { "x-user-id": VICTIM },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("GET scopes to the Clerk session, ignoring a spoofed header", async () => {
    mockAuth.mockResolvedValue({ userId: CALLER });
    const res = await GET(
      req("http://x/api/projects", { headers: { "x-user-id": VICTIM } }),
    );
    expect(res.status).toBe(200);
    expect(observedUserIds).toContain(CALLER);
    expect(observedUserIds).not.toContain(VICTIM);
  });

  it("POST writes the row under the session user, not the header", async () => {
    mockAuth.mockResolvedValue({ userId: CALLER });
    await POST(
      req("http://x/api/projects", {
        headers: { "x-user-id": VICTIM },
        body: { name: "n", clientName: "c" },
      }),
    );
    expect(insertedValues?.userId).toBe(CALLER);
  });

  it("PUT cannot reassign a project to another owner", async () => {
    mockAuth.mockResolvedValue({ userId: CALLER });
    await PUT(
      req("http://x/api/projects", {
        body: { id: "p1", userId: VICTIM, name: "renamed" },
      }),
    );
    // The ownership filter used the session id; the body's userId was stripped.
    expect(observedUserIds).toContain(CALLER);
    expect(observedUserIds).not.toContain(VICTIM);
  });
});
