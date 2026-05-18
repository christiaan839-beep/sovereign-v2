import { createAgentRoute } from "@/lib/agent-factory";
import { executeCode, analyzeData } from "@/lib/colab-mcp";
import { createLogger } from "@/lib/logger";


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
    const {
      action = "execute",
      code = "",
      task = "",
      data,
      libraries,
    } = input as {
      action?: string;
      code?: string;
      task?: string;
      data?: unknown;
      libraries?: string[];
    };

    if (action === "execute") {
      if (!code) return { error: "Missing 'code' parameter" };
      const result = await executeCode(code, { installDeps: libraries });
      return {
        output: result.output,
        success: result.success,
        error: result.error,
        executionTime: result.executionTime,
      };
    }

    if (action === "analyze") {
      if (!task) return { error: "Missing 'task' parameter" };
      const result = await analyzeData(
        task,
        // analyzeData accepts string | undefined; data is `unknown` from input
        data as string | undefined,
        { libraries },
      );
      return {
        output: result.output,
        success: result.success,
        error: result.error,
        executionTime: result.executionTime,
      };
    }

    return { error: "Invalid action. Use 'execute' or 'analyze'." };
  },
});
