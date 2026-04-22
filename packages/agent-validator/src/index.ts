/**
 * @sovereignmatrix/agent-validator — Validate SAM v1.0 manifests.
 *
 * Zero-dependency validator for the Sovereign Agent Manifest (SAM)
 * v1.0 spec. Bundles the schema offline; no network required.
 *
 * The spec is frozen at v1.0 for ≥12 months per the SAM versioning
 * promise. When v1.1 ships in the extensions namespace, this package
 * will add a supportsExtension() helper — no breaking changes to the
 * validator() API.
 *
 * Usage:
 *   import { validate, type ValidationResult } from "@sovereignmatrix/agent-validator";
 *   const result = validate(myManifest);
 *   if (!result.valid) console.error(result.errors);
 */

// ─── Schema bundled offline — frozen copy of SAM v1.0 ─────────────────────
//
// Kept in sync with /api/public/sam/schema on the platform. Any drift is
// a critical bug — a CI check in the monorepo asserts they match.

const SAM_V1_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://sovereignmatrix.agency/api/public/sam/schema",
  title: "Sovereign Agent Manifest v1.0",
  type: "object",
  required: [
    "sam",
    "slug",
    "displayName",
    "purpose",
    "category",
    "version",
    "inputs",
    "output",
    "guarantees",
  ] as const,
  additionalProperties: false as const,
  properties: {
    sam: { type: "string" as const, const: "1.0" },
    slug: { type: "string" as const, pattern: "^[a-z][a-z0-9-]{2,63}$" },
    displayName: { type: "string" as const, minLength: 1, maxLength: 60 },
    purpose: { type: "string" as const, minLength: 1, maxLength: 140 },
    category: {
      type: "string" as const,
      enum: [
        "Growth",
        "Content",
        "Dev",
        "Finance",
        "HR",
        "Legal",
        "Ecommerce",
        "Research",
        "Cybersec",
        "Real Estate",
        "Gov",
        "Productivity",
        "Creative",
        "Data",
        "A2E",
        "Meta",
        "Integration",
        "Safety",
      ],
    },
    version: {
      type: "string" as const,
      pattern: "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?$",
    },
    inputs: { type: "array" as const },
    output: { type: "object" as const },
    guarantees: {
      type: "array" as const,
      minItems: 1,
      items: { type: "string" as const, minLength: 10, maxLength: 300 },
    },
    pricing: { type: "object" as const },
    safety: { type: "object" as const },
    model: { type: "string" as const },
    creator: { type: "object" as const },
    tags: { type: "array" as const },
    extensions: { type: "object" as const },
  },
};

// ─── Types exposed to consumers ───────────────────────────────────────────

export interface ValidationError {
  /** JSON Pointer path to the offending field (e.g. "/slug"). */
  path: string;
  /** Human-readable description of what's wrong. */
  message: string;
  /** Stable error code, useful for i18n + programmatic handling. */
  code: ValidationErrorCode;
}

export type ValidationErrorCode =
  | "missing_required"
  | "type_mismatch"
  | "additional_property"
  | "const_mismatch"
  | "enum_mismatch"
  | "pattern_mismatch"
  | "length_out_of_range"
  | "array_empty";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  /** The version of SAM this validator supports. */
  samVersion: "1.0";
}

// ─── Validator ────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set(SAM_V1_SCHEMA.properties.category.enum);
const SLUG_PATTERN = new RegExp(SAM_V1_SCHEMA.properties.slug.pattern);
const VERSION_PATTERN = new RegExp(SAM_V1_SCHEMA.properties.version.pattern);

/**
 * Validate a manifest object against SAM v1.0.
 *
 * Unknown properties are rejected (additionalProperties: false) — this is
 * strict by design. Extensions go in `extensions[]`, not at the top level.
 *
 * The validator returns all errors found — it doesn't short-circuit on
 * the first one — so CI integrations can show a complete report to the
 * developer in one pass.
 */
