/**
 * Tests for src/lib/auditor-replay.ts — receipt replay verification.
 *
 * Covers every ReplayStatus branch:
 *   - not-found
 *   - unsigned (historical row, no signature column)
 *   - ok (stored sig reproduces over re-derived canonical)
 *   - tampered (stored sig fails verify on re-derived canonical)
 *   - no-key (signing not configured, but row + sig exist)
 *
 * The agent-runs module is mocked because we don't have a live DB in
 * the unit-test environment. We feed in fake row data and assert on
 * the deterministic canonical / hash / verdict.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac, randomBytes } from "crypto";

// ── Shared mock state ─────────────────────────────────────────────────

const mockRow: {
  current: {
    id: string;
    userId: string | null;
    tenantId: string | null;
    agentName: string;
    modelUsed: string;
    input: unknown;
    output: unknown;
    safetyResult: Record<string, unknown>;
    durationMs: number;
    chainDepth: number;
    trustDecision: string;
    visibility: "public" | "private" | "unlisted";
    signature: string;
    createdAt: Date;
  } | null;
} = { current: null };

// Manually re-implement the canonical projection so the test can compute
// the "correct" HMAC for the row independently of the module under test.
function canonicalForRow(row: NonNullable<typeof mockRow.current>): string {
  const sortKeysDeep = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(sortKeysDeep);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = sortKeysDeep((v as Record<string, unknown>)[k]);
    }
    return out;
  };
  return JSON.stringify({
    v: 1,
    id: row.id,
    agentName: row.agentName,
    modelUsed: row.modelUsed,
    input: sortKeysDeep(row.input),
    output: sortKeysDeep(row.output),
    safetyResult: sortKeysDeep(row.safetyResult),
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
  });
}

vi.mock("@/lib/agent-runs", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/agent-runs")>(
      "@/lib/agent-runs",
    );
  return {
    ...real,
    getRun: vi.fn(async () => mockRow.current),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────

function makeRow(overrides: Partial<NonNullable<typeof mockRow.current>> = {}) {
  return {
    id: "01HXTEST00000000000000000000000",
    userId: "u1",
    tenantId: null,
    agentName: "lead-blitz",
    modelUsed: "claude-sonnet-4-6",
    input: { icp: "Cape Town SaaS founders" },
    output: { headline: "ICP defined" },
    safetyResult: { passed: true },
    durationMs: 1432,
    chainDepth: 0,
    trustDecision: "auto-approved",
    visibility: "public" as const,
    signature: "",
    createdAt: new Date("2026-05-16T12:00:00.000Z"),
    ...overrides,
  };
}

const originalSecret = process.env.AGENT_RUN_SIGNING_SECRET;
const originalEd = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;

beforeEach(() => {
  // Use an HMAC-only signing setup for these tests — Ed25519 path is
  // covered in agent-runs's own tests. Deterministic + cheap.
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  process.env.AGENT_RUN_SIGNING_SECRET = randomBytes(24).toString("hex");
  mockRow.current = null;
  vi.resetModules();
});

afterAllRestoreEnv();

function afterAllRestoreEnv() {
  if (typeof afterAll !== "undefined") {
    afterAll(() => {
      if (originalSecret !== undefined)
        process.env.AGENT_RUN_SIGNING_SECRET = originalSecret;
      else delete process.env.AGENT_RUN_SIGNING_SECRET;
      if (originalEd !== undefined)
        process.env.AGENT_RUN_ED25519_PRIVATE_KEY = originalEd;
      else delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
    });
  }
}

// vitest globals — declared so TS doesn't complain about afterAll above.
declare const afterAll: ((fn: () => void) => void) | undefined;

// ── Tests ─────────────────────────────────────────────────────────────

describe("replayReceipt", () => {
  it("returns 'not-found' for an unknown receipt id", async () => {
    const { replayReceipt } = await import("@/lib/auditor-replay");
    mockRow.current = null;
    const r = await replayReceipt("not-a-real-id");
    expect(r.status).toBe("not-found");
    expect(r.run).toBeNull();
    expect(r.canonical).toBeNull();
    expect(r.canonicalHash).toBeNull();
    expect(r.replayAttestation).toBe("");
  });

  it("returns 'unsigned' for a row with no signature column", async () => {
    const { replayReceipt } = await import("@/lib/auditor-replay");
    mockRow.current = makeRow({ signature: "" });
    const r = await replayReceipt(mockRow.current.id);
    expect(r.status).toBe("unsigned");
    expect(r.run).not.toBeNull();
    expect(r.canonical).not.toBeNull();
    expect(r.canonicalHash).toMatch(/^[0-9a-f]{64}$/);
    // A fresh attestation IS issued since signing keys are configured.
    expect(r.replayAttestation).toMatch(/^v1=/);
  });

  it("returns 'unsigned' for a row with signature='unsigned' marker", async () => {
    const { replayReceipt } = await import("@/lib/auditor-replay");
    mockRow.current = makeRow({ signature: "unsigned" });
    const r = await replayReceipt(mockRow.current.id);
    expect(r.status).toBe("unsigned");
  });

  it("returns 'ok' when the stored HMAC validates over the recomputed canonical", async () => {
    // Compute a valid signature first, then store it on the mock row.
    const row = makeRow();
    const canonical = canonicalForRow(row);
    const validHmac = createHmac(
      "sha256",
      process.env.AGENT_RUN_SIGNING_SECRET!,
    )
      .update(canonical)
      .digest("hex");
    row.signature = `v1=${validHmac}`;
    mockRow.current = row;

    const { replayReceipt } = await import("@/lib/auditor-replay");
    const r = await replayReceipt(row.id);
    expect(r.status).toBe("ok");
    expect(r.signatureVerified).toBe(true);
    expect(r.storedSignature).toBe(`v1=${validHmac}`);
    expect(r.replayAttestation).toBe(`v1=${validHmac}`); // same canonical + same key = same sig
    expect(r.canonical).toBe(canonical);
  });

  it("returns 'tampered' when the stored sig fails to validate", async () => {
    const row = makeRow({ signature: "v1=deadbeef".padEnd(67, "0") });
    mockRow.current = row;

    const { replayReceipt } = await import("@/lib/auditor-replay");
    const r = await replayReceipt(row.id);
    expect(r.status).toBe("tampered");
    expect(r.signatureVerified).toBe(false);
    // Attestation is still issued — proves WE saw these bytes at replay time.
    expect(r.replayAttestation).toMatch(/^v1=/);
  });

  it("returns 'no-key' when the row has a signature but no signing key is configured", async () => {
    delete process.env.AGENT_RUN_SIGNING_SECRET;
    delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
    delete process.env.CRON_SECRET;

    const row = makeRow({ signature: "v1=somehexvalue" });
    mockRow.current = row;

    const { replayReceipt } = await import("@/lib/auditor-replay");
    const r = await replayReceipt(row.id);
    expect(r.status).toBe("no-key");
    expect(r.replayAttestation).toBe("");
    // Canonical is still recomputed for the auditor to inspect.
    expect(r.canonical).not.toBeNull();
  });

  it("includes a replayedAt ISO timestamp on every result", async () => {
    mockRow.current = null;
    const { replayReceipt } = await import("@/lib/auditor-replay");
    const r = await replayReceipt("anything");
    expect(r.replayedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

describe("formatReplayWorkpaper", () => {
  it("renders an 'ok' verdict suitable for auditor PDF paste", async () => {
    const row = makeRow();
    const canonical = canonicalForRow(row);
    const validHmac = createHmac(
      "sha256",
      process.env.AGENT_RUN_SIGNING_SECRET!,
    )
      .update(canonical)
      .digest("hex");
    row.signature = `v1=${validHmac}`;
    mockRow.current = row;

    const { replayReceipt, formatReplayWorkpaper } =
      await import("@/lib/auditor-replay");
    const r = await replayReceipt(row.id);
    const txt = formatReplayWorkpaper(r);

    expect(txt).toContain("SOVEREIGN MATRIX — Replay Attestation");
    expect(txt).toContain("Status: OK");
    expect(txt).toContain("Signature verifies under recomputed canonical: YES");
    expect(txt).toContain(row.agentName);
    expect(txt).toContain(row.modelUsed);
  });

  it("highlights TAMPERED status with an audit warning paragraph", async () => {
    const row = makeRow({ signature: "v1=deadbeef".padEnd(67, "0") });
    mockRow.current = row;
    const { replayReceipt, formatReplayWorkpaper } =
      await import("@/lib/auditor-replay");
    const r = await replayReceipt(row.id);
    const txt = formatReplayWorkpaper(r);
    expect(txt).toContain("Status: TAMPERED");
    expect(txt).toContain("Signature verifies under recomputed canonical: NO");
    expect(txt).toContain("WARNING");
    expect(txt).toContain("mutated since");
  });

  it("renders 'NOT-FOUND' minimally (no run/sig/hash blocks)", async () => {
    mockRow.current = null;
    const { replayReceipt, formatReplayWorkpaper } =
      await import("@/lib/auditor-replay");
    const r = await replayReceipt("nope");
    const txt = formatReplayWorkpaper(r);
    expect(txt).toContain("Status: NOT-FOUND");
    expect(txt).not.toContain("Receipt id:");
    expect(txt).not.toContain("Stored signature:");
  });
});
