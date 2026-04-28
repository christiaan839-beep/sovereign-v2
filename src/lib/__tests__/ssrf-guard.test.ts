/**
 * SSRF guard — comprehensive coverage of the bypass classes that
 * attackers actually attempt against URL-fetching agents.
 *
 * Every category in OWASP's SSRF cheatsheet (cloud-metadata,
 * private-IPv4, IPv6, hostname tricks, scheme bypasses) gets tested.
 *
 * The "blocking IS the security property" pattern: each test
 * asserts safe=false AND a specific category. Categories drive
 * dashboards/metrics, so a regression that returns wrong category
 * (e.g. private as link-local) would silently degrade observability
 * — these tests catch that too.
 */

import { describe, it, expect } from "vitest";
import { checkUrlForSsrf } from "../ssrf-guard";

describe("SSRF guard — cloud metadata endpoints (P0 — IAM token vector)", () => {
  it("blocks AWS / Azure / Alibaba metadata: 169.254.169.254", () => {
    const r = checkUrlForSsrf("http://169.254.169.254/latest/meta-data/");
    expect(r.safe).toBe(false);
    expect(r.category).toBe("metadata_ipv4");
  });

  it("blocks Alibaba metadata: 100.100.100.200", () => {
    const r = checkUrlForSsrf("http://100.100.100.200/foo");
    expect(r.safe).toBe(false);
    expect(r.category).toBe("metadata_ipv4");
  });

  it("blocks GCP metadata hostname: metadata.google.internal", () => {
    const r = checkUrlForSsrf("http://metadata.google.internal/v1/foo");
    expect(r.safe).toBe(false);
    expect(r.category).toBe("hostname");
  });

  it("blocks AWS IPv6 metadata: fd00:ec2::254", () => {
    const r = checkUrlForSsrf("http://[fd00:ec2::254]/latest/meta-data/");
    expect(r.safe).toBe(false);
    expect(r.category).toBe("private_ipv6");
  });

  it("blocks https variants of metadata too (not just http)", () => {
    const r = checkUrlForSsrf("https://169.254.169.254/foo");
    expect(r.safe).toBe(false);
  });
});

describe("SSRF guard — private IPv4 ranges", () => {
  it("blocks 10.x.y.z (RFC 1918 class A)", () => {
    expect(checkUrlForSsrf("http://10.0.0.5/admin").safe).toBe(false);
    expect(checkUrlForSsrf("http://10.255.255.255/foo").safe).toBe(false);
  });

  it("blocks 172.16-31.x.y (RFC 1918 class B)", () => {
    expect(checkUrlForSsrf("http://172.16.0.1/").safe).toBe(false);
    expect(checkUrlForSsrf("http://172.31.255.255/").safe).toBe(false);
    expect(checkUrlForSsrf("http://172.20.10.10/").safe).toBe(false);
  });

  it("ALLOWS 172.32.0.0 and beyond (outside RFC 1918)", () => {
    // Public IP that happens to be in 172. — should be allowed.
    expect(checkUrlForSsrf("http://172.32.0.1/").safe).toBe(true);
    expect(checkUrlForSsrf("http://172.15.0.1/").safe).toBe(true);
  });

  it("blocks 192.168.x.y", () => {
    expect(checkUrlForSsrf("http://192.168.1.1/").safe).toBe(false);
    expect(checkUrlForSsrf("http://192.168.0.0/").safe).toBe(false);
  });

  it("blocks 100.64-127.x.y (CGNAT)", () => {
    expect(checkUrlForSsrf("http://100.64.0.1/").safe).toBe(false);
    expect(checkUrlForSsrf("http://100.127.255.255/").safe).toBe(false);
  });

  it("blocks 0.x.y.z (this network reserved)", () => {
    expect(checkUrlForSsrf("http://0.0.0.0/").safe).toBe(false);
  });

  it("blocks multicast (224+)", () => {
    expect(checkUrlForSsrf("http://224.0.0.1/").safe).toBe(false);
    expect(checkUrlForSsrf("http://255.255.255.255/").safe).toBe(false);
  });
});

describe("SSRF guard — loopback + link-local", () => {
  it("blocks 127.0.0.1 + 127.x range", () => {
    const r = checkUrlForSsrf("http://127.0.0.1/admin");
    expect(r.safe).toBe(false);
    expect(r.category).toBe("loopback_ipv4");

    expect(checkUrlForSsrf("http://127.255.255.255/").safe).toBe(false);
  });

  it("blocks ::1 IPv6 loopback", () => {
    const r = checkUrlForSsrf("http://[::1]/admin");
    expect(r.safe).toBe(false);
    expect(r.category).toBe("loopback_ipv6");
  });

  it("blocks expanded ::1 form", () => {
    expect(
      checkUrlForSsrf("http://[0:0:0:0:0:0:0:1]/").safe,
    ).toBe(false);
  });

  it("blocks 169.254.x.y link-local (covers metadata IPs)", () => {
    expect(checkUrlForSsrf("http://169.254.0.1/").safe).toBe(false);
  });

  it("blocks fe80::/10 link-local IPv6", () => {
    expect(checkUrlForSsrf("http://[fe80::1]/").safe).toBe(false);
    expect(checkUrlForSsrf("http://[fe80::1234:5678]/").safe).toBe(false);
  });
});

