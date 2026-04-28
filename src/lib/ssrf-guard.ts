/**
 * SSRF GUARD — block server-side request forgery in URL-fetching agents.
 *
 * SSRF (Server-Side Request Forgery) is OWASP API Top 10 #7 and a real
 * exploit vector for any platform whose agents fetch arbitrary URLs:
 * an attacker submits `http://169.254.169.254/latest/meta-data/` and
 * the platform happily returns the cloud instance's IAM credentials.
 *
 * Without a guard, the firecrawl / page-builder-stream / similar
 * agents are an internal-network port scanner you handed the
 * attacker for free.
 *
 * WHAT THIS BLOCKS:
 *
 *   1. **Cloud metadata endpoints** — 169.254.169.254 (AWS, Azure,
 *      Alibaba), fd00:ec2::254 (AWS IPv6), metadata.google.internal,
 *      100.100.100.200 (Alibaba). Fetching these from a server-side
 *      runner returns IAM tokens / SSH keys / managed-identity
 *      credentials.
 *
 *   2. **Private RFC 1918 ranges** — 10.0.0.0/8, 172.16.0.0/12,
 *      192.168.0.0/16. The platform's own internal infrastructure.
 *
 *   3. **Loopback** — 127.0.0.0/8, ::1. The agent's own host.
 *
 *   4. **Link-local** — 169.254.0.0/16, fe80::/10. APIPA + link-local
 *      v6.
 *
 *   5. **IPv6 private ranges** — fc00::/7 (unique-local), fec0::/10
 *      (deprecated site-local).
 *
 *   6. **Non-HTTP schemes** — file://, gopher://, dict://, ftp://.
 *
 *   7. **Hostname-based bypasses** — `localhost`, `localtest.me`,
 *      `metadata.google.internal`, etc.
 *
 * WHAT THIS DOES NOT (CAN NOT) BLOCK:
 *
 *   - DNS rebinding attacks. The hostname resolves to a public IP
 *     when we check it, then re-resolves to a private IP when fetch
 *     actually connects. Mitigation requires connection-level
 *     interception (custom http agent), which is out of scope here.
 *
 *   - URLs that redirect TO a private IP. The caller MUST set
 *     `redirect: 'manual'` and re-validate the Location header.
 *
 * USAGE:
 *
 *   const guard = checkUrlForSsrf(req.url);
 *   if (!guard.safe) {
 *     return Response.json({ error: guard.reason }, { status: 400 });
 *   }
 *   const res = await fetch(req.url);
 */

export interface SsrfCheckResult {
  safe: boolean;
  reason?: string;
  category?:
    | "scheme"
    | "hostname"
    | "private_ipv4"
    | "loopback_ipv4"
    | "link_local_ipv4"
    | "metadata_ipv4"
    | "private_ipv6"
    | "loopback_ipv6"
    | "link_local_ipv6"
    | "malformed_url";
}

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localtest.me",
  "metadata.google.internal",
  "metadata.goog",
  "kubernetes.default",
  "kubernetes.default.svc",
  "instance-data",
  "metadata",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal"];

// ─── IPv4 helpers ────────────────────────────────────────────────────

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = parseInt(p, 10);
    if (!Number.isFinite(n) || n < 0 || n > 255) return null;
    octets.push(n);
  }
  return octets;
}

function categorizeIpv4(octets: number[]): SsrfCheckResult["category"] | "public" {
  const [a, b, c, d] = octets;

  // Cloud metadata — exact match (most important to block)
  if (a === 169 && b === 254 && c === 169 && d === 254) {
    return "metadata_ipv4";
  }
  // Alibaba metadata
  if (a === 100 && b === 100 && c === 100 && d === 200) {
    return "metadata_ipv4";
  }

  // Loopback — 127.0.0.0/8
  if (a === 127) return "loopback_ipv4";

  // Link-local — 169.254.0.0/16
  if (a === 169 && b === 254) return "link_local_ipv4";

  // Private RFC 1918
  if (a === 10) return "private_ipv4";
  if (a === 172 && b >= 16 && b <= 31) return "private_ipv4";
  if (a === 192 && b === 168) return "private_ipv4";

  // CGNAT — 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return "private_ipv4";

  // 0.0.0.0/8 reserved
  if (a === 0) return "private_ipv4";

  // Multicast / experimental / broadcast
  if (a >= 224) return "private_ipv4";

  return "public";
}

// ─── IPv6 helpers ────────────────────────────────────────────────────

