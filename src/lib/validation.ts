/**
 * Input validation utilities for SOVEREIGN tool forms.
 * Prevents garbage requests from reaching the API.
 */

/** Blocked IP ranges for SSRF prevention */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                    // loopback
  /^10\./,                     // class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // class B private
  /^192\.168\./,               // class C private
  /^0\./,                      // current network
  /^169\.254\./,               // link-local
  /^fc00:/i,                   // IPv6 private
  /^fe80:/i,                   // IPv6 link-local
  /^::1$/,                     // IPv6 loopback
  /^localhost$/i,
  /^metadata\.google/i,        // GCP metadata
];

export function isValidUrl(url: string): boolean {
  if (!url.trim()) return false;
  const withProtocol = url.startsWith("http") ? url : `https://${url}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname.includes(".")) return false;
    // Block private/internal IPs (SSRF prevention)
    if (PRIVATE_IP_PATTERNS.some(p => p.test(u.hostname))) return false;
    // Block non-HTTP protocols
    if (!["http:", "https:"].includes(u.protocol)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Validate and sanitize a user-provided URL for server-side fetching */
export function sanitizeUrl(url: string): string | null {
  if (!isValidUrl(url)) return null;
  const withProtocol = url.startsWith("http") ? url : `https://${url}`;
  try {
    const u = new URL(withProtocol);
    return u.toString();
  } catch {
    return null;
  }
}

export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function getValidationError(fields: { name: string; value: string; type?: string }[]): string | null {
  for (const field of fields) {
    if (!isNotEmpty(field.value)) {
      return `Please fill in the "${field.name}" field`;
    }
    if (field.type === "url" && !isValidUrl(field.value)) {
      return `"${field.name}" must be a valid URL (e.g. example.com)`;
    }
  }
  return null;
}
