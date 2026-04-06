/**
 * Tests for src/lib/analytics.ts — Lightweight Analytics Tracker
 */
import { describe, it, expect } from "vitest";
import {
  trackPageView,
  trackAgentExecution,
  trackUserAction,
  getAnalytics,
} from "@/lib/analytics";

describe("analytics.ts — In-Memory Analytics", () => {
  it("tracks page views", () => {
    trackPageView("/dashboard", "https://google.com");
    const analytics = getAnalytics();
    expect(analytics.pageViews.length).toBeGreaterThan(0);
    const last = analytics.pageViews[analytics.pageViews.length - 1];
    expect(last.page).toBe("/dashboard");
    expect(last.referrer).toBe("https://google.com");
  });

  it("tracks agent executions", () => {
    trackAgentExecution("leads", 1200, true);
    trackAgentExecution("leads", 800, true);
    trackAgentExecution("blog-gen", 2000, false);
    const analytics = getAnalytics();
    expect(analytics.agentExecutions.length).toBeGreaterThan(0);
  });

  it("tracks user actions", () => {
    trackUserAction("signup", { plan: "starter" });
    const analytics = getAnalytics();
    expect(analytics.userActions.length).toBeGreaterThan(0);
  });

  it("computes top pages", () => {
    for (let i = 0; i < 5; i++) trackPageView("/dashboard");
    for (let i = 0; i < 3; i++) trackPageView("/pricing");
    const analytics = getAnalytics();
    expect(analytics.topPages.length).toBeGreaterThan(0);
    expect(analytics.topPages[0].page).toBe("/dashboard");
  });

  it("computes top agents with success rate", () => {
    for (let i = 0; i < 10; i++) trackAgentExecution("test-agent", 500, i < 8);
    const analytics = getAnalytics();
    const testAgent = analytics.topAgents.find(a => a.agent === "test-agent");
    expect(testAgent).toBeDefined();
    expect(testAgent!.successRate).toBe(0.8);
    expect(testAgent!.avgDurationMs).toBe(500);
  });

  it("returns arrays (not mutating internal state)", () => {
    const a1 = getAnalytics();
    const a2 = getAnalytics();
    expect(a1.pageViews).not.toBe(a2.pageViews); // Different array references
  });
});