describe("SSRF guard — IPv6 private ranges", () => {
  it("blocks fc00::/7 unique-local", () => {
    expect(checkUrlForSsrf("http://[fc00::1]/").safe).toBe(false);
    expect(checkUrlForSsrf("http://[fdab:cdef::1]/").safe).toBe(false);
  });

  it("blocks fec0::/10 site-local (deprecated)", () => {
    expect(checkUrlForSsrf("http://[fec0::1]/").safe).toBe(false);
  });

  it("blocks ::ffff:10.0.0.1 (IPv4-mapped IPv6 to private IPv4)", () => {
    // Classic bypass: encode a private IPv4 as IPv6.
    const r = checkUrlForSsrf("http://[::ffff:10.0.0.1]/");
    expect(r.safe).toBe(false);
  });

  it("blocks ::ffff:127.0.0.1 (IPv4-mapped to loopback)", () => {
    expect(checkUrlForSsrf("http://[::ffff:127.0.0.1]/").safe).toBe(false);
  });
});

describe("SSRF guard — hostname-based bypasses", () => {
  it("blocks 'localhost'", () => {
    expect(checkUrlForSsrf("http://localhost/").safe).toBe(false);
    expect(checkUrlForSsrf("http://localhost:8080/").safe).toBe(false);
  });

  it("blocks '*.localhost' subdomains (DNS routes to 127.0.0.1)", () => {
    expect(checkUrlForSsrf("http://foo.localhost/").safe).toBe(false);
    expect(checkUrlForSsrf("http://bar.foo.localhost/").safe).toBe(false);
  });

  it("blocks .internal and .local TLDs", () => {
    expect(checkUrlForSsrf("http://services.internal/").safe).toBe(false);
    expect(checkUrlForSsrf("http://printer.local/").safe).toBe(false);
  });

  it("blocks the bare 'metadata' hostname", () => {
    expect(checkUrlForSsrf("http://metadata/").safe).toBe(false);
  });

  it("ALLOWS 'localhost.example.com' (third-party domain)", () => {
    // The blocklist is "localhost" exact + ".localhost" suffix.
    // A real public domain that happens to start with "localhost"
    // should still resolve normally.
    expect(checkUrlForSsrf("http://localhost.example.com/").safe).toBe(true);
  });
});

describe("SSRF guard — scheme bypasses", () => {
  it("blocks file:// (local file disclosure)", () => {
    const r = checkUrlForSsrf("file:///etc/passwd");
    expect(r.safe).toBe(false);
    expect(r.category).toBe("scheme");
  });

  it("blocks gopher:// (legacy fetch protocol bypass)", () => {
    expect(checkUrlForSsrf("gopher://example.com/").safe).toBe(false);
  });

  it("blocks dict:// + ftp:// + ldap://", () => {
    expect(checkUrlForSsrf("dict://example.com/").safe).toBe(false);
    expect(checkUrlForSsrf("ftp://example.com/").safe).toBe(false);
    expect(checkUrlForSsrf("ldap://example.com/").safe).toBe(false);
  });

  it("ALLOWS http: + https:", () => {
    expect(checkUrlForSsrf("http://example.com/").safe).toBe(true);
    expect(checkUrlForSsrf("https://example.com/").safe).toBe(true);
  });
});

describe("SSRF guard — malformed input", () => {
  it("blocks empty / null / undefined", () => {
    expect(checkUrlForSsrf("").safe).toBe(false);
    expect(checkUrlForSsrf(null as unknown as string).safe).toBe(false);
    expect(checkUrlForSsrf(undefined as unknown as string).safe).toBe(false);
  });

  it("blocks unparseable URLs", () => {
    expect(checkUrlForSsrf("not a url").safe).toBe(false);
    expect(checkUrlForSsrf("http://").safe).toBe(false);
    expect(checkUrlForSsrf("://example.com").safe).toBe(false);
  });

  it("never throws on hostile input", () => {
    expect(() => checkUrlForSsrf("javascript:alert(1)")).not.toThrow();
    expect(() => checkUrlForSsrf("data:text/html,<script>")).not.toThrow();
    expect(() => checkUrlForSsrf({} as unknown as string)).not.toThrow();
  });
});

describe("SSRF guard — public URLs (false-positive guard)", () => {
  it("ALLOWS legitimate public domains", () => {
    expect(checkUrlForSsrf("https://example.com/").safe).toBe(true);
    expect(checkUrlForSsrf("https://api.openai.com/v1/chat").safe).toBe(true);
    expect(checkUrlForSsrf("https://www.google.com/search?q=foo").safe).toBe(true);
  });

  it("ALLOWS public IPv4 addresses", () => {
    // 8.8.8.8 (Google DNS), 1.1.1.1 (Cloudflare) — public IPs.
    expect(checkUrlForSsrf("http://8.8.8.8/").safe).toBe(true);
    expect(checkUrlForSsrf("http://1.1.1.1/").safe).toBe(true);
  });

  it("ALLOWS public IPv6 (e.g. 2606::)", () => {
    // 2606:4700::1111 = Cloudflare DNS public IPv6
    expect(checkUrlForSsrf("http://[2606:4700::1111]/").safe).toBe(true);
  });
});

describe("SSRF guard — category accuracy (drives dashboards)", () => {
  it("returns specific categories for downstream metrics", () => {
    const checks: Array<[string, string]> = [
      ["http://169.254.169.254/", "metadata_ipv4"],
      ["http://10.0.0.1/", "private_ipv4"],
      ["http://127.0.0.1/", "loopback_ipv4"],
      ["http://[::1]/", "loopback_ipv6"],
      ["http://[fe80::1]/", "link_local_ipv6"],
      ["http://[fc00::1]/", "private_ipv6"],
      ["http://localhost/", "hostname"],
      ["file:///etc/passwd", "scheme"],
      ["not-a-url", "malformed_url"],
    ];
    for (const [url, expectedCat] of checks) {
      const r = checkUrlForSsrf(url);
      expect(r.safe, `${url} should be unsafe`).toBe(false);
      expect(r.category, `${url} should be ${expectedCat}`).toBe(expectedCat);
    }
  });
});
