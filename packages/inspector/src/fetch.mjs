/**
 * @sovereign/inspector — HTTP fetchers for Sovereign deployments.
 *
 * Helpers that fetch the public health endpoints from any
 * Sovereign deployment. Pure HTTP; uses the Node 20+ global
 * fetch — no extra dependencies.
 *
 * The fetched data is then passed to `verify.mjs` functions
 * for cryptographic verification. The fetcher is OPTIONAL:
 * a verifier can also be given offline data (e.g. an exported
 * audit dump).
 */

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch a JSON endpoint with a timeout. Throws on non-200.
 */
export async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: opts.headers ?? { Accept: "application/json" },
      body: opts.body,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the platform's permanence snapshot. Returns the live
 * invariant count, audit chain status, and artifact roster.
 */
export async function fetchPermanence(deploymentUrl) {
  return fetchJson(`${deploymentUrl}/api/health/permanence`);
}

/**
 * Fetch the SHIPPED HITL routing rules (the procurement-readable
 * policy artifact).
 */
export async function fetchHitlPolicy(deploymentUrl) {
  return fetchJson(`${deploymentUrl}/api/health/hitl-policy`);
}

/**
 * Fetch a public anonymized reasoning trace. The trace ID is the
 * capability — anyone with one can fetch + verify.
 */
export async function fetchTrace(deploymentUrl, traceId) {
  return fetchJson(`${deploymentUrl}/api/health/trace/${encodeURIComponent(traceId)}`);
}

/**
 * Fetch the platform's diagnostic — env presence, DB state, missing
 * tables, hints. Useful for "is this deployment healthy enough to
 * verify against?"
 */
export async function fetchDiagnose(deploymentUrl) {
  return fetchJson(`${deploymentUrl}/api/health/diagnose`);
}

/**
 * POST a delegation + user pubkey to the verify-delegation endpoint.
 * Note: this is a CONVENIENCE — the verifier can also run locally
 * via `verifyDelegation` from `./verify.mjs` without contacting any
 * server. Sovereign isn't a required trust anchor.
 */
export async function postVerifyDelegation(deploymentUrl, body) {
  return fetchJson(`${deploymentUrl}/api/health/verify-delegation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Fetch the federation discovery file at /.well-known/sovereign-trust.
 *
 * This is the "introduce yourself" endpoint of the Sovereign trust
 * federation. Any peer can fetch this from any instance and learn:
 *   - The instance's identity + canonical URL
 *   - Which trust primitives it supports
 *   - Where to fetch each verifiable artifact
 *   - Which federation peers it mutually recognizes
 *   - The verifier package npm coordinates
 *
 * No auth, no signature required (the document describes only public
 * data). The instance's signing key fingerprint (when present) lets
 * verifiers cross-check against subsequent signed artifacts.
 */
export async function fetchTrustDiscovery(deploymentUrl) {
  return fetchJson(`${deploymentUrl}/.well-known/sovereign-trust`);
}

/**
 * Crawl a federation graph starting from one instance.
 *
 * Recursively fetches /.well-known/sovereign-trust from each peer,
 * deduplicating on canonical URL. Returns a map of canonicalUrl →
 * trust document. Caps at maxDepth + maxNodes to prevent runaway.
 *
 * USE CASE: an auditor wants to verify "instance A says it federates
 * with B; what does B say about A?" A discrepancy = bad federation.
 */
export async function crawlFederation(seedUrl, opts = {}) {
  const maxDepth = opts.maxDepth ?? 3;
  const maxNodes = opts.maxNodes ?? 32;
  const seen = new Map(); // canonicalUrl → doc
  const queue = [{ url: seedUrl, depth: 0 }];
  while (queue.length > 0 && seen.size < maxNodes) {
    const { url, depth } = queue.shift();
    if (seen.has(url)) continue;
    if (depth > maxDepth) continue;
    try {
      const doc = await fetchTrustDiscovery(url);
      const canonical = doc?.identity?.canonicalUrl ?? url;
      if (seen.has(canonical)) continue;
      seen.set(canonical, doc);
      const peers = doc?.federation?.peers ?? [];
      for (const peer of peers) {
        queue.push({ url: peer, depth: depth + 1 });
      }
    } catch {
      // Peer unreachable; skip but record the attempt.
      seen.set(url, { error: "unreachable" });
    }
  }
  return Object.fromEntries(seen);
}
