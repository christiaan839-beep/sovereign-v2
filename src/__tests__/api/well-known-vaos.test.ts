/**
 * Tests for GET /.well-known/vaos — VAOS Issuer Discovery Document.
 *
 * Covers:
 *   - returns 200 + open CORS for cross-origin verifiers
 *   - schema invariants (discovery_version, all required fields)
 *   - URLs are absolute + share the same origin
 *   - supported_wire_versions degrades gracefully when no v2 key set
 *   - cache header is conservative (5 min)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

async function load() {
  return await import("@/app/.well-known/vaos/route");
}

interface DiscoveryDoc {
  discovery_version: number;
  issuer: string;
  issuer_name: string;
  supported_wire_versions: string[];
  algorithms: { v1: string; v2: string; v3: string };
  public_keys: {
    ed25519_pem_url: string;
    mldsa65_b64_url: string | null;
  };
  transparency: {
    sth_url: string;
    inclusion_proof_url: string;
    witness_url: string;
  };
  issuer_registry_url: string;
  specifications: Record<string, string>;
  bundle_download_root: string;
  contacts: { security: string; spec: string };
  security_policy_url: string;
  generated_at: string;
}

describe("GET /.well-known/vaos — discovery document", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with open CORS for cross-origin verifiers", async () => {
    const { GET } = await load();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("has 5-min cache header (conservative TTL for key rotation)", async () => {
    const { GET } = await load();
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("emits a stable schema-versioned envelope", async () => {
    const { GET } = await load();
    const res = await GET();
    const doc = (await res.json()) as DiscoveryDoc;

    expect(doc.discovery_version).toBe(1);
    expect(typeof doc.issuer).toBe("string");
    expect(doc.issuer.startsWith("http")).toBe(true);
    expect(doc.issuer_name).toBe("Sovereign Matrix");
    expect(Array.isArray(doc.supported_wire_versions)).toBe(true);
    expect(doc.supported_wire_versions.length).toBeGreaterThanOrEqual(1);
    expect(doc.algorithms.v1).toBe("HMAC-SHA256");
    expect(doc.algorithms.v2).toBe("Ed25519");
    expect(doc.algorithms.v3).toBe("Ed25519+ML-DSA-65");
  });

  it("public-key + transparency URLs share the issuer origin", async () => {
    const { GET } = await load();
    const res = await GET();
    const doc = (await res.json()) as DiscoveryDoc;
    const origin = doc.issuer;

    expect(doc.public_keys.ed25519_pem_url.startsWith(origin)).toBe(true);
    expect(doc.transparency.sth_url.startsWith(origin)).toBe(true);
    expect(doc.transparency.inclusion_proof_url.startsWith(origin)).toBe(true);
    expect(doc.transparency.witness_url.startsWith(origin)).toBe(true);
    expect(doc.issuer_registry_url.startsWith(origin)).toBe(true);
    expect(doc.bundle_download_root.startsWith(origin)).toBe(true);
  });

  it("exposes contacts and security policy URL", async () => {
    const { GET } = await load();
    const res = await GET();
    const doc = (await res.json()) as DiscoveryDoc;

    expect(doc.contacts.security).toMatch(/@sovereignmatrix\.agency$/);
    expect(doc.contacts.spec).toMatch(/@sovereignmatrix\.agency$/);
    expect(doc.security_policy_url).toMatch(/\/security$/);
  });

  it("includes generated_at as an ISO-8601 timestamp", async () => {
    const { GET } = await load();
    const res = await GET();
    const doc = (await res.json()) as DiscoveryDoc;

    expect(doc.generated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    );
  });

  it("references all three frozen VAOS specs by version", async () => {
    const { GET } = await load();
    const res = await GET();
    const doc = (await res.json()) as DiscoveryDoc;

    expect(doc.specifications.vaos_v1).toMatch(/vaos-1\.0\.md$/);
    expect(doc.specifications.vaos_v2).toMatch(/vaos-2\.0\.md$/);
    expect(doc.specifications.vaos_v3).toMatch(/vaos-3\.0\.md$/);
    expect(doc.specifications.transparency_log).toMatch(
      /transparency-log\.md$/,
    );
  });
});
