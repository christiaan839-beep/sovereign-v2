/**
 * Wave-107 — logger PII redaction tests.
 *
 * The audit flagged raw email/key payloads being logged from
 * `byok/route.ts`, `data-export/route.ts`, `webhooks/clerk/route.ts`,
 * and `_email/unsubscribe/route.ts`. The logger is now the choke-
 * point: any `data` object passed to logger.{info,warn,error,debug}
 * is recursively scrubbed first. This file pins that contract.
 */
import { describe, it, expect } from "vitest";
import { redactPii } from "../logger";

describe("redactPii — key-based redaction (fail-closed)", () => {
  it("redacts exact sensitive keys", () => {
    const r = redactPii({ password: "hunter2" }) as Record<string, unknown>;
    expect(r.password).toBe("[REDACTED]");
  });

  it("matches partial / camelCase / snake_case variants on substring tier", () => {
    const r = redactPii({
      userPassword: "x",
      password_hash: "x",
      apiKey: "x",
      api_key: "x",
      sessionToken: "x",
      authorization: "x",
      Cookie: "x",
      stripe_signature: "x",
    }) as Record<string, string>;
    for (const v of Object.values(r)) expect(v).toBe("[REDACTED]");
  });

  it("redacts EXACT email-variant field names (wave-107.1 exact tier)", () => {
    const r = redactPii({
      email: "u@example.com",
      userEmail: "u@example.com",
      user_email: "u@example.com",
      email_address: "u@example.com",
      email_addresses: ["u@example.com"],
      to_email: "u@example.com",
      from_email: "u@example.com",
    }) as Record<string, unknown>;
    for (const k of Object.keys(r)) {
      expect(r[k], `${k} should be redacted`).toBe("[REDACTED]");
    }
  });

  it("wave-107.1: does NOT over-redact business-meaningful email_* fields", () => {
    // The previous substring-only policy redacted these unconditionally,
    // which would have broken the content-machine / email-sequence
    // engine's debuggability. The exact-tier policy preserves them.
    const r = redactPii({
      email_template_name: "welcome_v3",
      email_campaign_id: "camp_42",
      email_open_count: 17,
      email_subject: "Your trial ends soon",
      welcome_email_sent_at: "2026-05-20T12:00:00Z",
    }) as Record<string, unknown>;
    expect(r.email_template_name).toBe("welcome_v3");
    expect(r.email_campaign_id).toBe("camp_42");
    expect(r.email_open_count).toBe(17);
    // email_subject contains an email-shaped value? No → preserved.
    expect(r.email_subject).toBe("Your trial ends soon");
    expect(r.welcome_email_sent_at).toBe("2026-05-20T12:00:00Z");
  });

  it("wave-107.1: does NOT over-redact phone_* business fields (e.g. Clerk phone_number_id)", () => {
    const r = redactPii({
      phone_number_id: "idn_publicclerkid", // public Clerk identifier
      phone_provider: "twilio",
      phone_country_code: "+27",
    }) as Record<string, unknown>;
    expect(r.phone_number_id).toBe("idn_publicclerkid");
    expect(r.phone_provider).toBe("twilio");
    expect(r.phone_country_code).toBe("+27");
  });

  it("BUT still redacts exact phone variants when the field IS the phone number", () => {
    const r = redactPii({
      phone: "+27821234567",
      phone_number: "+27821234567",
      phoneNumber: "+27821234567",
    }) as Record<string, string>;
    for (const v of Object.values(r)) expect(v).toBe("[REDACTED]");
  });

  it("does NOT redact benign keys", () => {
    const r = redactPii({
      name: "Alice",
      count: 7,
      ok: true,
      module: "auth",
    }) as Record<string, unknown>;
    expect(r.name).toBe("Alice");
    expect(r.count).toBe(7);
    expect(r.ok).toBe(true);
    expect(r.module).toBe("auth");
  });

  it("redacts case-insensitively", () => {
    expect((redactPii({ SECRET: "x" }) as Record<string, string>).SECRET).toBe(
      "[REDACTED]",
    );
    expect(
      (redactPii({ Authorization: "x" }) as Record<string, string>)
        .Authorization,
    ).toBe("[REDACTED]");
  });
});

