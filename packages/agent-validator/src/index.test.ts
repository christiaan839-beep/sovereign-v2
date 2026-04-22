/**
 * Tests for @sovereignmatrix/agent-validator.
 *
 * These tests ARE the spec in executable form — they guard the 9
 * required fields, kebab-case slug, 140-char purpose limit, the 18
 * official categories, SemVer versions, and the guarantee-array floor.
 * Any change in behavior must pass this suite.
 */

import { describe, it, expect } from "vitest";
import { validate, validateJson, SAM_V1_SCHEMA, SUPPORTED_SAM_VERSION } from "./index";

/** A valid minimal manifest — reused across tests. */
const VALID_MINIMAL = {
  sam: "1.0",
  slug: "extract-invoice",
  displayName: "Invoice Extractor",
  purpose: "Extract structured data from invoice text",
  category: "Finance",
  version: "1.0.0",
  inputs: [],
  output: { type: "object" },
  guarantees: ["Never fabricates missing fields"],
};

describe("validate — happy paths", () => {
  it("accepts a minimal valid manifest", () => {
    const result = validate(VALID_MINIMAL);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.samVersion).toBe("1.0");
  });

  it("accepts optional fields when well-formed", () => {
    const extended = {
      ...VALID_MINIMAL,
      pricing: { cents: 5, tier: "basic" },
      safety: { trustTier: "autonomous" },
      model: "claude",
      tags: ["finance", "ap"],
      extensions: { "sovereign.memory": { enabled: true } },
    };
    expect(validate(extended).valid).toBe(true);
  });

  it("accepts SemVer pre-release versions", () => {
    const withPreRelease = { ...VALID_MINIMAL, version: "2.1.3-beta.1" };
    expect(validate(withPreRelease).valid).toBe(true);
  });

  it("SUPPORTED_SAM_VERSION reflects the spec const", () => {
    expect(SUPPORTED_SAM_VERSION).toBe("1.0");
    expect(SAM_V1_SCHEMA.properties.sam.const).toBe("1.0");
  });
});

describe("validate — missing required fields", () => {
  it("reports every missing required field in one pass (not short-circuit)", () => {
    const result = validate({ sam: "1.0" });
    expect(result.valid).toBe(false);
    // Should find 8 missing (slug, displayName, purpose, category, version,
    // inputs, output, guarantees — sam is present).
    const missing = result.errors.filter((e) => e.code === "missing_required");
    expect(missing.length).toBe(8);
  });

  it("flags missing slug", () => {
    const { slug: _unused, ...rest } = VALID_MINIMAL;
    const result = validate(rest);
    expect(result.errors.find((e) => e.path === "/slug" && e.code === "missing_required"))
      .toBeDefined();
  });
});

describe("validate — type mismatches", () => {
  it("rejects non-object root (array)", () => {
    expect(validate([]).valid).toBe(false);
  });

  it("rejects non-object root (null)", () => {
    expect(validate(null).valid).toBe(false);
  });

  it("rejects non-object root (primitive)", () => {
    expect(validate("just a string").valid).toBe(false);
  });

  it("rejects non-string slug", () => {
    const bad = { ...VALID_MINIMAL, slug: 123 as unknown as string };
    const e = validate(bad).errors.find((x) => x.path === "/slug");
    expect(e?.code).toBe("type_mismatch");
  });

  it("rejects non-array guarantees", () => {
    const bad = { ...VALID_MINIMAL, guarantees: "just a string" as unknown as string[] };
    const e = validate(bad).errors.find((x) => x.path === "/guarantees");
    expect(e?.code).toBe("type_mismatch");
  });
});

describe("validate — const, pattern, enum, length", () => {
  it("rejects sam !== '1.0'", () => {
    const e = validate({ ...VALID_MINIMAL, sam: "0.9" }).errors.find((x) => x.path === "/sam");
    expect(e?.code).toBe("const_mismatch");
  });

  it("rejects non-kebab slugs", () => {
    const bad = { ...VALID_MINIMAL, slug: "NotKebab" };
    const e = validate(bad).errors.find((x) => x.path === "/slug");
    expect(e?.code).toBe("pattern_mismatch");
  });

  it("rejects slug starting with digit", () => {
    const bad = { ...VALID_MINIMAL, slug: "4-agent" };
    expect(validate(bad).valid).toBe(false);
  });

  it("rejects slug below 3 chars", () => {
    const bad = { ...VALID_MINIMAL, slug: "ab" };
    expect(validate(bad).valid).toBe(false);
  });

  it("rejects category not in the 18-enum", () => {
    const bad = { ...VALID_MINIMAL, category: "Miscellaneous" };
    const e = validate(bad).errors.find((x) => x.path === "/category");
    expect(e?.code).toBe("enum_mismatch");
  });

  it("rejects purpose over 140 chars", () => {
    const bad = { ...VALID_MINIMAL, purpose: "x".repeat(141) };
    const e = validate(bad).errors.find((x) => x.path === "/purpose");
    expect(e?.code).toBe("length_out_of_range");
  });

  it("rejects displayName over 60 chars", () => {
    const bad = { ...VALID_MINIMAL, displayName: "x".repeat(61) };
    const e = validate(bad).errors.find((x) => x.path === "/displayName");
    expect(e?.code).toBe("length_out_of_range");
  });

  it("rejects non-SemVer version", () => {
    const bad = { ...VALID_MINIMAL, version: "v1.0" };
    const e = validate(bad).errors.find((x) => x.path === "/version");
    expect(e?.code).toBe("pattern_mismatch");
  });

  it("rejects empty guarantees array", () => {
    const bad = { ...VALID_MINIMAL, guarantees: [] };
    const e = validate(bad).errors.find((x) => x.path === "/guarantees");
    expect(e?.code).toBe("array_empty");
  });

  it("rejects guarantee under 10 chars", () => {
    const bad = { ...VALID_MINIMAL, guarantees: ["short"] };
    const e = validate(bad).errors.find((x) => x.path === "/guarantees/0");
    expect(e?.code).toBe("length_out_of_range");
  });

  it("rejects guarantee over 300 chars", () => {
    const bad = { ...VALID_MINIMAL, guarantees: ["x".repeat(301)] };
    const e = validate(bad).errors.find((x) => x.path === "/guarantees/0");
    expect(e?.code).toBe("length_out_of_range");
  });
});

describe("validate — additional properties", () => {
  it("rejects unknown top-level properties (extensions namespace only)", () => {
    const bad = { ...VALID_MINIMAL, customField: "reject" };
    const e = validate(bad).errors.find((x) => x.path === "/customField");
    expect(e?.code).toBe("additional_property");
  });

  it("accepts the extensions bag for custom fields", () => {
    const withExtension = { ...VALID_MINIMAL, extensions: { "acme.field": "ok" } };
    expect(validate(withExtension).valid).toBe(true);
  });
});

describe("validateJson — JSON string input", () => {
  it("parses + validates valid JSON", () => {
    expect(validateJson(JSON.stringify(VALID_MINIMAL)).valid).toBe(true);
  });

  it("returns structured error on invalid JSON", () => {
    const result = validateJson("{ not json");
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("type_mismatch");
    expect(result.errors[0].message).toMatch(/Invalid JSON/);
  });
});
