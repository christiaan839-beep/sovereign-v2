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
  handler: async ({ input, email, userId }) => {


    const { action = "execute", code, task, data, libraries } = input as {
      action?: "execute" | "analyze";
      code?: string;
      task?: string;
      data?: unknown;
      libraries?: string[];
    };

    if (action === "execute") {
      if (!code) return ({ error: "Missing 'code' parameter" });
      const result = await executeCode(code, { installDeps: libraries });
      return ({ output: result.output, success: result.success, error: result.error, executionTime: result.executionTime });
    }

    if (action === "analyze") {
      if (!task) return ({ error: "Missing 'task' parameter" });
      // `data` is typed as unknown in the input schema; analyzeData expects
      // a string (CSV / JSON). Serialize non-string values for convenience.
      const dataStr: string | undefined =
        typeof data === "string" ? data : data !== undefined ? JSON.stringify(data) : undefined;
      const result = await analyzeData(task, dataStr, { libraries });
      return ({ output: result.output, success: result.success, error: result.error, executionTime: result.executionTime });
    }

    return ({ error: "Invalid action. Use 'execute' or 'analyze'." });
  
  },
});

