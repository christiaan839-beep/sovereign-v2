/**
 * Tests for src/lib/validation.ts — URL Validation & Sanitization
 *
 * Covers SSRF prevention (private IPs, localhost), protocol enforcement,
 * and the sanitizeUrl / getValidationError helpers.
 */
import { describe, it, expect } from "vitest";

import {
  isValidUrl,
  sanitizeUrl,
  isNotEmpty,
  getValidationError,
} from "@/lib/validation";

// ── isValidUrl ──

describe("isValidUrl", () => {
  // ─── Accepts Valid URLs ───

  it("accepts a standard HTTPS URL", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });

  it("accepts a standard HTTP URL", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("accepts URLs with paths and query strings", () => {
    expect(isValidUrl("https://example.com/path?q=test&lang=en")).toBe(true);
  });

  it("accepts URLs with subdomains", () => {
    expect(isValidUrl("https://api.staging.example.com")).toBe(true);
  });

  it("accepts URLs without protocol (auto-prefixes https)", () => {
    expect(isValidUrl("example.com")).toBe(true);
  });

  it("accepts URLs with port numbers", () => {
    expect(isValidUrl("https://example.com:8080")).toBe(true);
  });

  // ─── Rejects Private IPs ───

  it("rejects 127.0.0.1 (loopback)", () => {
    expect(isValidUrl("http://127.0.0.1")).toBe(false);
  });

  it("rejects 127.x.x.x range", () => {
    expect(isValidUrl("http://127.0.0.2:8080/admin")).toBe(false);
  });

  it("rejects 10.x.x.x (class A private)", () => {
    expect(isValidUrl("http://10.0.0.1")).toBe(false);
    expect(isValidUrl("http://10.255.255.255")).toBe(false);
  });

  it("rejects 192.168.x.x (class C private)", () => {
    expect(isValidUrl("http://192.168.0.1")).toBe(false);
    expect(isValidUrl("http://192.168.1.100:3000")).toBe(false);
  });

  it("rejects 172.16-31.x.x (class B private)", () => {
    expect(isValidUrl("http://172.16.0.1")).toBe(false);
    expect(isValidUrl("http://172.31.255.255")).toBe(false);
  });

  it("rejects 169.254.x.x (link-local)", () => {
    expect(isValidUrl("http://169.254.169.254")).toBe(false);
  });

  it("rejects 0.x.x.x (current network)", () => {
    expect(isValidUrl("http://0.0.0.0")).toBe(false);
  });

  it("rejects GCP metadata endpoint", () => {
    expect(isValidUrl("http://metadata.google.internal")).toBe(false);
  });

  // ─── Rejects Localhost ───

  it("rejects localhost", () => {
    expect(isValidUrl("http://localhost")).toBe(false);
  });

  it("rejects localhost with port", () => {
    expect(isValidUrl("http://localhost:3000")).toBe(false);
  });

  it("rejects LOCALHOST (case-insensitive)", () => {
    expect(isValidUrl("http://LOCALHOST:8080")).toBe(false);
  });

  // ─── Rejects Non-HTTP Protocols ───

  it("rejects ftp protocol", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });

  it("rejects file protocol", () => {
    expect(isValidUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects javascript protocol", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });

  // ─── Edge Cases ───

  it("rejects empty string", () => {
    expect(isValidUrl("")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isValidUrl("   ")).toBe(false);
  });

  it("rejects strings without a dot in hostname", () => {
    expect(isValidUrl("notaurl")).toBe(false);
  });

  it("rejects completely invalid URLs", () => {
    expect(isValidUrl("://broken")).toBe(false);
  });
});

// ── sanitizeUrl ──

describe("sanitizeUrl", () => {
  it("returns a normalized URL string for valid URLs", () => {
    const result = sanitizeUrl("example.com");
    expect(result).toBe("https://example.com/");
  });

  it("preserves existing protocol", () => {
    const result = sanitizeUrl("http://example.com/path");
    expect(result).toBe("http://example.com/path");
  });

  it("returns null for invalid URLs", () => {
    expect(sanitizeUrl("")).toBeNull();
    expect(sanitizeUrl("not-valid")).toBeNull();
  });

  it("returns null for private IPs", () => {
    expect(sanitizeUrl("http://127.0.0.1")).toBeNull();
    expect(sanitizeUrl("http://10.0.0.1")).toBeNull();
    expect(sanitizeUrl("http://192.168.1.1")).toBeNull();
  });

  it("returns null for localhost", () => {
    expect(sanitizeUrl("http://localhost:3000")).toBeNull();
  });

  it("returns null for non-HTTP protocols", () => {
    expect(sanitizeUrl("ftp://files.example.com")).toBeNull();
  });
});

// ── isNotEmpty ──

describe("isNotEmpty", () => {
  it("returns true for non-empty strings", () => {
    expect(isNotEmpty("hello")).toBe(true);
  });

  it("returns false for empty strings", () => {
    expect(isNotEmpty("")).toBe(false);
  });

  it("returns false for whitespace-only strings", () => {
    expect(isNotEmpty("   ")).toBe(false);
  });
});

// ── getValidationError ──

describe("getValidationError", () => {
  it("returns null when all fields are valid", () => {
    const result = getValidationError([
      { name: "Name", value: "John" },
      { name: "URL", value: "https://example.com", type: "url" },
    ]);
    expect(result).toBeNull();
  });

  it("returns error for empty required field", () => {
    const result = getValidationError([
      { name: "Name", value: "" },
    ]);
    expect(result).toContain("Name");
  });

  it("returns error for invalid URL field", () => {
    const result = getValidationError([
      { name: "Website", value: "not-a-url", type: "url" },
    ]);
    expect(result).toContain("Website");
    expect(result).toContain("URL");
  });

  it("validates fields in order and returns first error", () => {
    const result = getValidationError([
      { name: "First", value: "" },
      { name: "Second", value: "" },
    ]);
    expect(result).toContain("First");
  });
});
