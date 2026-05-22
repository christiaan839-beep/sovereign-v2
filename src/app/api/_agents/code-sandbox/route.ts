import { createAgentRoute } from "@/lib/agent-factory";
import { executeCode, analyzeData } from "@/lib/colab-mcp";

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
  // Wave 129 M3 batch 19: memory hooks. Per-user code session continuity —
  // prior task description + execution result helps next "modify the
  // function" or "fix the error from last run" land without re-pasting.
  memory: {
    search: {
      query: (input) =>
        `code-sandbox ${input.action ?? "execute"} ${String(input.task ?? "").slice(0, 60)} ${String(input.code ?? "").slice(0, 60)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          action?: string;
          output?: string;
          stdout?: string;
          stderr?: string;
          success?: boolean;
        };
        const out = (r.stdout ?? r.output ?? "")
          .slice(0, 180)
          .replace(/\s+/g, " ");
        const err = (r.stderr ?? "").slice(0, 100).replace(/\s+/g, " ");
        if (!out && !err) return null;
        return `code-sandbox[${r.action ?? "?"}/${r.success ? "ok" : "err"}]: ${out}${err ? ` ERR=${err}` : ""}`;
      },
      metadata: (input) => ({
        kind: "code-sandbox",
        action: typeof input.action === "string" ? input.action : "execute",
      }),
    },
  },
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
