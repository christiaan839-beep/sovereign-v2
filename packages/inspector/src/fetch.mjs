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
