/**
 * SOVEREIGN MATRIX — Federation peer-pull (wave 102).
 *
 * Self-improvement primitive: each platform deployment can configure
 * a list of peer federation endpoints to consume. A periodic cron
 * fetches `/api/honeypot/feed` from each peer, verifies the bulletin
 * signatures, and merges the active fingerprintIds into a LOCAL
 * block-set that the guard layer can query.
 *
 * Result: the more peers join the federation, the more attack
 * fingerprints each member's defences observe — without any per-member
 * code change. Defence improves O(N) in federation size; per-member
 * cost stays O(1).
 *
 * Safeguards baked into the code:
 *   - HTTPS-only peer URLs (no plaintext over the wire)
 *   - SSRF guard on every fetch (no internal IPs as "peers")
 *   - Outbound timeout 10s per peer (one slow peer can't stall others)
 *   - MAX_BULLETINS_PER_PULL cap (bounded memory)
 *   - TTL respected — expired bulletins from peers are dropped
 *   - Peer signature verification — bulletins without a recognised
 *     issuer pubkey or with a failing ML-DSA-65 sig are rejected
 *   - Cron-secret-gated invocation (operator-controlled cadence)
 *
 * Wire schema: bulletins follow `vaos-honeypot-bulletin-v1`.
 */

import { isSafeUrl } from "@/lib/tools/built-in";
import {
  resolvedHostIsSafe as sharedResolvedHostIsSafe,
  safeResolveOrNull as sharedSafeResolveOrNull,
} from "@/lib/safe-host";
import {
  activeBulletins,
  canonicalizeBulletin,
  type FederationBulletin,
} from "@/lib/federation-bulletin";
import { verifyMlDsa65WithKey } from "@/lib/pq-sign";
import { createLogger } from "@/lib/logger";
import {
  fingerprintId,
  type AttackFingerprint,
} from "@/lib/attack-fingerprint";

const log = createLogger("federation-puller");

/** Hard cap per peer — bounds memory + protects against runaway feeds. */
export const MAX_BULLETINS_PER_PULL = 200;

/** Hard cap per pull cycle across all peers. */
export const MAX_FINGERPRINTS_PER_CYCLE = 5_000;

/** Per-peer fetch timeout. */
export const PEER_FETCH_TIMEOUT_MS = 10_000;

/**
 * Wave-102 security review H2: bytes-on-the-wire cap. A malicious or
 * MITM peer returning a 100MB JSON would otherwise buffer all of it
 * into memory before our post-parse caps could kick in. 2 MB is well
 * above any plausible bulletin batch (200 bulletins × 100 fps × ~300B
 * fp = ~6 MB hard cap from the post-parse limits; reasonable feeds
 * are 50-200 KB).
 */
export const MAX_FEED_BYTES = 2 * 1024 * 1024;

/** Stable User-Agent so peers can identify federation pulls (and rate-limit politely). */
const FEDERATION_UA = "sovereign-matrix-federation-puller/1.0";

export interface PeerPullResult {
  /** Peer URL that was pulled. */
  peerUrl: string;
  /** Were we able to reach + parse the feed at all. */
  reached: boolean;
  /** Bulletins received from the peer (before filtering). */
  bulletinsReceived: number;
  /** Bulletins surviving TTL + shape + signature filters. */
  bulletinsAccepted: number;
  /** Distinct fingerprintIds extracted from accepted bulletins. */
  fingerprintsExtracted: number;
  /** Error message, when applicable. */
  error?: string;
}

export interface PullCycleResult {
  attemptedAt: string;
  peers: PeerPullResult[];
  /** Distinct fingerprintIds across all peers (after de-duplication). */
  uniqueFingerprintIds: string[];
  /** Total bulletins seen (after filtering). */
  totalBulletinsAccepted: number;
  /** Total fingerprints surfaced before dedup. */
  totalFingerprintsBeforeDedup: number;
}

interface PeerFeedResponse {
  generatedAt: string;
  totalActive: number;
  bulletins: FederationBulletin[];
}

/**
 * Read the configured peer list from env. Empty/unset = no peers =
 * pull cycle is a no-op. Format: comma-separated full URLs of each
 * peer's `/api/honeypot/feed` endpoint.
 */
