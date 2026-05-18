/**
 * /api/transparency/witness contract tests.
 *
 * Covers the witness submission + lookup paths used by the v0.3
 * N-witness aggregator. The interesting branches:
 *   - POST happy path stores a cosignature
 *   - POST is idempotent on (witnessId, signature) re-submission
 *   - POST rejects an sthCanonical that doesn't match the current STH
 *   - POST validates the schema
 *   - GET returns the recorded list for a known STH
 *   - GET returns an empty list for an unknown STH (no error)
 *   - OPTIONS preflight returns CORS headers
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { canonicalizeSth } from "@sovereign-matrix/verifiable-receipts/transparency";

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

// IMPORTANT: do NOT call vi.resetModules() between POST and GET in the
// same test. The route + witness-store + transparency-singleton must
// share one module instance per test so the in-memory state survives.
async function loadRoute() {
  return await import("@/app/api/transparency/witness/route");
}

async function loadSingleton() {
  const m = await import("@/lib/transparency-singleton");
  return m.getDemoTransparencyLog();
}

async function loadWitnessStore() {
  return await import("@/lib/witness-store");
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { _resetWitnessStore } = await loadWitnessStore();
  _resetWitnessStore();
});

// Realistic-length signatures: a base64 Ed25519 signature is 88 chars
// + "v2=" prefix = 91 chars. The schema requires ≥ 8; we use 16-char
// stubs so the schema gate is satisfied without making the test fixtures
// unreadable.
const SIG_A = "v2=" + "A".repeat(16);
const SIG_B = "v2=" + "B".repeat(16);
const SIG_EVIL = "v2=" + "X".repeat(16);

function makePost(body: unknown): Request {
  return new Request("http://localhost/api/transparency/witness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(sth: string): Request {
  return new Request(
    `http://localhost/api/transparency/witness?sth=${encodeURIComponent(sth)}`,
  );
}

describe("POST /api/transparency/witness", () => {
  it("stores a cosignature against the current STH", async () => {
    const tlog = await loadSingleton();
    const canonical = canonicalizeSth(tlog.currentSth());
    const { POST } = await loadRoute();
    const res = await POST(
      makePost({
        witnessId: "EU Witness · Berlin",
        signature: SIG_A,
        sthCanonical: canonical,
        publicKeyUrl: "https://eu-witness.example/key.pem",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      recorded: boolean;
      firstForThisSth: boolean;
      witnessCount: number;
    };
    expect(body.ok).toBe(true);
    expect(body.recorded).toBe(true);
    expect(body.firstForThisSth).toBe(true);
    expect(body.witnessCount).toBe(1);
  });

  it("is idempotent on (witnessId, signature) re-submission", async () => {
    const tlog = await loadSingleton();
    const canonical = canonicalizeSth(tlog.currentSth());
    const { POST } = await loadRoute();
    const submission = {
      witnessId: "US Witness · NYC",
      signature: SIG_B,
      sthCanonical: canonical,
    };
    const r1 = await POST(makePost(submission));
    const r2 = await POST(makePost(submission));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const b2 = (await r2.json()) as {
      firstForThisSth: boolean;
      witnessCount: number;
    };
    expect(b2.firstForThisSth).toBe(false);
    expect(b2.witnessCount).toBe(1);
  });

  it("accepts cosignatures from multiple distinct witnesses on the same STH", async () => {
    const tlog = await loadSingleton();
    const canonical = canonicalizeSth(tlog.currentSth());
    const { POST } = await loadRoute();
    await POST(
      makePost({
        witnessId: "Witness A",
        signature: SIG_A,
        sthCanonical: canonical,
      }),
    );
    const res = await POST(
      makePost({
        witnessId: "Witness B",
        signature: SIG_B,
        sthCanonical: canonical,
      }),
    );
    const body = (await res.json()) as { witnessCount: number };
    expect(body.witnessCount).toBe(2);
  });

  it("rejects an sthCanonical that doesn't match the current STH", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makePost({
        witnessId: "Attacker",
        signature: SIG_EVIL,
        sthCanonical: '{"forged":"sth"}',
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/does not commit to the current tree state/);
  });

  it("rejects malformed payload (missing witnessId)", async () => {
    const tlog = await loadSingleton();
    const canonical = canonicalizeSth(tlog.currentSth());
    const { POST } = await loadRoute();
    const res = await POST(
      makePost({ signature: SIG_A, sthCanonical: canonical }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a publicKeyUrl that isn't a valid URL", async () => {
    const tlog = await loadSingleton();
    const canonical = canonicalizeSth(tlog.currentSth());
    const { POST } = await loadRoute();
    const res = await POST(
      makePost({
        witnessId: "Witness",
        signature: SIG_A,
        sthCanonical: canonical,
        publicKeyUrl: "not-a-url",
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/transparency/witness", () => {
  it("returns the list of recorded cosignatures for a known STH", async () => {
    const tlog = await loadSingleton();
    const canonical = canonicalizeSth(tlog.currentSth());
    const { POST, GET } = await loadRoute();
    await POST(
      makePost({
        witnessId: "Witness A",
        signature: SIG_A,
        sthCanonical: canonical,
      }),
    );
    const res = await GET(makeGet(canonical));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      witnessCount: number;
      cosignatures: Array<{ witnessId: string }>;
    };
    expect(body.witnessCount).toBe(1);
    expect(body.cosignatures[0].witnessId).toBe("Witness A");
  });

  it("returns an empty list (not an error) for an unknown STH", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeGet('{"unknown":"sth"}'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { witnessCount: number };
    expect(body.witnessCount).toBe(0);
  });

  it("returns 400 when the sth query parameter is missing", async () => {
    const { GET } = await loadRoute();
    const res = await GET(
      new Request("http://localhost/api/transparency/witness"),
    );
    expect(res.status).toBe(400);
  });
});

describe("OPTIONS /api/transparency/witness (CORS preflight)", () => {
  it("returns CORS headers", async () => {
    const { OPTIONS } = await loadRoute();
    const res = await OPTIONS();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toMatch(/POST/);
  });
});
