import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";

/**
 * SMOKE TEST API — Runs quick health checks against critical agent endpoints.
 * Returns pass/fail for each test.
 * 
 * Run manually: GET /api/tests/smoke
 * Wire to CI: Add to Vercel deploy hooks
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  status: "PASS" | "FAIL" | "SKIP";
  response_code: number;
  duration_ms: number;
  error?: string;
}

export async function GET() {
  const baseUrl = getBaseUrl();
  const results: TestResult[] = [];

  const tests = [
    { name: "Health Endpoint", endpoint: "/api/health", method: "GET", body: null },
    { name: "PayFast Gateway", endpoint: "/api/payments/payfast", method: "GET", body: null },
    { name: "Smart Router (GET)", endpoint: "/api/_agents/smart-router", method: "GET", body: null },
    { name: "Agent Memory (GET)", endpoint: "/api/_agents/memory?userId=test", method: "GET", body: null },
    { name: "Billing Status", endpoint: "/api/_agents/billing", method: "GET", body: null },
    { name: "Verticals List", endpoint: "/api/_agents/verticals", method: "GET", body: null },
    { name: "Pipeline List", endpoint: "/api/_agents/pipeline", method: "GET", body: null },
    { name: "Benchmark Config", endpoint: "/api/_agents/benchmark", method: "GET", body: null },
    { name: "Webhook Gateway (GET)", endpoint: "/api/_agents/webhook-gateway", method: "GET", body: null },
    { name: "Translate (POST validation)", endpoint: "/api/_agents/translate", method: "POST", body: JSON.stringify({}) },
  ];

  for (const test of tests) {
    const start = Date.now();
    try {
      const fetchOpts: RequestInit = {
        method: test.method,
        headers: { "Content-Type": "application/json" },
      };
      if (test.body && test.method === "POST") {
        fetchOpts.body = test.body;
      }

      const res = await outboundFetchAsResponse(`${baseUrl}${test.endpoint}`, fetchOpts, { ruleId: "misc.tests.smoke.route.1", allowedHosts: [new URL(baseUrl).hostname] });
      const duration = Date.now() - start;

      results.push({
        name: test.name,
        endpoint: test.endpoint,
        method: test.method,
        status: res.status < 500 ? "PASS" : "FAIL",
        response_code: res.status,
        duration_ms: duration,
      });
    } catch (err) {
      results.push({
        name: test.name,
        endpoint: test.endpoint,
        method: test.method,
        status: "FAIL",
        response_code: 0,
        duration_ms: Date.now() - start,
        error: String(err),
      });
    }
  }

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;

  return NextResponse.json({
    status: failed === 0 ? "ALL PASS" : `${failed} FAILURES`,
    summary: `${passed}/${results.length} passed`,
    timestamp: new Date().toISOString(),
    total_duration_ms: results.reduce((s, r) => s + r.duration_ms, 0),
    results,
  });
}
