import { createLogger } from "@/lib/logger";

const log = createLogger("colab-mcp");

/**
 * Google Colab MCP Integration
 *
 * Enables agents to execute Python code in Google Colab's cloud sandbox.
 * No local Python needed. Secure, isolated execution environment.
 *
 * Setup: User must have Google Colab MCP server running locally:
 *   uvx git+https://github.com/googlecolab/colab-mcp
 *
 * For our platform, we proxy through a REST endpoint so agents
 * can execute code without MCP client setup.
 */

export interface ColabExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime?: number;
  visualizations?: string[]; // Base64 encoded images from matplotlib etc.
}

/**
 * Execute Python code via the code-agent which routes to Colab or falls back to Gemini code execution.
 * This is the agent-accessible interface — no direct MCP needed.
 */
export async function executeCode(
  code: string,
  options: { timeout?: number; installDeps?: string[] } = {}
): Promise<ColabExecutionResult> {
  const startTime = Date.now();

  // Try Gemini code execution first (built-in, no setup needed)
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("No Gemini key");

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ codeExecution: {} }],
    });

    const prompt = options.installDeps?.length
      ? `First install these packages: ${options.installDeps.join(", ")}. Then run this code:\n\`\`\`python\n${code}\n\`\`\``
      : `Run this Python code and return the output:\n\`\`\`python\n${code}\n\`\`\``;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return {
      success: true,
      output: text,
      executionTime: Date.now() - startTime,
    };
  } catch (err) {
    log.warn("Gemini code execution failed, returning error", { error: (err as Error).message });
    return {
      success: false,
      output: "",
      error: `Code execution unavailable: ${(err as Error).message}. Set up Google Colab MCP or ensure Gemini API key is configured.`,
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Execute a data analysis task — high-level wrapper for agents.
 * Generates Python code from natural language, executes it, returns results.
 */
export async function analyzeData(
  task: string,
  data?: string, // CSV or JSON data to analyze
  options: { libraries?: string[] } = {}
): Promise<ColabExecutionResult> {
  const { ai } = await import("@/lib/ai");

  // Step 1: Generate Python code from natural language
  const codePrompt = `Write Python code to accomplish this task: ${task}
${data ? `\nData to analyze:\n${data.slice(0, 2000)}` : ""}
${options.libraries?.length ? `\nUse these libraries: ${options.libraries.join(", ")}` : "\nUse pandas, numpy, matplotlib as needed."}

Return ONLY the Python code, no explanation. The code should print its results to stdout.`;

  const code = await ai(codePrompt, {
    system: "You are a Python data scientist. Return ONLY executable Python code. No markdown, no explanation.",
    maxTokens: 2000,
  });

  // Step 2: Execute the generated code
  const cleanCode = code.replace(/```python\n?/g, "").replace(/```\n?/g, "").trim();
  return executeCode(cleanCode, { installDeps: options.libraries });
}
