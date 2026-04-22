/**
 * data-cleaner route smoke tests.
 *
 * We mock `ai()` and verify the handler parses cleaning-rule output,
 * strips markdown fences, returns both sqlFixes and pythonFixes, and
 * throws on non-JSON.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAi } = vi.hoisted(() => ({ mockAi: vi.fn() }));

vi.mock("@/lib/ai", () => ({
  ai: mockAi,
  research_ai: vi.fn(),
}));

vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: (opts: { handler: (args: { input: unknown }) => Promise<unknown> }) => {
    return async (req: Request) => {
      const input = await req.json();
      const out = await opts.handler({ input });
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
  },
}));

beforeEach(() => {
  mockAi.mockReset();
});

import { POST } from "@/app/api/_agents/data-cleaner/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/data-cleaner", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sampleCsv = [
  "email,status,signup_date",
  "alice@example.com,Active,2024-01-15",
  "bob@example.com,active,01/15/24",
  "carol@example.com,ACTIVE,",
  "DAVID@EXAMPLE.COM,Inactive,2024-02-01",
].join("\n");

describe("data-cleaner", () => {
  it("returns issues, SQL fixes, Python fixes, and new schema", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        issuesFound: [
          {
            column: "status",
            issue: "Inconsistent casing across rows (Active, active, ACTIVE)",
            rowsAffected: 3,
            fixRule: "Lowercase and trim the status column",
          },
          {
            column: "signup_date",
            issue: "Mixed date formats and empty string treated as null",
            rowsAffected: 2,
            fixRule: "Parse dates to ISO 8601, replace empty strings with NULL",
          },
        ],
        sqlFixes: [
          "-- Normalize status casing\nUPDATE {{table}} SET status = LOWER(TRIM(status));",
          "-- Convert empty date strings to NULL\nUPDATE {{table}} SET signup_date = NULL WHERE signup_date = '';",
        ],
        pythonFixes: [
          "# Normalize status casing\ndf['status'] = df['status'].str.strip().str.lower()",
          "# Parse dates, NaT for empty\ndf['signup_date'] = pd.to_datetime(df['signup_date'], errors='coerce')",
        ],
        newSchema: "email: text (lowercased), status: enum(active|inactive), signup_date: date nullable",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        sample: sampleCsv,
        issueHypothesis: "Inconsistent casing in status and mixed date formats in signup_date",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.issuesFound.length).toBeGreaterThanOrEqual(2);
    expect(body.sqlFixes.length).toBeGreaterThan(0);
    expect(body.pythonFixes.length).toBeGreaterThan(0);
    expect(body.newSchema).toContain("enum");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"issuesFound":[],"sqlFixes":[],"pythonFixes":[],"newSchema":"no changes needed"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ sample: "id,name\n1,alice", issueHypothesis: "check for issues" }),
    );
    const body = await res.json();
    expect(body.issuesFound).toEqual([]);
    expect(body.newSchema).toBe("no changes needed");
  });

  it("provides both SQL and Python fixes for same rule", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        issuesFound: [
          {
            column: "email",
            issue: "Mixed case in email addresses",
            rowsAffected: 1,
            fixRule: "Lowercase email column",
          },
        ],
        sqlFixes: ["-- Lowercase emails\nUPDATE {{table}} SET email = LOWER(email);"],
        pythonFixes: ["# Lowercase emails\ndf['email'] = df['email'].str.lower()"],
        newSchema: "email: text (lowercased and trimmed)",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        sample: sampleCsv,
        issueHypothesis: "email casing inconsistent",
        targetSchema: "email lowercased and trimmed",
      }),
    );
    const body = await res.json();
    expect(body.sqlFixes[0]).toContain("LOWER");
    expect(body.pythonFixes[0]).toContain("str.lower");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I cannot propose cleaning rules for this data.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ sample: "a,b", issueHypothesis: "x" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