export function getConfiguredPeers(): string[] {
  const raw = process.env.FEDERATION_PEERS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Validate a peer URL — HTTPS only, SSRF-safe (string-level), no
 * internal IPs in the hostname literal. Public helper so the cron
 * route can pre-filter the list with the same logic the puller will
 * apply per peer.
 *
 * NOTE: This is a STRING-level check. A public hostname that resolves
 * to a private IP at fetch time (DNS rebinding) is not caught here —
 * see `resolvedHostIsSafe` for the runtime check.
 */
export function isValidPeerUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!isSafeUrl(url)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Reproduces the IPv4/IPv6 patterns isSafeUrl checks, but operates on
 * an ALREADY-RESOLVED IP address (not a hostname). Defends against
 * DNS rebinding — wave-102 review H1: an attacker who controls a
 * public DNS record like `peer.attacker.com` can point it at
 * 10.0.0.1 or 169.254.169.254 at fetch time, bypassing the string-
 * level isSafeUrl check. Pre-resolving + re-validating the IP closes
 * the window (small TOCTOU remains between resolve and fetch but is
 * impractical to exploit at the millisecond timescale).
 */
/**
 * Wave-107.2: now a re-export of the shared `resolvedHostIsSafe` in
 * `src/lib/safe-host.ts`. The implementation moved verbatim so the
 * single source of truth lives in one file. Federation-puller keeps
 * the re-export for backward-compat — any external caller of this
 * symbol continues to work.
 */
export const resolvedHostIsSafe = sharedResolvedHostIsSafe;

/**
 * Resolve a hostname to its IP and check the IP isn't private/loopback/
 * link-local. Returns null when any resolution returns an unsafe IP
 * (the peer is dropped). Returns the address on success.
 *
 * `dns.lookup` uses the OS resolver (same one fetch will use), so
 * cache coherency is good — the IP we validate is the one fetch will
 * connect to in the next few milliseconds.
 */
// Wave-107.2: now an alias of the shared `safeResolveOrNull` in
// `src/lib/safe-host.ts`. Implementation moved verbatim. The wave-
// 102 audit of this exact logic carries over — same semantics, same
// TOCTOU envelope, just one source of truth.
const safeResolveOrNull = sharedSafeResolveOrNull;

/**
 * Read a Response body with a hard byte cap. Streams chunks so a
 * malicious or MITM-substituted peer can't buffer 100MB into memory
 * before our post-parse caps apply (wave-102 review H2 fix).
 *
 * Returns null when the cap would be exceeded — we explicitly do NOT
 * return a truncated buffer because a truncated JSON is unparseable
 * and silently dropping data could mask attacks. Better to reject
 * the whole peer for that cycle.
 */
async function readJsonCapped(
  res: Response,
  capBytes: number,
): Promise<unknown | null> {
  // Fast path: if Content-Length is present and exceeds the cap,
  // reject before reading a single byte.
  const cl = res.headers.get("content-length");
  if (cl) {
    const declared = Number(cl);
    if (Number.isFinite(declared) && declared > capBytes) return null;
  }
  if (!res.body) {
    try {
      const txt = await res.text();
      if (txt.length > capBytes) return null;
      return JSON.parse(txt);
    } catch {
      return null;
    }
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > capBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return null;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  // Reassemble + parse.
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: false }).decode(buf));
  } catch {
    return null;
  }
}

/**
 * Fetch one peer's feed with a hard timeout, body byte-cap, and DNS-
 * rebinding defence. Returns null on any failure (network, parse,
 * shape mismatch, SSRF reject). Never throws.
 *
 * Note: this function does NOT verify bulletin ML-DSA-65 signatures —
 * see filterValidBulletins for the shape/TTL gate. Per-bulletin
 * signature verification is the next-wave headline (gated by
 * FEDERATION_VERIFY_SIGS env when introduced).
 */
