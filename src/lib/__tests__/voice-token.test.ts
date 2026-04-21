/**
 * voice-token.ts — tests.
 */

import { describe, it, expect } from "vitest";
import { signVoiceToken, verifyVoiceToken, type VoiceTokenPayload } from "@/lib/voice-token";

const SECRET = "x".repeat(32); // ≥ 16 chars

function makePayload(overrides: Partial<VoiceTokenPayload> = {}): VoiceTokenPayload {
  return {
    userId: "user_abc",
    personaId: "default",
    holdId: "hold_xyz",
    exp: Math.floor(Date.now() / 1000) + 60,
    ...overrides,
  };
}

describe("signVoiceToken", () => {
  it("produces a two-part token separated by a dot", () => {
    const token = signVoiceToken(makePayload(), SECRET);
    expect(token.split(".").length).toBe(2);
  });

  it("rejects weak secrets (< 16 chars)", () => {
    expect(() => signVoiceToken(makePayload(), "short")).toThrow(/16/);
  });

  it("produces distinct tokens for distinct payloads", () => {
    const a = signVoiceToken(makePayload({ userId: "u1" }), SECRET);
    const b = signVoiceToken(makePayload({ userId: "u2" }), SECRET);
    expect(a).not.toBe(b);
  });
});

describe("verifyVoiceToken", () => {
  it("returns the payload for a valid token", () => {
    const payload = makePayload();
    const token = signVoiceToken(payload, SECRET);
    const result = verifyVoiceToken(token, SECRET);
    expect(result).toMatchObject({
      userId: payload.userId,
      personaId: payload.personaId,
      holdId: payload.holdId,
    });
  });

  it("returns null for an expired token", () => {
    const payload = makePayload({ exp: Math.floor(Date.now() / 1000) - 5 });
    const token = signVoiceToken(payload, SECRET);
    expect(verifyVoiceToken(token, SECRET)).toBeNull();
  });

  it("returns null when signed with a different secret", () => {
    const token = signVoiceToken(makePayload(), SECRET);
    expect(verifyVoiceToken(token, "y".repeat(32))).toBeNull();
  });

  it("returns null for a malformed token (no dot)", () => {
    expect(verifyVoiceToken("notatoken", SECRET)).toBeNull();
  });

  it("returns null for a token with tampered payload", () => {
    const token = signVoiceToken(makePayload(), SECRET);
    const [, sig] = token.split(".");
    const fakePayload = Buffer.from(JSON.stringify(makePayload({ userId: "evil" }))).toString("base64url");
    expect(verifyVoiceToken(`${fakePayload}.${sig}`, SECRET)).toBeNull();
  });

  it("returns null when secret is empty", () => {
    const token = signVoiceToken(makePayload(), SECRET);
    expect(verifyVoiceToken(token, "")).toBeNull();
  });

  it("returns null for a token missing required fields", () => {
    const badPayload = Buffer.from(JSON.stringify({ userId: "x" })).toString("base64url");
    // Sign the bad payload manually so the signature is valid but payload shape is wrong
    const tokenWithMissingFields = signVoiceToken(
      makePayload(),
      SECRET,
    ).replace(/^[^.]+/, badPayload);
    expect(verifyVoiceToken(tokenWithMissingFields, SECRET)).toBeNull();
  });
});
