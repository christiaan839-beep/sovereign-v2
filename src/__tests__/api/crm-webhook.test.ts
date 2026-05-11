/**
 * Tests for /api/_webhooks/crm — HubSpot signature + event handling.
 *
 * Focus is on the gate behaviour (signature verification, idempotency, event
 * filtering). The downstream automation is covered indirectly: we assert that
 * `triggerCloseWonAutomation` is reached only for the right events, by
 * watching the mocked DB inserts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

const SECRET = "test_hubspot_secret";
const URL = "http://localhost/api/_webhooks/crm";

const mockAlreadyProcessed = vi.fn();
const mockSendEmail = vi.fn();
const mockAuditLog = vi.fn();

// Drizzle is awkward to fake — we stub the whole module surface used here.
const insertedPlaybookRows: unknown[] = [];
const insertedLeads: unknown[] = [];
const updatedPlaybooks: unknown[] = [];

const dbMock = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () =>
          Promise.resolve(
            mockUserLookup.length > 0 ? [mockUserLookup.shift()] : [],
          ),
      }),
    }),
  }),
  insert: (table: { _: { name?: string }; [key: string]: unknown }) => ({
    values: (row: unknown) => {
      const name =
        (table as unknown as { name?: string }).name ??
        // drizzle pgTable preserves the table name on _.name; for our stub
        // we just dispatch by reference equality below.
        "";
      void name;
      if (table === playbookRunsTable) insertedPlaybookRows.push(row);
      else if (table === leadsTable) insertedLeads.push(row);
      return Promise.resolve();
    },
  }),
  update: (table: unknown) => ({
    set: (row: unknown) => ({
      where: () => {
        if (table === playbookRunsTable) updatedPlaybooks.push(row);
        return Promise.resolve();
      },
    }),
  }),
};

const playbookRunsTable = { __name: "playback_runs" };
const leadsTable = { __name: "leads" };
const usersTable = { __name: "users" };

let mockUserLookup: Array<{ id: string; email: string; name: string }> = [];

vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@/db/schema", () => ({
  users: usersTable,
  playbookRuns: playbookRunsTable,
  leads: leadsTable,
}));
vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
}));
vi.mock("@/lib/idempotency", () => ({
  alreadyProcessed: (...args: unknown[]) => mockAlreadyProcessed(...args),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));
vi.mock("@/lib/audit-log", () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ check: () => Promise.resolve(null) }),
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
  return await import("@/app/api/_webhooks/crm/route");
}

function signRequest(body: string, timestamp: string): string {
  const source = `POST${URL}${body}${timestamp}`;
  return crypto.createHmac("sha256", SECRET).update(source).digest("base64");
}

function makeSignedRequest(
  body: unknown,
  opts?: {
    badSignature?: boolean;
    staleTimestamp?: boolean;
    missingHeaders?: boolean;
  },
) {
  const stringBody = JSON.stringify(body);
  const ts = opts?.staleTimestamp
    ? String(Date.now() - 10 * 60 * 1000)
    : String(Date.now());
  const sig = opts?.badSignature
    ? "deadbeef".repeat(8)
    : signRequest(stringBody, ts);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!opts?.missingHeaders) {
    headers["x-hubspot-signature-v3"] = sig;
    headers["x-hubspot-request-timestamp"] = ts;
  }

  return new Request(URL, { method: "POST", headers, body: stringBody });
}

describe("/api/_webhooks/crm — gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedPlaybookRows.length = 0;
    insertedLeads.length = 0;
    updatedPlaybooks.length = 0;
    mockUserLookup = [];
    process.env.HUBSPOT_CLIENT_SECRET = SECRET;
    mockAlreadyProcessed.mockResolvedValue(false);
    mockSendEmail.mockResolvedValue({ success: true, id: "email_test" });
  });

  it("returns 503 when HUBSPOT_CLIENT_SECRET is missing", async () => {
    delete process.env.HUBSPOT_CLIENT_SECRET;
    const { POST } = await loadRoute();
    const res = await POST(makeSignedRequest([]));
    expect(res.status).toBe(503);
  });

  it("rejects requests without signature headers", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeSignedRequest([], { missingHeaders: true }));
    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid signature", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeSignedRequest([], { badSignature: true }));
    expect(res.status).toBe(401);
  });

  it("rejects stale timestamps (replay protection)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeSignedRequest([], { staleTimestamp: true }));
    expect(res.status).toBe(401);
  });
});

describe("/api/_webhooks/crm — event handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedPlaybookRows.length = 0;
    insertedLeads.length = 0;
    updatedPlaybooks.length = 0;
    mockUserLookup = [];
    process.env.HUBSPOT_CLIENT_SECRET = SECRET;
    mockAlreadyProcessed.mockResolvedValue(false);
    mockSendEmail.mockResolvedValue({ success: true, id: "email_test" });
  });

  it("ignores events that aren't deal stage changes to closedwon", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeSignedRequest([
        {
          eventId: 1,
          subscriptionType: "contact.creation",
          objectId: 99,
        },
      ]),
    );
    expect(res.status).toBe(200);
    expect(insertedPlaybookRows.length).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips closed-won events when no Sovereign user matches the email", async () => {
    mockUserLookup = []; // no user found
    const { POST } = await loadRoute();
    const res = await POST(
      makeSignedRequest([
        {
          eventId: 2,
          subscriptionType: "deal.propertyChange",
          propertyName: "dealstage",
          propertyValue: "closedwon",
          objectId: 1234,
          ownerEmail: "ghost@example.com",
        },
      ]),
    );
    expect(res.status).toBe(200);
    expect(insertedPlaybookRows.length).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("triggers automation for a closed-won event with a matching user", async () => {
    mockUserLookup = [
      { id: "u_1", email: "founder@acme.com", name: "Acme Founder" },
    ];
    const { POST } = await loadRoute();
    const res = await POST(
      makeSignedRequest([
        {
          eventId: 3,
          subscriptionType: "deal.propertyChange",
          propertyName: "dealstage",
          propertyValue: "closedwon",
          objectId: 5678,
          ownerEmail: "founder@acme.com",
          dealName: "Acme Q3 Engagement",
        },
      ]),
    );
    expect(res.status).toBe(200);
    expect(insertedPlaybookRows.length).toBe(1);
    expect(insertedLeads.length).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "webhook.received",
        userId: "u_1",
      }),
    );
  });

  it("dedupes repeat events via the idempotency store", async () => {
    mockAlreadyProcessed.mockResolvedValueOnce(true);
    mockUserLookup = [
      { id: "u_1", email: "founder@acme.com", name: "Acme Founder" },
    ];
    const { POST } = await loadRoute();
    const res = await POST(
      makeSignedRequest([
        {
          eventId: 4,
          subscriptionType: "deal.propertyChange",
          propertyName: "dealstage",
          propertyValue: "closedwon",
          objectId: 9999,
          ownerEmail: "founder@acme.com",
        },
      ]),
    );
    expect(res.status).toBe(200);
    expect(insertedPlaybookRows.length).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
