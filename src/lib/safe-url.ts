// SSRF allowlist for user-supplied URLs that get fed into research agents,
// LLM prompts, or future server-side fetches. Rejects file://, internal
// IP ranges, and link-local / loopback hosts — even though we do NOT
// fetch these URLs server-side today, a future change might, and the
// guard is cheap.
//
// Added in response to security-review-2026-05 (HIGH finding).

import { z } from "zod";

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // AWS / Azure / GCP metadata endpoints
  /^::1$/,
  /^fc00:/i, // unique local IPv6
  /^fe80:/i, // link-local IPv6
];

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Returns true if the URL is a public http(s) URL safe to feed into a
 * research agent or future server-side fetch. Returns false on any
 * private / loopback / link-local / cloud-metadata host or any
 * non-http(s) scheme (file://, gopher://, etc.).
 */
export function isPublicHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  const host = parsed.hostname;
  if (!host) return false;
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(host)) return false;
  }
  return true;
}

/**
 * Drop-in replacement for `z.string().url()` that additionally enforces
 * the SSRF allowlist. Use for any URL field that comes from untrusted
 * input.
 */
export const publicHttpUrlSchema = z.string().url().refine(isPublicHttpUrl, {
  message:
    "Must be a public http(s) URL (no file://, no localhost, no internal IPs)",
});
