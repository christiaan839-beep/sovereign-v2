/**
 * Tests for src/lib/integrations/connector.ts — Integration Connector Framework
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeConnector, getAvailableConnectors } from "@/lib/integrations/connector";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("integrations/connector.ts", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ── Available Connectors ──

  it("lists all available connectors", () => {
    const connectors = getAvailableConnectors();
    expect(connectors).toContain("hubspot");
    expect(connectors).toContain("slack");
    expect(connectors).toContain("google-sheets");
    expect(connectors).toContain("gmail");
    expect(connectors).toContain("webhook");
    expect(connectors).toContain("airtable");
    expect(connectors).toContain("notion");
    expect(connectors).toContain("salesforce");
    expect(connectors).toContain("stripe");
    expect(connectors).toContain("twilio");
    expect(connectors.length).toBeGreaterThanOrEqual(15);
  });

  // ── Unknown Connector ──

  it("returns error for unknown connector", async () => {
    const result = await executeConnector({
      integrationId: "nonexistent",
      actionId: "test",
      params: {},
      auth: { type: "bearer", token: "test" },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not implemented");
  });

  // ── HubSpot Connector ──

  it("HubSpot list-contacts calls correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: "1", properties: { email: "test@example.com" } }] }),
    });

    const result = await executeConnector({
      integrationId: "hubspot",
      actionId: "list-contacts",
      params: { limit: 5 },
      auth: { type: "bearer", token: "test-token" },
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api.hubapi.com/crm/v3/objects/contacts"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) })
    );
  });

  it("HubSpot returns error for unknown action", async () => {
    const result = await executeConnector({
      integrationId: "hubspot",
      actionId: "unknown-action",
      params: {},
      auth: { type: "bearer", token: "test" },
    });
    expect(result.statusCode).toBe(400);
  });

  // ── Slack Connector ──

  it("Slack send-message calls correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, ts: "1234.5678" }),
    });

    const result = await executeConnector({
      integrationId: "slack",
      actionId: "send-message",
      params: { channel: "#general", text: "Hello" },
      auth: { type: "bearer", token: "xoxb-test" },
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.anything()
    );
  });

  // ── Webhook Connector ──

  it("webhook blocks private IPs (SSRF protection)", async () => {
    const result = await executeConnector({
      integrationId: "webhook",
      actionId: "fire",
      params: { url: "http://localhost:3000/admin" },
      auth: { type: "bearer", token: "" },
    });
    expect(result.statusCode).toBe(403);
    expect(result.data).toEqual(expect.objectContaining({ error: expect.stringContaining("blocked by SSRF guard") }));
  });

  it("webhook blocks 127.0.0.1", async () => {
    const result = await executeConnector({
      integrationId: "webhook",
      actionId: "fire",
      params: { url: "http://127.0.0.1:8080/api" },
      auth: { type: "bearer", token: "" },
    });
    expect(result.statusCode).toBe(403);
  });

  it("webhook blocks 192.168.x.x", async () => {
    const result = await executeConnector({
      integrationId: "webhook",
      actionId: "fire",
      params: { url: "http://192.168.1.1/admin" },
      auth: { type: "bearer", token: "" },
    });
    expect(result.statusCode).toBe(403);
  });

  it("webhook requires url parameter", async () => {
    const result = await executeConnector({
      integrationId: "webhook",
      actionId: "fire",
      params: {},
      auth: { type: "bearer", token: "" },
    });
    expect(result.statusCode).toBe(400);
  });

  it("webhook fires to valid external URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ received: true }),
    });

    const result = await executeConnector({
      integrationId: "webhook",
      actionId: "fire",
      params: { url: "https://hooks.zapier.com/test", body: { data: "test" } },
      auth: { type: "bearer", token: "" },
    });

    expect(result.success).toBe(true);
  });

  // ── Error Handling ──

  it("handles fetch failures gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await executeConnector({
      integrationId: "hubspot",
      actionId: "list-contacts",
      params: {},
      auth: { type: "bearer", token: "test" },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── Duration Tracking ──

  it("tracks execution duration", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });

    const result = await executeConnector({
      integrationId: "hubspot",
      actionId: "list-contacts",
      params: {},
      auth: { type: "bearer", token: "test" },
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.durationMs).toBe("number");
  });
});
