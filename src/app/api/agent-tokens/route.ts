/**
 * SOVEREIGN MATRIX — /api/agent-tokens (Wave 16)
 *
 * GET  → list currently-live tokens (public; only safe fields surfaced).
 * POST → issue a new JIT agent token (requires Clerk auth + admin role
 *        for now; will widen to tenant-owners once tenant-scope is
 *        enforced everywhere in the cascade).
 *
 * Body shape for POST:
 *   {
 *     agentSlug: string,
 *     scopes: AgentTokenScope[],
 *     ttlSeconds?: number,
 *     tenantId?: string
 *   }
 *
 * Response 200:
 *   { token, tokenId, claims, expiresAt }
 *
 * The returned `token` is the JWT-style wire format. Treat it as a
 * short-lived secret — pass it through Authorization: Bearer on
 * downstream tool calls.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { issueAgentToken, listActiveTokens } from "@/lib/agent-tokens";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/agent-tokens");

const issueLimiter = rateLimit({ interval: 60, limit: 30 });
const listLimiter = rateLimit({ interval: 60, limit: 60 });

const SCOPE_ENUM = [
  "agent:run",
  "agent:read",
  "tool:fetch",
  "tool:browser",
  "tool:sandbox",
  "data:write",
  "receipt:issue",
] as const;

const ISSUE_SCHEMA = z.object({
  agentSlug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  scopes: z.array(z.enum(SCOPE_ENUM)).min(1).max(SCOPE_ENUM.length),
  ttlSeconds: z.number().int().min(60).max(3600).optional(),
  tenantId: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  const limited = await listLimiter.check(req);
  if (limited) return limited;
  const url = new URL(req.url);
  const tokens = await listActiveTokens({
    limit: Number(url.searchParams.get("limit") ?? "25"),
    agentSlug: url.searchParams.get("agent") ?? undefined,
    tenantId: url.searchParams.get("tenant") ?? undefined,
  });
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), count: tokens.length, tokens },
    { headers: { "cache-control": "public, max-age=10" } },
  );
}

export async function POST(req: Request) {
  const limited = await issueLimiter.check(req);
  if (limited) return limited;

  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId!;

  if (!isAdmin(userId)) {
    log.warn("Non-admin attempted token issue", { userId });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ISSUE_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const issued = await issueAgentToken({
      agentSlug: parsed.data.agentSlug,
      scopes: parsed.data.scopes,
      ttlSeconds: parsed.data.ttlSeconds,
      tenantId: parsed.data.tenantId ?? null,
      userId,
    });
    await auditLog({
      userId,
      action: "agent_token.issued",
      resource: `agent_token:${issued.tokenId}`,
      details: {
        agentSlug: parsed.data.agentSlug,
        scopes: parsed.data.scopes,
        expiresAt: issued.expiresAt,
        scheme: issued.claims.iss === "sovereignmatrix.agency" ? "ok" : "?",
      },
    });
    return NextResponse.json(issued, { status: 201 });
  } catch (err) {
    log.error("issueAgentToken failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Token issue failed" }, { status: 500 });
  }
}
