/**
 * Tests for src/lib/data-residency.ts — Cook 119.
 */

import { describe, it, expect } from "vitest";
import {
  POLICY_PRESETS,
  pickProvider,
  tagRun,
  type ProviderZone,
  type ResidencyPolicy,
} from "../data-residency";

const PROVIDERS: ProviderZone[] = [
  { providerId: "nim-us", zone: "us" },
  { providerId: "anthropic-eu", zone: "eu" },
  { providerId: "anthropic-us", zone: "us" },
];

describe("pickProvider — storage gate", () => {
  it("rejects when tenant storage zone not in policy.storage", () => {
    const d = pickProvider(POLICY_PRESETS["eu-strict"], PROVIDERS, "us");
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("storage-zone-disallowed");
  });
});

describe("pickProvider — processing gate", () => {
  it("picks first eligible provider in allowed zone", () => {
    const d = pickProvider(POLICY_PRESETS["eu-strict"], PROVIDERS, "eu");
    expect(d.allowed).toBe(true);
    expect(d.chosenProvider?.providerId).toBe("anthropic-eu");
  });

  it("returns no-eligible-provider when no zone matches", () => {
    const policy: ResidencyPolicy = {
      storage: ["us"],
      processing: ["in"],
      redactPiiOnCrossZone: false,
    };
    const d = pickProvider(policy, PROVIDERS, "us");
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("no-eligible-provider");
  });

  it("falls back to global when processing includes 'global' and no specific match", () => {
    const policy: ResidencyPolicy = {
      storage: ["us"],
      processing: ["in", "global"],
      redactPiiOnCrossZone: false,
    };
    const d = pickProvider(policy, PROVIDERS, "us");
    expect(d.allowed).toBe(true);
  });
});

describe("pickProvider — redact-on-cross-zone", () => {
  it("flags mustRedact=true when provider zone differs from storage zone", () => {
    const policy: ResidencyPolicy = {
      storage: ["eu"],
      processing: ["us", "eu"],
      redactPiiOnCrossZone: true,
    };
    // Available is ordered nim-us first → cross-zone.
    const d = pickProvider(policy, PROVIDERS, "eu");
    expect(d.allowed).toBe(true);
    expect(d.mustRedact).toBe(true);
  });

  it("flags mustRedact=false when redactPiiOnCrossZone is disabled", () => {
    const policy: ResidencyPolicy = {
      storage: ["eu"],
      processing: ["us", "eu"],
      redactPiiOnCrossZone: false,
    };
    const d = pickProvider(policy, PROVIDERS, "eu");
    expect(d.mustRedact).toBe(false);
  });

  it("flags mustRedact=false when in-zone provider chosen", () => {
    const eu = [
      { providerId: "anthropic-eu", zone: "eu" as const },
      { providerId: "nim-us", zone: "us" as const },
    ];
    const d = pickProvider(POLICY_PRESETS["eu-strict"], eu, "eu");
    expect(d.mustRedact).toBe(false);
  });
});

describe("tagRun", () => {
  it("captures cross-zone flag + redaction state", () => {
    const decision = pickProvider(
      POLICY_PRESETS["uk-strict"],
      [{ providerId: "anthropic-eu", zone: "eu" }],
      "uk",
    );
    const tag = tagRun(decision, "uk", "uk-strict");
    expect(tag.providerZone).toBe("eu");
    expect(tag.tenantStorageZone).toBe("uk");
    expect(tag.crossZone).toBe(true);
    expect(tag.policyName).toBe("uk-strict");
  });
});

describe("POLICY_PRESETS", () => {
  it("includes the four core regional + global presets", () => {
    expect(POLICY_PRESETS).toHaveProperty("eu-strict");
    expect(POLICY_PRESETS).toHaveProperty("us-strict");
    expect(POLICY_PRESETS).toHaveProperty("uk-strict");
    expect(POLICY_PRESETS).toHaveProperty("in-strict");
    expect(POLICY_PRESETS).toHaveProperty("global-relaxed");
  });

  it("eu-strict refuses to route to us providers", () => {
    const d = pickProvider(POLICY_PRESETS["eu-strict"], PROVIDERS, "eu");
    expect(d.chosenProvider?.zone).toBe("eu");
  });
});
