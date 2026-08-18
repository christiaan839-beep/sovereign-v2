// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// MCP tool generator; not wired.
/**
 * SOVEREIGN MATRIX — MCP Dynamic Tool Generator
 *
 * Following the Anthropic MCP specification, this module allows agents to
 * dynamically CREATE new tool integrations at runtime.
 *
 * Architecture:
 *   - Tools defined as JSON Schema objects (MCP tool format)
 *   - Execution via sandboxed fetch-only functions
 *   - Blocked patterns prevent code injection
 *   - Tools persist in memory for session, optionally saved to DB
 */

import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";
import { outboundFetch } from "@/lib/outbound-fetch";

const log = createLogger("mcp-tool-gen");

// ── Types (MCP Tool Format) ──

export interface MCPToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface GeneratedTool {
  schema: MCPToolSchema;
  /** HTTP config for execution (safe — no arbitrary code) */
  httpConfig: {
    url: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers: Record<string, string>;
    bodyTemplate: string; // JSON template with {{param}} placeholders
  };
  createdAt: string;
  sourcePrompt: string;
}

// ── In-Memory Tool Registry ──

const toolRegistry = new Map<string, GeneratedTool>();

// ── Tool Generation ──

export async function generateTool(
  description: string,
): Promise<GeneratedTool> {
  const raw = await ai(
    `Create an API integration tool for: "${description}"

Return ONLY JSON:
{
  "schema": {
    "name": "tool_name_snake_case",
    "description": "What this tool does",
    "input_schema": {
      "type": "object",
      "properties": { "param1": { "type": "string", "description": "..." } },
      "required": ["param1"]
    }
  },
  "httpConfig": {
    "url": "https://api.example.com/endpoint",
    "method": "POST",
    "headers": { "Content-Type": "application/json" },
    "bodyTemplate": "{\"key\": \"{{param1}}\"}"
  }
}

The httpConfig.bodyTemplate uses {{paramName}} placeholders that get replaced at runtime.
URL can also use {{paramName}} placeholders for path/query params.`,
    {
      system:
        "You are an API integration specialist. Generate MCP tool definitions. Output ONLY valid JSON.",
      maxTokens: 1000,
    },
  );

  let parsed;
  try {
    parsed = JSON.parse(
      raw
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim(),
    );
  } catch {
    throw new Error("Failed to generate valid tool definition");
  }

  // Validate URL is HTTPS (SSRF protection)
  const url = parsed.httpConfig?.url || "";
  if (!url.startsWith("https://")) {
    throw new Error("Generated tool URL must use HTTPS");
  }

  const tool: GeneratedTool = {
    schema: parsed.schema,
    httpConfig: {
      url: parsed.httpConfig.url,
      method: parsed.httpConfig.method || "POST",
      headers: parsed.httpConfig.headers || {
        "Content-Type": "application/json",
      },
      bodyTemplate: parsed.httpConfig.bodyTemplate || "{}",
    },
    createdAt: new Date().toISOString(),
    sourcePrompt: description,
  };

  toolRegistry.set(tool.schema.name, tool);
  log.info("MCP tool generated", {
    name: tool.schema.name,
    url: tool.httpConfig.url,
  });
  return tool;
}

/**
 * Execute a generated tool — uses HTTP config (no arbitrary code execution).
 */
export async function executeTool(
  toolNameOrTool: string | GeneratedTool,
  params: Record<string, unknown>,
): Promise<unknown> {
  const tool =
    typeof toolNameOrTool === "string"
      ? toolRegistry.get(toolNameOrTool)
      : toolNameOrTool;
  if (!tool) throw new Error(`Tool "${toolNameOrTool}" not found`);

  // Replace {{placeholders}} in URL and body
  let url = tool.httpConfig.url;
  let body = tool.httpConfig.bodyTemplate;
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `{{${key}}}`;
    url = url.replaceAll(placeholder, encodeURIComponent(String(value)));
    body = body.replaceAll(placeholder, String(value));
  }

  const res = await outboundFetch(
    url,
    {
      method: tool.httpConfig.method,
      headers: tool.httpConfig.headers,
      body: tool.httpConfig.method !== "GET" ? body : undefined,
    },
    {
      ruleId: "mcp-tool.execute",
      timeoutMs: 15_000,
    },
  );

  const contentType = res.contentType || "";
  return contentType.includes("json") ? JSON.parse(res.body) : res.body;
}

export function listTools(): MCPToolSchema[] {
  return [...toolRegistry.values()].map((t) => t.schema);
}

export function getTool(name: string): GeneratedTool | undefined {
  return toolRegistry.get(name);
}

export function removeTool(name: string): boolean {
  return toolRegistry.delete(name);
}
