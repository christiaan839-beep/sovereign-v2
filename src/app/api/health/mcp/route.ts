import { NextResponse } from "next/server";
import { AnthropicMCPClient } from "@/lib/anthropic-mcp";

/**
 * MCP Health Check — Returns status of all MCP tool servers.
 */
export async function GET() {
  const servers = await AnthropicMCPClient.discoverTools();

  const operational = servers.filter((s) => s.status === "operational").length;
  const total = servers.length;

  return NextResponse.json({
    status: operational === total ? "healthy" : operational > 0 ? "degraded" : "offline",
    operational,
    total,
    servers,
  });
}
