/**
 * SOVEREIGN MATRIX — /api/auditor/verify-bundle (Wave 23)
 *
 * Public bundle verifier. An auditor extracted MANIFEST.signed.json
 * from a Sovereign receipt bundle and wants to know "is this manifest
 * intact, and does its signature reproduce under the platform's
 * public Ed25519 key?"
 *
 * POST { manifest: <parsed-MANIFEST.signed.json> }
 *   → 200 { ok: true, ... }
 *   → 200 { ok: false, reason }
 *
 * No auth required. The math is the math; we don't disclose any
 * server-side data beyond the verdict.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyManifest, type BundleManifest } from "@/lib/receipt-bundle";

const limiter = rateLimit({ interval: 60, limit: 60 });

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  let body: { manifest?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON with a `manifest` field" },
      { status: 400 },
    );
  }
  if (!body.manifest || typeof body.manifest !== "object") {
    return NextResponse.json(
      { error: "manifest is required" },
      { status: 400 },
    );
  }

  const result = verifyManifest(body.manifest as BundleManifest);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: result.reason,
        verifiedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
  const m = body.manifest as BundleManifest;
  return NextResponse.json(
    {
      ok: true,
      receiptCount: m.receiptCount,
      bundleDigest: m.bundleDigest,
      manifestHash: m.manifestHash,
      generatedAt: m.generatedAt,
      verifiedAt: new Date().toISOString(),
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
