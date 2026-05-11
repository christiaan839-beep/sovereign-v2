/**
 * Tests for VAOS 2.0 — Ed25519 asymmetric signature support in
 * src/lib/agent-runs.ts.
 *
 * Properties pinned:
 *   - With Ed25519 private key configured, signRun emits "v2=..."
 *   - Without, signRun falls back to "v1=..." (HMAC) — backwards-compat
 *   - verifySignature accepts BOTH v1 and v2 receipts transparently
 *   - Wrong-key v2 signature fails verification
 *   - Tampered canonical fails verification under v2
 *   - Unknown algorithm prefix (e.g. "v9=") is rejected
 *   - getEd25519PublicKeyPem returns SPKI PEM only when private key set
 *   - Public key endpoint serves the PEM with open CORS
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { generateKeyPairSync } from "crypto";

// ── Helpers ─────────────────────────────────────────────────────────────

function freshEd25519Pem(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ format: "pem", type: "pkcs8" }) as string;
}

const ORIG_HMAC = process.env.AGENT_RUN_SIGNING_SECRET;
const ORIG_ED = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;

beforeAll(() => {
  process.env.AGENT_RUN_SIGNING_SECRET = "test_secret_with_enough_entropy_aaaa";
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
});

afterAll(() => {
  if (ORIG_HMAC === undefined) delete process.env.AGENT_RUN_SIGNING_SECRET;
  else process.env.AGENT_RUN_SIGNING_SECRET = ORIG_HMAC;
  if (ORIG_ED === undefined) delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  else process.env.AGENT_RUN_ED25519_PRIVATE_KEY = ORIG_ED;
});

// ── Tests ───────────────────────────────────────────────────────────────

describe("signRun / verifySignature — v2 Ed25519 path", () => {
  beforeEach(async () => {
    // Reset the module-level key cache between tests by reloading.
    delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  });

  it("falls back to v1 HMAC when no Ed25519 key is configured", async () => {
    const { signRun, verifySignature } = await import("@/lib/agent-runs");
    const sig = signRun("{}");
    expect(sig).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(verifySignature("{}", sig)).toBe(true);
  });

  it("emits v2= when AGENT_RUN_ED25519_PRIVATE_KEY is configured", async () => {
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = freshEd25519Pem();
    // Re-import so the module re-reads env. vitest module cache is hot
    // per test file, so we have to bust it explicitly.
    const mod = await import("@/lib/agent-runs?ed25519-cache-bust=1");
    const sig = mod.signRun("{}");
    expect(sig.startsWith("v2=")).toBe(true);
    expect(mod.verifySignature("{}", sig)).toBe(true);
  });

  it("v2 verification rejects a tampered canonical", async () => {
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = freshEd25519Pem();
    const mod = await import("@/lib/agent-runs?v2-tamper-bust=1");
    const sig = mod.signRun('{"a":1}');
    expect(mod.verifySignature('{"a":2}', sig)).toBe(false);
  });

  it("v2 verification rejects a signature signed under a different key", async () => {
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = freshEd25519Pem();
    const mod = await import("@/lib/agent-runs?v2-altkey-bust=1");
    const otherSig = mod.signRun('{"a":1}');

    // Rotate the key — same canonical, different signature
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = freshEd25519Pem();
    const mod2 = await import("@/lib/agent-runs?v2-altkey-bust=2");
    // The old signature shouldn't verify under the new key
    expect(mod2.verifySignature('{"a":1}', otherSig)).toBe(false);
  });

  it("rejects malformed v2 signature (non-base64 garbage)", async () => {
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = freshEd25519Pem();
    const mod = await import("@/lib/agent-runs?v2-malformed-bust=1");
    expect(mod.verifySignature("{}", "v2=!!!notbase64!!!")).toBe(false);
  });

  it("rejects unknown algorithm prefix (forward-compat guard)", async () => {
    const { verifySignature } =
      await import("@/lib/agent-runs?unknown-prefix-bust=1");
    expect(verifySignature("anything", "v9=futurealgo")).toBe(false);
    expect(verifySignature("anything", "plain-hmac-no-prefix")).toBe(false);
  });

  it("rejects 'unsigned' sentinel under any key configuration", async () => {
    const { verifySignature } =
      await import("@/lib/agent-runs?unsigned-bust=1");
    expect(verifySignature("anything", "unsigned")).toBe(false);
  });
});

describe("getEd25519PublicKeyPem", () => {
  beforeEach(() => {
    delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  });

  it("returns null when no private key is configured", async () => {
    const { getEd25519PublicKeyPem } =
      await import("@/lib/agent-runs?pubkey-null-bust=1");
    expect(getEd25519PublicKeyPem()).toBeNull();
  });

  it("returns SPKI PEM when private key is configured", async () => {
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = freshEd25519Pem();
    const mod = await import("@/lib/agent-runs?pubkey-spki-bust=1");
    // Touch signRun to populate cache first
    mod.signRun("{}");
    const pem = mod.getEd25519PublicKeyPem();
    expect(pem).toMatch(/-----BEGIN PUBLIC KEY-----/);
    expect(pem).toMatch(/-----END PUBLIC KEY-----/);
  });
});

// ── Public-key endpoint ─────────────────────────────────────────────────

describe("GET /.well-known/sovereign-receipts/ed25519.pem", () => {
  beforeEach(() => {
    delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  });

  it("returns 404 when no Ed25519 key is configured", async () => {
    const { GET } =
      await import("@/app/.well-known/sovereign-receipts/ed25519.pem/route?nokey-bust=1");
    const res = await GET();
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
  });

  it("returns 200 + PEM + open CORS when key configured", async () => {
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = freshEd25519Pem();
    // Force the agent-runs module to pick up the key
    const mod = await import("@/lib/agent-runs?well-known-bust=1");
    mod.signRun("{}");
    const { GET } =
      await import("@/app/.well-known/sovereign-receipts/ed25519.pem/route?key-bust=1");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/x-pem-file/);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = await res.text();
    expect(body).toMatch(/-----BEGIN PUBLIC KEY-----/);
  });
});
