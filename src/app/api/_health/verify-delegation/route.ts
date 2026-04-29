/**
 * POST /api/health/verify-delegation
 *
 * The moat: a PUBLIC, no-auth endpoint that verifies an agent
 * delegation's cryptographic chain WITHOUT requiring the caller to
 * trust this server.
 *
 * The caller posts a delegation record (from anywhere they obtained
 * it — our DB, a peer's audit, an offline copy) and the user's
 * public key. The endpoint runs verifyDelegation() locally and
 * returns the result.
 *
 * Why this is novel: a third party can build their OWN verifier
 * using the same primitives in src/lib/agent-delegation.ts (open-
 * source the lib next sprint) and never call this endpoint at all.
 * The server is a CONVENIENCE, not a TRUST ANCHOR.
 *
 * No auth: the data being verified is already signed; an attacker
 * who fakes a request gets back "valid:false" because the math
 * doesn't lie. There's nothing to attack.
 *
 * Rate-limited at the platform middleware level.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyDelegation,
  verifyAgentAction,
  type DelegationRecord,
} from "@/lib/agent-delegation";

export const runtime = "nodejs";

const DelegationSchema = z.object({
  userId: z.string().min(1),
  agentName: z.string().min(1),
  agentPublicKey: z.string().min(1),
  scope: z.record(z.string(), z.unknown()).default({}),
  issuedAt: z.string(),
  expiresAt: z.string(),
  delegationMessage: z.string().min(1),
  userSignature: z.string().min(1),
  revokedAt: z.string().optional(),
  revocationMessage: z.string().optional(),
  revocationSignature: z.string().optional(),
});

const VerifyBodySchema = z.object({
  userPublicKey: z.string().min(1),
  delegation: DelegationSchema,
  // Optional: also verify a specific action against this delegation.
  action: z
    .object({
      action: z.string().min(1),
      agentName: z.string().min(1),
      timestampIso: z.string(),
      payload: z.unknown(),
      agentSignature: z.string().min(1),
      expectedChainHash: z.string().min(1),
      prevChainHash: z.string().nullable(),
    })
    .optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = VerifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const delegationResult = verifyDelegation({
    delegation: parsed.data.delegation as DelegationRecord,
    userPublicKey: parsed.data.userPublicKey,
  });

  let actionResult: ReturnType<typeof verifyAgentAction> | null = null;
  if (parsed.data.action) {
    actionResult = verifyAgentAction({
      action: parsed.data.action.action,
      agentName: parsed.data.action.agentName,
      timestampIso: parsed.data.action.timestampIso,
      payload: parsed.data.action.payload,
      agentSignature: parsed.data.action.agentSignature,
      agentPublicKey: parsed.data.delegation.agentPublicKey,
      expectedChainHash: parsed.data.action.expectedChainHash,
      prevChainHash: parsed.data.action.prevChainHash,
    });
  }

  return NextResponse.json(
    {
      delegation: delegationResult,
      action: actionResult,
      verifiedAt: new Date().toISOString(),
      note:
        "This verification was performed locally on this server. " +
        "You can perform the SAME verification independently using src/lib/agent-delegation.ts " +
        "or any Ed25519 library — Sovereign is not a required trust anchor.",
    },
    { status: 200 },
  );
}
