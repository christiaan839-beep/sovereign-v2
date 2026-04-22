/**
 * /api/public/verify-demo — tests.
 *
 * The 5-layer verifier (`verifyOutput`) is mocked here so tests don't
 * hit NVIDIA NIM or the real DB audit log. We verify input validation,
 * response shape, rate-limit-friendly cache header, and error paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifyOutput } = vi.hoisted(() => ({
  mockVerifyOutput: vi.fn(),
}));

vi.mock("@/lib/output-verifier", () => ({
  verifyOutput: mockVerifyOutput,
}));

beforeEach(() => {
  mockVerifyOutput.mockReset();
});

import { POST } from "@/app/api/public/verify-demo/route";

function req(body: unknown): Request {
  return new Request("http://l/api/public/verify-demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/verify-demo", () => {
  it("returns 200 with pass/fail per layer on happy path", async () => {
    mockVerifyOutput.mockResolvedValue({
      approved: true,
      output: "Hello world",
      safetyResult: {
        jailbreak: "pass",
        pii: "pass",
        content: "pass",
        quality: 85,
        critic: "pass",
      },
      trustDecision: "auto-approved",
      executionTimeMs: 420,
    });
    const res = await POST(req({ text: "Hello world" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approved).toBe(true);
    expect(body.layers).toHaveLength(5);
    expect(body.layers[0].name).toBe("jailbreak");
    expect(body.layers[0].passed).toBe(true);
    expect(body.totalMs).toBeGreaterThan(0);
  });

  it("surfaces a layer failure with its reason", async () => {
    mockVerifyOutput.mockResolvedValue({
      approved: false,
      output: "",
      safetyResult: {
        jailbreak: "pass",
        pii: "fail",
        content: "pass",
        quality: 80,
        critic: "pass",
      },
      trustDecision: "blocked",
      blockReason: "PII detected: Email (exposed)",
      executionTimeMs: 310,
    });
    const res = await POST(req({ text: "Contact me at jane@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approved).toBe(false);
    const piiLayer = body.layers.find((l: { name: string }) => l.name === "pii");
    expect(piiLayer.passed).toBe(false);
    expect(piiLayer.reason).toBeTruthy();
  });

  it("returns 400 for missing text", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty text", async () => {
    const res = await POST(req({ text: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for text over 500 chars", async () => {
    const res = await POST(req({ text: "a".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(
      new Request("http://l/api/public/verify-demo", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 503 if verifier throws", async () => {
    mockVerifyOutput.mockRejectedValue(new Error("verifier offline"));
    const res = await POST(req({ text: "Hello world" }));
    expect(res.status).toBe(503);
  });

  it("sets no-store cache header (every verification is unique)", async () => {
    mockVerifyOutput.mockResolvedValue({
      approved: true,
      output: "ok",
      safetyResult: { jailbreak: "pass", pii: "pass", content: "pass", quality: 80, critic: "pass" },
      trustDecision: "auto-approved",
      executionTimeMs: 100,
    });
    const res = await POST(req({ text: "Hello" }));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
