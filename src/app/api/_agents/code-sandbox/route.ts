import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { executeCode, analyzeData } from "@/lib/colab-mcp";
import { createLogger } from "@/lib/logger";

const log = createLogger("code-sandbox");

/**
 * CODE SANDBOX AGENT — Execute Python code in a cloud sandbox.
 * Uses Gemini Code Execution (built-in) with Colab MCP as future upgrade.
 *
 * Actions:
 * - "execute": Run raw Python code
 * - "analyze": Describe a data analysis task in plain English
 */
export const POST = createAgentRoute({
  name: "code-sandbox",
  handler: async ({ input }) => {


    const { action = "execute", code, task, data, libraries } = input as Record<string, any>;

    if (action === "execute") {
      if (!code) return ({ error: "Missing 'code' parameter" });
      const result = await executeCode(code, { installDeps: libraries });
      return ({ output: result.output, success: result.success, error: result.error, executionTime: result.executionTime });
    }

    if (action === "analyze") {
      if (!task) return ({ error: "Missing 'task' parameter" });
      const result = await analyzeData(task, data, { libraries });
      return ({ output: result.output, success: result.success, error: result.error, executionTime: result.executionTime });
    }

    return ({ error: "Invalid action. Use 'execute' or 'analyze'." });
  
  },
});

