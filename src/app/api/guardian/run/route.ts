/**
 * SOVEREIGN MATRIX — /api/guardian/run (Wave 17)
 *
 * Server-side Guardian evaluator. Lets external SDK consumers submit
 * a `GuardianContext` plus a list of built-in rule descriptors and
 * receive a cryptographically-signed `GuardianAttestation` envelope
 * back. The signing key never leaves the server.
 *
 * Rules in this MVP are limited to the platform's built-in library
 * (output-size, forbidden-substring, require-token). Customer-defined
 * function rules are slated for Wave 18 once we ship the WASM sandbox
 * primitive — executing arbitrary code from a request body is the
 * obvious security cliff to NOT walk over.
 *
 * Request body:
 *   {
 *     ctx: GuardianContext,
 *     rules: Array<
 *       | { kind: "output-size", maxBytes: number }
 *       | { kind: "forbidden-substring", needles: string[], level?: "warn"|"block" }
 *       | { kind: "require-token" }
 *     >
 *   }
 *
 * Response 200: GuardianAttestation
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import {
  runGuardian,
  outputSizeRule,
  forbiddenSubstringRule,
  requireTokenRule,
  type GuardianRule,
} from "@/lib/guardian-runner";

const limiter = rateLimit({ interval: 60, limit: 60 });

const RULE_SCHEMA = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("output-size"),
    maxBytes: z.number().int().min(1).max(10_000_000),
  }),
  z.object({
    kind: z.literal("forbidden-substring"),
    needles: z.array(z.string().min(1).max(200)).min(1).max(100),
    level: z.enum(["warn", "block"]).optional(),
  }),
  z.object({
    kind: z.literal("require-token"),
  }),
]);

const BODY_SCHEMA = z.object({
  ctx: z.object({
    runId: z.string().min(1).max(128),
    agentSlug: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    tokenId: z.string().min(1).max(128).optional(),
    input: z.unknown(),
    output: z.unknown(),
  }),
  rules: z.array(RULE_SCHEMA).min(1).max(20),
});

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = BODY_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Materialize built-in rules from the descriptor list.
  const rules: GuardianRule[] = parsed.data.rules.map((descriptor) => {
    switch (descriptor.kind) {
      case "output-size":
        return outputSizeRule(descriptor.maxBytes);
      case "forbidden-substring":
        return forbiddenSubstringRule(descriptor.needles, descriptor.level);
      case "require-token":
        return requireTokenRule;
    }
  });

  const attestation = await runGuardian(rules, parsed.data.ctx);
  return NextResponse.json(attestation, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
