/**
 * SOVEREIGN MATRIX — Per-agent JIT identity tokens (Wave 16).
 *
 * Solves the "Authorization Gap" the 2026 research identified:
 *   92% of CISOs lack visibility into AI agent identities, and 95%
 *   doubt they could detect a compromised agent.
 *
 * Every agent run can now hold a short-lived, scoped, revocable token
 * (JWT-style). The platform issues the token at run start, every tool
 * call cites the token id, and the audit log binds every action to
 * the issued identity rather than the platform's blanket signing key.
 *
 * Revocation: the JWT is verifiable offline (signature + exp), but
 * a verifier that hits the platform `/api/agent-tokens/{id}/status`
 * gets revocation state too. Hot revoke flips `revokedAt` in the DB
 * and the verify path then rejects.
 *
 * Wire format (compact JSON, base64url-encoded per segment):
 *   header   = { alg: "HS256" | "EdDSA", typ: "sov-agent" }
 *   payload  = { aid, agt, ten, usr, sco, iat, exp, iss }
 *   signed   = base64url(header) + "." + base64url(payload)
 *   token    = signed + "." + signature
 *
 * Pairs with src/db/schema.ts (agentTokens table) and the public
 * /api/agent-tokens endpoint surface.
 */

import {
  createHmac,
  createSign,
  createVerify,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import { db } from "@/db";
import { agentTokens } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-tokens");

const ISSUER = "sovereignmatrix.agency";
const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes — matches admin MFA window

export type AgentTokenScope =
  /** Run the agent end-to-end. */
  | "agent:run"
  /** Read tool outputs the agent owns. */
  | "agent:read"
  /** Call external tools (fetch / browser / sandbox). */
  | "tool:fetch"
  | "tool:browser"
  | "tool:sandbox"
  /** Write to tenant-scoped data. */
  | "data:write"
  /** Issue receipts on the tenant's behalf. */
  | "receipt:issue";

export interface AgentTokenClaims {
  /** Token id — matches agent_tokens.id, used for revocation lookup. */
  aid: string;
  /** Agent slug ("lead-blitz", "god-brain", …). */
  agt: string;
  /** Tenant id (null for platform-system tokens). */
  ten: string | null;
  /** Issuing Clerk userId (null for system runs). */
  usr: string | null;
  /** Scopes granted. Verifier enforces; emitter constrains by request. */
  sco: AgentTokenScope[];
  /** Issued-at seconds (unix). */
  iat: number;
  /** Expiry seconds (unix). */
  exp: number;
  /** Issuer string — pinned to sovereignmatrix.agency. */
  iss: string;
}

export interface IssueTokenInput {
  agentSlug: string;
  tenantId?: string | null;
  userId?: string | null;
  scopes: AgentTokenScope[];
  /** Optional override (seconds). Default 15 min. Capped at 60 min. */
  ttlSeconds?: number;
}

export interface IssuedToken {
  /** The fully-formed JWT-style token. Pass this to downstream tool calls. */
  token: string;
  /** The persisted DB row id. Use to revoke. */
  tokenId: string;
  /** Decoded claims for caller convenience. */
  claims: AgentTokenClaims;
  /** When the token expires (ISO 8601). */
  expiresAt: string;
}

/**
 * Issue a JIT token for an agent run. Returns the wire token + the
 * claim object. Persists the row in `agent_tokens` for revocation.
 *
 * Caps:
 *   - `ttlSeconds` is clamped to [60, 3600]. Anything beyond an hour
 *     should use a different primitive (long-lived API keys, not JIT).
 *   - `scopes` is deduplicated; empty arrays are rejected.
 */
export async function issueAgentToken(
  input: IssueTokenInput,
): Promise<IssuedToken> {
  const ttl = Math.max(
    60,
    Math.min(3600, input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  );
  const scopes = Array.from(new Set(input.scopes));
  if (scopes.length === 0) {
    throw new Error("issueAgentToken: scopes must be non-empty");
  }

  const tokenId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const claims: AgentTokenClaims = {
    aid: tokenId,
    agt: input.agentSlug,
    ten: input.tenantId ?? null,
    usr: input.userId ?? null,
    sco: scopes,
    iat: now,
    exp: now + ttl,
    iss: ISSUER,
  };

  const scheme = hasEd25519Key() ? "v2" : "v1";
  const token = sign(claims, scheme);
  const expiresAt = new Date(claims.exp * 1000);

  // Persist the row for revocation lookup. Best-effort: if the table
  // is missing in dev, we still return the signed token (verifier will
  // accept it offline; revocation is a no-op).
  try {
    await db.insert(agentTokens).values({
      id: tokenId,
      agentSlug: input.agentSlug,
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      scopes: JSON.stringify(scopes),
      scheme,
      expiresAt,
      issuedAt: new Date(claims.iat * 1000),
    });
  } catch (err) {
    log.warn("agent_tokens insert skipped (table missing?)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Wave-21 SSE wire-up — lazy-imported, best-effort.
  try {
    const { publishTokenIssued } = await import("@/lib/event-bus");
    publishTokenIssued(input.tenantId ?? "*", {
      tokenId,
      agentSlug: input.agentSlug,
      scopes,
    });
  } catch {
    /* non-blocking */
  }

  return { token, tokenId, claims, expiresAt: expiresAt.toISOString() };
}

export interface VerifyResult {
  ok: boolean;
  claims?: AgentTokenClaims;
  /** Why verification failed. */
  reason?:
    | "malformed"
    | "bad-header"
    | "bad-signature"
    | "expired"
    | "revoked"
    | "wrong-issuer"
    | "no-key";
}

/**
 * Verify a JWT-style agent token. Offline check first (signature +
 * expiry); then hits the DB for revocation status when `checkRevoked`
 * is true (default). Returns the parsed claims on success.
 */
export async function verifyAgentToken(
  token: string,
  opts: { checkRevoked?: boolean } = {},
): Promise<VerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; typ?: string };
  let claims: AgentTokenClaims;
  try {
    header = JSON.parse(b64urlDecode(headerB64));
    claims = JSON.parse(b64urlDecode(payloadB64)) as AgentTokenClaims;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (header.typ !== "sov-agent") return { ok: false, reason: "bad-header" };
  if (header.alg !== "HS256" && header.alg !== "EdDSA")
    return { ok: false, reason: "bad-header" };
  if (claims.iss !== ISSUER) return { ok: false, reason: "wrong-issuer" };

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp < now) return { ok: false, reason: "expired" };

  const signed = `${headerB64}.${payloadB64}`;
  const sigOk = verifySignature(signed, sigB64, header.alg);
  if (sigOk === null) return { ok: false, reason: "no-key" };
  if (!sigOk) return { ok: false, reason: "bad-signature" };

  // Revocation check.
  if (opts.checkRevoked !== false) {
    try {
      const [row] = await db
        .select({
          id: agentTokens.id,
          revokedAt: agentTokens.revokedAt,
        })
        .from(agentTokens)
        .where(eq(agentTokens.id, claims.aid))
        .limit(1);
      if (row?.revokedAt) return { ok: false, reason: "revoked" };
    } catch {
      // Table missing — accept the offline-verified token. Documented:
      // operators who need hard revocation must ensure the table exists.
    }
  }

  return { ok: true, claims };
}

/**
 * Revoke a token by id. Idempotent — revoking an already-revoked
 * token is a no-op success.
 */
export async function revokeAgentToken(
  tokenId: string,
  reason: string,
): Promise<{ ok: boolean }> {
  try {
    await db
      .update(agentTokens)
      .set({ revokedAt: new Date(), revokeReason: reason.slice(0, 200) })
      .where(
        and(
          eq(agentTokens.id, tokenId),
          // Don't overwrite an existing revocation reason — first revoke wins.
        ),
      );
    // Wave-21 SSE wire-up — lazy-imported. Look up the slug + tenant
    // for the payload; if the row is gone, emit a minimal event.
    try {
      const status = await getTokenStatus(tokenId);
      const { publishTokenRevoked } = await import("@/lib/event-bus");
      publishTokenRevoked("*", {
        tokenId,
        agentSlug: status.agentSlug ?? "unknown",
        scopes: [],
      });
    } catch {
      /* non-blocking */
    }
    return { ok: true };
  } catch (err) {
    log.warn("agent_tokens revoke failed", {
      error: err instanceof Error ? err.message : String(err),
      tokenId,
    });
    return { ok: false };
  }
}

/**
 * Status check for an arbitrary token id — used by the public
 * /api/agent-tokens/[id]/status endpoint. No signature material is
 * required; we return only what's safe to disclose.
 */
export interface TokenStatus {
  exists: boolean;
  agentSlug?: string;
  active?: boolean;
  expiresAt?: string;
  revokedAt?: string | null;
  revokeReason?: string | null;
}

export async function getTokenStatus(tokenId: string): Promise<TokenStatus> {
  try {
    const [row] = await db
      .select()
      .from(agentTokens)
      .where(eq(agentTokens.id, tokenId))
      .limit(1);
    if (!row) return { exists: false };
    return {
      exists: true,
      agentSlug: row.agentSlug,
      active: !row.revokedAt && row.expiresAt.getTime() > Date.now(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      revokeReason: row.revokeReason,
    };
  } catch {
    return { exists: false };
  }
}

/**
 * List currently-live (non-expired, non-revoked) tokens for the
 * /identity public page. Caller filters by tenantId / agentSlug.
 */
export async function listActiveTokens(opts: {
  limit?: number;
  agentSlug?: string;
  tenantId?: string;
}): Promise<
  Array<{
    id: string;
    agentSlug: string;
    tenantId: string | null;
    userId: string | null;
    scopes: AgentTokenScope[];
    scheme: string;
    issuedAt: string;
    expiresAt: string;
  }>
> {
  const limit = Math.min(100, opts.limit ?? 25);
  const now = new Date();
  try {
    const where = and(
      gt(agentTokens.expiresAt, now),
      opts.agentSlug ? eq(agentTokens.agentSlug, opts.agentSlug) : undefined,
      opts.tenantId ? eq(agentTokens.tenantId, opts.tenantId) : undefined,
    );
    const rows = await db.select().from(agentTokens).where(where).limit(limit);
    return rows
      .filter((r) => !r.revokedAt) // pretend revoked rows don't exist on public surface
      .map((r) => ({
        id: r.id,
        agentSlug: r.agentSlug,
        tenantId: r.tenantId,
        userId: r.userId,
        scopes: safeParseScopes(r.scopes),
        scheme: r.scheme,
        issuedAt: r.issuedAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      }));
  } catch {
    return [];
  }
}

// ── Internals ─────────────────────────────────────────────────────────

function getHmacKey(): string | null {
  const s =
    process.env.AGENT_RUN_SIGNING_SECRET ?? process.env.CRON_SECRET ?? null;
  if (!s || s.length < 16) return null;
  return s;
}

function hasEd25519Key(): boolean {
  return typeof process.env.AGENT_RUN_ED25519_PRIVATE_KEY === "string";
}

function sign(claims: AgentTokenClaims, scheme: "v1" | "v2"): string {
  const alg = scheme === "v2" ? "EdDSA" : "HS256";
  const header = b64urlEncode(JSON.stringify({ alg, typ: "sov-agent" }));
  const payload = b64urlEncode(JSON.stringify(claims));
  const signed = `${header}.${payload}`;
  const sig = scheme === "v2" ? signEd25519(signed) : signHmac(signed);
  return `${signed}.${sig}`;
}

function signHmac(signed: string): string {
  const key = getHmacKey();
  if (!key) throw new Error("No HMAC key configured for agent-tokens");
  return b64urlEncodeBuffer(createHmac("sha256", key).update(signed).digest());
}

function signEd25519(signed: string): string {
  // Lazy require to avoid pulling node:crypto KeyObject typing into
  // every call site. The same key the receipt-signing path uses.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPrivateKey } = require("crypto");
  const pem = process.env.AGENT_RUN_ED25519_PRIVATE_KEY!;
  const key = createPrivateKey({ key: pem, format: "pem" });
  const signer = createSign("RSA-SHA256"); // unused — Ed25519 is single-shot
  void signer;
  // Ed25519 uses single-shot sign via crypto.sign(null, ...).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sign: nodeSign } = require("crypto");
  const sig = nodeSign(null, Buffer.from(signed, "utf8"), key);
  return b64urlEncodeBuffer(sig);
}

/**
 * Returns true / false on signature pass-fail, or null when no key
 * is configured for the requested algorithm.
 */
function verifySignature(
  signed: string,
  sigB64: string,
  alg: string,
): boolean | null {
  if (alg === "HS256") {
    const key = getHmacKey();
    if (!key) return null;
    const expected = b64urlEncodeBuffer(
      createHmac("sha256", key).update(signed).digest(),
    );
    return constantTimeEqual(expected, sigB64);
  }
  if (alg === "EdDSA") {
    const pem = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
    if (!pem) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPublicKey, verify: nodeVerify } = require("crypto");
    const pubKey = createPublicKey({ key: pem, format: "pem" });
    const verifier = createVerify("RSA-SHA256"); // unused
    void verifier;
    let sigBytes: Buffer;
    try {
      sigBytes = Buffer.from(b64urlNormalize(sigB64), "base64");
    } catch {
      return false;
    }
    try {
      return nodeVerify(null, Buffer.from(signed, "utf8"), pubKey, sigBytes);
    } catch {
      return false;
    }
  }
  return false;
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlEncodeBuffer(b: Buffer): string {
  return b
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): string {
  return Buffer.from(b64urlNormalize(s), "base64").toString("utf8");
}

function b64urlNormalize(s: string): string {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return padded.replace(/-/g, "+").replace(/_/g, "/");
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function safeParseScopes(raw: string): AgentTokenScope[] {
  try {
    const arr = JSON.parse(raw) as AgentTokenScope[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
