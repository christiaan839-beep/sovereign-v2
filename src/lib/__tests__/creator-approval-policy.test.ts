/**
 * Unit tests for creator-approval-policy.
 *
 * Every strategy is exercised in isolation. The env-var resolver is
 * tested against valid, invalid, and missing inputs to confirm the
 * `curated` default is truly unconditional.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activePolicyName,
  evaluateSubmission,
  getStrategy,
  type CreatorContext,
  type ManifestContext,
} from "../creator-approval-policy";

const manifest: ManifestContext = {
  slug: "extract-invoice",
  displayName: "Invoice Extractor",
  category: "Finance",
  pricingCents: 5,
};

const newCreator: CreatorContext = {
  contactEmail: "new@example.com",
  priorApprovedCount: 0,
};

const returningCreator: CreatorContext = {
  contactEmail: "veteran@example.com",
  priorApprovedCount: 3,
};

/* ─── activePolicyName ─────────────────────────────────────────── */

describe("activePolicyName()", () => {
  const ORIGINAL = process.env.SOVEREIGN_APPROVAL_POLICY;

  beforeEach(() => {
    delete process.env.SOVEREIGN_APPROVAL_POLICY;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.SOVEREIGN_APPROVAL_POLICY;
    } else {
      process.env.SOVEREIGN_APPROVAL_POLICY = ORIGINAL;
    }
  });

  it("defaults to 'curated' when env var is unset", () => {
    expect(activePolicyName()).toBe("curated");
  });

  it("defaults to 'curated' when env var is an empty string", () => {
    process.env.SOVEREIGN_APPROVAL_POLICY = "";
    expect(activePolicyName()).toBe("curated");
  });

  it("defaults to 'curated' when env var is an unknown value", () => {
    process.env.SOVEREIGN_APPROVAL_POLICY = "wild-west";
    expect(activePolicyName()).toBe("curated");
  });

  it("returns 'open' when env is 'open'", () => {
    process.env.SOVEREIGN_APPROVAL_POLICY = "open";
    expect(activePolicyName()).toBe("open");
  });

  it("returns 'curated' when env is 'curated'", () => {
    process.env.SOVEREIGN_APPROVAL_POLICY = "curated";
    expect(activePolicyName()).toBe("curated");
  });

  it("returns 'trust-tiered' when env is 'trust-tiered'", () => {
    process.env.SOVEREIGN_APPROVAL_POLICY = "trust-tiered";
    expect(activePolicyName()).toBe("trust-tiered");
  });
});

/* ─── open strategy ────────────────────────────────────────────── */

describe("strategy: open", () => {
  it("auto-publishes a new creator's submission", () => {
    const d = getStrategy("open").evaluate(manifest, newCreator);
    expect(d.outcome).toBe("auto-publish");
    expect(d.policy).toBe("open");
    expect(d.reason).toContain("all SAM-valid manifests");
  });

  it("auto-publishes a returning creator's submission", () => {
    const d = getStrategy("open").evaluate(manifest, returningCreator);
    expect(d.outcome).toBe("auto-publish");
  });
});

/* ─── curated strategy ─────────────────────────────────────────── */

describe("strategy: curated", () => {
  it("queues a new creator's submission", () => {
    const d = getStrategy("curated").evaluate(manifest, newCreator);
    expect(d.outcome).toBe("queue");
    expect(d.policy).toBe("curated");
    expect(d.reason).toContain("operator review");
  });

  it("queues a returning creator's submission (ignores prior approvals)", () => {
    const d = getStrategy("curated").evaluate(manifest, returningCreator);
    expect(d.outcome).toBe("queue");
  });
});

/* ─── trust-tiered strategy ────────────────────────────────────── */

describe("strategy: trust-tiered", () => {
  it("queues a first-time creator (priorApprovedCount === 0)", () => {
    const d = getStrategy("trust-tiered").evaluate(manifest, newCreator);
    expect(d.outcome).toBe("queue");
    expect(d.policy).toBe("trust-tiered");
    expect(d.reason).toContain("first submission");
  });

  it("queues a creator whose prior count is negative (defensive)", () => {
    // Should not happen in practice but guards against a bad query.
    const d = getStrategy("trust-tiered").evaluate(manifest, {
      contactEmail: "a@b.com",
      priorApprovedCount: -1,
    });
    expect(d.outcome).toBe("queue");
  });

  it("auto-publishes a creator with 1 prior approval", () => {
    const d = getStrategy("trust-tiered").evaluate(manifest, {
      contactEmail: "a@b.com",
      priorApprovedCount: 1,
    });
    expect(d.outcome).toBe("auto-publish");
    expect(d.reason).toContain("1 prior approval");
  });

  it("auto-publishes a creator with many prior approvals", () => {
    const d = getStrategy("trust-tiered").evaluate(manifest, returningCreator);
    expect(d.outcome).toBe("auto-publish");
    expect(d.reason).toContain("3 prior approval");
  });
});

/* ─── evaluateSubmission integration ───────────────────────────── */

describe("evaluateSubmission()", () => {
  const ORIGINAL = process.env.SOVEREIGN_APPROVAL_POLICY;

  beforeEach(() => {
    delete process.env.SOVEREIGN_APPROVAL_POLICY;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.SOVEREIGN_APPROVAL_POLICY;
    } else {
      process.env.SOVEREIGN_APPROVAL_POLICY = ORIGINAL;
    }
  });

  it("uses the curated default when env is unset", () => {
    const d = evaluateSubmission(manifest, newCreator);
    expect(d.policy).toBe("curated");
    expect(d.outcome).toBe("queue");
  });

  it("follows env var when set to 'open'", () => {
    process.env.SOVEREIGN_APPROVAL_POLICY = "open";
    const d = evaluateSubmission(manifest, newCreator);
    expect(d.policy).toBe("open");
    expect(d.outcome).toBe("auto-publish");
  });

  it("follows env var when set to 'trust-tiered' with new creator", () => {
    process.env.SOVEREIGN_APPROVAL_POLICY = "trust-tiered";
    const d = evaluateSubmission(manifest, newCreator);
    expect(d.policy).toBe("trust-tiered");
    expect(d.outcome).toBe("queue");
  });

  it("follows env var when set to 'trust-tiered' with returning creator", () => {
    process.env.SOVEREIGN_APPROVAL_POLICY = "trust-tiered";
    const d = evaluateSubmission(manifest, returningCreator);
    expect(d.policy).toBe("trust-tiered");
    expect(d.outcome).toBe("auto-publish");
  });

  it("honors the explicit override parameter (bypasses env entirely)", () => {
    process.env.SOVEREIGN_APPROVAL_POLICY = "open";
    const d = evaluateSubmission(manifest, newCreator, "curated");
    expect(d.policy).toBe("curated");
    expect(d.outcome).toBe("queue");
  });
});

/* ─── getStrategy error surface ────────────────────────────────── */

describe("getStrategy()", () => {
  it("throws on unknown policy name (programmer error)", () => {
    // @ts-expect-error -- intentional invalid input
    expect(() => getStrategy("rogue")).toThrow(/Unknown approval policy/);
  });
});