describe("redactPii — value-based redaction (catches misnamed fields)", () => {
  it("masks emails appearing in arbitrary string values", () => {
    const r = redactPii({
      note: "contacted alice@example.com about the invoice",
    }) as Record<string, string>;
    expect(r.note).not.toContain("alice@example.com");
    expect(r.note).toContain("[email]");
  });

  it("masks Stripe sk_/pk_/whsec_ tokens by value", () => {
    const r = redactPii({
      log: "called sk_live_abcdefghijklmnop1234567890 ok",
    }) as Record<string, string>;
    expect(r.log).not.toContain("sk_live_abcdefghijklmnop");
    expect(r.log).toContain("[token]");
  });

  it("masks Clerk-style tokens (whsec_, pk_, etc.)", () => {
    const r = redactPii({
      log: "whsec_aaaaaaaaaaaaaaaaaaaaaa pk_test_zzzzzzzzzzzzzzzzzzzzzzzzzz",
    }) as Record<string, string>;
    expect(r.log).not.toContain("whsec_a");
    expect(r.log).not.toContain("pk_test_z");
  });

  it("masks JWT-shaped tokens by value", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.fakesignature123";
    const r = redactPii({ note: `bearer ${jwt}` }) as Record<string, string>;
    expect(r.note).toContain("[jwt]");
    expect(r.note).not.toContain(jwt);
  });

  it("masks long opaque secret-shaped values (≥64 chars, wave-107.1)", () => {
    // Bumped from 48 to 64 chars to avoid false positives on UUIDs +
    // signed S3 URLs. 64+ is still well below real API-key lengths.
    const opaque =
      "ZGVtb2RlbW9kZW1vZGVtb2RlbW9kZW1vZGVtb2RlbW9kZW1vZGVtb2RlbW9kZW1vZA==";
    const r = redactPii({ note: `key=${opaque}` }) as Record<string, string>;
    expect(r.note).toContain("[opaque]");
  });

  it("wave-107.1: does NOT mask <64-char opaque strings (UUIDs, request IDs, S3 keys)", () => {
    const r = redactPii({
      requestId: "req_01HXYZ123456789",
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      shortHash: "abc123def456ghi789",
    }) as Record<string, string>;
    expect(r.requestId).not.toContain("[opaque]");
    expect(r.uuid).not.toContain("[opaque]");
    expect(r.shortHash).not.toContain("[opaque]");
  });

  it("leaves short strings untouched (no false positives on counts/ids)", () => {
    const r = redactPii({
      id: "user-42",
      shortHex: "abc123",
    }) as Record<string, string>;
    expect(r.id).toBe("user-42");
    expect(r.shortHex).toBe("abc123");
  });
});

describe("redactPii — structure", () => {
  it("recurses into nested objects", () => {
    const r = redactPii({
      a: { b: { password: "x" } },
    }) as { a: { b: { password: string } } };
    expect(r.a.b.password).toBe("[REDACTED]");
  });

  it("recurses into arrays", () => {
    const r = redactPii({
      users: [{ email: "a@x" }, { email: "b@x" }],
    }) as { users: Array<{ email: string }> };
    expect(r.users[0].email).toBe("[REDACTED]");
    expect(r.users[1].email).toBe("[REDACTED]");
  });

  it("handles circular references without stack overflow", () => {
    const obj: Record<string, unknown> = { name: "x" };
    obj.self = obj;
    const r = redactPii(obj) as Record<string, unknown>;
    expect(r.name).toBe("x");
    expect(r.self).toBe("[circular]");
  });

  it("caps depth (defends against malicious/buggy deep nesting)", () => {
    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 20; i++) deep = { next: deep };
    const r = redactPii(deep);
    expect(JSON.stringify(r)).toContain("[depth-limit]");
  });

  it("preserves primitives", () => {
    expect(redactPii(42)).toBe(42);
    expect(redactPii(true)).toBe(true);
    expect(redactPii(null)).toBe(null);
    expect(redactPii(undefined)).toBe(undefined);
  });

  it("replaces functions/symbols with placeholders", () => {
    expect(redactPii(() => 0)).toBe("[function]");
    expect(redactPii(Symbol("x"))).toBe("[symbol]");
  });
});

describe("redactPii — real-world audit findings", () => {
  it("scrubs the byok payload pattern { email, key }", () => {
    const r = redactPii({
      email: "user@example.com",
      key: "sk_live_secrethandshakekey1234567890",
    }) as Record<string, string>;
    expect(r.email).toBe("[REDACTED]");
    expect(r.key).not.toContain("sk_live");
  });

  it("scrubs the Clerk webhook payload pattern (whole sensitive subtree)", () => {
    const r = redactPii({
      data: {
        email_addresses: [{ email_address: "user@example.com" }],
        first_name: "Alice",
      },
    }) as {
      data: { email_addresses: string; first_name: string };
    };
    // The `email_addresses` key matches the `email` pattern → the
    // whole subtree is replaced with [REDACTED]. This is the
    // fail-closed safety contract; a partial leak (e.g. count
    // visible while addresses hidden) would require a deliberate
    // safe-key allowlist that doesn't exist yet.
    expect(r.data.email_addresses).toBe("[REDACTED]");
    expect(r.data.first_name).toBe("Alice"); // name is NOT sensitive
  });

  it("scrubs unsubscribe payload {email}", () => {
    const r = redactPii({ email: "leaver@example.com" }) as Record<
      string,
      string
    >;
    expect(r.email).toBe("[REDACTED]");
  });
});
