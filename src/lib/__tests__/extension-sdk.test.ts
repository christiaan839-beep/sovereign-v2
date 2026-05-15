/**
 * Tests for src/lib/extension-sdk.ts — Cook 65.
 *
 *   - invokeAgent:
 *       - missing PAT / agent slug / selection validation
 *       - 429 → rate-limited; non-2xx → upstream-error
 *       - thrown fetch → network-error
 *       - bad JSON → malformed-response
 *       - happy path returns the parsed body
 *       - sends Authorization + client headers
 *   - renderPlainText composes a stable display block
 */

import { describe, it, expect, vi } from "vitest";
import {
  invokeAgent,
  renderPlainText,
  EXTENSION_SDK_CONSTANTS,
  type AuthConfig,
  type Selection,
  type InvokeResponse,
} from "../extension-sdk";

const AUTH: AuthConfig = {
  apiBase: "https://api.sovereignmatrix.agency",
  pat: "test-pat-token",
  clientId: "browser-ext",
};

const SEL: Selection = {
  kind: "browser-text",
  text: "summarize this paragraph",
  pageUrl: "https://example.com/article",
  pageTitle: "Example",
};

const VALID_RESPONSE: InvokeResponse = {
  receiptId: "rcpt-1",
  headline: "OK",
  body: "Body text",
  citations: [{ id: "m-1", label: "Source one", url: "https://src.example/" }],
  streamed: false,
};

function mockFetch(
  status: number,
  body: unknown,
  bodyAsText = false,
): typeof fetch {
  return vi.fn(async () => {
    if (bodyAsText) {
      return new Response(String(body), { status });
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("invokeAgent — gating", () => {
  it("missing-pat when token absent", async () => {
    const out = await invokeAgent(
      { ...AUTH, pat: "" },
      { agentSlug: "xx", selection: SEL },
      mockFetch(200, VALID_RESPONSE),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("missing-pat");
  });

  it("missing-agent when slug malformed", async () => {
    const out = await invokeAgent(
      AUTH,
      { agentSlug: "BadCase", selection: SEL },
      mockFetch(200, VALID_RESPONSE),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("missing-agent");
  });

  it("invalid-selection on empty text", async () => {
    const out = await invokeAgent(
      AUTH,
      {
        agentSlug: "xx",
        selection: { kind: "browser-text", text: "", pageUrl: "https://x" },
      },
      mockFetch(200, VALID_RESPONSE),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("invalid-selection");
  });

  it("invalid-selection on oversize text", async () => {
    const big = "x".repeat(EXTENSION_SDK_CONSTANTS.MAX_SELECTION_BYTES + 1);
    const out = await invokeAgent(
      AUTH,
      {
        agentSlug: "xx",
        selection: { kind: "browser-text", text: big, pageUrl: "https://x" },
      },
      mockFetch(200, VALID_RESPONSE),
    );
    expect(out.ok).toBe(false);
  });

  it("invalid-selection on malformed pageUrl", async () => {
    const out = await invokeAgent(
      AUTH,
      {
        agentSlug: "xx",
        selection: { kind: "browser-text", text: "hi", pageUrl: "not a url" },
      },
      mockFetch(200, VALID_RESPONSE),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("invalid-selection");
  });
});

describe("invokeAgent — transport errors", () => {
  it("rate-limited on 429", async () => {
    const out = await invokeAgent(
      AUTH,
      { agentSlug: "xx", selection: SEL },
      mockFetch(429, {}),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("rate-limited");
      expect(out.status).toBe(429);
    }
  });

  it("upstream-error on 500", async () => {
    const out = await invokeAgent(
      AUTH,
      { agentSlug: "xx", selection: SEL },
      mockFetch(500, {}),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("upstream-error");
  });

  it("network-error when fetch throws", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const out = await invokeAgent(
      AUTH,
      { agentSlug: "xx", selection: SEL },
      failing,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("network-error");
  });

  it("malformed-response when body isn't JSON", async () => {
    const out = await invokeAgent(
      AUTH,
      { agentSlug: "xx", selection: SEL },
      mockFetch(200, "not json", true),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("malformed-response");
  });

  it("malformed-response when JSON lacks required fields", async () => {
    const out = await invokeAgent(
      AUTH,
      { agentSlug: "xx", selection: SEL },
      mockFetch(200, { wrong: "shape" }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("malformed-response");
  });
});

describe("invokeAgent — happy path", () => {
  it("returns the parsed response and sends auth + client headers", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(`${AUTH.apiBase}/api/agents/lead-blitz`);
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(`Bearer ${AUTH.pat}`);
      expect(headers["X-Sovereign-Client"]).toBe("browser-ext");
      return new Response(JSON.stringify(VALID_RESPONSE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const out = await invokeAgent(
      AUTH,
      { agentSlug: "lead-blitz", selection: SEL },
      fetcher as unknown as typeof fetch,
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.receiptId).toBe("rcpt-1");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("works with editor-text selection", async () => {
    const out = await invokeAgent(
      AUTH,
      {
        agentSlug: "code-review",
        selection: {
          kind: "editor-text",
          text: "function f(){}",
          languageId: "typescript",
          filePath: "src/foo.ts",
          lineRange: { start: 1, end: 1 },
        },
      },
      mockFetch(200, VALID_RESPONSE),
    );
    expect(out.ok).toBe(true);
  });
});

describe("renderPlainText", () => {
  it("composes a stable display block including citations", () => {
    const text = renderPlainText(VALID_RESPONSE);
    expect(text).toContain("OK");
    expect(text).toContain("Body text");
    expect(text).toContain("[m-1] Source one");
    expect(text).toContain("Receipt: rcpt-1");
  });

  it("omits the citations block when none supplied", () => {
    const text = renderPlainText({
      ...VALID_RESPONSE,
      citations: [],
    });
    expect(text).not.toContain("Citations:");
  });
});
