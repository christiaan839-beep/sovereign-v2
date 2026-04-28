/**
 * SAFE FETCH — the only sanctioned outbound HTTP exit point.
 *
 * Round 25. The audit found the SSRF guard wired into TWO of N
 * URL-fetching surfaces: competitive-radar and url-context. Every
 * other place that does `fetch(...)` with a URL that could be
 * influenced by user input — webhook dispatcher, agent triggers,
 * OAuth redirect endpoints — is unguarded. An attacker who can
 * register a webhook target pointing at 169.254.169.254 fetches
 * IAM credentials on every event.
 *
 * THE FIX IS A CHOKE POINT. Instead of asking every caller to
 * remember `checkUrlForSsrf` + `redirect: 'manual'` + per-hop
 * Location re-validation, we expose ONE function:
 *
 *     await safeFetch(url, { method, headers, body, ... });
 *
 * It does the SSRF gate, sets `redirect: 'manual'`, and re-checks
 * the Location header on every redirect (max 3 hops). If any hop
 * resolves to a blocked address, the call rejects with
 * SsrfBlockedError.
 *
 * After R25, every place that takes a user URL and fetches it
 * MUST go through safeFetch. An anti-drift CI gate scans route
 * files for raw `fetch(` calls — only `safeFetch` is allowed in
 * the allowlist.
 *
 * EXCEPTIONS (allowlisted in the CI gate, not in code):
 *   - Internal Vercel routes (`fetch('/api/...')`) where the URL
 *     is a relative path; SSRF doesn't apply.
 *   - LLM provider clients (Anthropic SDK, Gemini SDK, etc.) —
 *     they call fetch internally with their own hardened URL set;
 *     wrapping them is out of scope.
 *
 * NOT MITIGATED (still our job to think about):
 *   - DNS rebinding: same caveat as the underlying SSRF guard.
 *     Closing this requires a custom net.Socket connect hook with
 *     a per-resolve IP cache; future work.
 */

import { checkUrlForSsrf } from "./ssrf-guard";

/**
 * Thrown when the URL or any redirect target fails the SSRF gate.
 * Caller code can catch this specifically to surface 400 vs 5xx.
 */
export class SsrfBlockedError extends Error {
  readonly category: string;
  readonly url: string;
  constructor(url: string, category: string, reason: string) {
    super(`SSRF blocked: ${reason} (url=${url}, category=${category})`);
    this.name = "SsrfBlockedError";
    this.category = category;
    this.url = url;
  }
}

export interface SafeFetchOptions extends RequestInit {
  /** Maximum number of redirects to follow. Default 3. Set 0 to refuse
   *  any redirect — useful when the URL is meant to be terminal
   *  (e.g. a webhook delivery target that shouldn't be redirecting). */
  maxRedirects?: number;
  /** Per-request timeout in ms. Default 15_000. We always set one —
   *  unbounded fetch is a reliability footgun (a slow upstream stalls
   *  the function forever). */
  timeoutMs?: number;
}

/**
 * Safe outbound fetch. Runs the SSRF guard before any network
 * activity, then again on every redirect target (up to maxRedirects).
 *
 * Throws SsrfBlockedError on a blocked URL. Throws DOMException
 * AbortError on timeout. Otherwise returns the final Response.
 *
 * Same call shape as `fetch` so refactoring is mechanical:
 *     - fetch(url, init)
 *     + await safeFetch(url, init)
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = Math.max(0, options.maxRedirects ?? 3);
  const timeoutMs = Math.max(1, options.timeoutMs ?? 15_000);

  // Guard the initial URL before opening any socket.
  const initialCheck = checkUrlForSsrf(url);
  if (!initialCheck.safe) {
    throw new SsrfBlockedError(url, initialCheck.category ?? "unknown", initialCheck.reason ?? "blocked");
  }

  // Manual redirect handling so we can guard each hop. Using
  // redirect: 'manual' on the first call gives us the 30x response
  // back instead of fetch silently following it.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = url;
    let response = await fetch(currentUrl, {
      ...options,
      redirect: "manual",
      signal: controller.signal,
    });

    let hops = 0;
    while (response.status >= 300 && response.status < 400) {
      if (hops >= maxRedirects) {
        // Stop following — return the last 30x response so the caller
        // can decide. Common case: webhook target shouldn't redirect.
        break;
      }
      const location = response.headers.get("location");
      if (!location) break;

      // Resolve relative locations against the current URL.
      const next = new URL(location, currentUrl).toString();

      // Guard the redirect target. This is the critical step — without
      // it, an attacker submits `http://allowlisted.com/redirect-to-metadata`
      // which 302s to 169.254.169.254 and we fetch the redirect blindly.
      const hopCheck = checkUrlForSsrf(next);
      if (!hopCheck.safe) {
        throw new SsrfBlockedError(
          next,
          hopCheck.category ?? "unknown",
          `redirect target blocked: ${hopCheck.reason ?? "unknown"}`,
        );
      }

      currentUrl = next;
      hops += 1;
      response = await fetch(currentUrl, {
        method: "GET", // browsers always switch to GET on cross-origin 30x
        headers: options.headers,
        redirect: "manual",
        signal: controller.signal,
      });
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Convenience wrapper that returns parsed JSON or throws. Common
 * pattern for webhook delivery + agent URL fetches that expect JSON
 * back.
 */
export async function safeFetchJson<T = unknown>(
  url: string,
  options: SafeFetchOptions = {},
): Promise<T> {
  const res = await safeFetch(url, options);
  if (!res.ok) {
    throw new Error(`safeFetchJson: HTTP ${res.status} ${res.statusText} (url=${url})`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) {
    throw new Error(`safeFetchJson: expected JSON, got ${ct} (url=${url})`);
  }
  return (await res.json()) as T;
}
