/**
 * Tests for src/lib/webhook-sign — outbound webhook signing.
 *
 * Properties pinned:
 *   - signWebhookPayload + verifyWebhookSignature round-trip cleanly
 *   - Wire format matches Stripe's t=<ts>,v1=<hex> convention
 *   - Verification rejects tampered body + tampered signature
 *   - Verification rejects replay (timestamp older than tolerance)
 *   - Verification handles malformed header gracefully (no throw)
 *   - generateWebhookSecret produces base64url with ≥32 bytes entropy
 *   - dispatchWebhook sends correct headers + body
 *   - dispatchWebhook returns failure shape (not throw) on network error
 */

import { describe, it, expect, vi } from "vitest";

import {
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_VERSION,
  WEBHOOK_REPLAY_WINDOW_SECONDS,
  generateWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  dispatchWebhook,
} from "@/lib/webhook-sign";

const SECRET = "test_webhook_secret_aaa";
const BODY = '{"agent":"blog-gen","event":"run.completed"}';

// ── signWebhookPayload / verifyWebhookSignature ─────────────────────────

describe("signWebhookPayload + verifyWebhookSignature", () => {
  it("round-trips a freshly signed payload", () => {
    const sig = signWebhookPayload(BODY, SECRET);
    expect(sig.signature).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(sig.header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verifyWebhookSignature(BODY, sig.header, SECRET)).toBe(true);
  });

  it("wire format follows Stripe's t=<ts>,v1=<hex> convention", () => {
    const sig = signWebhookPayload(BODY, SECRET, 1700000000);
    expect(sig.header.startsWith("t=1700000000,v1=")).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = signWebhookPayload(BODY, SECRET);
    expect(
      verifyWebhookSignature('{"agent":"hacked"}', sig.header, SECRET),
    ).toBe(false);
  });

  it("rejects a wrong-secret verification", () => {
    const sig = signWebhookPayload(BODY, SECRET);
    expect(verifyWebhookSignature(BODY, sig.header, "wrong-secret")).toBe(
      false,
    );
  });

  it("rejects a replay older than the tolerance window", () => {
    const old = signWebhookPayload(
      BODY,
      SECRET,
      Math.floor(Date.now() / 1000) - WEBHOOK_REPLAY_WINDOW_SECONDS - 10,
    );
    expect(verifyWebhookSignature(BODY, old.header, SECRET)).toBe(false);
  });

  it("accepts a payload within the tolerance window", () => {
    const fresh = signWebhookPayload(
      BODY,
      SECRET,
      Math.floor(Date.now() / 1000) - WEBHOOK_REPLAY_WINDOW_SECONDS + 10,
    );
    expect(verifyWebhookSignature(BODY, fresh.header, SECRET)).toBe(true);
  });

  it("returns false (not throws) on missing / malformed header", () => {
    expect(verifyWebhookSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "not a real header", SECRET)).toBe(
      false,
    );
    expect(verifyWebhookSignature(BODY, "t=not-a-number,v1=", SECRET)).toBe(
      false,
    );
    expect(verifyWebhookSignature(BODY, "v1=abc", SECRET)).toBe(false); // missing t=
  });

  it("rejects non-hex v1 payload (forward-compat guard)", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(
      verifyWebhookSignature(BODY, `t=${ts},v1=NOT-HEX-VALUES!!!`, SECRET),
    ).toBe(false);
  });

  it("rejects unknown algorithm prefix (v2= without v1= still rejects)", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(
      verifyWebhookSignature(BODY, `t=${ts},v2=${"a".repeat(64)}`, SECRET),
    ).toBe(false);
  });
});

// ── generateWebhookSecret ───────────────────────────────────────────────

describe("generateWebhookSecret", () => {
  it("produces base64url strings (no padding, no slash/plus)", () => {
    const s = generateWebhookSecret();
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(s).not.toContain("="); // base64url is unpadded
    expect(s).not.toContain("/");
    expect(s).not.toContain("+");
  });

  it("emits 32+ bytes of entropy (>= 43 base64url chars)", () => {
    expect(generateWebhookSecret().length).toBeGreaterThanOrEqual(43);
  });

  it("two consecutive calls produce different secrets", () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });
});

// ── dispatchWebhook ─────────────────────────────────────────────────────

describe("dispatchWebhook", () => {
  it("sends correct headers + signed body, returns ok on 2xx", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    const result = await dispatchWebhook({
      url: "https://example.test/hook",
      event: "agent.run.completed",
      payload: { hello: "world" },
      secret: SECRET,
      fetch: fetchMock as typeof fetch,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.signature).toMatch(/^v1=[0-9a-f]{64}$/);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.test/hook");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers[WEBHOOK_EVENT_HEADER]).toBe("agent.run.completed");
    expect(headers[WEBHOOK_SIGNATURE_HEADER]).toMatch(
      /^t=\d+,v1=[0-9a-f]{64}$/,
    );

    // Body must be JSON-stringified payload and verifiable against secret
    const body = (init as RequestInit).body as string;
    expect(JSON.parse(body)).toEqual({ hello: "world" });
    expect(
      verifyWebhookSignature(body, headers[WEBHOOK_SIGNATURE_HEADER], SECRET),
    ).toBe(true);
  });

  it("returns ok:false (does not throw) on a network error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const result = await dispatchWebhook({
      url: "https://example.test/hook",
      event: "agent.run.completed",
      payload: {},
      secret: SECRET,
      fetch: fetchMock as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBeNull();
    expect(result.error).toMatch(/ECONNREFUSED/);
  });

  it("returns ok:false when the receiver responds non-2xx", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    const result = await dispatchWebhook({
      url: "https://example.test/hook",
      event: "agent.run.completed",
      payload: {},
      secret: SECRET,
      fetch: fetchMock as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });
});

// ── Wire-format constants ───────────────────────────────────────────────

describe("wire format constants", () => {
  it("publishes the header names used in the wire format", () => {
    // Customers verifying inbound webhooks pin against these literal
    // strings — they SHOULD NOT change without a major-version bump.
    expect(WEBHOOK_SIGNATURE_HEADER).toBe("X-Sovereign-Signature");
    expect(WEBHOOK_EVENT_HEADER).toBe("X-Sovereign-Event");
    expect(WEBHOOK_SIGNATURE_VERSION).toBe("v1");
  });

  it("replay window matches Stripe's convention (300 seconds)", () => {
    expect(WEBHOOK_REPLAY_WINDOW_SECONDS).toBe(300);
  });
});
