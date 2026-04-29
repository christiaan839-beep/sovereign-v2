/**
 * POST /api/identity/verify
 *
 * PUBLIC, no-auth manifest verifier. Mirrors `/api/health/verify-delegation`
 * for R34, and `/api/health/verify-token` (future) for R37 ACTs.
 *
 * The caller posts a SignedManifest + the expected ownerPublicKey.
 * The endpoint runs `verifyManifest()` locally and returns the
 * result. Note: the SAME verification can run on the caller's
 * machine via `@sovereign/inspector` — no Sovereign server is a
 * required trust anchor. This endpoint is a CONVENIENCE.
 *
 * Optional: if `chain` is provided (an array of SignedManifest
 * version chain), runs `verifyManifestChain()` instead.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyManifest,
  verifyManifestChain,
  type SignedManifest,
} from "@/lib/agent-identity";

export const runtime = "nodejs";

const SignedManifestSchema = z.object({
  $schema: z.literal("sovereign-identity-manifest/v1"),
  id: z.string(),
  name: z.string(),
  version: z.string(),
  owner: z.string(),
  ownerPublicKey: z.string(),
  purpose: z.string(),
  capabilities: z.array(z.string()),
  modelProvenance: z.object({
    models: z.array(z.string()),
    promptHash: z.string(),
  }),
  codeProvenance: z.object({
    repository: z.string().optional(),
    commitHash: z.string().optional(),
    buildTimestamp: z.string().optional(),
  }).optional(),
  trainingDataDeclaration: z.string().optional(),
  previousManifestHash: z.string().nullable(),
  issuedAt: z.string(),
  expiresAt: z.string(),
  manifestMessage: z.string(),
  manifestSignature: z.string(),
  chainHash: z.string(),
  revokedAt: z.string().optional(),
  revocationMessage: z.string().optional(),
  revocationSignature: z.string().optional(),
});

const VerifyBodySchema = z.object({
  expectedOwnerPublicKey: z.string().min(1),
  manifest: SignedManifestSchema.optional(),
  chain: z.array(SignedManifestSchema).optional(),
}).refine(
  (data) => data.manifest !== undefined || data.chain !== undefined,
  { message: "Either 'manifest' or 'chain' must be provided" },
);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = VerifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.chain) {
    const result = verifyManifestChain({
      manifests: parsed.data.chain as SignedManifest[],
      expectedOwnerPublicKey: parsed.data.expectedOwnerPublicKey,
    });
    return NextResponse.json({
      mode: "chain",
      result,
      verifiedAt: new Date().toISOString(),
      note:
        "This verification was performed on this server. " +
        "You can perform the SAME verification independently using " +
        "@sovereign/inspector — Sovereign is not a required trust anchor.",
    });
  }

  // Single manifest verification.
  const result = verifyManifest({
    manifest: parsed.data.manifest as SignedManifest,
    expectedOwnerPublicKey: parsed.data.expectedOwnerPublicKey,
  });
  return NextResponse.json({
    mode: "single",
    result,
    verifiedAt: new Date().toISOString(),
    note:
      "This verification was performed on this server. " +
      "You can perform the SAME verification independently using " +
      "@sovereign/inspector — Sovereign is not a required trust anchor.",
  });
}
