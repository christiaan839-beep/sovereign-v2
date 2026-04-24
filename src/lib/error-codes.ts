/**
 * Structured error code taxonomy — one source of truth for every error
 * the API surfaces to clients, dashboards, and SLO telemetry.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Returning plain English ("something went wrong") erodes trust and
 * prevents clients from handling errors programmatically. Elite APIs
 * (Stripe, Twilio, AWS) return a stable, documented error code that:
 *
 *   • clients can switch on to surface a specific UI state
 *   • dashboards can aggregate by
 *   • auditors can cite
 *   • docs can link to a fix-it page per code
 *
 * Every code here has:
 *   - a STABLE string identifier (never change after shipped)
 *   - an HTTP status it maps to
 *   - a user-safe message (no stack traces, no internals)
 *   - a doc hint (where to go to fix)
 *
 * Add new codes; never remove. If a code is deprecated, mark it with
 * `deprecated: true` and keep it emitting indefinitely so existing
 * clients don't break.
 */

export type ErrorCategory =
  | "auth"
  | "input"
  | "rate-limit"
  | "quota"
  | "not-found"
  | "conflict"
  | "upstream"
  | "internal"
  | "config";

export interface ErrorCodeDefinition {
  /** Stable, never-rename. Exposed to clients. snake_case. */
  code: string;
  category: ErrorCategory;
  httpStatus: number;
  /** Safe to show end-users. */
  userMessage: string;
  /** Where to go to fix — URL path fragment (under /docs/errors/...). */
  docHint: string;
  /** If true, still emitted but clients should migrate away. */
  deprecated?: boolean;
}

// ────────────────────────────────────────────────────────────────
// The taxonomy. Keep alphabetical by code.
// ────────────────────────────────────────────────────────────────

