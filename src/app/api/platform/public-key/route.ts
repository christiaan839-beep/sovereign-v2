/**
 * GET /api/platform/public-key
 *
 * Returns the ed25519 public key that the platform uses to sign
 * invocation attestations. Anyone can fetch this and verify
 * attestations offline using standard WebCrypto libraries.
 *
 * The PUBLIC key is derived from the PRIVATE key configured in
 * PLATFORM_SIGNING_KEY (PKCS8 base64url). No private material leaves
 * this server.
 *
 * This is the trust anchor for the verifiable-computation layer:
 * auditors, regulators, and customer compliance tools can use this
 * key to independently verify that any invocation attestation was
 * produced by Sovereign Matrix and hasn't been tampered with.
 *
 * Graceful: when the signing key isn't configured, returns 503 with
 * a helpful message. When configured, returns:
 *
 *   {
 *     "alg": "ed25519",
 *     "publicKey": "<base64url-encoded OKP x value>",
 *     "format": "jwk",
 *     "platform": "sovereignmatrix.agency"
 *   }
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("platform-public-key");

function platformKeyAvailable(): boolean {
  const v = process.env.PLATFORM_SIGNING_KEY;
  return typeof v === "string" && v.length > 0;
}

function base64urlDecode(b64url: string): Uint8Array {
  const pad =
    b64url.length % 4 === 2 ? "==" : b64url.length % 4 === 3 ? "=" : "";
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const PLATFORM_HOST =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ??
  "sovereignmatrix.agency";

export const revalidate = 86400; // public key changes rarely — cache 24h

export async function GET(): Promise<Response> {
  if (!platformKeyAvailable()) {
    return NextResponse.json(
      {
        alg: "ed25519",
        available: false,
        platform: PLATFORM_HOST,
        reason:
          "Platform signing key not configured — invocation attestations are currently unsigned.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    // Import the private key briefly ONLY to export the public half
    // as JWK. Private material stays on the server.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subtle = crypto.subtle as any;
    const priv = await subtle.importKey(
      "pkcs8",
      base64urlDecode(process.env.PLATFORM_SIGNING_KEY as string),
      "Ed25519",
      true,
      ["sign"],
    );
    const jwk = (await subtle.exportKey("jwk", priv)) as { x?: string };
    if (!jwk.x) {
      throw new Error("Private key lacks 'x' component");
    }

    return NextResponse.json(
      {
        alg: "ed25519",
        available: true,
        format: "jwk",
        publicKey: jwk.x,
        platform: PLATFORM_HOST,
      },
      {
        status: 200,
        headers: {
          // Long cache — public key is stable between rotations.
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (err) {
    log.error("public-key endpoint threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        alg: "ed25519",
        available: false,
        platform: PLATFORM_HOST,
        reason: "Key export failed",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
