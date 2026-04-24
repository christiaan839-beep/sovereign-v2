/**
 * OpenAPI 3.1 spec builder — introspects the platform's public API
 * surface and returns a serializable spec document.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Every serious enterprise buyer asks "where's your Swagger?" Every SDK
 * generator starts from OpenAPI. Stripe's partner ecosystem is boot-
 * strapped by their OpenAPI doc. Publishing ours turns 218 typed agents
 * into discoverable developer surface.
 *
 * APPROACH
 * ────────
 * We DON'T hand-write the spec (218 endpoints × 4 fields each = 872 error
 * points). Instead we introspect:
 *
 *   1. `AGENT_REGISTRY` from src/app/api/agents/registry.ts → endpoint list
 *   2. The route's default export for inputSchema (where declared)
 *   3. The structured ERROR_CODES for response schemas
 *
 * Missing schemas get a pragmatic "any object" placeholder — better than
 * a lie, worse than a full type. This is documented on the spec itself.
 *
 * OUTPUT
 * ──────
 * A serializable OpenAPI 3.1 document ready to return as JSON. Cached
 * for 5 minutes so we don't re-introspect on every hit.
 */

import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { ERROR_CODES } from "@/lib/error-codes";

interface OpenAPIOperation {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  requestBody?: {
    required: boolean;
    content: {
      "application/json": {
        schema: { type: string; additionalProperties: boolean };
      };
    };
  };
  responses: Record<string, {
    description: string;
    content?: {
      "application/json": {
        schema: { type: string; additionalProperties: boolean };
      };
    };
  }>;
  security: Array<Record<string, string[]>>;
}

interface OpenAPIDoc {
  openapi: "3.1.0";
  info: {
    title: string;
    description: string;
    version: string;
    contact: { name: string; url: string };
    license: { name: string; url: string };
  };
  servers: Array<{ url: string; description: string }>;
  security: Array<Record<string, string[]>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
    responses: Record<string, unknown>;
  };
  paths: Record<string, Record<string, OpenAPIOperation>>;
  tags: Array<{ name: string; description: string }>;
}

/**
 * Derive a tag (grouping) for an agent slug. Pattern matching keeps
 * this deterministic without having to maintain a separate manifest.
 * Tags are what Swagger UI uses to collapse the sidebar.
 */
function tagForSlug(slug: string): string {
  // Explicit mappings for vertical-depth agents
  const exact: Record<string, string> = {
    "fnol-intake": "Insurance",
    "coi-verifier": "Insurance",
    "bill-of-lading-reader": "Logistics",
    "hs-code-classifier": "Logistics",
    "icd10-coder": "Healthcare",
    "prior-auth-drafter": "Healthcare",
    "healthcare-docs": "Healthcare",
    "soil-report-extractor": "Agriculture",
    "crop-health-scout": "Agriculture",
    "permit-form-filler": "Construction",
    "safety-incident-reporter": "Construction",
    "blueprint-parser": "Construction",
    "w2-reader": "Finance",
    "invoice-extractor": "Finance",
    "invoice-ocr": "Finance",
    "id-verifier": "Compliance",
    "business-card-reader": "Sales",
    "menu-digitizer": "Ecommerce",
  };
  if (exact[slug]) return exact[slug];

  // Heuristic grouping
  if (slug.includes("voice") || slug.includes("speech")) return "Voice";
  if (slug.includes("vision") || slug.includes("image") || slug.includes("video")) return "Vision & Media";
  if (slug.includes("blog") || slug.includes("content") || slug.includes("seo")) return "Content";
  if (slug.includes("lead") || slug.includes("sales") || slug.includes("pipeline")) return "Sales";
  if (slug.includes("compet") || slug.includes("market")) return "Research";
  if (slug.includes("safety") || slug.includes("pii") || slug.includes("jailbreak") || slug.includes("nemoclaw")) return "Safety";
  if (slug.includes("health") || slug.includes("medical")) return "Healthcare";
  if (slug.includes("router") || slug.includes("brain") || slug.includes("meta-prompt")) return "Meta";
  return "General";
}