export const ERROR_CODES = {
  // ── Auth ──
  auth_required: {
    code: "auth_required",
    category: "auth",
    httpStatus: 401,
    userMessage: "This endpoint requires a signed-in user.",
    docHint: "/docs/errors/auth_required",
  },
  forbidden: {
    code: "forbidden",
    category: "auth",
    httpStatus: 403,
    userMessage: "You don't have permission for this action.",
    docHint: "/docs/errors/forbidden",
  },
  invalid_api_key: {
    code: "invalid_api_key",
    category: "auth",
    httpStatus: 401,
    userMessage: "API key missing, invalid, or revoked.",
    docHint: "/docs/errors/invalid_api_key",
  },

  // ── Input ──
  invalid_input: {
    code: "invalid_input",
    category: "input",
    httpStatus: 400,
    userMessage: "Request body failed validation.",
    docHint: "/docs/errors/invalid_input",
  },
  missing_required_field: {
    code: "missing_required_field",
    category: "input",
    httpStatus: 400,
    userMessage: "A required field was not provided.",
    docHint: "/docs/errors/missing_required_field",
  },
  payload_too_large: {
    code: "payload_too_large",
    category: "input",
    httpStatus: 413,
    userMessage: "Request body exceeded the per-endpoint size limit.",
    docHint: "/docs/errors/payload_too_large",
  },
  unsupported_media_type: {
    code: "unsupported_media_type",
    category: "input",
    httpStatus: 415,
    userMessage: "Content-Type not supported for this endpoint.",
    docHint: "/docs/errors/unsupported_media_type",
  },

  // ── Rate limit / quota ──
  rate_limit_exceeded: {
    code: "rate_limit_exceeded",
    category: "rate-limit",
    httpStatus: 429,
    userMessage:
      "You've hit this endpoint's per-minute limit. Retry after the window resets.",
    docHint: "/docs/errors/rate_limit_exceeded",
  },
  quota_exceeded: {
    code: "quota_exceeded",
    category: "quota",
    httpStatus: 402,
    userMessage:
      "You've consumed your plan's monthly quota. Upgrade or wait for reset.",
    docHint: "/docs/errors/quota_exceeded",
  },

  // ── Not found ──
  agent_not_found: {
    code: "agent_not_found",
    category: "not-found",
    httpStatus: 404,
    userMessage: "No agent with that slug is registered.",
    docHint: "/docs/errors/agent_not_found",
  },
  bundle_not_found: {
    code: "bundle_not_found",
    category: "not-found",
    httpStatus: 404,
    userMessage: "No bundle with that ID or slug was found.",
    docHint: "/docs/errors/bundle_not_found",
  },
  submission_not_found: {
    code: "submission_not_found",
    category: "not-found",
    httpStatus: 404,
    userMessage: "No submission with that reference ID was found.",
    docHint: "/docs/errors/submission_not_found",
  },

  // ── Conflict ──
  slug_taken: {
    code: "slug_taken",
    category: "conflict",
    httpStatus: 409,
    userMessage: "This slug is already in use. Pick another.",
    docHint: "/docs/errors/slug_taken",
  },
  duplicate_submission: {
    code: "duplicate_submission",
    category: "conflict",
    httpStatus: 409,
    userMessage: "This content was already submitted under another reference ID.",
    docHint: "/docs/errors/duplicate_submission",
  },

  // ── Upstream (dependency failures) ──
  upstream_unavailable: {
    code: "upstream_unavailable",
    category: "upstream",
    httpStatus: 503,
    userMessage:
      "A downstream model provider is temporarily unavailable. Failover chain has been exhausted.",
    docHint: "/docs/errors/upstream_unavailable",
  },
  upstream_timeout: {
    code: "upstream_timeout",
    category: "upstream",
    httpStatus: 504,
    userMessage: "A downstream call exceeded its timeout budget.",
    docHint: "/docs/errors/upstream_timeout",
  },
  safety_violation: {
    code: "safety_violation",
    category: "upstream",
    httpStatus: 422,
    userMessage:
      "The input or output tripped a safety gate (jailbreak, PII, or content policy).",
    docHint: "/docs/errors/safety_violation",
  },
  circuit_open: {
    code: "circuit_open",
    category: "upstream",
    httpStatus: 503,
    userMessage:
      "This agent's circuit breaker is open after repeated failures. Retry in a minute.",
    docHint: "/docs/errors/circuit_open",
  },

  // ── Config ──
  database_not_configured: {
    code: "database_not_configured",
    category: "config",
    httpStatus: 503,
    userMessage:
      "This feature requires a configured database. Operator must set DATABASE_URL.",
    docHint: "/docs/errors/database_not_configured",
  },
  provider_not_configured: {
    code: "provider_not_configured",
    category: "config",
    httpStatus: 503,
    userMessage: "A required model provider has no API key set.",
    docHint: "/docs/errors/provider_not_configured",
  },

  // ── Internal ──
  internal_error: {
    code: "internal_error",
    category: "internal",
    httpStatus: 500,
    userMessage:
      "Something went wrong on our side. The error has been logged with a trace ID.",
    docHint: "/docs/errors/internal_error",
  },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCode = keyof typeof ERROR_CODES;

export function getErrorCode(code: ErrorCode): ErrorCodeDefinition {
  return ERROR_CODES[code];
}

/**
 * Render a structured error response. Attaches the code, user-safe
 * message, doc hint, and an optional request-scoped trace ID for
 * log correlation.
 */
export function errorPayload(
  code: ErrorCode,
  opts: {
    detail?: string;
    traceId?: string;
    retryAfterSeconds?: number;
    field?: string;
  } = {},
): {
  error: {
    code: string;
    category: ErrorCategory;
    message: string;
    docHint: string;
    detail?: string;
    field?: string;
    traceId?: string;
    retryAfterSeconds?: number;
  };
} {
  const def = ERROR_CODES[code];
  return {
    error: {
      code: def.code,
      category: def.category,
      message: def.userMessage,
      docHint: def.docHint,
      detail: opts.detail,
      field: opts.field,
      traceId: opts.traceId,
      retryAfterSeconds: opts.retryAfterSeconds,
    },
  };
}

/** Convenience for Next.js routes. */
export function errorResponseNext(
  code: ErrorCode,
  opts: Parameters<typeof errorPayload>[1] = {},
): Response {
  const def = ERROR_CODES[code];
  const body = errorPayload(code, opts);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.retryAfterSeconds) {
    headers["Retry-After"] = String(opts.retryAfterSeconds);
  }
  return new Response(JSON.stringify(body), {
    status: def.httpStatus,
    headers,
  });
}
