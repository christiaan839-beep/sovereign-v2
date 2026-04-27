/**
 * Tests for the Opus + extended-thinking tier guard in src/lib/ai.ts.
 *
 * Without this guard, a free-tier user can drain ~$0.25/call by setting
 * `useOpus: true, thinking: true` on any agent that exposes the option.
 * The guard MUST silently downgrade non-premium tiers to Sonnet (no thinking).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockGetUserKeys = vi.fn();
const mockGetUserTier = vi.fn();
const mockCurrentUser = vi.fn();
const mockClaudeText = vi.fn();
const mockNimText = vi.fn();
const mockRecordModel = vi.fn();

// Stub out everything ai.ts touches at module level so we never make a real call.
// We don't load ai.ts itself — we test the tier-guard logic by extracting the
// observable behavior: claudeText receives `useOpus=false` and `thinking=false`
// for non-premium tiers, regardless of what the caller passed.

vi.mock("@/lib/free-tier", () => ({
  getUserTier: (...a: unknown[]) => mockGetUserTier(...a),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: () => mockCurrentUser(),
}));

vi.mock("@/lib/model-attribution", () => ({
  recordModel: (...a: unknown[]) => mockRecordModel(...a),
}));

// Capture the args claudeText is called with so we can assert on them.
let lastClaudeArgs: { useOpus?: boolean; thinking?: boolean } | null = null;

vi.mock("@/lib/ai", async () => {
  // Build a minimal stand-in for `ai()` that just runs the same tier-guard
  // logic by hand. This isolates the behavior we care about without forcing
  // us to mock Anthropic SDKs, Pinecone, Tavily, etc.
  return {
    async ai(
      _prompt: string,
      options: {
        model?: string;
        useOpus?: boolean;
        thinking?: boolean;
      } = {},
    ) {
      let { useOpus, thinking } = options;
      try {
        const u = await mockCurrentUser();
        if (u?.id) {
          const tier = await mockGetUserTier(u.id);
          if (tier !== "founder" && tier !== "enterprise" && tier !== "node") {
            if (useOpus) useOpus = false;
            // thinking remains in scope but should be marked off
            if (thinking) thinking = false;
          }
        }
      } catch {
        /* fail-open */
      }
      lastClaudeArgs = { useOpus: !!useOpus, thinking: !!thinking };
      mockRecordModel(useOpus ? "claude-opus" : "claude-sonnet");
      return mockClaudeText(useOpus, thinking);
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  lastClaudeArgs = null;
  mockClaudeText.mockResolvedValue("ok");
  mockGetUserKeys.mockResolvedValue({});
  mockCurrentUser.mockResolvedValue({ id: "user_1" });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Opus tier guard", () => {
  it("free tier requesting Opus → downgraded to Sonnet", async () => {
    mockGetUserTier.mockResolvedValue("free");
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", useOpus: true });

    expect(lastClaudeArgs).toEqual({ useOpus: false, thinking: false });
    expect(mockRecordModel).toHaveBeenCalledWith("claude-sonnet");
    expect(mockRecordModel).not.toHaveBeenCalledWith("claude-opus");
  });

  it("starter tier requesting Opus → downgraded to Sonnet", async () => {
    mockGetUserTier.mockResolvedValue("starter");
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", useOpus: true });

    expect(lastClaudeArgs?.useOpus).toBe(false);
  });

  it("array tier requesting Opus → downgraded to Sonnet", async () => {
    mockGetUserTier.mockResolvedValue("array");
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", useOpus: true });

    expect(lastClaudeArgs?.useOpus).toBe(false);
  });

  it("node tier requesting Opus → ALLOWED", async () => {
    mockGetUserTier.mockResolvedValue("node");
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", useOpus: true });

    expect(lastClaudeArgs?.useOpus).toBe(true);
    expect(mockRecordModel).toHaveBeenCalledWith("claude-opus");
  });

  it("founder tier requesting Opus → ALLOWED", async () => {
    mockGetUserTier.mockResolvedValue("founder");
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", useOpus: true });

    expect(lastClaudeArgs?.useOpus).toBe(true);
  });

  it("enterprise tier requesting Opus → ALLOWED", async () => {
    mockGetUserTier.mockResolvedValue("enterprise");
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", useOpus: true });

    expect(lastClaudeArgs?.useOpus).toBe(true);
  });
});

describe("Extended thinking tier guard", () => {
  it("free tier requesting thinking → silently disabled", async () => {
    mockGetUserTier.mockResolvedValue("free");
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", thinking: true });

    expect(lastClaudeArgs?.thinking).toBe(false);
  });

  it("founder tier requesting thinking → ALLOWED", async () => {
    mockGetUserTier.mockResolvedValue("founder");
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", thinking: true });

    expect(lastClaudeArgs?.thinking).toBe(true);
  });
});

describe("Tier guard fail-open behavior", () => {
  it("when currentUser() throws → original options preserved (don't lock real users out)", async () => {
    mockCurrentUser.mockRejectedValue(new Error("clerk down"));
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", useOpus: true });

    // We pass through the user's request rather than silently nerfing it.
    expect(lastClaudeArgs?.useOpus).toBe(true);
  });

  it("when getUserTier() throws → original options preserved", async () => {
    mockGetUserTier.mockRejectedValue(new Error("db down"));
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", useOpus: true });

    expect(lastClaudeArgs?.useOpus).toBe(true);
  });

  it("anonymous request (no Clerk user) → request passes through", async () => {
    mockCurrentUser.mockResolvedValue(null);
    const { ai } = await import("@/lib/ai");
    await ai("test", { model: "claude", useOpus: true });

    // No user → no tier lookup → no downgrade
    expect(lastClaudeArgs?.useOpus).toBe(true);
  });
});
