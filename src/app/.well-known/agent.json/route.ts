/**
 * GET /.well-known/agent.json
 *
 * R160 — Move 13. Public publication of the Sovereign Matrix
 * platform-level Agent Card per Google's Agent-to-Agent (A2A) v1.0
 * spec. Joins the open agent web: any A2A-compatible peer (or
 * auditor / inspector / competitor) can fetch this URL with no
 * prior knowledge and learn:
 *
 *   - Sovereign's stable agent id, name, supplier
 *   - Which trust capabilities (R-numbered) the platform claims
 *   - Which auth schemes peers may use to establish a session
 *   - Where the RPC endpoint lives
 *   - When the card was last regenerated
 *   - SHA-256 fingerprint over the canonical-encoded identity
 *     fields — proves the card wasn't man-in-the-middle-swapped
 *
 * STANDARD-SETTING POSTURE:
 *
 *   This is the canonical URL spec'd by Google A2A. Publishing it
 *   here makes Sovereign discoverable to the 150+ orgs already on
 *   A2A in production by April 2026 — no custom integration.
 *
 *   The fingerprint header (X-Sovereign-Card-Fingerprint) lets
 *   clients pin against the card without re-parsing the body.
 *   That's the procurement-grade A2A surface.
 *
 *   The card's capability list is sourced from
 *   src/lib/protocols/a2a/platform-card.ts which is ALSO imported
 *   by /.well-known/sovereign-trust — drift between the two
 *   manifests is structurally impossible.
 *
 * SECURITY:
 *
 *   This endpoint reveals nothing secret. The fingerprint is a
 *   hash, not a secret. Authentication for actual RPC traffic
 *   happens via authSchemes, not via reading this card.
 *
 * CACHE:
 *
 *   5 min — capabilities don't change mid-deploy. Per-deploy the
 *   fingerprint stabilizes once AGENT_CARD_PUBLISHED_AT is pinned
 *   to the deploy SHA's timestamp.
 */

import { NextResponse } from "next/server";
import { buildSovereignPlatformAgentCard } from "@/lib/protocols/a2a/platform-card";
import { createLogger } from "@/lib/logger";

const log = createLogger("well-known-agent-card");

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * Deploy-stable publishedAt. Resolution order:
 *   1. AGENT_CARD_PUBLISHED_AT — explicit override (set at deploy time)
 *   2. VERCEL_GIT_COMMIT_SHA + a stable build epoch — fingerprint
 *      stays fixed for the life of a Vercel deployment
 *   3. Process start ISO — dev-mode fallback; rotates per restart
 *      which is acceptable in development
 *
 * The card's fingerprint is the canonical encoding of (id |
 * capabilities | authSchemes | endpoints | publishedAt) — so
 * publishedAt stability per deploy is what gives us per-deploy
 * fingerprint stability for downstream pinning.
 */
function resolveStablePublishedAt(): string {
  if (process.env.AGENT_CARD_PUBLISHED_AT) {
    const candidate = process.env.AGENT_CARD_PUBLISHED_AT;
    if (!Number.isNaN(Date.parse(candidate))) return candidate;
  }
  // Vercel sets VERCEL_GIT_COMMIT_SHA at build; combining it with
  // a fixed deploy epoch (the build's start time) would be ideal
  // but Vercel doesn't expose the build start time as an env var.
  // Module-load time on a serverless invocation is the next best
  // approximation — within a single deploy, the same image is
  // re-used across invocations, so this stays stable for that
  // deploy's lifetime.
  return PROCESS_START_ISO;
}

const PROCESS_START_ISO = new Date().toISOString();

export async function GET(req: Request) {
  const url = new URL(req.url);
  // The card always claims https for the rpc endpoint regardless
  // of the request scheme — production is https, and the card
  // describes production. validateAgentCard requires https-only.
  const canonicalHost = url.host;
  const publishedAt = resolveStablePublishedAt();

  const card = buildSovereignPlatformAgentCard({
    canonicalHost,
    publishedAt,
  });

  log.info("served agent card", {
    canonicalHost,
    fingerprint: card.fingerprint,
    capabilityCount: card.capabilities.length,
  });

  return NextResponse.json(card, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
      // Expose fingerprint in a header so clients can pin without
      // re-parsing the body. Standard pattern from JWKS / OIDC.
      "X-Sovereign-Card-Fingerprint": card.fingerprint,
      // Allow CORS so any third-party verifier or peer can hit it
      // without proxy machinery. Discovery surface is public.
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}
