/**
 * /api/public/router-demo — tests.
 *
 * Verifies the endpoint classifies a user prompt via the real
 * classifyTask() function and returns the deterministic routing
 * decision (no LLM call actually made — this is a classification
 * demonstration, not a real agent invocation).
 */

import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/public/router-demo/route";

function req(body: unknown): Request {
  return new Request("http://l/api/public/router-demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/router-demo", () => {
  it("returns 200 with classification + selected model for a creative prompt", async () => {
    const res = await POST(req({ prompt: "Write a blog post about AI safety" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.incoming).toBe("Write a blog post about AI safety");
    expect(body.classification.category).toBe("creative");
    expect(body.selected.model).toBeTruthy();
    expect(body.fallbackChain.length).toBeGreaterThanOrEqual(3);
    expect(body.candidates.length).toBeGreaterThanOrEqual(3);
  });

  it("classifies code prompts correctly", async () => {
    const res = await POST(req({ prompt: "Write a TypeScript function to parse JSON" }));
    const body = await res.json();
    expect(body.classification.category).toBe("code");
  });

  it("classifies reasoning prompts correctly", async () => {
    const res = await POST(req({ prompt: "Analyze the strategic position of this company" }));
    const body = await res.json();
    expect(body.classification.category).toBe("reasoning");
  });

  it("returns 400 for empty prompt", async () => {
    const res = await POST(req({ prompt: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for prompt over 300 chars", async () => {
    const res = await POST(req({ prompt: "a".repeat(301) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing body", async () => {
    const res = await POST(new Request("http://l/api/public/router-demo", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
  });

  it("sets no-cache header (each classification is unique)", async () => {
    const res = await POST(req({ prompt: "Summarize this" }));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
