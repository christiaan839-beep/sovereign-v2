/**
 * SOVEREIGN MATRIX — /api/commerce/intent (Wave 18 — ACP issue).
 *
 * Issue a signed Agentic-Commerce Protocol envelope. The agent posts:
 *   {
 *     acp: AcpIntent,
 *     consent: AcpConsent,
 *     agentTokenId: <Wave-16 JIT token id>
 *   }
 *
 * Server validates inputs, checks the JIT token is live (Wave 16 hard
 * invariant — every commerce action MUST be bound to an active agent
 * identity), then signs the envelope with the platform signing key.
 *
 * Audits every issued envelope so the receipt-anchored audit log
 * (Wave 9 Bitcoin anchor) makes every AI-initiated purchase
 * tamper-evident across the long retention horizon.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";
import { issueAcpEnvelope } from "@/lib/agentic-commerce";
import { getTokenStatus } from "@/lib/agent-tokens";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/commerce/intent");
const limiter = rateLimit({ interval: 60, limit: 60 });

const CURRENCY = z.enum(["USD", "ZAR", "EUR", "GBP", "JPY", "USDC"]);
const BODY = z.object({
  acp: z.object({
    merchantId: z.string().min(1).max(200),
    sku: z.string().min(1).max(200),
    title: z.string().min(1).max(300),
    unitAmount: z.number().int().min(1).max(1_000_000_000),
    currency: CURRENCY,
    quantity: z.number().int().min(1).max(100_000),
    catalogHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  }),
  consent: z.object({
    principalId: z.string().min(1).max(128),
    spendCapAmount: z.number().int().min(1).max(1_000_000_000),
    spendCapCurrency: CURRENCY,
    allowedMerchantId: z.string().min(1).max(200),
    expiresAt: z.string().datetime(),
    consentToken: z.string().min(1).max(2000),
  }),
  agentTokenId: z.string().uuid(),
});

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId!;

  const body = await req.json().catch(() => null);
  const parsed = BODY.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Hard invariant: the agent token must be active. A revoked or
  // expired token cannot authorize a purchase, period.
  const tokenStatus = await getTokenStatus(parsed.data.agentTokenId);
  if (!tokenStatus.exists || !tokenStatus.active) {
    log.warn("Commerce intent denied — token inactive", {
      tokenId: parsed.data.agentTokenId,
      exists: tokenStatus.exists,
      active: tokenStatus.active ?? false,
    });
    return NextResponse.json(
      { error: "Agent token is not active" },
      { status: 403 },
    );
  }

  try {
    const envelope = issueAcpEnvelope({
      acp: parsed.data.acp,
      consent: parsed.data.consent,
      agentTokenId: parsed.data.agentTokenId,
    });
    await auditLog({
      userId,
      action: "data.export",
      resource: `acp_envelope:${envelope.envelopeId}`,
      details: {
        merchantId: envelope.acp.merchantId,
        sku: envelope.acp.sku,
        totalAmount: envelope.acp.unitAmount * envelope.acp.quantity,
        currency: envelope.acp.currency,
        agentTokenId: envelope.agentTokenId,
        contentHash: envelope.contentHash,
      },
    });
    return NextResponse.json(envelope, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("ACP envelope issue rejected", { error: msg });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
