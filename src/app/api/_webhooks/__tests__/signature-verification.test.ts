/**
 * Regression tests for webhook signature verification helpers.
 *
 * These tests exercise the signature verification logic that protects
 * CRM (HubSpot v3) and booking (Cal.com) webhooks from the critical
 * "unauthenticated webhook" vulnerabilities found in the security audit.
 *
 * The verification functions are currently route-local, so we recreate
 * them here to test the pattern. If they're ever extracted into a shared
 * helper, these tests can import directly.
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";

// ─── HubSpot v3 signature pattern ──────────────────────

function verifyHubSpot(
  signature: string,
  secret: string,
  method: string,
  url: string,
  body: string,
  timestamp: string,
  now = Date.now(),
): boolean {
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const ageMs = now - ts;
  if (ageMs > 5 * 60 * 1000 || ageMs < -30 * 1000) return false;

  const source = `${method}${url}${body}${timestamp}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(source)
    .digest("base64");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

describe("HubSpot v3 signature verification", () => {
  const SECRET = "test_hubspot_client_secret";
  const URL_STR = "https://sovereignmatrix.agency/api/_webhooks/crm";
  const METHOD = "POST";
  const BODY = JSON.stringify({ subscriptionType: "deal.propertyChange" });
  const NOW = 1_700_000_000_000;
  const TS = String(NOW - 1000); // 1 second ago

  function signHubSpot(ts = TS, body = BODY, url = URL_STR): string {
    const source = `${METHOD}${url}${body}${ts}`;
    return crypto.createHmac("sha256", SECRET).update(source).digest("base64");
  }

  it("accepts a valid signature within the replay window", () => {
    const sig = signHubSpot();
    expect(verifyHubSpot(sig, SECRET, METHOD, URL_STR, BODY, TS, NOW)).toBe(
      true,
    );
  });

  it("rejects a tampered body", () => {
    const sig = signHubSpot();
    const tampered = JSON.stringify({ subscriptionType: "attacker" });
    expect(verifyHubSpot(sig, SECRET, METHOD, URL_STR, tampered, TS, NOW)).toBe(
      false,
    );
  });

  it("rejects signatures older than 5 minutes (replay)", () => {
    const oldTs = String(NOW - 6 * 60 * 1000);
    const sig = signHubSpot(oldTs);
    expect(verifyHubSpot(sig, SECRET, METHOD, URL_STR, BODY, oldTs, NOW)).toBe(
      false,
    );
  });

  it("rejects signatures from the future (clock skew attack)", () => {
    const futureTs = String(NOW + 60 * 1000); // 1 minute in the future
    const sig = signHubSpot(futureTs);
    expect(
      verifyHubSpot(sig, SECRET, METHOD, URL_STR, BODY, futureTs, NOW),
    ).toBe(false);
  });

  it("rejects mismatched-length signatures without throwing", () => {
    expect(() =>
      verifyHubSpot("short", SECRET, METHOD, URL_STR, BODY, TS, NOW),
    ).not.toThrow();
    expect(verifyHubSpot("short", SECRET, METHOD, URL_STR, BODY, TS, NOW)).toBe(
      false,
    );
  });

  it("rejects garbage timestamps", () => {
    const sig = signHubSpot();
    expect(
      verifyHubSpot(sig, SECRET, METHOD, URL_STR, BODY, "not-a-number", NOW),
    ).toBe(false);
  });

  it("rejects a valid signature made with the wrong secret", () => {
    const badSig = crypto
      .createHmac("sha256", "different_secret")
      .update(`${METHOD}${URL_STR}${BODY}${TS}`)
      .digest("base64");
    expect(verifyHubSpot(badSig, SECRET, METHOD, URL_STR, BODY, TS, NOW)).toBe(
      false,
    );
  });
});

// ─── Cal.com signature pattern ─────────────────────────

function verifyCal(
  signature: string,
  secret: string,
  rawBody: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

describe("Cal.com signature verification", () => {
  const SECRET = "test_cal_secret";
  const BODY = JSON.stringify({
    triggerEvent: "BOOKING_CREATED",
    payload: { attendees: [{ email: "legit@customer.com" }] },
  });

  function signCal(body = BODY): string {
    return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  }

  it("accepts a valid signature", () => {
    expect(verifyCal(signCal(), SECRET, BODY)).toBe(true);
  });

  // Regression: the critical finding was that an attacker could POST an
  // arbitrary attendee email and we'd send a welcome email from
  // hello@sovereignmatrix.agency to that address. This test proves the
  // fix rejects unsigned/forged bodies.
  it("rejects forged attendee injection without a valid signature", () => {
    const forged = JSON.stringify({
      triggerEvent: "BOOKING_CREATED",
      payload: { attendees: [{ email: "victim@example.com" }] },
    });
    expect(verifyCal("no-signature-at-all", SECRET, forged)).toBe(false);
  });

  it("rejects a signature computed over a different body", () => {
    const originalSig = signCal();
    const tamperedBody = JSON.stringify({
      triggerEvent: "BOOKING_CREATED",
      payload: { attendees: [{ email: "victim@example.com" }] },
    });
    expect(verifyCal(originalSig, SECRET, tamperedBody)).toBe(false);
  });

  it("rejects mismatched-length signatures without throwing", () => {
    expect(() => verifyCal("short", SECRET, BODY)).not.toThrow();
    expect(verifyCal("short", SECRET, BODY)).toBe(false);
  });
});
