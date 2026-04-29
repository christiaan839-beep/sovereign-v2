/**
 * federation/discovery (R56) — tests.
 *
 * Pure-function URL validation + manifest parsing + graph build,
 * plus the crawler with an injected fetcher for determinism.
 *
 * Covers:
 *   - normalizeUrl: stable hashing across equivalent forms
 *   - validateFederationUrl: rejects non-http, IP literals, IPv6
 *     literals, loopback (production), oversize URLs
 *   - parseTrustManifest: rejects missing fields, malformed peers
 *   - graphUniqueUrls: dedup + stable sort
 *   - crawlFederation: 1-hop + multi-hop + cycle detection +
 *     unreachable-peer survival + maxDepth + maxPeers limits
 */

import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  validateFederationUrl,
  parseTrustManifest,
  graphUniqueUrls,
  crawlFederation,
} from "../federation/discovery";

describe("normalizeUrl (pure)", () => {
  it("strips trailing slash from path", () => {
    expect(normalizeUrl("https://a.example.com/")).toBe(
      "https://a.example.com",
    );
  });

  it("lowercases the host", () => {
    expect(normalizeUrl("https://A.Example.COM/path")).toBe(
      "https://a.example.com/path",
    );
  });

  it("preserves the path", () => {
    expect(normalizeUrl("https://a.example.com/foo/bar")).toBe(
      "https://a.example.com/foo/bar",
    );
  });

  it("invalid URLs pass through unchanged", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
});

describe("validateFederationUrl (pure)", () => {
  it("accepts valid https URL", () => {
    const r = validateFederationUrl("https://sovereign-peer.example.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe("https://sovereign-peer.example.com");
  });

  it("rejects non-http(s) schemes", () => {
    const r = validateFederationUrl("file:///etc/passwd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("non_http_scheme");
  });

  it("rejects IPv4-literal hosts (SSRF defense)", () => {
    const r = validateFederationUrl("http://192.168.1.1/.well-known/sovereign-trust");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("ip_literal_host");
  });

  it("rejects IPv6-literal hosts", () => {
    const r = validateFederationUrl("https://[::1]/x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("ipv6_literal_host");
  });

  it("rejects localhost in production mode", () => {
    const r = validateFederationUrl("http://localhost:3000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("loopback_rejected");
  });

  it("permits localhost when allowLoopback=true (test mode)", () => {
    const r = validateFederationUrl("http://localhost:3000", {
      allowLoopback: true,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects oversize URLs", () => {
    const big = "https://" + "a".repeat(3000) + ".com";
    const r = validateFederationUrl(big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("url_too_long");
  });
});

describe("parseTrustManifest (pure)", () => {
  it("accepts a minimal valid manifest", () => {
    const r = parseTrustManifest({
      version: "v1",
      deploymentUrl: "https://a.example.com",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.version).toBe("v1");
      expect(r.manifest.federationPeers).toBeUndefined();
    }
  });

  it("preserves federationPeers when present", () => {
    const r = parseTrustManifest({
      version: "v1",
      deploymentUrl: "https://a.example.com",
      federationPeers: ["https://b.example.com", "https://c.example.com"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.federationPeers).toEqual([
        "https://b.example.com",
        "https://c.example.com",
      ]);
    }
  });

  it("rejects missing version", () => {
    const r = parseTrustManifest({ deploymentUrl: "https://a" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_version");
  });

  it("rejects missing deploymentUrl", () => {
    const r = parseTrustManifest({ version: "v1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_deployment_url");
  });

  it("rejects malformed peers (not an array)", () => {
    const r = parseTrustManifest({
      version: "v1",
      deploymentUrl: "https://a",
      federationPeers: "not-an-array",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("peers_not_array");
  });

  it("rejects malformed peers (non-string entries)", () => {
    const r = parseTrustManifest({
      version: "v1",
      deploymentUrl: "https://a",
      federationPeers: ["https://a", 42],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("peer_not_string");
  });

  it("forward-compat: ignores unknown fields", () => {
    const r = parseTrustManifest({
      version: "v1",
      deploymentUrl: "https://a",
      unknownField: "ignored",
      somethingFromV2: { nested: true },
    });
    expect(r.ok).toBe(true);
  });
});

describe("graphUniqueUrls (pure)", () => {
  it("dedups + sorts peer URLs", () => {
    const peers = [
      { url: "https://b", depth: 0, reachable: true, learnedFrom: "seed" },
      { url: "https://a", depth: 1, reachable: true, learnedFrom: "https://b" },
      { url: "https://b", depth: 2, reachable: true, learnedFrom: "https://a" }, // dup
    ];
    expect(graphUniqueUrls(peers)).toEqual(["https://a", "https://b"]);
  });

  it("stable across permutations of input order", () => {
    const a = [
      { url: "https://b", depth: 0, reachable: true, learnedFrom: "seed" },
      { url: "https://a", depth: 1, reachable: true, learnedFrom: "x" },
    ];
    const b = [
      { url: "https://a", depth: 1, reachable: true, learnedFrom: "x" },
      { url: "https://b", depth: 0, reachable: true, learnedFrom: "seed" },
    ];
    expect(graphUniqueUrls(a)).toEqual(graphUniqueUrls(b));
  });
});

describe("crawlFederation — single seed (no peers advertised)", () => {
  it("crawls one URL and reports it as reachable", async () => {
    const result = await crawlFederation({
      seedUrls: ["https://seed.example.com"],
      maxDepth: 3,
      maxPeers: 10,
      perFetchTimeoutMs: 1000,
      fetcher: async (_url) => ({
        version: "v1",
        deploymentUrl: "https://seed.example.com",
      }),
    });
    expect(result.totalCrawled).toBe(1);
    expect(result.totalReachable).toBe(1);
    expect(result.totalUnreachable).toBe(0);
  });
});

describe("crawlFederation — multi-hop discovery", () => {
  it("seed advertises 2 peers; crawler discovers all 3 nodes", async () => {
    const manifests: Record<string, unknown> = {
      "https://seed.example.com": {
        version: "v1",
        deploymentUrl: "https://seed.example.com",
        federationPeers: [
          "https://peer-a.example.com",
          "https://peer-b.example.com",
        ],
      },
      "https://peer-a.example.com": {
        version: "v1",
        deploymentUrl: "https://peer-a.example.com",
      },
      "https://peer-b.example.com": {
        version: "v1",
        deploymentUrl: "https://peer-b.example.com",
      },
    };
    const result = await crawlFederation({
      seedUrls: ["https://seed.example.com"],
      maxDepth: 3,
      maxPeers: 10,
      perFetchTimeoutMs: 1000,
      fetcher: async (url) => {
        const key = url.replace(/\/\.well-known\/sovereign-trust$/, "");
        const m = manifests[key];
        if (!m) throw new Error("404");
        return m;
      },
    });
    expect(result.totalCrawled).toBe(3);
    expect(result.totalReachable).toBe(3);
    expect(result.uniquePeerUrls).toContain("https://peer-a.example.com");
    expect(result.uniquePeerUrls).toContain("https://peer-b.example.com");
  });

  it("cycle: A → B → A is handled (no infinite loop)", async () => {
    const manifests: Record<string, unknown> = {
      "https://a.example.com": {
        version: "v1",
        deploymentUrl: "https://a.example.com",
        federationPeers: ["https://b.example.com"],
      },
      "https://b.example.com": {
        version: "v1",
        deploymentUrl: "https://b.example.com",
        federationPeers: ["https://a.example.com"], // back-edge
      },
    };
    const result = await crawlFederation({
      seedUrls: ["https://a.example.com"],
      maxDepth: 5,
      maxPeers: 10,
      perFetchTimeoutMs: 1000,
      fetcher: async (url) => {
        const key = url.replace(/\/\.well-known\/sovereign-trust$/, "");
        return manifests[key]!;
      },
    });
    // Only 2 unique nodes; no infinite loop.
    expect(result.totalCrawled).toBe(2);
  });

  it("unreachable peer doesn't halt the crawl", async () => {
    const manifests: Record<string, unknown> = {
      "https://seed.example.com": {
        version: "v1",
        deploymentUrl: "https://seed.example.com",
        federationPeers: [
          "https://reachable.example.com",
          "https://broken.example.com",
        ],
      },
      "https://reachable.example.com": {
        version: "v1",
        deploymentUrl: "https://reachable.example.com",
      },
    };
    const result = await crawlFederation({
      seedUrls: ["https://seed.example.com"],
      maxDepth: 3,
      maxPeers: 10,
      perFetchTimeoutMs: 1000,
      fetcher: async (url) => {
        const key = url.replace(/\/\.well-known\/sovereign-trust$/, "");
        const m = manifests[key];
        if (!m) throw new Error("connection refused");
        return m;
      },
    });
    expect(result.totalCrawled).toBe(3);
    expect(result.totalReachable).toBe(2);
    expect(result.totalUnreachable).toBe(1);
    const broken = result.peers.find((p) => p.url.includes("broken"));
    expect(broken?.errorReason).toContain("connection refused");
  });

  it("maxDepth bounds the crawl", async () => {
    const manifests: Record<string, unknown> = {
      "https://depth0.example.com": {
        version: "v1",
        deploymentUrl: "https://depth0.example.com",
        federationPeers: ["https://depth1.example.com"],
      },
      "https://depth1.example.com": {
        version: "v1",
        deploymentUrl: "https://depth1.example.com",
        federationPeers: ["https://depth2.example.com"],
      },
      "https://depth2.example.com": {
        version: "v1",
        deploymentUrl: "https://depth2.example.com",
      },
    };
    const result = await crawlFederation({
      seedUrls: ["https://depth0.example.com"],
      maxDepth: 1, // only 0 → 1 traversed
      maxPeers: 10,
      perFetchTimeoutMs: 1000,
      fetcher: async (url) => {
        const key = url.replace(/\/\.well-known\/sovereign-trust$/, "");
        return manifests[key] ?? Promise.reject(new Error("404"));
      },
    });
    expect(result.totalCrawled).toBe(2); // depth0 + depth1
    expect(result.hitMaxDepth).toBe(true);
  });

  it("maxPeers bounds the crawl", async () => {
    const manifests: Record<string, unknown> = {
      "https://hub.example.com": {
        version: "v1",
        deploymentUrl: "https://hub.example.com",
        federationPeers: [
          "https://p1.example.com",
          "https://p2.example.com",
          "https://p3.example.com",
          "https://p4.example.com",
        ],
      },
      "https://p1.example.com": { version: "v1", deploymentUrl: "https://p1.example.com" },
      "https://p2.example.com": { version: "v1", deploymentUrl: "https://p2.example.com" },
      "https://p3.example.com": { version: "v1", deploymentUrl: "https://p3.example.com" },
      "https://p4.example.com": { version: "v1", deploymentUrl: "https://p4.example.com" },
    };
    const result = await crawlFederation({
      seedUrls: ["https://hub.example.com"],
      maxDepth: 5,
      maxPeers: 2, // hub + 1 peer = 2
      perFetchTimeoutMs: 1000,
      fetcher: async (url) => {
        const key = url.replace(/\/\.well-known\/sovereign-trust$/, "");
        return manifests[key]!;
      },
    });
    expect(result.hitMaxPeers).toBe(true);
    expect(result.totalCrawled).toBeLessThanOrEqual(2);
  });

  it("rejectUrlPredicate blocks specific URLs (operator allowlist hook)", async () => {
    const manifests: Record<string, unknown> = {
      "https://seed.example.com": {
        version: "v1",
        deploymentUrl: "https://seed.example.com",
        federationPeers: [
          "https://allowed.example.com",
          "https://blocked.example.com",
        ],
      },
      "https://allowed.example.com": {
        version: "v1",
        deploymentUrl: "https://allowed.example.com",
      },
    };
    const result = await crawlFederation({
      seedUrls: ["https://seed.example.com"],
      maxDepth: 3,
      maxPeers: 10,
      perFetchTimeoutMs: 1000,
      rejectUrlPredicate: (url) => url.includes("blocked"),
      fetcher: async (url) => {
        const key = url.replace(/\/\.well-known\/sovereign-trust$/, "");
        return manifests[key] ?? Promise.reject(new Error("404"));
      },
    });
    expect(result.uniquePeerUrls).not.toContain("https://blocked.example.com");
    expect(result.uniquePeerUrls).toContain("https://allowed.example.com");
  });
});
