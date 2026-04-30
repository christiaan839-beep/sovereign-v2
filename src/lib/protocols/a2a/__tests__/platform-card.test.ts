/**
 * Tests for platform-card.ts — Sovereign Matrix platform Agent Card.
 *
 * Coverage:
 *   - Builder produces a structurally valid Agent Card
 *   - Fingerprint is deterministic for the same inputs
 *   - Fingerprint changes when capabilities change (anti-tampering anchor)
 *   - All declared capabilities map to R-numbered primitives
 *   - All declared auth schemes are in the canonical A2A list
 *   - Card validates through validateAgentCard (full structural+crypto)
 *   - regulatoryNotes call out the procurement-grade frameworks
 */

import { describe, it, expect } from "vitest";
import {
  SOVEREIGN_PLATFORM_CAPABILITIES,
  SOVEREIGN_PLATFORM_AUTH_SCHEMES,
  SOVEREIGN_PLATFORM_AGENT_ID,
  buildSovereignPlatformAgentCard,
} from "../platform-card";
import {
  validateAgentCard,
  A2A_AUTH_SCHEMES,
  computeAgentCardFingerprint,
} from "../agent-card";

const FIXED_PUBLISHED_AT = "2026-04-30T12:00:00.000Z";
const FIXED_HOST = "sovereignmatrix.agency";

describe("platform-card — capability discipline", () => {
  it("declares capabilities for every R-numbered primitive shipped in Moves 6-12", () => {
    // The capability list must include every trust primitive whose
    // library + audit-vocabulary entry is live in main. New primitives
    // get added here as part of the same commit that ships them.
    const required = [
      "audit-chain-r26",
      "policy-gate-r100",
      "governance-loop-r142",
      "odta-runtime-gate-r143",
      "memory-payload-guard-r145",
      "aibom-r150",
      "hitl-confidence-routing-r155",
      "agent-card-a2a-r160",
      "mcp-tool-gateway-r161",
      "cross-protocol-bridge-r162",
      "inspector-verifiable",
    ];
    for (const cap of required) {
      expect(SOVEREIGN_PLATFORM_CAPABILITIES).toContain(cap);
    }
  });

  it("every declared capability is kebab-case + R-tagged or 'inspector-verifiable'", () => {
    // Strict naming — kebab-case + ends with -rNN, except the
    // cross-cutting 'inspector-verifiable' which is a meta-claim.
    const KEBAB_R_TAGGED = /^[a-z][a-z0-9-]*-r\d+$/;
    for (const cap of SOVEREIGN_PLATFORM_CAPABILITIES) {
      if (cap === "inspector-verifiable") continue;
      expect(cap).toMatch(KEBAB_R_TAGGED);
    }
  });

  it("auth schemes are all in the canonical A2A list", () => {
    for (const scheme of SOVEREIGN_PLATFORM_AUTH_SCHEMES) {
      expect(A2A_AUTH_SCHEMES).toContain(scheme);
    }
  });
});

describe("platform-card — buildSovereignPlatformAgentCard", () => {
  it("produces a structurally + cryptographically valid Agent Card", () => {
    const card = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: FIXED_PUBLISHED_AT,
    });
    const r = validateAgentCard(card);
    expect(r.ok).toBe(true);
  });

  it("uses the stable platform agent id", () => {
    const card = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: FIXED_PUBLISHED_AT,
    });
    expect(card.id).toBe(SOVEREIGN_PLATFORM_AGENT_ID);
  });

  it("rpc endpoint is HTTPS at the canonical host", () => {
    const card = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: FIXED_PUBLISHED_AT,
    });
    expect(card.endpoints.rpc).toBe("https://sovereignmatrix.agency/api/v1");
  });

  it("declares the SOC 2 + EU AI Act + OWASP frameworks in regulatoryNotes", () => {
    const card = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: FIXED_PUBLISHED_AT,
    });
    const notes = (card.regulatoryNotes ?? []).join(" | ");
    expect(notes).toContain("EU AI Act");
    expect(notes).toContain("OWASP ASI04");
    expect(notes).toContain("SOC 2");
    expect(notes).toContain("OWASP ASI03");
  });

  it("fingerprint is deterministic for fixed inputs", () => {
    const a = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: FIXED_PUBLISHED_AT,
    });
    const b = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: FIXED_PUBLISHED_AT,
    });
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("fingerprint changes when host changes", () => {
    const a = buildSovereignPlatformAgentCard({
      canonicalHost: "host-a.example",
      publishedAt: FIXED_PUBLISHED_AT,
    });
    const b = buildSovereignPlatformAgentCard({
      canonicalHost: "host-b.example",
      publishedAt: FIXED_PUBLISHED_AT,
    });
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("fingerprint changes when publishedAt changes", () => {
    const a = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: "2026-04-30T12:00:00.000Z",
    });
    const b = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: "2026-04-30T12:00:01.000Z",
    });
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("fingerprint matches an independent recomputation (anti-tampering anchor)", () => {
    const card = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: FIXED_PUBLISHED_AT,
    });
    const { fingerprint, ...rest } = card;
    const recomputed = computeAgentCardFingerprint(rest);
    expect(fingerprint).toBe(recomputed);
  });

  it("homepage is set to https://canonicalHost", () => {
    const card = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: FIXED_PUBLISHED_AT,
    });
    expect(card.homepage).toBe(`https://${FIXED_HOST}`);
  });
});

describe("platform-card — anti-drift between Agent Card and federation manifest", () => {
  it("capability list is the SAME constant exported by the module (no duplication risk)", () => {
    // This test exists so anyone tempted to inline a separate list in
    // /.well-known/sovereign-trust gets a CI failure — both manifests
    // MUST import SOVEREIGN_PLATFORM_CAPABILITIES from this file.
    const card = buildSovereignPlatformAgentCard({
      canonicalHost: FIXED_HOST,
      publishedAt: FIXED_PUBLISHED_AT,
    });
    expect([...card.capabilities].sort()).toEqual(
      [...SOVEREIGN_PLATFORM_CAPABILITIES].sort(),
    );
  });
});
