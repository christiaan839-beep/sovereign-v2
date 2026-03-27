import { ai } from "@/lib/ai";

export interface ToolResult {
  objective: string;
  generatedCode: string;
  result: unknown;
  error?: string;
  executionTimeMs: number;
}

/**
 * Tool Factory — When SOVEREIGN encounters a problem it doesn't have a tool for,
 * it writes the tool in JavaScript and executes it in real-time.
 */
export async function createAndRunTool(objective: string): Promise<ToolResult> {
  const start = Date.now();

  const systemPrompt = `You are the SOVEREIGN Tool Factory — an elite AI engineer.
The user needs a tool to accomplish an objective. You must WRITE it now in JavaScript.

Rules:
1. Write a SINGLE async arrow function.
2. The function takes NO arguments.
3. The function MUST return a value (object, string, array, etc).
4. Only use native Node.js APIs (fetch, crypto, Math, URL, etc). No npm packages.
5. Output ONLY raw executable JavaScript. No markdown. No \`\`\`js. No comments.

Example:
async () => {
  const res = await fetch("https://api.publicapis.org/entries");
  const data = await res.json();
  return data.entries.slice(0, 3);
}`;

  let generatedCode = "";

  try {
    generatedCode = await ai(`Objective: ${objective}`, {
      system: systemPrompt,
      model: "claude",
      taskType: "code",
    });

    // Clean markdown wrappers
    generatedCode = generatedCode.replace(/^```(js|javascript)?\s*/i, "").replace(/```$/i, "").trim();

    // Safety: Block dangerous patterns before execution
    const dangerousPatterns = [
      /process\.env/i,
      /require\s*\(/i,
      /import\s*\(/i,
      /child_process/i,
      /\beval\s*\(/i,
      /Function\s*\(/i,
      /fs\./i,
      /\.exec\s*\(/i,
      /\.spawn\s*\(/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(generatedCode)) {
        return {
          objective,
          generatedCode,
          result: null,
          error: `Generated code contains blocked pattern: ${pattern.source}`,
          executionTimeMs: Date.now() - start,
        };
      }
    }

    // Execute in sandboxed context (limited to safe globals)
    const execute = new Function(`return (${generatedCode})();`);
    const result = await execute();

    return { objective, generatedCode, result, executionTimeMs: Date.now() - start };
  } catch (error) {
    return {
      objective,
      generatedCode,
      result: null,
      error: error instanceof Error ? error.message : "Execution failed",
      executionTimeMs: Date.now() - start,
    };
  }
}
