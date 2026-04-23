/**
 * Tests for nemo-safety — no-key graceful path + provider toggle.
 *
 * The NIM-network path is integration-tested against a staging key.
 * Here we verify:
 *   - No NIM key → returns passed:true, safetyScore:70, all layers open
 *   - Provider env toggle resolves correctly
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runNemoSafety, type NemoSafetyInput } from "../nemo-safety";
import { activeDeepSafetyProvider, runDeepSafety, type SafetyInput } from "../submission-safety";

const CLEAN: NemoSafetyInput = {
  displayName: "Invoice Extractor",
  purpose: "Extract structured data from invoice text",
  guarantees: ["Never fabricates missing fields"],
  systemPrompt: "You are Invoice Extractor. Extract JSON fields.",
};

describe("runNemoSafety() — no NIM key", () => {
  const ORIG_NIM = process.env.NIM_API_KEY;
  const ORIG_NVIDIA = process.env.NVIDIA_API_KEY;
  beforeEach(() => {
    delete process.env.NIM_API_KEY;
    delete process.env.NVIDIA_API_KEY;
  });
  afterEach(() => {
    if (ORIG_NIM === undefined) delete process.env.NIM_API_KEY;
    else process.env.NIM_API_KEY = ORIG_NIM;
    if (ORIG_NVIDIA === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = ORIG_NVIDIA;
  });

  it("returns passed:true + safetyScore:70 when no NIM key is configured", async () => {
    const r = await runNemoSafety(CLEAN);
    expect(r.passed).toBe(true);
    expect(r.safetyScore).toBe(70);
    expect(r.reason).toMatch(/no NIM key/);
  });

  it("populates all three layer verdicts even on skip (downstream renderers depend on this)", async () => {
    const r = await runNemoSafety(CLEAN);
    expect(r.layers.contentSafety.passed).toBe(true);
    expect(r.layers.jailbreakProbe.passed).toBe(true);
    expect(r.layers.topicControl.passed).toBe(true);
  });
});

describe("activeDeepSafetyProvider()", () => {
  const ORIG = process.env.SOVEREIGN_SAFETY_PROVIDER;
  beforeEach(() => {
    delete process.env.SOVEREIGN_SAFETY_PROVIDER;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.SOVEREIGN_SAFETY_PROVIDER;
    else process.env.SOVEREIGN_SAFETY_PROVIDER = ORIG;
  });

  it("defaults to 'nemoguard' when env var is unset", () => {
    expect(activeDeepSafetyProvider()).toBe("nemoguard");
  });

  it("defaults to 'nemoguard' when env var has an invalid value", () => {
    process.env.SOVEREIGN_SAFETY_PROVIDER = "bogus";
    expect(activeDeepSafetyProvider()).toBe("nemoguard");
  });

  it("returns 'claude' when env var is 'claude'", () => {
    process.env.SOVEREIGN_SAFETY_PROVIDER = "claude";
    expect(activeDeepSafetyProvider()).toBe("claude");
  });

  it("returns 'both' when env var is 'both'", () => {
    process.env.SOVEREIGN_SAFETY_PROVIDER = "both";
    expect(activeDeepSafetyProvider()).toBe("both");
  });
});

describe("runDeepSafety() — provider override + graceful fallbacks", () => {
  const ORIG_NIM = process.env.NIM_API_KEY;
  const ORIG_NVIDIA = process.env.NVIDIA_API_KEY;
  const ORIG_ANTHROPIC = process.env.ANTHROPIC_API_KEY;

  const CLEAN_INPUT: SafetyInput = {
    displayName: "X",
    purpose: "Y",
    guarantees: ["G"],
    pricingCents: 5,
    systemPrompt: "You are X.",
  };

  beforeEach(() => {
    delete process.env.NIM_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (ORIG_NIM === undefined) delete process.env.NIM_API_KEY;
    else process.env.NIM_API_KEY = ORIG_NIM;
    if (ORIG_NVIDIA === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = ORIG_NVIDIA;
    if (ORIG_ANTHROPIC === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIG_ANTHROPIC;
  });

  it("nemoguard provider returns passed:true under graceful fallback (no key)", async () => {
    const r = await runDeepSafety(CLEAN_INPUT, "nemoguard");
    expect(r.passed).toBe(true);
    expect(r.safetyScore).toBeGreaterThanOrEqual(70);
  });

  it("nemoguard provider populates claudeCritic key for backward compatibility", async () => {
    const r = await runDeepSafety(CLEAN_INPUT, "nemoguard");
    expect(r.layers.claudeCritic).toBeDefined();
    expect(r.layers.jailbreakProbe).toBeDefined();
  });

  it("claude provider returns passed:true under graceful fallback (no anthropic key)", async () => {
    const r = await runDeepSafety(CLEAN_INPUT, "claude");
    expect(r.passed).toBe(true);
  });

  it("'both' provider requires both stacks to pass — fails open when both unreachable", async () => {
    const r = await runDeepSafety(CLEAN_INPUT, "both");
    // Graceful path from both stacks → overall passes
    expect(r.passed).toBe(true);
  });
});
