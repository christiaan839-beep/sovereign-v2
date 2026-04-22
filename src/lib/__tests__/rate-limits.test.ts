/**
 * Rate-limit rule matcher + in-memory fallback tests.
 *
 * These tests don't exercise Upstash (no env vars in CI) — they verify:
 *   1. Rules are matched by prefix in the documented precedence
 *   2. The in-memory fallback honors max/window correctly
 *   3. Identifier resolution respects the identify mode
 *   4. `skip` rules bypass without counting
 */

import { describe, it, expect, beforeEach } from "vitest";
import { applyRateLimit, matchRule, rateLimitHeaders } from "@/lib/rate-limits";

// Ensure Upstash env is NOT set — forces the in-memory path for tests
beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("matchRule", () => {
  it("matches /api/agents/* to agents rule", () => {
    const rule = matchRule("/api/agents/seo-dominator");
    expect(rule?.name).toBe("agents");
    expect(rule?.max).toBe(60);
  });

  it("matches /api/auth/* to auth rule", () => {
    expect(matchRule("/api/auth/callback")?.name).toBe("auth");
    expect(matchRule("/api/auth/callback")?.max).toBe(10);
  });

  it("matches /api/webhooks/stripe to webhooks-stripe", () => {
    const rule = matchRule("/api/webhooks/stripe");
    expect(rule?.name).toBe("webhooks-stripe");
    expect(rule?.max).toBe(100);
  });

  it("matches /api/playbooks/run to playbook-run (user_only)", () => {
    const rule = matchRule("/api/playbooks/run");
    expect(rule?.name).toBe("playbook-run");
    expect(rule?.identify).toBe("user_only");
  });

  it("/api/free/* rule is marked skip:true (handled by free-tool-limits)", () => {
    const rule = matchRule("/api/free/run");
    expect(rule?.skip).toBe(true);
  });

  it("non-/api/ paths are never rate-limited (returns null)", () => {
    // Only /api/ paths are subject to rate limiting. Pages, RSC payloads,
    // and static assets always pass through without touching Redis.
    expect(matchRule("/dashboard")).toBeNull();
    expect(matchRule("/")).toBeNull();
    expect(matchRule("/marketplace")).toBeNull();
    expect(matchRule("/world")).toBeNull();
  });

  it("all /api/ paths now match at least the api-default rule", () => {
    // W1 T3 coverage expansion: previously any /api/ path not covered
    // by a specific rule returned null (no limit). The new api-default
    // fallback rule ensures every API path gets at least a
    // 60/min/caller bucket — defense against scraper/abuse.
    expect(matchRule("/api/usage")).not.toBeNull();
    expect(matchRule("/api/usage")?.name).toBe("api-default");
    expect(matchRule("/api/contact")).not.toBeNull();
    expect(matchRule("/api/waitlist")).not.toBeNull();
    expect(matchRule("/api/approvals")).not.toBeNull();
  });

  it("specific rules beat the api-default fallback (order matters)", () => {
    expect(matchRule("/api/catalog")?.name).toBe("catalog");
    expect(matchRule("/api/leaderboard")?.name).toBe("leaderboard");
    expect(matchRule("/api/public/recent-runs")?.name).toBe("public");
    expect(matchRule("/api/admin/agents/pending")?.name).toBe("admin");
    expect(matchRule("/api/credits/balance")?.name).toBe("credits");
    expect(matchRule("/api/voice/session")?.name).toBe("voice");
    expect(matchRule("/api/developers/submit")?.name).toBe("developers-submit");
  });

  it("cron/health/internal prefixes are marked skip=true", () => {
    expect(matchRule("/api/cron/dispatch-scheduled-playbooks")?.skip).toBe(true);
    expect(matchRule("/api/health/deep")?.skip).toBe(true);
    expect(matchRule("/api/_health/ping")?.skip).toBe(true);
    expect(matchRule("/api/_internal/playbook-worker")?.skip).toBe(true);
  });
});

describe("applyRateLimit — identity resolution", () => {
  it("blocks playbook-run without a userId (user_only rule)", async () => {
    const decision = await applyRateLimit("/api/playbooks/run", {
      userId: null,
      ip: "1.2.3.4",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.rule).toBe("playbook-run:no-identity");
  });

  it("allows /api/agents/* with only an IP (user_or_ip)", async () => {
    const decision = await applyRateLimit("/api/agents/research", {
      userId: null,
      ip: "5.6.7.8",
    });
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(59); // max=60, we used 1
  });

  it("prefers userId when both userId and ip are present", async () => {
    // Two requests from same user on different IPs should count together
    const d1 = await applyRateLimit("/api/agents/a", { userId: "u_1", ip: "1.1.1.1" });
    const d2 = await applyRateLimit("/api/agents/b", { userId: "u_1", ip: "2.2.2.2" });
    expect(d2.remaining).toBe(d1.remaining - 1);
  });

  it("separates buckets by identifier", async () => {
    await applyRateLimit("/api/agents/a", { userId: "u_alpha", ip: "1.1.1.1" });
    const fresh = await applyRateLimit("/api/agents/a", { userId: "u_beta", ip: "2.2.2.2" });
    // Different user → fresh bucket → 59 remaining
    expect(fresh.remaining).toBe(59);
  });
});

describe("applyRateLimit — window enforcement (in-memory)", () => {
  it("allows exactly `max` requests before blocking", async () => {
    const ipFor = (i: number) => `10.0.0.${i}`;
    // Auth rule has max=10 — easier to exhaust than agents' 60
    let lastAllowed = 0;
    for (let i = 0; i < 12; i++) {
      const decision = await applyRateLimit("/api/auth/callback", {
        userId: null,
        ip: ipFor(1), // same IP so all hit one bucket
      });
      if (decision.allowed) lastAllowed = i + 1;
    }
    expect(lastAllowed).toBe(10);
  });
});

describe("applyRateLimit — skip rules bypass", () => {
  it("/api/free/* returns allowed=true with rule=skipped:*", async () => {
    const decision = await applyRateLimit("/api/free/lead-finder", {
      userId: null,
      ip: "9.9.9.9",
    });
    expect(decision.allowed).toBe(true);
    expect(decision.rule).toBe("skipped:free-tools");
  });
});

describe("rateLimitHeaders", () => {
  it("includes Retry-After only when blocked", () => {
    const headers = rateLimitHeaders({
      allowed: false,
      remaining: 0,
      limit: 10,
      resetInSeconds: 42,
      rule: "auth",
    });
    expect(headers["Retry-After"]).toBe("42");
    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("omits Retry-After when allowed", () => {
    const headers = rateLimitHeaders({
      allowed: true,
      remaining: 5,
      limit: 10,
      resetInSeconds: 30,
      rule: "auth",
    });
    expect(headers["Retry-After"]).toBeUndefined();
  });
});
