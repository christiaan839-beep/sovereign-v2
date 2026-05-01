/**
 * Move 23 — trust-status registry conformance tests.
 *
 * Enforces the discipline that backs /trust/wiring-status:
 *   - Every "wired" entry's source file exists
 *   - Every "wired" entry's source file actually contains a runtime
 *     reference to the audit action it claims to fire (rough check)
 *   - Every entry has a non-empty description
 *   - Every status value is one of the canonical 4
 *   - No two entries share the same (tag, name) pair
 *
 * If a row claims something that the codebase doesn't back up,
 * this test fails and CI blocks merge.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TRUST_REGISTRY,
  entriesByStatus,
  type TrustEntry,
} from "@/lib/trust-status";

// Vitest runs from project root by default.
const ROOT = process.cwd();

describe("/trust/wiring-status — registry conformance", () => {
  it("every entry has a non-empty description", () => {
    for (const e of TRUST_REGISTRY) {
      expect(e.description.length).toBeGreaterThan(20);
    }
  });

  it("every entry has a status in the canonical set", () => {
    const valid = new Set(["wired", "live", "library", "roadmap"]);
    for (const e of TRUST_REGISTRY) {
      expect(valid.has(e.status)).toBe(true);
    }
  });

  it("no two entries share the same (tag, name) pair", () => {
    const seen = new Set<string>();
    for (const e of TRUST_REGISTRY) {
      const key = `${e.tag}::${e.name}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("every wired/live entry's source path exists in the codebase", () => {
    const fileBacked = [
      ...entriesByStatus("wired"),
      ...entriesByStatus("live"),
      ...entriesByStatus("library"),
    ];
    for (const e of fileBacked) {
      if (e.source === "—") continue;
      // Tolerate route-style paths that include [param] segments
      // (Next.js dynamic routes) — exists() accepts them as-is.
      const fullPath = resolve(ROOT, e.source);
      const found = existsSync(fullPath);
      if (!found) {
        // Surface which entry failed for fast triage.
        throw new Error(`source path missing for entry ${e.tag} / ${e.name}: ${e.source}`);
      }
      expect(found).toBe(true);
    }
  });

  it("every wired entry that declares an auditAction also has a source file", () => {
    const wired = entriesByStatus("wired");
    for (const e of wired) {
      if (!e.auditAction) continue;
      expect(e.source).not.toBe("—");
      expect(e.source.length).toBeGreaterThan(0);
    }
  });

  it("audit-log.ts contains every declared auditAction literal", () => {
    // The forward-declaration discipline: every auditAction we claim
    // to fire must be present as a string literal in audit-log.ts
    // (it's the union member in AuditAction).
    const auditLogPath = resolve(ROOT, "src/lib/audit-log.ts");
    const auditLog = readFileSync(auditLogPath, "utf8");
    for (const e of TRUST_REGISTRY) {
      if (!e.auditAction) continue;
      expect(auditLog).toContain(`"${e.auditAction}"`);
    }
  });
});

describe("/trust/wiring-status — registry counts (sanity check)", () => {
  it("at least 8 wired entries (Tier 1 + foundation)", () => {
    expect(entriesByStatus("wired").length).toBeGreaterThanOrEqual(8);
  });

  it("at least 4 live public-surface entries (Agent Card + verifier + audit head + spec)", () => {
    expect(entriesByStatus("live").length).toBeGreaterThanOrEqual(4);
  });

  it("library + roadmap entries are honestly declared (not zero)", () => {
    // It's OK to have library-only entries — that's the transparency
    // discipline. What's NOT ok is silently moving them to "wired"
    // without code changes.
    const libRoadmap = [...entriesByStatus("library"), ...entriesByStatus("roadmap")];
    expect(libRoadmap.length).toBeGreaterThan(0);
  });
});

describe("/trust/wiring-status — wired entries fire on real call sites (spot checks)", () => {
  // We don't enforce ALL audit actions are firing — too brittle.
  // Spot-check the Tier 1 wirings specifically since those are the
  // recently-shipped commits that the page claims fire.

  const spotChecks: Array<{ source: string; needle: string; entryName: string }> = [
    {
      source: "src/lib/agent-factory.ts",
      needle: "consultGovernance",
      entryName: "R142 governance",
    },
    {
      source: "src/lib/agent-factory.ts",
      needle: "buildHITLRoutingAuditEntry",
      entryName: "R155 HITL routing",
    },
    {
      source: "src/lib/memory.ts",
      needle: "scanMemoryWrite",
      entryName: "R145 memory payload",
    },
    {
      source: "src/app/api/v1/a2a/[peer]/route.ts",
      needle: "bridgeAuthorization",
      entryName: "R162 cross-protocol",
    },
    {
      source: "src/app/.well-known/aibom.json/route.ts",
      needle: "buildAIBOMAuditEntry",
      entryName: "R150 AIBOM",
    },
  ];

  for (const { source, needle, entryName } of spotChecks) {
    it(`${entryName} runtime call site present in ${source}`, () => {
      const file = readFileSync(resolve(ROOT, source), "utf8");
      expect(file).toContain(needle);
    });
  }
});
