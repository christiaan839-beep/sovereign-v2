/**
 * GET /api/public/sam/schema
 *
 * Serves the Sovereign Agent Manifest (SAM) v1.0 JSON Schema. Any
 * tool — agent validators, IDE plugins, CI pipelines — can fetch this
 * and validate manifests against it.
 *
 * Content-Type: application/schema+json (per RFC 8927), falling back
 * to application/json so curl without --accept-anything just works.
 *
 * Cache policy: 1 day s-maxage. The spec is frozen for v1.0 per our
 * versioning commitment, so caching is aggressive. When (not if) we
 * publish v1.1 in the extensions namespace, we'll cut over at a
 * different URL (/api/public/sam/v1.1/schema).
 */

import { NextResponse } from "next/server";

const SAM_V1_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://sovereignmatrix.agency/api/public/sam/schema",
  title: "Sovereign Agent Manifest v1.0",
  description:
    "Open protocol for declaring an AI agent. Any agent conforming to this schema can run on any SAM-compliant runtime.",
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
  ],
  additionalProperties: false,
  properties: {
    sam: {
      type: "string",
      const: "1.0",
      description: "SAM spec version. Must be exactly '1.0' for this revision.",
    },
    slug: {
      type: "string",
      pattern: "^[a-z][a-z0-9-]{2,63}$",
      description:
        "kebab-case identifier, unique across the marketplace. 3-64 chars, starts with a letter.",
    },
    displayName: {
      type: "string",
      minLength: 1,
      maxLength: 60,
      description: "Human-readable name. Title case.",
    },
    purpose: {
      type: "string",
      minLength: 1,
      maxLength: 140,
      description:
        "One-line description. Verb-first: 'Extracts invoice data' not 'For invoices'.",
    },
    category: {
      type: "string",
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
      description: "One of the 18 official SAM categories.",
    },
    version: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?$",
      description: "SemVer. Major bump on breaking input/output changes.",
    },
    inputs: {
      type: "array",
      minItems: 0,
      items: {
        type: "object",
        required: ["name", "type", "required"],
        additionalProperties: false,
        properties: {
          name: { type: "string", pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$" },
          type: {
            type: "string",
            enum: [
              "string",
              "number",
              "boolean",
              "object",
              "array",
              "url",
              "email",
              "date",
              "enum",
            ],
          },
          required: { type: "boolean" },
          description: { type: "string", maxLength: 500 },
          enum: {
            type: "array",
            items: { type: "string" },
            description: "Required when type is 'enum'.",
          },
          default: {
            description: "Default value when field is not provided. Type must match 'type'.",
          },
        },
      },
    },
    output: {
      type: "object",
      required: ["type"],
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["object", "array", "string", "stream"],
        },
        schema: {
          type: "object",
          description:
            "Optional JSON-Schema-compatible shape. Runtime may use for post-hoc output validation.",
        },
      },
    },
    guarantees: {
      type: "array",
      minItems: 1,
      items: {
        type: "string",
        minLength: 10,
        maxLength: 300,
      },
      description:
        "Machine-checkable promises. Bad: 'high quality'. Good: 'returns ≥5 items each with contact_angle field'.",
    },
    pricing: {
      type: "object",
      additionalProperties: false,
      properties: {
        cents: { type: "number", minimum: 0 },
        tier: { type: "string", enum: ["free", "basic", "verified", "premium"] },
      },
    },
    safety: {
      type: "object",
      additionalProperties: false,
      properties: {
        trustTier: {
          type: "string",
          enum: ["supervised", "guided", "autonomous", "full-auto"],
          default: "guided",
        },
        requiredApprovals: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    model: {
      type: "string",
      enum: ["claude", "gemini", "nim", "groq", "cerebras", "ollama"],
      description:
        "Preferred model hint. Runtime may override via cost-optimizer unless safety-critical.",
    },
    creator: {
      type: "object",
      additionalProperties: false,
      properties: {
        handle: { type: "string", pattern: "^[a-zA-Z0-9_-]{3,30}$" },
        url: { type: "string", format: "uri" },
        githubOrg: { type: "string" },
      },
      required: ["handle"],
    },
    tags: {
      type: "array",
      maxItems: 10,
      items: {
        type: "string",
        pattern: "^[a-z0-9-]{2,30}$",
      },
    },
    extensions: {
      type: "object",
      description:
        "Namespaced extensions. Keys look like 'sovereign.memory' or 'acmecorp.customfield'. Runtimes that don't support an extension MUST still execute the agent, ignoring the extension fields.",
    },
  },
};

export async function GET(): Promise<Response> {
  return NextResponse.json(SAM_V1_SCHEMA, {
    headers: {
      "Content-Type": "application/schema+json; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      "X-SAM-Version": "1.0",
    },
  });
}
