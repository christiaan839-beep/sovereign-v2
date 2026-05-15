/**
 * Tests for src/lib/sandbox-egress.ts — Cook 108.
 */

import { describe, it, expect } from "vitest";
import {
  buildPolicy,
  DEFAULT_POLICY,
  meterRequest,
  testUrl,
} from "../sandbox-egress";

describe("buildPolicy", () => {
  it("normalizes hosts (lowercase + strip www.)", () => {
    const p = buildPolicy({
      mode: "allowlist",
      hosts: ["API.OpenAI.com", "www.example.com"],
    });
    expect(p.allowedHosts).toEqual(["api.openai.com", "example.com"]);
  });

  it("rejects non-positive caps", () => {
    expect(() => buildPolicy({ mode: "off", maxEgressBytes: 0 })).toThrow();
    expect(() => buildPolicy({ mode: "off", maxRequests: -1 })).toThrow();
  });

  it("DEFAULT_POLICY is mode=off", () => {
    expect(DEFAULT_POLICY.mode).toBe("off");
  });
});

describe("testUrl — mode=off", () => {
  it("blocks every URL", () => {
    expect(testUrl("https://example.com", DEFAULT_POLICY)?.reason).toBe(
      "mode-off",
    );
  });
});

describe("testUrl — mode=open", () => {
  const open = buildPolicy({ mode: "open" });

  it("allows public HTTPS URLs", () => {
    expect(testUrl("https://example.com", open)).toBeNull();
  });

  it("blocks non-https", () => {
    expect(testUrl("http://example.com", open)?.reason).toBe("non-https");
  });

  it("blocks SSRF-flagged URLs (metadata, private IPs)", () => {
    expect(testUrl("http://169.254.169.254/latest", open)?.reason).toBe(
      "ssrf-blocked",
    );
    expect(testUrl("http://127.0.0.1/x", open)?.reason).toBe("ssrf-blocked");
  });
});

describe("testUrl — mode=allowlist", () => {
  const policy = buildPolicy({
    mode: "allowlist",
    hosts: ["api.openai.com", "example.com"],
  });

  it("allows hosts on the allowlist", () => {
    expect(testUrl("https://api.openai.com/v1/chat", policy)).toBeNull();
  });

  it("allows subdomains of allowlisted hosts", () => {
    expect(testUrl("https://docs.example.com/spec", policy)).toBeNull();
  });

  it("blocks hosts not on the allowlist", () => {
    expect(testUrl("https://evil.example.io", policy)?.reason).toBe(
      "host-not-allowed",
    );
  });

  it("blocks malformed URLs", () => {
    expect(testUrl("not a url", policy)?.reason).toBe("ssrf-blocked");
  });
});

describe("meterRequest", () => {
  it("returns null while caps are not exceeded", () => {
    const policy = buildPolicy({ mode: "open" });
    const session = { requests: 0, bytes: 0 };
    expect(meterRequest(session, policy, 1024)).toBeNull();
    expect(session.requests).toBe(1);
    expect(session.bytes).toBe(1024);
  });

  it("violates request-cap when too many requests", () => {
    const policy = buildPolicy({ mode: "open", maxRequests: 2 });
    const session = { requests: 0, bytes: 0 };
    meterRequest(session, policy, 100);
    meterRequest(session, policy, 100);
    const v = meterRequest(session, policy, 100);
    expect(v?.reason).toBe("request-cap");
  });

  it("violates byte-cap when too many bytes", () => {
    const policy = buildPolicy({ mode: "open", maxEgressBytes: 200 });
    const session = { requests: 0, bytes: 0 };
    meterRequest(session, policy, 100);
    const v = meterRequest(session, policy, 200);
    expect(v?.reason).toBe("byte-cap");
  });

  it("clamps negative response bytes to 0", () => {
    const policy = buildPolicy({ mode: "open" });
    const session = { requests: 0, bytes: 0 };
    meterRequest(session, policy, -50);
    expect(session.bytes).toBe(0);
  });
});
