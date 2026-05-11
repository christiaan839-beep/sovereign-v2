/**
 * Tests for the retry endpoint side of the packet store + the .strict()
 * defense added in commit 32cfd25.
 *
 * Covers:
 *   - .strict() rejects unknown keys on every packet schema (closes
 *     security-review-2026-05 MEDIUM-4)
 *   - Schema enforces shape but tolerates known optional fields
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: () => () => new Response("noop"),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));
vi.mock("@/lib/ai", () => ({
  ai: vi.fn(),
  research_ai: vi.fn(),
}));
vi.mock("@/lib/packet-store", () => ({ savePacket: vi.fn() }));

import { agencyPacketSchema } from "@/app/api/_agents/agency-packet/route";
import { sourcingSprintSchema } from "@/app/api/_agents/sourcing-sprint/route";
import { growthPulseSchema } from "@/app/api/_agents/growth-pulse/route";
import { listingPulseSchema } from "@/app/api/_agents/listing-pulse/route";

const VALID_AGENCY = {
  clientName: "Acme",
  clientDomain: "acme.com",
  clientDescription: "Acme builds applicant-tracking software for HR teams.",
  audience: "HR leaders",
  brandVoice: "professional",
  primaryKeywords: [],
};

const VALID_SOURCING = {
  roleTitle: "Senior Engineer",
  companyName: "Acme",
  companyDescription: "Acme builds ATS software for mid-market HR teams.",
  mustHaveSkills: ["Go"],
  seniorityLevel: "senior",
  urgency: "perfect-fit",
};

const VALID_GROWTH = {
  businessName: "Ndlovu Hair",
  businessDescription: "Sea Point salon serving working professionals.",
  industry: "salon",
  locale: "ZA",
  topServices: ["braids"],
  brandVoice: "warm",
};

const VALID_LISTING = {
  propertyAddress: "12 Beach Road",
  suburb: "Sea Point",
  priceLabel: "R3 950 000",
  currency: "ZAR",
  propertyType: "apartment",
  bedrooms: 3,
  bathrooms: 2,
  keyFeatures: ["north-facing"],
  agentName: "Lerato",
  brandVoice: "warm",
};

// ── .strict() defense (security-review-2026-05 MEDIUM-4) ────────────

describe("packet schemas .strict() — reject unknown keys", () => {
  it("agency-packet rejects unknown top-level key", () => {
    expect(() =>
      agencyPacketSchema.parse({ ...VALID_AGENCY, _evil: "x" }),
    ).toThrow(/unrecognized/i);
  });

  it("sourcing-sprint rejects unknown top-level key", () => {
    expect(() =>
      sourcingSprintSchema.parse({ ...VALID_SOURCING, __proto__: { x: 1 } }),
    ).toThrow(/unrecognized/i);
  });

  it("growth-pulse rejects unknown top-level key", () => {
    expect(() =>
      growthPulseSchema.parse({ ...VALID_GROWTH, secretAdminMode: true }),
    ).toThrow(/unrecognized/i);
  });

  it("listing-pulse rejects unknown top-level key", () => {
    expect(() =>
      listingPulseSchema.parse({ ...VALID_LISTING, _meta: "evil" }),
    ).toThrow(/unrecognized/i);
  });

  it("agency-packet still accepts the documented optional competitorUrl", () => {
    expect(() =>
      agencyPacketSchema.parse({
        ...VALID_AGENCY,
        competitorUrl: "https://hubspot.com",
      }),
    ).not.toThrow();
  });

  it("growth-pulse still accepts the documented optional websiteUrl", () => {
    expect(() =>
      growthPulseSchema.parse({
        ...VALID_GROWTH,
        websiteUrl: "https://example.com",
      }),
    ).not.toThrow();
  });
});

// ── SSRF guard (security-review-2026-05 HIGH-2) ────────────────────

describe("packet schemas SSRF allowlist", () => {
  it("agency-packet rejects file:// competitorUrl", () => {
    expect(() =>
      agencyPacketSchema.parse({
        ...VALID_AGENCY,
        competitorUrl: "file:///etc/passwd",
      }),
    ).toThrow();
  });

  it("agency-packet rejects localhost competitorUrl", () => {
    expect(() =>
      agencyPacketSchema.parse({
        ...VALID_AGENCY,
        competitorUrl: "http://localhost:9000/admin",
      }),
    ).toThrow();
  });

  it("agency-packet rejects cloud-metadata IP competitorUrl", () => {
    expect(() =>
      agencyPacketSchema.parse({
        ...VALID_AGENCY,
        competitorUrl: "http://169.254.169.254/latest/meta-data",
      }),
    ).toThrow();
  });

  it("agency-packet rejects RFC-1918 IP competitorUrl", () => {
    expect(() =>
      agencyPacketSchema.parse({
        ...VALID_AGENCY,
        competitorUrl: "http://10.0.0.1/internal",
      }),
    ).toThrow();
  });

  it("growth-pulse rejects localhost websiteUrl", () => {
    expect(() =>
      growthPulseSchema.parse({
        ...VALID_GROWTH,
        websiteUrl: "http://localhost/",
      }),
    ).toThrow();
  });

  it("growth-pulse rejects link-local websiteUrl", () => {
    expect(() =>
      growthPulseSchema.parse({
        ...VALID_GROWTH,
        websiteUrl: "http://169.254.169.254/",
      }),
    ).toThrow();
  });

  it("growth-pulse accepts valid public https websiteUrl", () => {
    expect(() =>
      growthPulseSchema.parse({
        ...VALID_GROWTH,
        websiteUrl: "https://example.com/about",
      }),
    ).not.toThrow();
  });
});