function normalizeIpv6(host: string): string {
  return host.toLowerCase().replace(/^\[|\]$/g, "");
}

function categorizeIpv6(host: string): SsrfCheckResult["category"] | "public" | null {
  const h = normalizeIpv6(host);

  // Loopback — ::1 (with optional zone id)
  if (h === "::1" || h.startsWith("::1%")) return "loopback_ipv6";
  if (h === "0:0:0:0:0:0:0:1") return "loopback_ipv6";

  // Unspecified — :: (any address)
  if (h === "::") return "private_ipv6";

  // Link-local — fe80::/10
  if (/^fe[89ab][0-9a-f]?:/i.test(h)) return "link_local_ipv6";

  // Unique-local — fc00::/7
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return "private_ipv6";

  // Site-local (deprecated) — fec0::/10
  if (/^fec[0-9a-f]:/i.test(h)) return "private_ipv6";

  // IPv4-mapped IPv6 — TWO forms:
  //   1. dotted: ::ffff:10.0.0.1 (human-friendly)
  //   2. hex: ::ffff:a00:1 (what URL.hostname normalizes to)
  // Both must be recognized — Node's URL parser converts (1) to (2)
  // before we ever see it.
  const ipv4MappedDotted = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedDotted) {
    const octets = parseIpv4(ipv4MappedDotted[1]);
    if (octets) {
      const cat = categorizeIpv4(octets);
      if (cat !== "public") {
        return cat as SsrfCheckResult["category"];
      }
    }
  }
  // Hex form: ::ffff:HHHH:HHHH where the two hex words encode IPv4.
  // a00:1 → 0x0a00, 0x0001 → 10.0.0.1.
  const ipv4MappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (ipv4MappedHex) {
    const hi = parseInt(ipv4MappedHex[1], 16);
    const lo = parseInt(ipv4MappedHex[2], 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      const octets = [
        (hi >> 8) & 0xff,
        hi & 0xff,
        (lo >> 8) & 0xff,
        lo & 0xff,
      ];
      const cat = categorizeIpv4(octets);
      if (cat !== "public") {
        return cat as SsrfCheckResult["category"];
      }
    }
  }

  // AWS EC2 IPv6 metadata
  if (h.startsWith("fd00:ec2:") || h === "fd00:ec2::254") {
    return "private_ipv6";
  }

  // If we got here, it has the shape of IPv6 but didn't match any
  // blocked pattern. Treat as public — the alternative (conservative
  // block all unmatched IPv6) breaks legitimate fetches to Cloudflare
  // / Google / etc. public IPv6 endpoints. The blocked patterns
  // above are the comprehensive enumeration of the dangerous ranges.
  if (h.includes(":")) return "public";

  return null;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Check whether a URL is safe to fetch server-side.
 * NEVER throws.
 */
export function checkUrlForSsrf(rawUrl: string): SsrfCheckResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return {
      safe: false,
      category: "malformed_url",
      reason: "URL is empty or not a string",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      safe: false,
      category: "malformed_url",
      reason: "URL is not parseable",
    };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return {
      safe: false,
      category: "scheme",
      reason: `scheme ${parsed.protocol} not allowed (only http: + https:)`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return {
      safe: false,
      category: "hostname",
      reason: `hostname '${hostname}' is on the SSRF blocklist`,
    };
  }
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return {
        safe: false,
        category: "hostname",
        reason: `hostname suffix '${suffix}' is on the SSRF blocklist`,
      };
    }
  }

  const octets = parseIpv4(hostname);
  if (octets) {
    const cat = categorizeIpv4(octets);
    if (cat !== "public") {
      return {
        safe: false,
        category: cat as SsrfCheckResult["category"],
        reason: `IPv4 ${octets.join(".")} is in a blocked range (${cat})`,
      };
    }
    return { safe: true };
  }

  if (hostname.includes(":") || (hostname.startsWith("[") && hostname.endsWith("]"))) {
    const cat = categorizeIpv6(hostname);
    if (cat && cat !== "public") {
      return {
        safe: false,
        category: cat,
        reason: `IPv6 ${hostname} is in a blocked range (${cat})`,
      };
    }
    // cat === "public" or null — fall through to allow. The
    // categorizer's blocked-pattern list is the comprehensive
    // enumeration; anything outside it is a public IPv6.
  }

  // DNS hostname — can't fully validate without async lookup +
  // DNS rebinding mitigation. The caller MUST set redirect: 'manual'
  // and re-validate any Location header.
  return { safe: true };
}
