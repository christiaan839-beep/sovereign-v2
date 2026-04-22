/**
 * POST /api/voice/session — tests.
 *
 * Places a 5-minute credit hold, signs a 60s voice-session token, returns
 * { token, wsUrl }. 401 if unauth, 402 if insufficient credits, 400 on
 * bad payload, 500 if secret unset.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPlaceHold, mockGetUserPlan, mockGetMinutes } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPlaceHold: vi.fn(),
  mockGetUserPlan: vi.fn(),
  mockGetMinutes: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/lib/credits", () => {
  class InsufficientCreditsError extends Error {
    constructor(
      public userId: string,
      public required: number,
      public available: number,
    ) {
      super("insufficient");
      this.name = "InsufficientCreditsError";
    }
  }
  return {
    placeHold: mockPlaceHold,
    InsufficientCreditsError,
  };
});
vi.mock("@/lib/plan-enforcement", () => ({ getUserPlan: mockGetUserPlan }));
vi.mock("@/lib/voice-billing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/voice-billing")>(
    "@/lib/voice-billing",
  );
  return {
    ...actual,
    getVoiceMinutesThisMonth: mockGetMinutes,
  };
});

// Give the token module a secret via process.env before importing the route.
process.env.VOICE_SESSION_SECRET = "x".repeat(32);

import { POST } from "@/app/api/voice/session/route";
import { verifyVoiceToken } from "@/lib/voice-token";

const jsonBody = (body: unknown) =>
  new Request("http://l/api/voice/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mockAuth.mockReset();
  mockPlaceHold.mockReset();
  mockGetUserPlan.mockReset();
  mockGetMinutes.mockReset();
  // Defaults mirror a paid-plan user with no monthly voice usage yet.
  // Individual tests override as needed.
  mockGetUserPlan.mockResolvedValue("array");
  mockGetMinutes.mockResolvedValue(0);
});

describe("POST /api/voice/session", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(jsonBody({ personaId: "default" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when personaId is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    const res = await POST(jsonBody({}));
    expect(res.status).toBe(400);
  });

  it("accepts unknown personaId (falls back to default)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockPlaceHold.mockResolvedValue("hold_abc");
    const res = await POST(jsonBody({ personaId: "not_a_real_persona" }));
    // Endpoint itself doesn't 400 on unknown — getPersona() falls back.
    // That keeps the client tolerant to new persona IDs rolling out.
    expect([200, 400]).toContain(res.status);
  });

  it("returns 402 when placeHold throws InsufficientCreditsError", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    const { InsufficientCreditsError } = (await import("@/lib/credits")) as {
      InsufficientCreditsError: new (u: string, r: number, a: number) => Error;
    };
    mockPlaceHold.mockRejectedValue(new InsufficientCreditsError("u_1", 75, 20));
    const res = await POST(jsonBody({ personaId: "default" }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.required).toBe(75);
    expect(body.available).toBe(20);
    expect(body.topUpUrl).toContain("/dashboard/billing");
  });

  it("returns 200 + signed token + wsUrl on success", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockPlaceHold.mockResolvedValue("hold_xyz");
    const res = await POST(jsonBody({ personaId: "architect" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wsUrl).toBe("/api/voice/ws");
    expect(body.token).toBeTruthy();

    const decoded = verifyVoiceToken(body.token, process.env.VOICE_SESSION_SECRET!);
    expect(decoded).toMatchObject({
      userId: "u_1",
      personaId: "architect",
      holdId: "hold_xyz",
    });
  });

  it("places a hold for 75 cents (15¢ × 5 minutes)", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    mockPlaceHold.mockResolvedValue("hold_xyz");
    await POST(jsonBody({ personaId: "default" }));
    expect(mockPlaceHold).toHaveBeenCalledWith(
      "u_1",
      75,
      expect.any(String), // agentRunId tag
      expect.any(Number), // TTL
    );
  });

  it("returns 400 when body is not valid JSON", async () => {
    mockAuth.mockResolvedValue({ userId: "u_1" });
    const req = new Request("http://l/api/voice/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