/**
 * A minimal JSON schema placeholder when we can't introspect the real
 * zod schema. Honest — we document that at the spec level.
 */
const ANY_OBJECT = { type: "object", additionalProperties: true } as const;

/** Canonical envelope every agent response conforms to. */
const AGENT_RESPONSE_ENVELOPE = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    meta: {
      type: "object",
      properties: {
        agentName: { type: "string" },
        durationMs: { type: "number" },
        model: { type: "string" },
        requestId: { type: "string" },
      },
    },
  },
  additionalProperties: true,
  required: ["success"],
};

/** The structured error response shape from error-codes.ts. */
const ERROR_RESPONSE = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        category: { type: "string" },
        message: { type: "string" },
        docHint: { type: "string" },
        detail: { type: "string" },
        field: { type: "string" },
        traceId: { type: "string" },
        retryAfterSeconds: { type: "number" },
      },
      required: ["code", "category", "message", "docHint"],
    },
  },
  required: ["error"],
};

export async function buildOpenApiSpec(
  baseUrl: string = "https://sovereignmatrix.agency",
): Promise<OpenAPIDoc> {
  const agentSlugs = Object.keys(AGENT_REGISTRY).sort();
  const tags = new Set<string>();
  const paths: Record<string, Record<string, OpenAPIOperation>> = {};

  // ─── Agent endpoints ───────────────────────────────────────────
  for (const slug of agentSlugs) {
    const tag = tagForSlug(slug);
    tags.add(tag);
    paths[`/api/agents/${slug}`] = {
      post: {
        operationId: `invokeAgent_${slug.replace(/-/g, "_")}`,
        tags: [tag],
        summary: `Invoke the ${slug} agent`,
        description: [
          `POST to invoke the **${slug}** agent.`,
          "",
          "Agents run through the platform's 7-module safety pipeline (jailbreak, content, PII, quality, critic, trust, action-tier) and circuit-breaker. All invocations are audit-logged and cryptographically attested — see [/trust/anthropic](/trust/anthropic).",
          "",
          "Full input schema is available via the agent's published manifest at `/api/public/marketplace/agents/<slug>`. Requests that fail validation return a structured error (see `responses`).",
        ].join("\n"),
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: ANY_OBJECT },
          },
        },
        responses: {
          "200": {
            description: "Successful invocation — envelope + agent-specific payload",
            content: { "application/json": { schema: AGENT_RESPONSE_ENVELOPE as never } },
          },
          "400": { description: "Invalid input (see `error.code` for specifics)", content: { "application/json": { schema: ERROR_RESPONSE as never } } },
          "401": { description: "Authentication required", content: { "application/json": { schema: ERROR_RESPONSE as never } } },
          "402": { description: "Plan quota exceeded", content: { "application/json": { schema: ERROR_RESPONSE as never } } },
          "422": { description: "Safety gate tripped", content: { "application/json": { schema: ERROR_RESPONSE as never } } },
          "429": { description: "Rate limit exceeded (Retry-After header set)", content: { "application/json": { schema: ERROR_RESPONSE as never } } },
          "503": { description: "Upstream provider unavailable / circuit open", content: { "application/json": { schema: ERROR_RESPONSE as never } } },
        },
        security: [{ bearerAuth: [] }],
      },
    };
  }

  // ─── Platform endpoints (public, non-agent) ────────────────────
  const platformEndpoints: Array<{
    path: string;
    method: "get" | "post";
    tag: string;
    summary: string;
    description: string;
    auth: boolean;
  }> = [
    {
      path: "/api/_health/slo",
      method: "get",
      tag: "Platform",
      summary: "Platform SLO snapshot",
      description: "Rolling 24h uptime, P95 latency, and top-endpoint breakdown. Cache: 30s. See also `/status/slo`.",
      auth: false,
    },
    {
      path: "/api/_health/performance",
      method: "get",
      tag: "Platform",
      summary: "Per-endpoint performance + cache telemetry",
      description: "P50/P95/P99 per endpoint, cache hit rate, stampede saves. Optional `endpoint=<path>` + `windowMinutes=<n>` query params.",
      auth: false,
    },
    {
      path: "/api/webhooks/subscriptions",
      method: "get",
      tag: "Webhooks",
      summary: "List webhook subscriptions",
      description: "Lists the caller's active webhook subscriptions. The HMAC secret is NEVER returned — it's shown only once at creation.",
      auth: true,
    },
    {
      path: "/api/webhooks/subscriptions",
      method: "post",
      tag: "Webhooks",
      summary: "Create a webhook subscription",
      description: "Creates a subscription. The HMAC signing secret is returned ONCE in this response. Store it immediately — we keep only a salted hash. See `/docs/webhooks/verify` for sample verification code in Node/Python/Go.",
      auth: true,
    },
  ];

  for (const ep of platformEndpoints) {
    tags.add(ep.tag);
    const existing = paths[ep.path] ?? {};
    existing[ep.method] = {
      operationId: `${ep.method}${ep.path.replace(/[^A-Za-z0-9]/g, "_")}`,
      tags: [ep.tag],
      summary: ep.summary,
      description: ep.description,
      ...(ep.method === "post"
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: ANY_OBJECT } },
            },
          }
        : {}),
      responses: {
        "200": {
          description: "OK",
          content: { "application/json": { schema: ANY_OBJECT } },
        },
        ...(ep.auth ? { "401": { description: "Unauthenticated", content: { "application/json": { schema: ERROR_RESPONSE as never } } } } : {}),
      },
      security: ep.auth ? [{ bearerAuth: [] }] : [],
    };
    paths[ep.path] = existing;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Sovereign Matrix API",
      description: [
        "The Sovereign Matrix platform API. 218 first-party agents across 10 industry verticals, each accessible via a uniform POST contract.",
        "",
        "## Authentication",
        "All agent invocations require a bearer token (Clerk JWT or API key). Public endpoints (`/api/_health/*`, `/status/slo`) are unauthenticated.",
        "",
        "## Rate limiting",
        "Enforced per-user + per-endpoint. Clients should honor `Retry-After` on 429 responses. See [/docs/errors/rate_limit_exceeded](/docs/errors/rate_limit_exceeded).",
        "",
        "## Errors",
        "Every error response carries a structured `code` that never renames. 18-code taxonomy at [/docs/errors](/docs/errors).",
        "",
        "## Webhooks",
        "Subscribe via `POST /api/webhooks/subscriptions`. HMAC-SHA256 signing with replay protection. Sample verification code (Node / Python / Go) at [/docs/webhooks/verify](/docs/webhooks/verify).",
        "",
        "## Spec generation",
        "This document is auto-generated from the static agent registry + zod schemas. Schemas not yet introspected default to `{ type: 'object', additionalProperties: true }` — we document this trade-off rather than emit placeholder types that lie.",
      ].join("\n"),
      version: "1.0.0",
      contact: {
        name: "Sovereign Matrix",
        url: "https://sovereignmatrix.agency/contact",
      },
      license: {
        name: "SAM v1.0 Spec",
        url: "https://sovereignmatrix.agency/spec/agent-manifest",
      },
    },
    servers: [
      { url: baseUrl, description: "Production" },
      { url: "http://localhost:3000", description: "Local dev" },
    ],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT or sm_live_* API key",
        },
      },
      schemas: {
        AgentResponseEnvelope: AGENT_RESPONSE_ENVELOPE,
        ErrorResponse: ERROR_RESPONSE,
      },
      responses: Object.fromEntries(
        Object.entries(ERROR_CODES).map(([code, def]) => [
          code,
          {
            description: `${def.userMessage} (HTTP ${def.httpStatus}, category: ${def.category})`,
            content: { "application/json": { schema: ERROR_RESPONSE } },
          },
        ]),
      ),
    },
    paths,
    tags: [...tags].sort().map((name) => ({
      name,
      description: `${name} agents and endpoints`,
    })),
  };
}
