import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { action = "execute", code, task, data, libraries } = await req.json();

    if (action === "execute") {
      if (!code) return NextResponse.json({ error: "Missing 'code' parameter" }, { status: 400 });
      const result = await executeCode(code, { installDeps: libraries });
      return NextResponse.json({ output: result.output, success: result.success, error: result.error, executionTime: result.executionTime });
    }

    if (action === "analyze") {
      if (!task) return NextResponse.json({ error: "Missing 'task' parameter" }, { status: 400 });
      const result = await analyzeData(task, data, { libraries });
      return NextResponse.json({ output: result.output, success: result.success, error: result.error, executionTime: result.executionTime });
    }

    return NextResponse.json({ error: "Invalid action. Use 'execute' or 'analyze'." }, { status: 400 });
  } catch (err) {
    log.error("Code sandbox error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Code execution failed" }, { status: 500 });
  }
}
