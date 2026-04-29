/**
 * webhooks/signing (R58) — tests.
 *
 * Closes the outbound cryptographic perimeter. Pure-function
 * canonical message + verifier; sign uses Ed25519 from R34.
 *
 * Covers:
 *   - buildWebhookCanonicalMessage: deterministic format
 *   - signWebhook: produces all 4 required headers
 *   - verifyWebhook: roundtrip with valid signature
 *   - verifyWebhook: catches missing headers (each one individually)
 *   - verifyWebhook: catches stale timestamps (>5 min default)
 *   - verifyWebhook: catches future timestamps (>60s clock drift)
 *   - verifyWebhook: catches body tampering
 *   - verifyWebhook: catches signature tampering
 *   - verifyWebhook: catches key-id mismatch
 *   - verifyWebhook: replay-detection callback
 *   - Header lookup is case-insensitive (HTTP standard)
 */

import { describe, it, expect } from "vitest";
import {
  buildWebhookCanonicalMessage,
  signWebhook,
  verifyWebhook,
  REQUIRED_WEBHOOK_HEADER_NAMES,
} from "../webhooks/signing";
import { generateKeyPair } from "../agent-delegation";

const TIMESTAMP = "2026-04-29T12:00:00.000Z";
const NOW = new Date("2026-04-29T12:01:00.000Z"); // 1 min after timestamp

const fixedInput = (override: Record<string, unknown> = {}) => {
  const kp = generateKeyPair();
  return {
    kp,
    body: '{"event":"agent.run.completed","agentId":"foo"}',
    webhookId: "wh-123",
    timestamp: TIMESTAMP,
    platformKeyId: "platform-key-2026",
    ...override,
  };
};

describe("buildWebhookCanonicalMessage (pure)", () => {
  it("produces v1 line-separated format with all key fields", () => {
    const msg = buildWebhookCanonicalMessage({
      timestamp: TIMESTAMP,
      webhookId: "wh-1",
      body: "hello",
    });
    expect(msg.startsWith("v1\nsovereign-webhook\n")).toBe(true);
    expect(msg).toContain("timestamp:2026-04-29T12:00:00.000Z");
    expect(msg).toContain("webhookId:wh-1");
    expect(msg).toMatch(/bodyHash:[a-f0-9]{64}/);
  });

  it("identical body → identical message", () => {
    const a = buildWebhookCanonicalMessage({
      timestamp: TIMESTAMP,
      webhookId: "wh-1",
      body: "x",
    });
    const b = buildWebhookCanonicalMessage({
      timestamp: TIMESTAMP,
      webhookId: "wh-1",
      body: "x",
    });
    expect(a).toBe(b);
  });

  it("different body → different bodyHash → different message", () => {
    const a = buildWebhookCanonicalMessage({
      timestamp: TIMESTAMP,
      webhookId: "wh-1",
      body: "x",
    });
    const b = buildWebhookCanonicalMessage({
      timestamp: TIMESTAMP,
      webhookId: "wh-1",
      body: "y",
    });
    expect(a).not.toBe(b);
  });
});

