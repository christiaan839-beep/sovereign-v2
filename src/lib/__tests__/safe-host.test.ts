/**
 * Wave-107.2 — safe-host primitives.
 *
 * The two functions exported by `src/lib/safe-host.ts` carry the
 * DNS-resolved private-IP check that closes the DNS-rebinding gap
 * in outboundFetch. The implementation moved verbatim from
 * federation-puller.ts (wave 102, audited there) so the tests
 * here pin the shared contract.
 *
 * `resolvedHostIsSafe` is the pure RFC1918/loopback/link-local
 * classifier. `safeResolveOrNull` is the DNS-lookup wrapper that
 * returns null on either an unsafe IP or a failed lookup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { dnsLookupMock } = vi.hoisted(() => ({
  dnsLookupMock: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: dnsLookupMock,
}));

import { resolvedHostIsSafe, safeResolveOrNull } from "@/lib/safe-host";

beforeEach(() => {
  dnsLookupMock.mockReset();
});

describe("resolvedHostIsSafe — RFC1918 / loopback / link-local classifier", () => {
  it("BLOCKS IPv4 loopback (127/8)", () => {
    expect(resolvedHostIsSafe("127.0.0.1")).toBe(false);
    expect(resolvedHostIsSafe("127.255.255.254")).toBe(false);
  });

  it("BLOCKS IPv4 RFC1918 class A (10/8)", () => {
    expect(resolvedHostIsSafe("10.0.0.1")).toBe(false);
    expect(resolvedHostIsSafe("10.255.255.255")).toBe(false);
  });

  it("BLOCKS IPv4 RFC1918 class B (172.16/12)", () => {
    expect(resolvedHostIsSafe("172.16.0.1")).toBe(false);
    expect(resolvedHostIsSafe("172.20.100.5")).toBe(false);
    expect(resolvedHostIsSafe("172.31.255.255")).toBe(false);
    // 172.15 is NOT in RFC1918 — public
    expect(resolvedHostIsSafe("172.15.0.1")).toBe(true);
    // 172.32 is NOT in RFC1918 — public
    expect(resolvedHostIsSafe("172.32.0.1")).toBe(true);
  });

  it("BLOCKS IPv4 RFC1918 class C (192.168/16)", () => {
    expect(resolvedHostIsSafe("192.168.0.1")).toBe(false);
    expect(resolvedHostIsSafe("192.168.255.255")).toBe(false);
  });

  it("BLOCKS link-local (169.254/16) — INCLUDES AWS/GCP/Azure metadata IP", () => {
    // 169.254.169.254 is the cloud-metadata server on AWS / GCP /
    // Azure. SSRF-via-DNS-rebinding to this is the canonical attack.
    expect(resolvedHostIsSafe("169.254.169.254")).toBe(false);
    expect(resolvedHostIsSafe("169.254.0.1")).toBe(false);
  });

  it("BLOCKS 0.0.0.0 wildcard", () => {
    expect(resolvedHostIsSafe("0.0.0.0")).toBe(false);
  });

  it("BLOCKS IPv6 loopback (::1)", () => {
    expect(resolvedHostIsSafe("::1")).toBe(false);
  });

  it("BLOCKS IPv6 unique-local (fc00::/7)", () => {
    expect(resolvedHostIsSafe("fc00::1")).toBe(false);
    expect(resolvedHostIsSafe("fd00::1")).toBe(false);
  });

  it("BLOCKS IPv6 link-local (fe80::/10)", () => {
    expect(resolvedHostIsSafe("fe80::1")).toBe(false);
    expect(resolvedHostIsSafe("FE80::abcd")).toBe(false); // case-insensitive
  });

  it("ALLOWS public IPv4 addresses", () => {
    expect(resolvedHostIsSafe("8.8.8.8")).toBe(true);
    expect(resolvedHostIsSafe("93.184.216.34")).toBe(true); // example.com
    expect(resolvedHostIsSafe("1.1.1.1")).toBe(true);
  });

  it("ALLOWS public IPv6 addresses", () => {
    expect(resolvedHostIsSafe("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
    expect(resolvedHostIsSafe("2001:4860:4860::8888")).toBe(true); // Google DNS
  });

  // ─── IPv4-mapped IPv6 SSRF bypass (BACKLOG ssrf-v4mapped) ───

  it("BLOCKS IPv4-mapped IPv6 of cloud metadata (::ffff:169.254.169.254)", () => {
    expect(resolvedHostIsSafe("::ffff:169.254.169.254")).toBe(false);
    expect(resolvedHostIsSafe("::FFFF:169.254.169.254")).toBe(false);
  });

  it("BLOCKS IPv4-mapped IPv6 of RFC1918 ranges", () => {
    expect(resolvedHostIsSafe("::ffff:10.0.0.5")).toBe(false);
    expect(resolvedHostIsSafe("::ffff:192.168.1.1")).toBe(false);
    expect(resolvedHostIsSafe("::ffff:172.16.0.1")).toBe(false);
    expect(resolvedHostIsSafe("::ffff:127.0.0.1")).toBe(false);
  });

  it("BLOCKS hex-form IPv4-mapped IPv6 of metadata (::ffff:a9fe:a9fe)", () => {
    // a9fe:a9fe == 169.254.169.254
    expect(resolvedHostIsSafe("::ffff:a9fe:a9fe")).toBe(false);
    // 0a00:0005 == 10.0.0.5
    expect(resolvedHostIsSafe("::ffff:0a00:0005")).toBe(false);
  });

  it("BLOCKS IPv4-compatible IPv6 (::a.b.c.d) of private ranges", () => {
    expect(resolvedHostIsSafe("::169.254.169.254")).toBe(false);
    expect(resolvedHostIsSafe("::10.0.0.5")).toBe(false);
  });

  it("BLOCKS the unspecified address (::)", () => {
    expect(resolvedHostIsSafe("::")).toBe(false);
  });

  it("still ALLOWS a mapped PUBLIC IPv4 (::ffff:8.8.8.8)", () => {
    expect(resolvedHostIsSafe("::ffff:8.8.8.8")).toBe(true);
  });
});

describe("safeResolveOrNull — DNS-resolution + safety check", () => {
  it("returns the resolved address when DNS resolves to a public IP", async () => {
    dnsLookupMock.mockResolvedValueOnce({
      address: "93.184.216.34",
      family: 4,
    });
    const result = await safeResolveOrNull("example.com");
    expect(result).toBe("93.184.216.34");
    expect(dnsLookupMock).toHaveBeenCalledWith("example.com");
  });

  it("returns null when DNS resolves to a private IP (DNS-rebinding defense)", async () => {
    // The classic shape: public-looking hostname → private IP.
    dnsLookupMock.mockResolvedValueOnce({ address: "10.0.0.5", family: 4 });
    const result = await safeResolveOrNull("evil.example.com");
    expect(result).toBeNull();
  });

  it("returns null when DNS resolves to the cloud-metadata IP", async () => {
    dnsLookupMock.mockResolvedValueOnce({
      address: "169.254.169.254",
      family: 4,
    });
    const result = await safeResolveOrNull("metadata-mask.example.com");
    expect(result).toBeNull();
  });

  it("returns null on DNS lookup failure (NXDOMAIN / ETIMEDOUT)", async () => {
    dnsLookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    const result = await safeResolveOrNull("nonexistent.example");
    expect(result).toBeNull();
  });

  it("returns null when DNS resolves to IPv6 loopback", async () => {
    dnsLookupMock.mockResolvedValueOnce({ address: "::1", family: 6 });
    const result = await safeResolveOrNull("ipv6-loopback.example.com");
    expect(result).toBeNull();
  });

  it("returns null when DNS resolves to IPv6 link-local", async () => {
    dnsLookupMock.mockResolvedValueOnce({ address: "fe80::1", family: 6 });
    const result = await safeResolveOrNull("ipv6-linklocal.example.com");
    expect(result).toBeNull();
  });
});