export function validate(manifest: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return {
      valid: false,
      samVersion: "1.0",
      errors: [
        {
          path: "/",
          message: "Manifest must be a JSON object (not array, null, or primitive).",
          code: "type_mismatch",
        },
      ],
    };
  }

  const m = manifest as Record<string, unknown>;

  // Required top-level fields.
  for (const field of SAM_V1_SCHEMA.required) {
    if (!(field in m)) {
      errors.push({
        path: `/${field}`,
        message: `Required field "${field}" is missing.`,
        code: "missing_required",
      });
    }
  }

  // Reject unknown top-level properties.
  const knownKeys = new Set(Object.keys(SAM_V1_SCHEMA.properties));
  for (const key of Object.keys(m)) {
    if (!knownKeys.has(key)) {
      errors.push({
        path: `/${key}`,
        message: `Unknown top-level property "${key}". Use the extensions namespace for custom fields.`,
        code: "additional_property",
      });
    }
  }

  // sam: const '1.0'
  if ("sam" in m && m.sam !== "1.0") {
    errors.push({
      path: "/sam",
      message: `"sam" must be exactly the string "1.0", got ${JSON.stringify(m.sam)}.`,
      code: "const_mismatch",
    });
  }

  // slug: string, kebab-case pattern
  if ("slug" in m) {
    if (typeof m.slug !== "string") {
      errors.push({ path: "/slug", message: `"slug" must be a string.`, code: "type_mismatch" });
    } else if (!SLUG_PATTERN.test(m.slug)) {
      errors.push({
        path: "/slug",
        message: `"slug" must be kebab-case, 3-64 chars, starting with a letter (got "${m.slug}").`,
        code: "pattern_mismatch",
      });
    }
  }

  // displayName: 1-60 chars
  if ("displayName" in m) {
    const dn = m.displayName;
    if (typeof dn !== "string") {
      errors.push({
        path: "/displayName",
        message: `"displayName" must be a string.`,
        code: "type_mismatch",
      });
    } else if (dn.length < 1 || dn.length > 60) {
      errors.push({
        path: "/displayName",
        message: `"displayName" must be 1-60 characters (got ${dn.length}).`,
        code: "length_out_of_range",
      });
    }
  }

  // purpose: 1-140 chars
  if ("purpose" in m) {
    const p = m.purpose;
    if (typeof p !== "string") {
      errors.push({
        path: "/purpose",
        message: `"purpose" must be a string.`,
        code: "type_mismatch",
      });
    } else if (p.length < 1 || p.length > 140) {
      errors.push({
        path: "/purpose",
        message: `"purpose" must be 1-140 characters (got ${p.length}).`,
        code: "length_out_of_range",
      });
    }
  }

  // category: one of the 18 official categories
  if ("category" in m) {
    if (typeof m.category !== "string") {
      errors.push({
        path: "/category",
        message: `"category" must be a string.`,
        code: "type_mismatch",
      });
    } else if (!VALID_CATEGORIES.has(m.category as never)) {
      errors.push({
        path: "/category",
        message: `"category" must be one of the 18 official categories (got "${m.category}"). See the SAM spec.`,
        code: "enum_mismatch",
      });
    }
  }

  // version: SemVer
  if ("version" in m) {
    if (typeof m.version !== "string") {
      errors.push({
        path: "/version",
        message: `"version" must be a SemVer string.`,
        code: "type_mismatch",
      });
    } else if (!VERSION_PATTERN.test(m.version)) {
      errors.push({
        path: "/version",
        message: `"version" must be SemVer (major.minor.patch[-prerelease]), got "${m.version}".`,
        code: "pattern_mismatch",
      });
    }
  }

  // inputs: array
  if ("inputs" in m && !Array.isArray(m.inputs)) {
    errors.push({
      path: "/inputs",
      message: `"inputs" must be an array (can be empty).`,
      code: "type_mismatch",
    });
  }

  // output: object with type
  if ("output" in m) {
    if (typeof m.output !== "object" || m.output === null || Array.isArray(m.output)) {
      errors.push({
        path: "/output",
        message: `"output" must be an object.`,
        code: "type_mismatch",
      });
    }
  }

  // guarantees: array of strings, minItems 1, each 10-300 chars
  if ("guarantees" in m) {
    if (!Array.isArray(m.guarantees)) {
      errors.push({
        path: "/guarantees",
        message: `"guarantees" must be an array of strings.`,
        code: "type_mismatch",
      });
    } else {
      if (m.guarantees.length < 1) {
        errors.push({
          path: "/guarantees",
          message: `"guarantees" must contain at least 1 machine-checkable clause.`,
          code: "array_empty",
        });
      }
      m.guarantees.forEach((g, i) => {
        if (typeof g !== "string") {
          errors.push({
            path: `/guarantees/${i}`,
            message: `Each guarantee must be a string.`,
            code: "type_mismatch",
          });
        } else if (g.length < 10 || g.length > 300) {
          errors.push({
            path: `/guarantees/${i}`,
            message: `Each guarantee must be 10-300 characters (got ${g.length}).`,
            code: "length_out_of_range",
          });
        }
      });
    }
  }

  return { valid: errors.length === 0, errors, samVersion: "1.0" };
}

/**
 * Validate a JSON string (rather than a parsed object). Catches JSON
 * parse errors with a structured error instead of throwing.
 */
export function validateJson(jsonString: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      valid: false,
      samVersion: "1.0",
      errors: [
        {
          path: "/",
          message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
          code: "type_mismatch",
        },
      ],
    };
  }
  return validate(parsed);
}

/** The SAM v1.0 schema (frozen). Exposed for tooling that needs the raw JSON Schema. */
export { SAM_V1_SCHEMA };

/** Version this package supports. */
export const SUPPORTED_SAM_VERSION = "1.0" as const;
