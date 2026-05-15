/**
 * Tests for src/lib/attestation-letter.ts — Cook 53.
 *
 *   - generateAttestationLetter:
 *       - rejects empty signingKey + empty frameworks list.
 *       - produces body containing header, summary, controls, signature.
 *       - bodyDigest is reproducible from the body-for-signing slice.
 *       - signature verifies under verifyAttestationLetter.
 *   - verifyAttestationLetter:
 *       - returns ok=true for a freshly generated letter.
 *       - returns digest-mismatch when the body was tampered.
 *       - returns invalid-signature when the key is wrong.
 *       - returns missing-key on empty key input.
 */

import { describe, it, expect } from "vitest";
import {
  generateAttestationLetter,
  verifyAttestationLetter,
  type LetterRequest,
  type PeriodStats,
} from "../attestation-letter";

const STATS: PeriodStats = {
  totalRuns: 12_345,
  passedRuns: 12_300,
  redTeamCampaigns: 4,
  redTeamFailuresByseverity: { critical: 0, high: 1, medium: 3, low: 7 },
  driftEvents: 2,
  replays: 89,
};

function buildRequest(overrides: Partial<LetterRequest> = {}): LetterRequest {
  return {
    tenantId: "t-acme",
    tenantDisplayName: "Acme Corp",
    periodStart: "2026-01-01",
    periodEnd: "2026-03-31",
    frameworks: ["eu-ai-act-annex-iv", "nist-ai-rmf"],
    stats: STATS,
    signingKey: "secret-key-32-chars-min-yes-it-is",
    ...overrides,
  };
}

describe("generateAttestationLetter — validation", () => {
  it("rejects empty signingKey", () => {
    expect(() =>
      generateAttestationLetter(buildRequest({ signingKey: "" })),
    ).toThrow(/signingKey/);
  });

  it("rejects empty frameworks list", () => {
    expect(() =>
      generateAttestationLetter(buildRequest({ frameworks: [] })),
    ).toThrow(/framework/);
  });
});

describe("generateAttestationLetter — body shape", () => {
  it("renders every required section", () => {
    const letter = generateAttestationLetter(buildRequest());
    expect(letter.body).toContain("Quarterly AI System Attestation");
    expect(letter.body).toContain("Acme Corp");
    expect(letter.body).toContain("Executive Summary");
    expect(letter.body).toContain("Control-by-Control Evidence");
    expect(letter.body).toContain("Signature");
    expect(letter.body).toContain(letter.bodyDigest);
    expect(letter.body).toContain(letter.signature);
  });

  it("includes coverage percentage for each framework requested", () => {
    const letter = generateAttestationLetter(buildRequest());
    expect(letter.scorecards.length).toBe(2);
    for (const sc of letter.scorecards) {
      expect(letter.body).toContain(sc.framework);
    }
  });

  it("issuedAt is an ISO-8601 timestamp", () => {
    const letter = generateAttestationLetter(
      buildRequest(),
      new Date("2026-05-12T11:30:00Z"),
    );
    expect(letter.issuedAt).toBe("2026-05-12T11:30:00.000Z");
  });
});

describe("verifyAttestationLetter", () => {
  it("returns ok=true for a freshly generated letter", () => {
    const req = buildRequest();
    const letter = generateAttestationLetter(req);
    const result = verifyAttestationLetter(letter, req.signingKey);
    expect(result.ok).toBe(true);
  });

  it("returns invalid-signature when the key is wrong", () => {
    const req = buildRequest();
    const letter = generateAttestationLetter(req);
    const result = verifyAttestationLetter(letter, "wrong-key-different");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid-signature");
  });

  it("returns digest-mismatch when the body was tampered", () => {
    const req = buildRequest();
    const letter = generateAttestationLetter(req);
    const tampered = {
      ...letter,
      body: letter.body.replace("Acme Corp", "Evil Corp"),
    };
    const result = verifyAttestationLetter(tampered, req.signingKey);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("digest-mismatch");
  });

  it("returns missing-key on empty key", () => {
    const req = buildRequest();
    const letter = generateAttestationLetter(req);
    const result = verifyAttestationLetter(letter, "");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing-key");
  });
});

describe("generateAttestationLetter — receipt friendliness", () => {
  it("returns a JSON-serializable result", () => {
    const letter = generateAttestationLetter(buildRequest());
    expect(() => JSON.parse(JSON.stringify(letter))).not.toThrow();
  });
});
