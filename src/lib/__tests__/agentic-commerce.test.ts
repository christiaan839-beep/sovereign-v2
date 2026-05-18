/**
 * Tests for src/lib/agentic-commerce.ts — Wave 18 ACP envelope.
 *
 * All hermetic. HMAC v1 signing scheme via AGENT_RUN_SIGNING_SECRET.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "crypto";
import {
  issueAcpEnvelope,
  verifyAcpEnvelope,
  totalSpend,
  type AcpIntent,
  type AcpConsent,
} from "@/lib/agentic-commerce";

const originalSecret = process.env.AGENT_RUN_SIGNING_SECRET;
const originalEd = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
beforeAll(() => {
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  process.env.AGENT_RUN_SIGNING_SECRET = randomBytes(24).toString("hex");
});
afterAll(() => {
  if (originalSecret !== undefined)
    process.env.AGENT_RUN_SIGNING_SECRET = originalSecret;
  else delete process.env.AGENT_RUN_SIGNING_SECRET;
  if (originalEd !== undefined)
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = originalEd;
});

const ACP: AcpIntent = {
  merchantId: "merchant.example",
  sku: "widget-blue-l",
  title: "Blue widget, large",
  unitAmount: 2500, // $25.00
  currency: "USD",
  quantity: 2,
};

const CONSENT: AcpConsent = {
  principalId: "user_alice",
  spendCapAmount: 10_000, // $100
  spendCapCurrency: "USD",
  allowedMerchantId: "merchant.example",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  consentToken: "ct_test_1",
};

describe("issueAcpEnvelope", () => {
  it("produces a well-formed signed envelope", () => {
    const env = issueAcpEnvelope({
      acp: ACP,
      consent: CONSENT,
      agentTokenId: "tok_test_1",
    });
    expect(env.envelopeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(env.protocol).toBe("sov-acp/1");
    expect(env.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(env.signature).toMatch(/^v1=[0-9a-f]+$/);
    expect(env.canonical).toMatch(/"type":"sov-acp\/1"/);
  });

  it("throws when unitAmount <= 0", () => {
    expect(() =>
      issueAcpEnvelope({
        acp: { ...ACP, unitAmount: 0 },
        consent: CONSENT,
        agentTokenId: "tok",
      }),
    ).toThrow(/unitAmount/);
  });

  it("throws on non-positive quantity", () => {
    expect(() =>
      issueAcpEnvelope({
        acp: { ...ACP, quantity: 0 },
        consent: CONSENT,
        agentTokenId: "tok",
      }),
    ).toThrow(/quantity/);
  });

  it("throws when total spend exceeds consent cap", () => {
    expect(() =>
      issueAcpEnvelope({
        acp: { ...ACP, quantity: 1000 },
        consent: CONSENT,
        agentTokenId: "tok",
      }),
    ).toThrow(/exceeds consent cap/);
  });

  it("throws when merchant outside consent scope", () => {
    expect(() =>
      issueAcpEnvelope({
        acp: { ...ACP, merchantId: "merchant.other" },
        consent: CONSENT,
        agentTokenId: "tok",
      }),
    ).toThrow(/merchant outside consent/);
  });

  it("accepts wildcard '*' allowedMerchantId", () => {
    const env = issueAcpEnvelope({
      acp: ACP,
      consent: { ...CONSENT, allowedMerchantId: "*" },
      agentTokenId: "tok",
    });
    expect(env.envelopeId).toBeTruthy();
  });

  it("rejects when consent currency != acp currency", () => {
    expect(() =>
      issueAcpEnvelope({
        acp: ACP,
        consent: { ...CONSENT, spendCapCurrency: "EUR" },
        agentTokenId: "tok",
      }),
    ).toThrow(/currency does not match/);
  });
});

describe("verifyAcpEnvelope", () => {
  it("returns ok=true on an unmutated envelope", () => {
    const env = issueAcpEnvelope({
      acp: ACP,
      consent: CONSENT,
      agentTokenId: "tok",
    });
    const v = verifyAcpEnvelope(env);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.envelope.envelopeId).toBe(env.envelopeId);
  });

  it("returns hash-mismatch when contentHash is tampered", () => {
    const env = issueAcpEnvelope({
      acp: ACP,
      consent: CONSENT,
      agentTokenId: "tok",
    });
    const tampered = { ...env, contentHash: "0".repeat(64) };
    const v = verifyAcpEnvelope(tampered);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("hash-mismatch");
  });

  it("returns signature-mismatch when signature bytes are tampered", () => {
    const env = issueAcpEnvelope({
      acp: ACP,
      consent: CONSENT,
      agentTokenId: "tok",
    });
    const tampered = { ...env, signature: "v1=" + "0".repeat(64) };
    const v = verifyAcpEnvelope(tampered);
    expect(v.ok).toBe(false);
    if (!v.ok)
      expect(["signature-mismatch", "hash-mismatch"]).toContain(v.reason);
  });

  it("returns expired-consent when consent.expiresAt is in the past", () => {
    const env = issueAcpEnvelope({
      acp: ACP,
      consent: {
        ...CONSENT,
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      },
      agentTokenId: "tok",
    });
    // Travel past the consent expiry.
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 60_000;
      const v = verifyAcpEnvelope(env);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toBe("expired-consent");
    } finally {
      Date.now = realNow;
    }
  });

  it("returns canonical-mismatch when the canonical bytes are altered", () => {
    const env = issueAcpEnvelope({
      acp: ACP,
      consent: CONSENT,
      agentTokenId: "tok",
    });
    const tampered = { ...env, canonical: env.canonical + " " };
    const v = verifyAcpEnvelope(tampered);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("canonical-mismatch");
  });
});

describe("totalSpend", () => {
  it("multiplies unitAmount × quantity", () => {
    expect(totalSpend(ACP)).toBe(5000);
  });
});
