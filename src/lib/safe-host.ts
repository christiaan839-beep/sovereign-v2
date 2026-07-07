/**
 * SOVEREIGN MATRIX — Shared host-safety primitives (wave 107.2).
 *
 * `outboundFetch` (wave 107 SSRF guard) does a STRING-prefix check
 * against the URL's hostname via `isSafeUrl`. That catches the
 * obvious cases like `https://10.0.0.1` but does NOT resolve DNS —
 * so a public hostname like `https://evil.example.com` whose A
 * record points at `10.0.0.5` (or `169.254.169.254` for cloud
 * metadata) slips past.
 *
 * `federation-puller.ts` (wave 102) already implemented a
 * DNS-resolved private-IP check as `safeResolveOrNull`. This file
 * promotes that defense to a shared utility so every outbound
 * fetch can inherit it — closes the gap uniformly across all
 * callers, not just per-route.
 *
 * The implementation is identical to the original (audited in wave
 * 102) — moved here verbatim so federation-puller can re-import
 * without behaviour change. The TOCTOU window between DNS lookup
 * and connect is well-understood (impractical at millisecond
 * scale; a sticky-IP fetch would close it fully but is a future
 * hardening).
 */

import { lookup as dnsLookup } from "node:dns/promises";

/**
 * Returns true when `address` is a publicly-routable IP — false for
 * any RFC1918 / loopback / link-local / unique-local range. Both
 * IPv4 dotted-quad and IPv6 colon-hex forms are supported.
 *
 * Pure function. Exported so any caller can validate a
 * pre-resolved IP without an additional DNS lookup (useful when
 * the caller already resolved the host for other reasons).
 */
export function resolvedHostIsSafe(address: string): boolean {
  // IPv4 patterns (mirror the regex in outbound-fetch/tools/built-in
  // isSafeUrl so the two layers agree on what 'private' means).
  const blockedV4 = [
    /^127\./, // loopback
    /^10\./, // RFC1918 class A
    /^192\.168\./, // RFC1918 class C
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // RFC1918 class B
    /^169\.254\./, // link-local (incl. cloud metadata 169.254.169.254)
    /^0\.0\.0\.0$/, // wildcard
  ];
  if (blockedV4.some((re) => re.test(address))) return false;

  // IPv6 (lowercase compare).
  //   ::1        → loopback
  //   fc00::/7   → unique-local (covers fc... and fd...)
  //   fe80::/10  → link-local
  //   ::         → unspecified
  const lower = address.toLowerCase();

  // IPv4-mapped / IPv4-compatible IPv6 (::ffff:a.b.c.d, ::ffff:hhhh:hhhh,
  // ::a.b.c.d) tunnel a v4 address past the colon-hex checks below.
  // An attacker who controls a hostname's DNS can publish an AAAA
  // record of ::ffff:169.254.169.254 to reach cloud metadata. Extract
  // the embedded IPv4 and re-run the v4 blocklist on it
  // (BACKLOG ssrf-v4mapped).
  const embeddedV4 = extractEmbeddedIpv4(lower);
  if (embeddedV4 && blockedV4.some((re) => re.test(embeddedV4))) return false;

  if (lower === "::1" || lower === "::") return false;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false;
  if (lower.startsWith("fe80:")) return false;
  return true;
}

/**
 * Pull the embedded IPv4 out of an IPv4-mapped/compatible IPv6 address.
 * Handles the dotted form (::ffff:169.254.169.254, ::10.0.0.5) and the
 * hex form (::ffff:a9fe:a9fe). Returns dotted-quad or null.
 */
function extractEmbeddedIpv4(lower: string): string | null {
  // Dotted form: trailing literal a.b.c.d after the last colon.
  const dotted = lower.match(/:((?:\d{1,3}\.){3}\d{1,3})$/);
  if (dotted) return dotted[1];

  // Hex form: ::ffff:HHHH:HHHH or ::HHHH:HHHH (all-zero mapping prefix,
  // optional ffff group).
  const hex = lower.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

/**
 * Resolve a hostname to its IP and check the IP isn't private /
 * loopback / link-local. Returns the resolved address on success;
 * returns `null` when any resolution returns an unsafe IP OR when
 * resolution itself fails (NXDOMAIN, ETIMEDOUT, etc.) — caller
 * should treat null as "do not connect."
 *
 * `dns.lookup` uses the OS resolver (same one `fetch` will use),
 * so cache coherency is good — the IP we validate is the one
 * fetch will connect to in the next few milliseconds.
 *
 * Wave-107.2 intent: every outbound fetch in the platform routes
 * through this check, so DNS rebinding (public hostname → private
 * IP at fetch time) is blocked uniformly.
 */
export async function safeResolveOrNull(
  hostname: string,
): Promise<string | null> {
  try {
    const { address } = await dnsLookup(hostname);
    if (!resolvedHostIsSafe(address)) return null;
    return address;
  } catch {
    return null;
  }
}
