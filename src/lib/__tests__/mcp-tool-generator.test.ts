import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/ai", () => ({ ai: vi.fn().mockResolvedValue('{"schema":{"name":"test_tool","description":"Test","input_schema":{"type":"object","properties":{"q":{"type":"string","description":"Query"}},"required":["q"]}},"httpConfig":{"url":"https://api.example.com/test","method":"POST","headers":{"Content-Type":"application/json"},"bodyTemplate":"{\\\"query\\\": \\\"{{q}}\\\"}"}}') }));
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
import { generateTool, listTools, getTool, removeTool } from "@/lib/mcp-tool-generator";

describe("mcp-tool-generator.ts", () => {
  it("generates a tool from description", async () => {
    const tool = await generateTool("Search for users by email");
    expect(tool.schema.name).toBe("test_tool");
    expect(tool.httpConfig.url).toContain("https://");
  });

  it("lists registered tools", async () => {
    await generateTool("Another tool");
    const tools = listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("gets tool by name", () => {
    const tool = getTool("test_tool");
    expect(tool).toBeDefined();
  });

  it("removes a tool", () => {
    expect(removeTool("test_tool")).toBe(true);
    expect(removeTool("test_tool")).toBe(false); // Already removed
  });
});
