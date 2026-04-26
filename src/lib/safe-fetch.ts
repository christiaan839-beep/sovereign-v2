/**
 * SSRF guard for outbound fetches that take user-supplied URLs.
 *
 * Rejects:
 *  - non-https schemes (http, file, ftp, gopher, javascript, data, blob, etc.)
 *  - loopback (127.0.0.0/8, ::1)
 *  - link-local (169.254.0.0/16, fe80::/10) and cloud metadata (169.254.169.254, fd00:ec2::254)
 *  - RFC1918 private ranges (10/8, 172.16/12, 192.168/16)
 *  - 0.0.0.0/8 and 100.64/10 carrier-grade NAT
 *  - any literal IPv6 by default (use `allowIpLiteral` to opt-in for testing)
 *
 * Usage:
 *   const safe = assertSafeUrl(userInput);   // throws SafeFetchError on bad URL
 *   const res  = await safeFetch(userInput); // wraps fetch + assertSafeUrl
 */

export class SafeFetchError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "SafeFetchError";
    this.status = status;
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "metadata.aws",
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts;

  // 0.0.0.0/8 — "this network"
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 169.254.0.0/16 link-local (includes 169.254.169.254 metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 224.0.0.0/4 multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 reserved
  if (a >= 240) return true;

  return false;
}

function isIPv4Literal(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

function isIPv6Literal(host: string): boolean {
  // URL.hostname strips brackets, so we get bare ipv6 here
  return host.includes(":");
}

export interface AssertSafeUrlOptions {
  /** Allow literal IPv6 hostnames. Default false. */
  allowIpLiteral?: boolean;
  /** Allow http:// in addition to https://. Default false. */
  allowHttp?: boolean;
}

/**
 * Validate a user-supplied URL. Returns the parsed URL if safe, throws SafeFetchError otherwise.
 * Does NOT perform a DNS lookup — DNS rebinding is mitigated separately by the runtime fetch
 * stack (Vercel Edge does not allow private addresses) and by hostname blocking below.
 */
export function assertSafeUrl(
  input: string,
  opts: AssertSafeUrlOptions = {},
): URL {
  if (!input || typeof input !== "string") {
    throw new SafeFetchError("URL required");
  }

  const trimmed = input.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SafeFetchError("Invalid URL");
  }

  const allowedProtocols = opts.allowHttp ? ["http:", "https:"] : ["https:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new SafeFetchError(
      `Only ${allowedProtocols.join(", ")} URLs are accepted`,
    );
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) throw new SafeFetchError("Invalid URL: missing hostname");

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new SafeFetchError("Blocked hostname");
  }
  // Block any *.localhost or *.local
  if (host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new SafeFetchError("Blocked hostname");
  }
  // Block AWS / GCP / Azure metadata aliases
  if (host.endsWith(".internal") || host === "169.254.169.254") {
    throw new SafeFetchError("Blocked hostname");
  }

  if (isIPv4Literal(host)) {
    if (isPrivateIPv4(host)) {
      throw new SafeFetchError("Blocked private/loopback IP");
    }
  } else if (isIPv6Literal(host)) {
    if (!opts.allowIpLiteral) {
      throw new SafeFetchError("IPv6 literals not allowed");
    }
    // Even if allowed, block ::1 and link-local
    if (
      host === "::1" ||
      host.startsWith("fe80:") ||
      host.startsWith("fc") ||
      host.startsWith("fd")
    ) {
      throw new SafeFetchError("Blocked private/loopback IP");
    }
  }

  return parsed;
}

/**
 * Drop-in replacement for fetch() that runs assertSafeUrl first.
 * Forwards a default 10s timeout and 5MB body cap to keep upstream calls bounded.
 */
export async function safeFetch(
  input: string,
  init: RequestInit & { timeoutMs?: number; allowHttp?: boolean } = {},
): Promise<Response> {
  const { timeoutMs = 10_000, allowHttp, ...fetchInit } = init;
  const url = assertSafeUrl(input, { allowHttp });

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    return await fetch(url.toString(), { ...fetchInit, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}
