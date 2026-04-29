/**
 * FEDERATION AUTO-DISCOVERY (R56).
 *
 * Closes R36 (federation discovery seed) + R50 (cross-instance
 * reputation aggregation) into a self-organizing peer graph. Given
 * one or more seed deployment URLs, the crawler walks each
 * deployment's `/.well-known/sovereign-trust` manifest, collects
 * any peers it advertises, and continues recursively until depth
 * or budget is exhausted.
 *
 * Same pattern as RSS feed-discovery, BGP peer learning, BitTorrent
 * tracker peer-exchange — each node learns about other nodes from
 * the ones it already knows.
 *
 * THE CRAWL CONTRACT:
 *
 *   1. Caller passes seedUrls + maxDepth + maxPeers + per-fetch
 *      timeout.
 *   2. Crawler fetches each seed's /.well-known/sovereign-trust.
 *   3. Each manifest may declare `federationPeers: string[]`.
 *   4. Crawler enqueues new peers (deduped by URL).
 *   5. Continues to maxDepth or maxPeers (whichever first).
 *   6. Returns the discovered peer graph + diagnostic info.
 *
 * Pure function for the GRAPH BUILD step (graphBuildFromManifests):
 *   - Same input manifests → same output graph, deterministic
 *   - The CRAWL itself is impure (network) but isolated to a
 *     single async function (crawlFederation) that delegates to
 *     graphBuildFromManifests for the pure logic
 *
 * Defensive limits:
 *   - maxDepth (default 3): prevents runaway crawls
 *   - maxPeers (default 50): bounds the result set
 *   - perFetchTimeoutMs (default 5_000): one slow peer can't
 *     stall the entire crawl
 *   - URL validation: only http/https; reject IP literals to
 *     avoid SSRF; reject loopback in production
 */

// ── Types ──────────────────────────────────────────────────────────

/**
 * Shape of /.well-known/sovereign-trust as published by R36 +
 * extended by federation. Only the fields we care about for
 * crawl + verification are typed; ignored extras don't error.
 */
export interface TrustManifest {
  /** Spec version. */
  version: string;
  /** Canonical deployment URL. May differ from the URL we fetched
   *  from (in case of mirrored manifests). */
  deploymentUrl: string;
  /** Public Ed25519 platform key — used to verify R44 attestations. */
  platformPublicKey?: string;
  /** Federation peers this deployment advertises. */
  federationPeers?: string[];
  /** Optional human-readable platform name. */
  platformName?: string;
  /** ISO 8601 timestamp of manifest publication. */
  publishedAt?: string;
}

export interface DiscoveredPeer {
  /** The URL we crawled. Always normalized. */
  url: string;
  /** Distance from the original seed (0 = seed). */
  depth: number;
  /** True iff we successfully fetched and parsed a manifest from this URL. */
  reachable: boolean;
  /** When reachable, the parsed manifest. */
  manifest?: TrustManifest;
  /** When unreachable, the error message. */
  errorReason?: string;
  /** Which seed/parent this peer was learned from. */
  learnedFrom: string;
}

export interface CrawlConfig {
  seedUrls: string[];
  maxDepth: number;
  maxPeers: number;
  perFetchTimeoutMs: number;
  /** Optional: reject URLs matching these patterns (e.g. private IPs). */
  rejectUrlPredicate?: (url: string) => boolean;
  /** Optional: hook to fetch (test injection). */
  fetcher?: (url: string, signal: AbortSignal) => Promise<unknown>;
}

export interface CrawlResult {
  peers: DiscoveredPeer[];
  /** Stats for the /reliability + diagnostics surface. */
  totalCrawled: number;
  totalReachable: number;
  totalUnreachable: number;
  hitMaxDepth: boolean;
  hitMaxPeers: boolean;
  /** Pure: peer URLs deduped + sorted, for stable hashing. */
  uniquePeerUrls: string[];
}

// ── Pure: URL normalization + validation ───────────────────────────

/**
 * Pure: normalize a URL so equivalent forms hash the same.
 * Strips trailing slash, lowercases the host, removes default ports.
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.host.toLowerCase();
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${host}${path}`;
  } catch {
    return raw;
  }
}

/**
 * Pure: defensive URL validation. Rejects:
 *   - Non-http(s) schemes (no file://, no ftp://, etc.)
 *   - IP-literal hosts (avoids SSRF where attacker injects 127.0.0.1)
 *   - Excessively long URLs (DoS vector)
 *
 * Returns a structured ok/err so the caller knows WHY a URL was
 * rejected (for diagnostic surfacing).
 */
export function validateFederationUrl(
  raw: string,
  options: { allowLoopback?: boolean } = {},
): { ok: true; normalized: string } | { ok: false; reason: string } {
  if (raw.length > 2048) {
    return { ok: false, reason: "url_too_long" };
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, reason: "non_http_scheme" };
  }
  // IPv4 literal (e.g. 192.168.1.1).
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) {
    return { ok: false, reason: "ip_literal_host" };
  }
  // IPv6 literal.
  if (u.hostname.startsWith("[")) {
    return { ok: false, reason: "ipv6_literal_host" };
  }
  // Loopback rejection (production-only; tests can opt in).
  if (
    !options.allowLoopback &&
    (u.hostname === "localhost" ||
      u.hostname.endsWith(".localhost") ||
      u.hostname === "127.0.0.1")
  ) {
    return { ok: false, reason: "loopback_rejected" };
  }
  return { ok: true, normalized: normalizeUrl(raw) };
}

// ── Pure: manifest parsing ─────────────────────────────────────────

