/**
 * SOVEREIGN MATRIX: MCP TOOL BRIDGE
 *
 * Real MCP implementation that wraps existing platform modules
 * (database, memory, computer-use) as MCP-compatible tool interfaces.
 *
 * Instead of running separate MCP server processes, we expose
 * Drizzle DB queries, Pinecone memory, and Computer Use API
 * through a unified tool execution interface.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("mcp");

export interface MCPToolRequest {
  serverId: string;
  toolName: string;
  parameters: Record<string, unknown>;
}

export interface MCPResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  latencyMs?: number;
}

interface MCPServer {
  id: string;
  name: string;
  status: "operational" | "degraded" | "offline";
  tools: string[];
}

// ─── Tool Handlers ───

async function handlePostgres(toolName: string, params: Record<string, unknown>): Promise<MCPResponse> {
  switch (toolName) {
    case "query": {
      const query = params.sql as string;
      if (!query) return { success: false, error: "Missing 'sql' parameter" };
      // Only allow SELECT queries for safety
      if (!query.trim().toUpperCase().startsWith("SELECT")) {
        return { success: false, error: "Only SELECT queries are allowed via MCP" };
      }
      try {
        const result = await db.execute(sql.raw(query));
        return { success: true, data: { rows: result, rowCount: Array.isArray(result) ? result.length : 0 } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Query failed" };
      }
    }
    case "list_tables": {
      try {
        const result = await db.execute(
          sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
        );
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Failed to list tables" };
      }
    }
    case "describe_table": {
      const table = params.table as string;
      if (!table) return { success: false, error: "Missing 'table' parameter" };
      try {
        const result = await db.execute(
          sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = ${table} ORDER BY ordinal_position`
        );
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Failed to describe table" };
      }
    }
    default:
      return { success: false, error: `Unknown postgres tool: ${toolName}` };
  }
}

async function handleMemory(toolName: string, params: Record<string, unknown>): Promise<MCPResponse> {
  switch (toolName) {
    case "store": {
      const text = params.text as string;
      const namespace = (params.namespace as string) || "default";
      if (!text) return { success: false, error: "Missing 'text' parameter" };
      try {
        const { memorize } = await import("@/lib/memory");
        await memorize(text, namespace);
        return { success: true, data: { stored: true, namespace } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Memory store failed" };
      }
    }
    case "recall": {
      const query = params.query as string;
      const namespace = (params.namespace as string) || "default";
      if (!query) return { success: false, error: "Missing 'query' parameter" };
      try {
        const { recall } = await import("@/lib/memory");
        const results = await recall(query, parseInt(namespace, 10) || 2);
        return { success: true, data: { results, count: Array.isArray(results) ? results.length : 0 } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Memory recall failed" };
      }
    }
    default:
      return { success: false, error: `Unknown memory tool: ${toolName}` };
  }
}

async function handleComputerUse(toolName: string, params: Record<string, unknown>): Promise<MCPResponse> {
  // Proxy to the computer-use API endpoint
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/agents/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: toolName, ...params }),
    });
    if (!res.ok) return { success: false, error: `Computer use API returned ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Computer use failed" };
  }
}

// ─── Main MCP Client ───

export class AnthropicMCPClient {
  /**
   * Execute a tool on a specific MCP server.
   */
  static async executeTool(request: MCPToolRequest): Promise<MCPResponse> {
    const start = Date.now();
    log.info("Executing MCP tool", { server: request.serverId, tool: request.toolName });

    let result: MCPResponse;

    switch (request.serverId) {
      case "mcp-postgres":
        result = await handlePostgres(request.toolName, request.parameters);
        break;
      case "mcp-memory":
        result = await handleMemory(request.toolName, request.parameters);
        break;
      case "mcp-computer-use":
        result = await handleComputerUse(request.toolName, request.parameters);
        break;
      default:
        result = { success: false, error: `Unknown MCP server: ${request.serverId}` };
    }

    result.latencyMs = Date.now() - start;
    return result;
  }

  /**
   * Discover available MCP tools with live health status.
   */
  static async discoverTools(): Promise<MCPServer[]> {
    const servers: MCPServer[] = [];

    // Check Postgres
    try {
      await db.execute(sql`SELECT 1`);
      servers.push({
        id: "mcp-postgres",
        name: "PostgreSQL (Neon)",
        status: "operational",
        tools: ["query", "list_tables", "describe_table"],
      });
    } catch {
      servers.push({ id: "mcp-postgres", name: "PostgreSQL (Neon)", status: "offline", tools: [] });
    }

    // Check Memory (Pinecone)
    const hasPinecone = !!(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX);
    servers.push({
      id: "mcp-memory",
      name: "Vector Memory (Pinecone)",
      status: hasPinecone ? "operational" : "offline",
      tools: hasPinecone ? ["store", "recall"] : [],
    });

    // Check Computer Use (Claude)
    const hasClaude = !!process.env.ANTHROPIC_API_KEY;
    servers.push({
      id: "mcp-computer-use",
      name: "Computer Use (Claude)",
      status: hasClaude ? "operational" : "offline",
      tools: hasClaude ? ["click", "type", "screenshot", "bash"] : [],
    });

    return servers;
  }
}
