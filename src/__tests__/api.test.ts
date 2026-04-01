/**
 * SOVEREIGN MATRIX Test Suite
 *
 * Tests for critical paths: Health, Payments, Email, Agents, Rate Limiting.
 * Run with: npm test
 *
 * These are lightweight tests that verify API route exports and
 * response structures. Auth-protected routes return 401 in test env
 * (no Clerk session), so we test for that explicitly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk auth to avoid import errors in test environment
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  currentUser: vi.fn().mockResolvedValue(null),
}));

// Mock database to avoid needing a real connection
vi.mock("@/db", () => ({
  testConnection: vi.fn().mockResolvedValue({ connected: true, latencyMs: 5 }),
  db: {
    execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }),
  },
}));

// ============================================================
// Health Check API Tests
// ============================================================
describe("Health Check API", () => {
  it("should export a GET handler", async () => {
    const mod = await import("@/app/api/health/route");
    expect(mod.GET).toBeDefined();
    expect(typeof mod.GET).toBe("function");
  });

  it("should return structured health data", async () => {
    const mod = await import("@/app/api/health/route");
    const response = await mod.GET();
    const data = await response.json();

    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("timestamp");
  });
});

// ============================================================
// Email Sender API Tests
// ============================================================
describe("Email Sender API", () => {
  it("should export a POST handler", async () => {
    const mod = await import("@/app/api/_agents/email-onboard/route");
    expect(mod.POST).toBeDefined();
    expect(typeof mod.POST).toBe("function");
  });

  it("should reject unauthenticated requests", async () => {
    const mod = await import("@/app/api/_agents/email-onboard/route");
    const req = new Request("http://localhost/api/agents/email-onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "" }),
    });
    const res = await mod.POST(req);
    expect([400, 401]).toContain(res.status);
  });
});

// ============================================================
// Rate Limiter Tests
// ============================================================
describe("Rate Limiter", () => {
  it("should export rateLimit function", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(rateLimit).toBeDefined();
    expect(typeof rateLimit).toBe("function");
  });

  it("should create a limiter with check method", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const limiter = rateLimit({ interval: 60, limit: 20 });
    expect(limiter.check).toBeDefined();
    expect(typeof limiter.check).toBe("function");
  });

  it("should allow requests under the limit", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const limiter = rateLimit({ interval: 60, limit: 5 });
    const req = new Request("http://localhost/api/test", { headers: { "x-forwarded-for": "192.168.1.100" } });
    const result = await limiter.check(req);
    // null means allowed (no 429 response)
    expect(result).toBeNull();
  });

  it("should block excessive requests", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const limiter = rateLimit({ interval: 60, limit: 3 });
    const makeReq = () => new Request("http://localhost/api/test", { headers: { "x-forwarded-for": "10.0.0.1" } });
    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      await limiter.check(makeReq());
    }
    // Next request should be blocked (returns 429 response)
    const result = await limiter.check(makeReq());
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
  });
});

// ============================================================
// Agent Routes — Export Verification
// ============================================================
describe("Agent API Routes", () => {
  it("SEO agent should export a POST handler", async () => {
    const mod = await import("@/app/api/_agents/seo/route");
    expect(mod.POST).toBeDefined();
    expect(typeof mod.POST).toBe("function");
  }, 15000);

  it("Design agent should export a POST handler", async () => {
    const mod = await import("@/app/api/_agents/design/route");
    expect(mod.POST).toBeDefined();
    expect(typeof mod.POST).toBe("function");
  }, 15000);

  it("Content agent should export a POST handler", async () => {
    const mod = await import("@/app/api/_agents/content/route");
    expect(mod.POST).toBeDefined();
    expect(typeof mod.POST).toBe("function");
  });

  it("Orchestrator should export a POST handler", async () => {
    const mod = await import("@/app/api/_agents/orchestrator/route");
    expect(mod.POST).toBeDefined();
  });

  it("Smart router should export GET and POST handlers", async () => {
    const mod = await import("@/app/api/_agents/smart-router/route");
    expect(mod.GET).toBeDefined();
    expect(mod.POST).toBeDefined();
  });

  it("Smart router GET should return model registry", async () => {
    const mod = await import("@/app/api/_agents/smart-router/route");
    const res = await mod.GET();
    const data = await res.json();
    expect(data.models).toBeGreaterThan(10);
    expect(data.task_types).toBeDefined();
    expect(Array.isArray(data.task_types)).toBe(true);
  });

  it("Catch-all agent router should export POST", async () => {
    const mod = await import("@/app/api/agents/[...slug]/route");
    expect(mod.POST).toBeDefined();
  });

  it("Conversations API should exist in catchall", async () => {
    // Conversations is handled via the main catch-all router
    const mod = await import("@/app/api/[...catchall]/route");
    expect(mod.POST).toBeDefined();
  });
});

// ============================================================
// Payment Routes — Export Verification
// ============================================================
describe("Payment Routes", () => {
  it("Payments catch-all should export a POST handler", async () => {
    const mod = await import("@/app/api/payments/[...path]/route");
    expect(mod.POST).toBeDefined();
  });

  it("Payments catch-all should export a GET handler", async () => {
    const mod = await import("@/app/api/payments/[...path]/route");
    expect(mod.GET).toBeDefined();
  });
});

// ============================================================
// Agent Auth & Usage Tests
// ============================================================
describe("Agent Auth", () => {
  it("should export authorizeAgent and getUsageStats", async () => {
    const mod = await import("@/lib/agent-auth");
    expect(mod.authorizeAgent).toBeDefined();
    expect(mod.getUsageStats).toBeDefined();
    expect(mod.getUsageLogs).toBeDefined();
  });

  it("getUsageStats should return structured data", async () => {
    const { getUsageStats } = await import("@/lib/agent-auth");
    const stats = getUsageStats();
    expect(stats).toHaveProperty("total_calls_today");
    expect(stats).toHaveProperty("total_calls_all_time");
    expect(stats).toHaveProperty("calls_by_agent");
    expect(stats).toHaveProperty("unique_users_today");
  });
});

// ============================================================
// Design Tokens & Theme Tests
// ============================================================
describe("Design System", () => {
  it("should export theme tokens", async () => {
    const mod = await import("@/config/theme");
    expect(mod.colors).toBeDefined();
    expect(mod.colors.accent).toBe("#00B7FF");
    expect(mod.glassmorphism).toBeDefined();
    expect(mod.spacing).toBeDefined();
    expect(mod.typography).toBeDefined();
  });
});
