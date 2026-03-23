import { NextResponse } from "next/server";

/**
 * MCP (Model Context Protocol) Gateway
 * The Open Source standard for Universal Agent Interoperability.
 * 
 * Allows Sovereign Matrix autonomous agents to dynamically connect with
 * local or remote MCP servers (e.g. Postgres databases, local file systems,
 * GitHub repos, or external SaaS APIs) without hardcoded integrations.
 */

// Simulated registry of connected MCP Servers for the Gateway
const REGISTRY = [
  { id: "mcp-pg-01", name: "Client Database (Postgres)", status: "connected", protocol: "mcp/v1" },
  { id: "mcp-fs-02", name: "Local Filesystem Agent", status: "dormant", protocol: "mcp/v1" },
  { id: "mcp-gh-03", name: "GitHub Subsystem", status: "connected", protocol: "mcp/v1" }
];

export async function POST(request: Request) {
  try {
    const { action, server_id, payload } = await request.json();

    if (!action) {
      return NextResponse.json({ error: "Missing MCP action" }, { status: 400 });
    }

    if (action === "list_servers") {
      return NextResponse.json({
        mcp_version: "1.0",
        servers: REGISTRY
      });
    }

    if (action === "execute" && server_id) {
      const server = REGISTRY.find(s => s.id === server_id);
      if (!server || server.status !== "connected") {
        return NextResponse.json({ error: "MCP Server not found or disconnected" }, { status: 404 });
      }

      // Simulate routing the payload to the external MCP server
      // In a real environment, this delegates to an MCP Client SDK instance over stdio/SSE
      return NextResponse.json({
        success: true,
        source: `MCP::${server_id}`,
        execution: "delegated",
        result: `Successfully routed payload to ${server.name} via Model Context Protocol.`,
        meta: { payload_size: JSON.stringify(payload || {}).length }
      });
    }

    return NextResponse.json({ error: "Unknown MCP action payload" }, { status: 400 });

  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: "MCP Gateway Error", details: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "MCP Gateway Active",
    version: "v1.0 (Anthropic Spec)",
    active_connections: REGISTRY.filter(r => r.status === "connected").length,
    endpoints: ["POST /api/mcp-gateway (actions: list_servers, execute)"]
  });
}