/**
 * Pure: validate + parse a manifest payload (already JSON-decoded).
 * Returns either the typed manifest or a structured error.
 *
 * Rejects manifests with malformed peer lists; permissive about
 * unknown fields (forward-compat).
 */
export function parseTrustManifest(
  payload: unknown,
):
  | { ok: true; manifest: TrustManifest }
  | { ok: false; reason: string } {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, reason: "manifest_not_object" };
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.version !== "string") {
    return { ok: false, reason: "missing_version" };
  }
  if (typeof p.deploymentUrl !== "string") {
    return { ok: false, reason: "missing_deployment_url" };
  }
  let federationPeers: string[] | undefined;
  if (p.federationPeers !== undefined) {
    if (!Array.isArray(p.federationPeers)) {
      return { ok: false, reason: "peers_not_array" };
    }
    if (!p.federationPeers.every((u): u is string => typeof u === "string")) {
      return { ok: false, reason: "peer_not_string" };
    }
    federationPeers = p.federationPeers;
  }
  return {
    ok: true,
    manifest: {
      version: p.version,
      deploymentUrl: p.deploymentUrl,
      platformPublicKey:
        typeof p.platformPublicKey === "string"
          ? p.platformPublicKey
          : undefined,
      federationPeers,
      platformName:
        typeof p.platformName === "string" ? p.platformName : undefined,
      publishedAt:
        typeof p.publishedAt === "string" ? p.publishedAt : undefined,
    },
  };
}

// ── Pure: graph build (deterministic) ──────────────────────────────

/**
 * Pure: given a list of discovered peer-records, return the canonical
 * deduped + sorted peer URL list. Used internally by the crawler and
 * exposed for test cases that want to verify crawl determinism.
 */
export function graphUniqueUrls(peers: DiscoveredPeer[]): string[] {
  const set = new Set<string>();
  for (const p of peers) set.add(p.url);
  return [...set].sort();
}

// ── Crawler (impure: network) ──────────────────────────────────────

const DEFAULT_CONFIG: Required<
  Omit<CrawlConfig, "seedUrls" | "rejectUrlPredicate" | "fetcher">
> = {
  maxDepth: 3,
  maxPeers: 50,
  perFetchTimeoutMs: 5_000,
};

async function defaultFetcher(
  url: string,
  signal: AbortSignal,
): Promise<unknown> {
  const trustUrl = url.endsWith("/.well-known/sovereign-trust")
    ? url
    : `${url}/.well-known/sovereign-trust`;
  const res = await fetch(trustUrl, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Crawl the federation graph from one or more seed URLs.
 *
 * Mostly impure (network) but the heavy lifting (URL validation,
 * manifest parsing, dedup) is pure and unit-tested separately.
 *
 * Failure mode: per-peer failures are recorded as `reachable: false`
 * and DO NOT halt the crawl. One unreachable peer cannot prevent
 * discovering the others.
 */
export async function crawlFederation(
  config: CrawlConfig,
): Promise<CrawlResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const fetcher = config.fetcher ?? defaultFetcher;
  const reject = config.rejectUrlPredicate ?? (() => false);

  const peers: DiscoveredPeer[] = [];
  const seen = new Set<string>();
  const queue: Array<{ url: string; depth: number; learnedFrom: string }> = [];

  for (const seed of cfg.seedUrls) {
    const v = validateFederationUrl(seed);
    if (v.ok && !reject(v.normalized)) {
      if (!seen.has(v.normalized)) {
        seen.add(v.normalized);
        queue.push({ url: v.normalized, depth: 0, learnedFrom: "seed" });
      }
    }
  }

  let hitMaxDepth = false;
  let hitMaxPeers = false;

  while (queue.length > 0) {
    if (peers.length >= cfg.maxPeers) {
      hitMaxPeers = true;
      break;
    }
    const next = queue.shift()!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.perFetchTimeoutMs);
    let payload: unknown;
    try {
      payload = await fetcher(next.url, controller.signal);
    } catch (err) {
      peers.push({
        url: next.url,
        depth: next.depth,
        reachable: false,
        errorReason: String(err),
        learnedFrom: next.learnedFrom,
      });
      clearTimeout(timer);
      continue;
    } finally {
      clearTimeout(timer);
    }

    const parsed = parseTrustManifest(payload);
    if (!parsed.ok) {
      peers.push({
        url: next.url,
        depth: next.depth,
        reachable: false,
        errorReason: `manifest_parse:${parsed.reason}`,
        learnedFrom: next.learnedFrom,
      });
      continue;
    }

    peers.push({
      url: next.url,
      depth: next.depth,
      reachable: true,
      manifest: parsed.manifest,
      learnedFrom: next.learnedFrom,
    });

    // Recurse: enqueue advertised peers (if depth permits).
    if (next.depth + 1 > cfg.maxDepth) {
      hitMaxDepth = true;
      continue;
    }
    for (const advertised of parsed.manifest.federationPeers ?? []) {
      const v = validateFederationUrl(advertised);
      if (!v.ok) continue;
      if (reject(v.normalized)) continue;
      if (seen.has(v.normalized)) continue;
      seen.add(v.normalized);
      queue.push({
        url: v.normalized,
        depth: next.depth + 1,
        learnedFrom: next.url,
      });
    }
  }

  return {
    peers,
    totalCrawled: peers.length,
    totalReachable: peers.filter((p) => p.reachable).length,
    totalUnreachable: peers.filter((p) => !p.reachable).length,
    hitMaxDepth,
    hitMaxPeers,
    uniquePeerUrls: graphUniqueUrls(peers),
  };
}