describe("signWebhook → verifyWebhook roundtrip", () => {
  it("verifies cleanly with the matching public key", () => {
    const { kp, body, webhookId, timestamp, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const result = verifyWebhook({
      body: signed.body,
      headers: signed.headers as unknown as Record<string, string>,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.webhookId).toBe(webhookId);
  });

  it("emits all 4 required headers", () => {
    const { kp, body, webhookId, timestamp, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    for (const name of REQUIRED_WEBHOOK_HEADER_NAMES) {
      expect(
        signed.headers[name as keyof typeof signed.headers],
      ).toBeTruthy();
    }
  });
});

describe("verifyWebhook — missing headers (each individually)", () => {
  function getSigned() {
    const { kp, body, webhookId, timestamp, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    return { kp, signed };
  }

  it("missing X-Sovereign-Signature → missing_signature", () => {
    const { kp, signed } = getSigned();
    const headers = { ...signed.headers } as Record<string, string | undefined>;
    delete headers["X-Sovereign-Signature"];
    const result = verifyWebhook({
      body: signed.body,
      headers,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("missing_signature");
  });

  it("missing timestamp → missing_timestamp", () => {
    const { kp, signed } = getSigned();
    const headers = { ...signed.headers } as Record<string, string | undefined>;
    delete headers["X-Sovereign-Signature-Timestamp"];
    const result = verifyWebhook({
      body: signed.body,
      headers,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("missing_timestamp");
  });

  it("missing webhook id → missing_webhook_id", () => {
    const { kp, signed } = getSigned();
    const headers = { ...signed.headers } as Record<string, string | undefined>;
    delete headers["X-Sovereign-Webhook-Id"];
    const result = verifyWebhook({
      body: signed.body,
      headers,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("missing_webhook_id");
  });

  it("missing key id → missing_key_id", () => {
    const { kp, signed } = getSigned();
    const headers = { ...signed.headers } as Record<string, string | undefined>;
    delete headers["X-Sovereign-Signature-Key-Id"];
    const result = verifyWebhook({
      body: signed.body,
      headers,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("missing_key_id");
  });
});

describe("verifyWebhook — timestamp validation", () => {
  it("stale timestamp (>5 min default) → timestamp_too_old", () => {
    const { kp, body, webhookId, platformKeyId } = fixedInput();
    const old = "2026-04-29T11:00:00.000Z"; // 1 hour before NOW
    const signed = signWebhook({
      body,
      webhookId,
      timestamp: old,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const result = verifyWebhook({
      body: signed.body,
      headers: signed.headers as unknown as Record<string, string>,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("timestamp_too_old");
  });

  it("future timestamp beyond 60s drift → timestamp_in_future", () => {
    const { kp, body, webhookId, platformKeyId } = fixedInput();
    const future = "2026-04-29T12:30:00.000Z"; // 29 min after NOW
    const signed = signWebhook({
      body,
      webhookId,
      timestamp: future,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const result = verifyWebhook({
      body: signed.body,
      headers: signed.headers as unknown as Record<string, string>,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("timestamp_in_future");
  });

  it("invalid timestamp format → timestamp_invalid", () => {
    const { kp, body, webhookId, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp: "not-a-date",
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const result = verifyWebhook({
      body: signed.body,
      headers: signed.headers as unknown as Record<string, string>,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("timestamp_invalid");
  });

  it("custom freshnessWindow allows older timestamps", () => {
    const { kp, body, webhookId, platformKeyId } = fixedInput();
    const old = "2026-04-29T11:00:00.000Z"; // 1 hour before NOW
    const signed = signWebhook({
      body,
      webhookId,
      timestamp: old,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const result = verifyWebhook({
      body: signed.body,
      headers: signed.headers as unknown as Record<string, string>,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
      freshnessWindowMs: 24 * 60 * 60 * 1000, // 24h
    });
    expect(result.valid).toBe(true);
  });
});

describe("verifyWebhook — tampering detection", () => {
  it("body tampering breaks bodyHash → signature_invalid", () => {
    const { kp, body, webhookId, timestamp, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const result = verifyWebhook({
      body: body + "TAMPERED",
      headers: signed.headers as unknown as Record<string, string>,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("signature_invalid");
  });

  it("signature tampering → signature_invalid", () => {
    const { kp, body, webhookId, timestamp, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const sig = signed.headers["X-Sovereign-Signature"];
    const tampered = sig.split("");
    tampered[5] = tampered[5] === "A" ? "B" : "A";
    const result = verifyWebhook({
      body: signed.body,
      headers: {
        ...signed.headers,
        "X-Sovereign-Signature": tampered.join(""),
      } as unknown as Record<string, string>,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("signature_invalid");
  });

  it("attacker swapping pubkey → signature_invalid", () => {
    const { kp, body, webhookId, timestamp, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const attacker = generateKeyPair();
    const result = verifyWebhook({
      body: signed.body,
      headers: signed.headers as unknown as Record<string, string>,
      expectedPlatformPublicKey: attacker.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("signature_invalid");
  });
});

describe("verifyWebhook — key-id pinning + replay defense", () => {
  it("expectedKeyId mismatch → key_id_mismatch", () => {
    const { kp, body, webhookId, timestamp, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const result = verifyWebhook({
      body: signed.body,
      headers: signed.headers as unknown as Record<string, string>,
      expectedPlatformPublicKey: kp.publicKey,
      expectedKeyId: "different-key",
      now: NOW,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("key_id_mismatch");
  });

  it("replay defense: isReplay=true → replay_detected", () => {
    const { kp, body, webhookId, timestamp, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const result = verifyWebhook({
      body: signed.body,
      headers: signed.headers as unknown as Record<string, string>,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
      isReplay: () => true,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("replay_detected");
  });
});

describe("verifyWebhook — case-insensitive header lookup", () => {
  it("accepts lowercase header names (HTTP standard)", () => {
    const { kp, body, webhookId, timestamp, platformKeyId } = fixedInput();
    const signed = signWebhook({
      body,
      webhookId,
      timestamp,
      platformPrivateKey: kp.privateKey,
      platformKeyId,
    });
    const lowercased: Record<string, string> = {
      "x-sovereign-signature": signed.headers["X-Sovereign-Signature"],
      "x-sovereign-signature-timestamp":
        signed.headers["X-Sovereign-Signature-Timestamp"],
      "x-sovereign-signature-key-id":
        signed.headers["X-Sovereign-Signature-Key-Id"],
      "x-sovereign-webhook-id": signed.headers["X-Sovereign-Webhook-Id"],
    };
    const result = verifyWebhook({
      body: signed.body,
      headers: lowercased,
      expectedPlatformPublicKey: kp.publicKey,
      now: NOW,
    });
    expect(result.valid).toBe(true);
  });
});
