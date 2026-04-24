/**
 * /docs/errors/[code] — one doc page per structured error code.
 *
 * WHY THIS EXISTS
 * ───────────────
 * src/lib/error-codes.ts emits `docHint: "/docs/errors/<code>"` on every
 * error response. If those URLs 404 that's a credibility-killing moment —
 * "we have 18 error codes, all documented" rings hollow if the links
 * all dead-end. This closes the loop.
 *
 * SHAPE
 * ─────
 * Dynamic route: /docs/errors/rate_limit_exceeded, /docs/errors/invalid_input,
 * etc. One page per code, generated at build time via generateStaticParams.
 *
 * PER-CODE CONTENT
 * ────────────────
 * We supplement the taxonomy (category, HTTP status, user message) with:
 *   - Typical trigger scenarios
 *   - How to recover (code-level fix vs. config fix vs. retry)
 *   - Example response body
 *   - Related codes
 *
 * MISSING CODE?
 * ─────────────
 * generateStaticParams covers all 18 codes. If a new code is added to
 * ERROR_CODES without a CODE_DETAIL entry, the page still renders with
 * a fallback copy and a PR-me hint.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ERROR_CODES, type ErrorCode } from "@/lib/error-codes";

type CodeDetail = {
  triggers: string[];
  howToFix: string[];
  exampleBody: string;
  related: ErrorCode[];
};

const CODE_DETAIL: Partial<Record<ErrorCode, CodeDetail>> = {
  auth_required: {
    triggers: [
      "Calling a protected endpoint without an `Authorization: Bearer <token>` header",
      "Calling from a session that's logged out or expired",
      "Missing Clerk session cookie on a dashboard route",
    ],
    howToFix: [
      "Sign in via /signup or pass a valid Clerk JWT",
      "Use the `@clerk/backend` verifyToken helper to check your token before sending",
      "For API integrations, mint an API key at /dashboard/api-keys",
    ],
    exampleBody: `{
  "error": {
    "code": "auth_required",
    "category": "auth",
    "message": "This endpoint requires a signed-in user.",
    "docHint": "/docs/errors/auth_required"
  }
}`,
    related: ["forbidden", "invalid_api_key"],
  },
  forbidden: {
    triggers: [
      "Tenant mismatch — you're signed in but the resource belongs to another tenant",
      "Admin-only endpoint without admin role",
      "Feature flag gate you're not in",
    ],
    howToFix: [
      "Check you're signed in to the correct tenant",
      "If you expect admin access, verify your user ID is in the ADMIN_USER_IDS env var",
      "If this is an API call across tenants, include the X-Tenant-Id header",
    ],
    exampleBody: `{
  "error": {
    "code": "forbidden",
    "category": "auth",
    "message": "You don't have permission for this action.",
    "docHint": "/docs/errors/forbidden"
  }
}`,
    related: ["auth_required"],
  },
  invalid_api_key: {
    triggers: [
      "API key missing from `Authorization` header",
      "API key was revoked or expired",
      "API key belongs to a deleted account",
    ],
    howToFix: [
      "Mint a fresh key at /dashboard/api-keys",
      "Send as `Authorization: Bearer sm_live_...`",
      "Keys starting with `sm_test_` only work against the sandbox",
    ],
    exampleBody: `{
  "error": {
    "code": "invalid_api_key",
    "category": "auth",
    "message": "API key missing, invalid, or revoked.",
    "docHint": "/docs/errors/invalid_api_key"
  }
}`,
    related: ["auth_required"],
  },
  invalid_input: {
    triggers: [
      "Request body fails zod schema validation",
      "Required field has wrong type",
      "Enum value outside the allowed set",
    ],
    howToFix: [
      "Read the `detail` field — it points at the offending key",
      "Check the agent's published input schema under /docs/agents/<slug>",
      "If validating locally, use `@sovereignmatrix/agent-validator`",
    ],
    exampleBody: `{
  "error": {
    "code": "invalid_input",
    "category": "input",
    "message": "Request body failed validation.",
    "detail": "Expected number for 'amountCents' but got string",
    "field": "amountCents",
    "docHint": "/docs/errors/invalid_input"
  }
}`,
    related: ["missing_required_field", "payload_too_large"],
  },
  missing_required_field: {
    triggers: ["Required field not present in the request body"],
    howToFix: ["Look at `field` in the response for the exact missing key"],
    exampleBody: `{
  "error": {
    "code": "missing_required_field",
    "category": "input",
    "message": "A required field was not provided.",
    "field": "url",
    "docHint": "/docs/errors/missing_required_field"
  }
}`,
    related: ["invalid_input"],
  },
  payload_too_large: {
    triggers: ["Request body exceeded per-endpoint size limit (typically 50,000 chars)"],
    howToFix: [
      "Slice long documents into chunks before calling",
      "For file ingestion agents, upload to a URL first and pass the URL",
    ],
    exampleBody: `{ "error": { "code": "payload_too_large", ... } }`,
    related: ["invalid_input"],
  },
  unsupported_media_type: {
    triggers: ["Content-Type missing or not application/json"],
    howToFix: ["Set `Content-Type: application/json` on every request"],
    exampleBody: `{ "error": { "code": "unsupported_media_type", ... } }`,
    related: ["invalid_input"],
  },
  rate_limit_exceeded: {
    triggers: [
      "Too many requests per minute from the same user / IP",
      "Agent's per-agent limit tripped (varies by plan)",
    ],
    howToFix: [
      "Honor the `Retry-After` header (seconds to wait)",
      "Use exponential backoff — 500ms → 1s → 2s → …",
      "Upgrade plan for higher limits",
    ],
    exampleBody: `{
  "error": {
    "code": "rate_limit_exceeded",
    "category": "rate-limit",
    "retryAfterSeconds": 24,
    "docHint": "/docs/errors/rate_limit_exceeded"
  }
}`,
    related: ["quota_exceeded"],
  },
  quota_exceeded: {
    triggers: ["Monthly plan quota exhausted"],
    howToFix: [
      "Upgrade at /pricing (resets immediately on upgrade)",
      "Wait for monthly reset (1st of the month, UTC)",
    ],
    exampleBody: `{ "error": { "code": "quota_exceeded", ... } }`,
    related: ["rate_limit_exceeded"],
  },
  agent_not_found: {
    triggers: ["No agent with that slug in `src/app/api/agents/registry.ts`"],
    howToFix: [
      "Browse /agents for the directory",
      "Slugs are case-sensitive kebab-case",
    ],
    exampleBody: `{ "error": { "code": "agent_not_found", ... } }`,
    related: [],
  },
  bundle_not_found: {
    triggers: ["Bundle ID or slug doesn't exist, or bundle was soft-deleted"],
    howToFix: ["Browse /marketplace/bundles for published bundles"],
    exampleBody: `{ "error": { "code": "bundle_not_found", ... } }`,
    related: [],
  },
  submission_not_found: {
    triggers: [
      "Reference ID wrong or from a different tenant",
      "Submission was purged (we retain 90 days)",
    ],
    howToFix: [
      "Check your confirmation email for the ref ID",
      "View your submissions at /dashboard/creator",
    ],
    exampleBody: `{ "error": { "code": "submission_not_found", ... } }`,
    related: [],
  },
  slug_taken: {
    triggers: ["Agent or bundle slug conflicts with an existing one"],
    howToFix: ["Pick another — slugs are globally unique per resource type"],
    exampleBody: `{ "error": { "code": "slug_taken", ... } }`,
    related: ["duplicate_submission"],
  },
  duplicate_submission: {
    triggers: [
      "You submitted the same manifest content twice (detected by content hash)",
    ],
    howToFix: [
      "Check your existing submission's ref ID and amend that instead",
    ],
    exampleBody: `{ "error": { "code": "duplicate_submission", ... } }`,
    related: ["slug_taken"],
  },
  upstream_unavailable: {
    triggers: [
      "All models in the failover chain returned 5xx or timed out",
      "Model provider is in a known outage",
    ],
    howToFix: [
      "Wait and retry — circuit breaker auto-closes once upstream recovers",
      "Check /status/slo for platform-wide health",
    ],
    exampleBody: `{ "error": { "code": "upstream_unavailable", ... } }`,
    related: ["upstream_timeout", "circuit_open"],
  },
  upstream_timeout: {
    triggers: ["Model response exceeded the per-call timeout (typically 30-60s)"],
    howToFix: ["Retry — transient timeouts are common"],
    exampleBody: `{ "error": { "code": "upstream_timeout", ... } }`,
    related: ["upstream_unavailable"],
  },
  safety_violation: {
    triggers: [
      "Input tripped the jailbreak, PII, or content-policy gate",
      "Output tripped the critic model's reject threshold",
    ],
    howToFix: [
      "Paraphrase if the input contained system-prompt-exfiltration patterns",
      "Redact PII from inputs (the gate detects + blocks, doesn't silently pass)",
      "Contact support if you believe this is a false positive",
    ],
    exampleBody: `{ "error": { "code": "safety_violation", ... } }`,
    related: [],
  },
  circuit_open: {
    triggers: ["An agent's circuit breaker tripped after repeated failures"],
    howToFix: [
      "Wait 60s — circuits auto-recover",
      "Check /status/slo for the failing endpoint",
    ],
    exampleBody: `{ "error": { "code": "circuit_open", ... } }`,
    related: ["upstream_unavailable"],
  },
  database_not_configured: {
    triggers: ["Feature requires DATABASE_URL env var, not set in this environment"],
    howToFix: [
      "Operator: set DATABASE_URL in Vercel env vars",
      "Or run locally with `export DATABASE_URL='postgresql://...'`",
    ],
    exampleBody: `{ "error": { "code": "database_not_configured", ... } }`,
    related: ["provider_not_configured"],
  },
  provider_not_configured: {
    triggers: ["Agent needs a specific API key not set in the environment"],
    howToFix: [
      "Operator: cross-check .env.example against Vercel env vars",
      "Agents typically need one of: ANTHROPIC_API_KEY, GEMINI_API_KEY, NVIDIA_NIM_API_KEY, GROQ_API_KEY",
    ],
    exampleBody: `{ "error": { "code": "provider_not_configured", ... } }`,
    related: ["database_not_configured", "upstream_unavailable"],
  },
  internal_error: {
    triggers: [
      "Unhandled exception inside the agent's handler",
      "Bug in the platform itself",
    ],
    howToFix: [
      "Retry once (transient bugs catch at startup)",
      "Report with the `traceId` from the response — it correlates to our logs",
    ],
    exampleBody: `{
  "error": {
    "code": "internal_error",
    "category": "internal",
    "traceId": "req_7f3d9a21c8b4",
    "docHint": "/docs/errors/internal_error"
  }
}`,
    related: [],
  },
};

interface PageProps {
  params: Promise<{ code: string }>;
}

export function generateStaticParams() {
  return Object.keys(ERROR_CODES).map((code) => ({ code }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const def = ERROR_CODES[code as ErrorCode];
  if (!def) return { title: "Error — Sovereign Matrix" };
  return {
    title: `${def.code} — Error docs · Sovereign Matrix`,
    description: `${def.userMessage} HTTP ${def.httpStatus}. ${def.category}.`,
    alternates: {
      canonical: `https://sovereignmatrix.agency/docs/errors/${def.code}`,
    },
  };
}

export default async function ErrorCodeDocPage({ params }: PageProps) {
  const { code } = await params;
  const def = ERROR_CODES[code as ErrorCode];
  if (!def) notFound();

  const detail = CODE_DETAIL[code as ErrorCode];

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/docs/errors"
          className="text-[13px] text-neutral-400 hover:text-white transition-colors"
        >
          ← All error codes
        </Link>
      </nav>

      <section className="pt-20 pb-10 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="font-mono text-[11px] text-neutral-600 tracking-[0.2em] uppercase">
              Error code
            </span>
            <span className="h-px flex-1 bg-white/[0.06] max-w-[40px]" />
            <span className="inline-flex items-center px-2 py-1 rounded-[3px] text-[11px] font-mono uppercase tracking-wider bg-rose-500/10 text-rose-400">
              HTTP {def.httpStatus}
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-[3px] text-[11px] font-mono uppercase tracking-wider bg-white/[0.04] text-neutral-400">
              {def.category}
            </span>
          </div>

          <h1 className="font-mono text-3xl md:text-5xl text-white mb-4 tracking-tight break-all">
            {def.code}
          </h1>
          <p className="text-neutral-400 text-lg leading-relaxed max-w-2xl">{def.userMessage}</p>
        </div>
      </section>

      {detail ? (
        <>
          <DocSection title="When you'll see this">
            <ul className="space-y-2">
              {detail.triggers.map((t, i) => (
                <li key={i} className="flex gap-3 text-neutral-300">
                  <span className="text-[#B5532C] shrink-0 mt-0.5">·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </DocSection>

          <DocSection title="How to recover">
            <ol className="space-y-2">
              {detail.howToFix.map((f, i) => (
                <li key={i} className="flex gap-3 text-neutral-300">
                  <span className="text-neutral-600 font-mono shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ol>
          </DocSection>

          <DocSection title="Example response body">
            <pre className="font-mono text-xs text-neutral-300 bg-[#060606] border border-white/[0.06] rounded-lg p-5 overflow-x-auto leading-relaxed">
              {detail.exampleBody}
            </pre>
          </DocSection>

          {detail.related.length > 0 && (
            <DocSection title="Related codes">
              <div className="flex flex-wrap gap-2">
                {detail.related.map((rel) => (
                  <Link
                    key={rel}
                    href={`/docs/errors/${rel}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-white/[0.06] bg-[#060606] text-xs font-mono text-neutral-400 hover:text-white hover:border-white/[0.12] transition-colors"
                  >
                    {rel}
                  </Link>
                ))}
              </div>
            </DocSection>
          )}
        </>
      ) : (
        <DocSection title="Full docs not yet published">
          <p className="text-neutral-400 text-sm leading-relaxed mb-3">
            This error code is registered in the platform&apos;s taxonomy but hasn&apos;t
            yet been expanded into a full trigger/recovery guide. The basics
            above are accurate.
          </p>
          <p className="text-neutral-500 text-sm leading-relaxed">
            Want to help? Open a PR to add this code to{" "}
            <code className="font-mono text-xs text-[#B5532C]">
              src/app/docs/errors/[code]/page.tsx → CODE_DETAIL
            </code>
            .
          </p>
        </DocSection>
      )}

      <section className="py-16 px-6 border-t border-white/[0.04] mt-10">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-neutral-500">
            Encountered this error without a clear path forward?{" "}
            <Link href="/contact" className="underline hover:text-white">
              Let us know
            </Link>{" "}
            — elite-tier means every error has a doc page, and every doc page
            has an actionable fix.
          </p>
        </div>
      </section>
    </div>
  );
}

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-8 px-6 border-t border-white/[0.04]">
      <div className="max-w-4xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-5">
          {title}
        </p>
        {children}
      </div>
    </section>
  );
}