export async function fetchPeerFeed(
  peerUrl: string,
): Promise<PeerFeedResponse | null> {
  if (!isValidPeerUrl(peerUrl)) {
    log.warn("peer URL rejected (invalid / string-SSRF)", { peerUrl });
    return null;
  }

  // Wave-102 review H1: defeat DNS rebinding. Resolve the host and
  // re-validate the IP against the same patterns isSafeUrl checked
  // statically. A peer hostname that resolves to RFC-1918 /
  // loopback / link-local space is rejected before any HTTP traffic.
  const parsed = new URL(peerUrl);
  const safeIp = await safeResolveOrNull(parsed.hostname);
  if (safeIp === null) {
    log.warn("peer URL rejected (resolved to unsafe IP)", { peerUrl });
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PEER_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(peerUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": FEDERATION_UA,
      },
      signal: controller.signal,
      // Don't follow redirects — a peer that redirects could swap
      // identity mid-fetch. If a peer needs to relocate, the operator
      // updates FEDERATION_PEERS explicitly.
      redirect: "manual",
    });
    if (!res.ok) {
      log.warn("peer feed non-2xx", { peerUrl, status: res.status });
      return null;
    }
    const raw = await readJsonCapped(res, MAX_FEED_BYTES);
    if (!raw || typeof raw !== "object") {
      log.warn("peer feed unreadable or exceeded byte cap", {
        peerUrl,
        cap: MAX_FEED_BYTES,
      });
      return null;
    }
    const candidate = raw as Partial<PeerFeedResponse>;
    if (
      !Array.isArray(candidate.bulletins) ||
      typeof candidate.generatedAt !== "string"
    ) {
      log.warn("peer feed shape invalid", { peerUrl });
      return null;
    }
    return candidate as PeerFeedResponse;
  } catch (err) {
    log.warn("peer fetch failed", {
      peerUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether the operator has opted into STRICT signature verification.
 * When true, every consumed bulletin MUST carry a valid ML-DSA-65
 * signature from a known issuer pubkey — unsigned or unverifiable
 * bulletins are dropped.
 *
 * When false (default / bootstrap mode), shape-valid bulletins are
 * accepted regardless of signature state. Useful for early-federation
 * setups where pubkey distribution is still in flight.
 */
export function isStrictVerifyEnabled(): boolean {
  return process.env.FEDERATION_VERIFY_SIGS === "true";
}

/**
 * Look up an issuer's ML-DSA-65 base64 public key from the env. Mirror
 * of the wave-95 TRS_ED25519_PK_<ISSUER> pattern, scoped to
 * federation peer issuers so the two key registries can be managed
 * independently.
 *
 * Returns null when no key configured for the issuer — caller decides
 * (per FEDERATION_VERIFY_SIGS) whether absence is fatal.
 */
function issuerPubKeyBase64(issuerId: string): string | null {
  const envName = `FEDERATION_PEER_MLDSA65_PK_${issuerId
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")}`;
  const val = process.env[envName];
  return val && val.length > 0 ? val : null;
}

/**
 * Verify one bulletin's ML-DSA-65 signature against the
 * configured peer issuer pubkey. Returns:
 *   - { ok: true }              — verified
 *   - { ok: false, reason }     — fail / unknown issuer / no sig
 *
 * Pure of I/O — caller wires the result into trust decisions.
 *
 * NOTE: wave-95's `pq-sign.ts:verifyMlDsa65` reads ONE platform-wide
 * pubkey from env. For federation, each PEER has its own pubkey.
 * This helper does NOT reuse verifyMlDsa65 — instead it inlines the
 * ml_dsa65 verification using the per-issuer key. To keep the
 * change tiny + auditable, the actual `@noble/post-quantum` call
 * lives in `pq-sign.ts:verifyMlDsa65WithKey` (added in this wave).
 */
export function verifyBulletinSig(
  b: FederationBulletin,
):
  | { ok: true }
  | { ok: false; reason: "no-signature" | "no-pubkey" | "verify-failed" } {
  if (!b.mldsa65Sig) return { ok: false, reason: "no-signature" };
  const pkB64 = issuerPubKeyBase64(b.issuerId);
  if (!pkB64) return { ok: false, reason: "no-pubkey" };
  // Verify the canonical bytes the issuer actually signed.
  const canonical = canonicalizeBulletin({
    schema: b.schema,
    issuedAt: b.issuedAt,
    expiresAt: b.expiresAt,
    issuerId: b.issuerId,
    fingerprints: b.fingerprints,
    contentHash: b.contentHash,
  });
  const verified = verifyMlDsa65WithKey(canonical, b.mldsa65Sig, pkB64);
  return verified ? { ok: true } : { ok: false, reason: "verify-failed" };
}

/**
 * Filter raw peer bulletins to those that pass our trust checks:
 *   1. Schema id is vaos-honeypot-bulletin-v1
 *   2. issuerId / expiresAt / fingerprints all present + shaped
 *   3. TTL still active (server-side activeBulletins re-check)
 *   4. Capped at MAX_BULLETINS_PER_PULL
 *   5. When FEDERATION_VERIFY_SIGS=true: ML-DSA-65 sig verifies
 *      against the configured peer pubkey (wave-103 trust loop)
 *
 * Returns the surviving bulletins. Each survivor whose signature
 * couldn't be verified (no key, no sig, or mismatched sig) is
 * dropped when strict mode is on, and accepted with a "unverified"
 * log entry when strict mode is off.
 */
export function filterValidBulletins(
  raw: FederationBulletin[],
): FederationBulletin[] {
  const strict = isStrictVerifyEnabled();
  const filtered: FederationBulletin[] = [];
  for (const b of raw) {
    if (b.schema !== "vaos-honeypot-bulletin-v1") continue;
    if (typeof b.issuerId !== "string" || b.issuerId.length === 0) continue;
    if (typeof b.expiresAt !== "string") continue;
    if (!Array.isArray(b.fingerprints)) continue;

    // Wave-103: optional ML-DSA-65 verification gate. In strict mode
    // an unverifiable bulletin is dropped entirely — the federation
    // does not consume unsigned attack data. In bootstrap mode the
    // bulletin is accepted but the gap is logged for ops visibility.
    const sigCheck = verifyBulletinSig(b);
    if (!sigCheck.ok) {
      if (strict) {
        log.warn("dropping unverifiable bulletin (strict mode)", {
          issuerId: b.issuerId,
          reason: sigCheck.reason,
        });
        continue;
      }
      log.info("accepting unverified bulletin (bootstrap mode)", {
        issuerId: b.issuerId,
        reason: sigCheck.reason,
      });
    }

    filtered.push(b);
    if (filtered.length >= MAX_BULLETINS_PER_PULL) break;
  }
  return activeBulletins(filtered);
}

/**
 * Extract the fingerprintIds from a list of bulletins, dedup, cap at
 * MAX_FINGERPRINTS_PER_CYCLE. The fingerprintId is the stable
 * identifier that downstream guard layers query — they don't care
 * about which peer originally observed the attack, only "have I seen
 * this attack fingerprint anywhere on the federation."
 */
/**
 * Validate that a value is shaped like an AttackFingerprint before
 * we hash it. fingerprintId(canonicalizeFingerprint(...)) will accept
 * almost anything (JSON.stringify happily produces output for
 * arbitrary objects), but a fingerprint whose `schema` or `class` is
 * wrong shouldn't be counted toward the federation block-set.
 */
function isWellFormedFingerprint(v: unknown): v is AttackFingerprint {
  if (!v || typeof v !== "object") return false;
  const f = v as Partial<AttackFingerprint>;
  return (
    f.schema === "vaos-attack-fingerprint-v1" &&
    typeof f.class === "string" &&
    typeof f.ts === "string" &&
    typeof f.method === "string" &&
    typeof f.severity === "number"
  );
}

export function extractFingerprintIds(
  bulletins: FederationBulletin[],
): string[] {
  const seen = new Set<string>();
  for (const b of bulletins) {
    if (!Array.isArray(b.fingerprints)) continue;
    for (const f of b.fingerprints) {
      // Wave-102 review M3: a peer can send arbitrary objects in the
      // fingerprints array. Validate shape before hashing — otherwise
      // junk would silently mint distinct fingerprintIds.
      if (!isWellFormedFingerprint(f)) continue;
      try {
        const id = fingerprintId(f);
        seen.add(id);
        if (seen.size >= MAX_FINGERPRINTS_PER_CYCLE) {
          return [...seen];
        }
      } catch {
        /* belt-and-braces — never abort the cycle on one bad entry */
      }
    }
  }
  return [...seen];
}

/**
 * End-to-end pull cycle: fetch every configured peer, filter, extract
 * distinct fingerprintIds, return observability metrics. Pure of
 * persistence — the caller (cron route) decides whether to write
 * the results into the platform's block-set cache.
 *
 * Peers are fetched in PARALLEL with a hard timeout each — one slow
 * peer cannot stall the whole cycle.
 */
export async function runPullCycle(): Promise<PullCycleResult> {
  const attemptedAt = new Date().toISOString();
  const peers = getConfiguredPeers();
  const perPeer: PeerPullResult[] = [];
  const allBulletins: FederationBulletin[] = [];

  // Run all peer fetches in parallel — cap the wall time at the per-
  // peer timeout because Promise.allSettled returns when all settle.
  const results = await Promise.allSettled(
    peers.map(async (peerUrl) => {
      const feed = await fetchPeerFeed(peerUrl);
      if (!feed) {
        return {
          peerUrl,
          reached: false,
          bulletinsReceived: 0,
          bulletinsAccepted: 0,
          fingerprintsExtracted: 0,
        } satisfies PeerPullResult;
      }
      const valid = filterValidBulletins(feed.bulletins);
      const fpIds = extractFingerprintIds(valid);
      allBulletins.push(...valid);
      return {
        peerUrl,
        reached: true,
        bulletinsReceived: feed.bulletins.length,
        bulletinsAccepted: valid.length,
        fingerprintsExtracted: fpIds.length,
      } satisfies PeerPullResult;
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled") {
      perPeer.push(r.value);
    } else {
      perPeer.push({
        peerUrl: "(unknown)",
        reached: false,
        bulletinsReceived: 0,
        bulletinsAccepted: 0,
        fingerprintsExtracted: 0,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }

  const allFingerprintIds = extractFingerprintIds(allBulletins);
  const totalBeforeDedup = allBulletins.reduce(
    (acc, b) => acc + b.fingerprints.length,
    0,
  );

  return {
    attemptedAt,
    peers: perPeer,
    uniqueFingerprintIds: allFingerprintIds,
    totalBulletinsAccepted: allBulletins.length,
    totalFingerprintsBeforeDedup: totalBeforeDedup,
  };
}
