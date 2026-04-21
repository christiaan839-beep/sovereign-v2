/**
 * agent-submission.ts — validation + slug normalization for 3rd-party
 * agent submissions via /developers/submit.
 *
 * Submitted agents always start as visibility='unlisted' + verified=false.
 * Admin promotion to 'public' + verified=true is a separate flow (manual
 * review in the dashboard, not yet built — will land with the admin
 * moderation panel).
 *
 * Safety note: we do NOT register the submission into AGENT_REGISTRY
 * (the static import map). That's a build-time construct. For now,
 * submissions are metadata-only entries that show up on /world as
 * "pending" (since verified=false + unlisted → drawer-only discovery).
 * The runtime registration happens in a later plan when the agent
 * author provides a hosted endpoint.
 */

import { z } from "zod";

// ─── Constants ──────────────────────────────────────────────────

const ALLOWED_CATEGORIES = [
  "content",
  "leads",
  "intelligence",
  "voice",
  "safety",
  "creative",
  "engineering",
  "finance",
  "social",
  "analysis",
  "general",
] as const;

export type SubmissionCategory = (typeof ALLOWED_CATEGORIES)[number];

const MAX_PRICING_CENTS = 10_000; // $100.00 per run hard cap for now

// ─── Schema ─────────────────────────────────────────────────────

/**
 * Step 1 fields (Define). Required shape — the POST handler only
 * accepts fully-formed submissions (no partial saves for now).
 */
export const SubmissionSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(60, "Name must be at most 60 characters")
    .refine((s) => s.trim().length > 0, "Name cannot be whitespace only"),
  tagline: z.string().min(10, "Tagline must be at least 10 characters").max(140),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(ALLOWED_CATEGORIES),
  pricingCents: z
    .number()
    .int()
    .min(0)
    .max(MAX_PRICING_CENTS, `Pricing cannot exceed $${MAX_PRICING_CENTS / 100}`),

  // Step 2 — one of these must be present
  systemPrompt: z.string().min(20).max(20_000).nullable().optional(),
  hostedEndpoint: z.string().url("Must be a valid https:// URL").nullable().optional(),
}).refine(
  (v) => Boolean(v.systemPrompt) || Boolean(v.hostedEndpoint),
  { message: "Provide either a system prompt or a hosted endpoint URL" },
);

export type Submission = z.infer<typeof SubmissionSchema>;

// ─── Slug ───────────────────────────────────────────────────────

/**
 * Normalize a human name to a URL-safe slug.
 *
 *   "SEO Dominator!" → "seo-dominator"
 *   "  Price Ninja  " → "price-ninja"
 *   "My Agent / v2"  → "my-agent-v2"
 *
 * Enforces max 40 chars — longer slugs become ugly URLs and don't
 * fit in the constellation tooltip.
 */
export function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // drop punctuation
    .replace(/\s+/g, "-")          // spaces → hyphens
    .replace(/-+/g, "-")            // collapse multiple hyphens
    .replace(/^-|-$/g, "")         // trim leading/trailing hyphens
    .slice(0, 40);
}

// ─── Safety (lightweight — real NemoGuard hop lands in a later plan) ──

const BLOCKLIST = [
  "malware", "exploit", "phishing", "ransomware",
  "jailbreak", "prompt-inject", "illegal",
];

/**
 * Lightweight content screen. Rejects obvious bad-actor submissions
 * without a LLM round-trip. The full NemoGuard pipeline (the one the
 * spec references) lives in `src/lib/nemoguard.ts` and will be wired
 * here in the next sprint — for now this is the belt-and-suspenders
 * first pass that runs synchronously so we can return a 400 to the
 * submitter immediately.
 */
export function screenSubmission(s: Submission): { ok: true } | { ok: false; reason: string } {
  const haystack = `${s.name} ${s.tagline} ${s.description ?? ""} ${s.systemPrompt ?? ""}`.toLowerCase();
  for (const term of BLOCKLIST) {
    if (haystack.includes(term)) {
      return { ok: false, reason: `Submission contains disallowed term: ${term}` };
    }
  }
  return { ok: true };
}

/**
 * Parse + validate a raw payload. Combines schema validation and
 * content screening so the route handler can do `const { ok, data } =
 * validateSubmission(body)` once.
 */
export function validateSubmission(raw: unknown):
  | { ok: true; data: Submission; slug: string }
  | { ok: false; status: number; error: string; issues?: z.ZodIssue[] }
{
  const parsed = SubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "Validation failed",
      issues: parsed.error.issues,
    };
  }
  const screen = screenSubmission(parsed.data);
  if (!screen.ok) {
    return { ok: false, status: 400, error: screen.reason };
  }
  const slug = normalizeSlug(parsed.data.name);
  if (slug.length < 3) {
    return { ok: false, status: 400, error: "Name does not produce a usable URL slug" };
  }
  return { ok: true, data: parsed.data, slug };
}

export { ALLOWED_CATEGORIES };
