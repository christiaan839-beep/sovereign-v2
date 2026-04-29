/**
 * POST /api/identity/manifests
 *
 * Register a NEW agent identity manifest.
 *
 * The user has already signed the manifest CLIENT-SIDE with their
 * R34 CADC private key. This endpoint accepts the SignedManifest +
 * verifies the signature server-side (defense-in-depth) + persists.
 *
 * The platform NEVER sees the user's private key. The signature is
 * verified locally with the embedded ownerPublicKey + the canonical
 * message. If anything is wrong, the signature won't verify.
 *
 * AUTH: requireMutatingAuth — registering on behalf of yourself.
 *       The userId from the auth must match manifest.owner.
 *
 * AUDIT: every registration is hash-chained via the audit log
 *        (R26), and the manifest itself joins the chain via its
 *        previous_manifest_hash field (R38).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireMutatingAuth } from "@/lib/auth-guard";
import { verifyManifest, type SignedManifest } from "@/lib/agent-identity";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("identity-register");

export const runtime = "nodejs";

// Zod schema for the SignedManifest shape. We don't trust the client
// to send well-formed JSON; validate every field.
const SignedManifestSchema = z.object({
  $schema: z.literal("sovereign-identity-manifest/v1"),
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  version: z.string().min(1).max(50),
  owner: z.string().min(1).max(200),
  ownerPublicKey: z.string().min(1).max(200),
  purpose: z.string().min(1).max(2000),
  capabilities: z.array(z.string().min(1).max(100)).max(50),
  modelProvenance: z.object({
    models: z.array(z.string().min(1).max(100)).max(20),
    promptHash: z.string().min(1).max(200),
  }),
  codeProvenance: z.object({
    repository: z.string().url().optional(),
    commitHash: z.string().min(1).max(200).optional(),
    buildTimestamp: z.string().optional(),
  }).optional(),
  trainingDataDeclaration: z.string().max(2000).optional(),
  previousManifestHash: z.string().nullable(),
  issuedAt: z.string(),
  expiresAt: z.string(),
  manifestMessage: z.string().min(1).max(4000),
  manifestSignature: z.string().min(1).max(200),
  chainHash: z.string().length(64),
  // Revocation fields not present at register time
});

export async function POST(req: Request) {
  const auth = await requireMutatingAuth(req);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SignedManifestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const manifest = parsed.data as SignedManifest;

  // Defense-in-depth: the manifest's owner field must match the
  // authenticated user. The Ed25519 signature itself is a stronger
  // binding (only someone with the private key could sign), but we
  // also check the userId for auditability.
  if (manifest.owner !== auth.userId) {
    log.warn("Manifest owner != auth userId", {
      authUserId: auth.userId,
      manifestOwner: manifest.owner,
    });
    return NextResponse.json(
      { error: "Manifest owner must match authenticated user" },
      { status: 403 },
    );
  }

  // Verify the signature SERVER-SIDE before persisting. This is
  // defense-in-depth — the same verification will run for any third
  // party fetching this manifest later via @sovereign/inspector.
  const verification = verifyManifest({
    manifest,
    expectedOwnerPublicKey: manifest.ownerPublicKey,
  });
  if (!verification.valid) {
    log.warn("Manifest verification failed", {
      reason: verification.reason,
      manifestId: manifest.id,
    });
    return NextResponse.json(
      { error: `Signature verification failed: ${verification.reason}` },
      { status: 400 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  try {
    const { db } = await import("@/db");
    const { agentIdentityManifests, userSigningKeys } = await import("@/db/schema");

    // Defense-in-depth: the ownerPublicKey must be a registered (R34)
    // user signing key. Otherwise anyone could mint a key + claim it
    // belongs to user X.
    const keyRows = await db
      .select()
      .from(userSigningKeys)
      .where(eq(userSigningKeys.publicKey, manifest.ownerPublicKey))
      .limit(1);
    if (keyRows.length === 0) {
      return NextResponse.json(
        { error: "ownerPublicKey not registered in user_signing_keys" },
        { status: 403 },
      );
    }
    if (keyRows[0].userId !== auth.userId) {
      return NextResponse.json(
        { error: "ownerPublicKey belongs to a different user" },
        { status: 403 },
      );
    }

    // Persist.
    await db.insert(agentIdentityManifests).values({
      agentId: manifest.id,
      version: manifest.version,
      ownerUserId: manifest.owner,
      ownerPublicKey: manifest.ownerPublicKey,
      manifestJson: manifest as unknown as Record<string, unknown>,
      manifestMessage: manifest.manifestMessage,
      manifestSignature: manifest.manifestSignature,
      chainHash: manifest.chainHash,
      previousManifestHash: manifest.previousManifestHash ?? null,
      expiresAt: new Date(manifest.expiresAt),
    });

    // Audit log — hash-chained record of the registration.
    await auditLog({
      userId: auth.userId,
      action: "settings.update",
      resource: `agent-identity:${manifest.id}`,
      details: {
        operation: "register_manifest",
        agentId: manifest.id,
        version: manifest.version,
        chainHash: manifest.chainHash,
        previousManifestHash: manifest.previousManifestHash,
      },
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        agentId: manifest.id,
        version: manifest.version,
        chainHash: manifest.chainHash,
      },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("idx_agent_identity_chain_hash") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "Manifest with this chain hash already registered" },
        { status: 409 },
      );
    }
    log.error("Register manifest failed", { error: msg });
    return NextResponse.json(
      { error: "Failed to persist manifest" },
      { status: 500 },
    );
  }
}
