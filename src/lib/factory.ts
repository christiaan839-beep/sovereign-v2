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

  const systemPrompt = `You are the SOVEREIGN Tool Factory — a senior AI engineer.
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
      model: "groq",
      taskType: "code",
    });

    // Clean markdown wrappers
    generatedCode = generatedCode
      .replace(/^```(js|javascript)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    // Security: block dangerous code patterns before execution
    const blockedPatterns = [
      /\bprocess\b/,
      /\brequire\b/,
      /\bimport\b/,
      /\b__dirname\b/,
      /\b__filename\b/,
      /\bchild_process\b/,
      /\bfs\b\./,
      /\bnet\b\./,
      /\bhttp\b\./,
      /\bdns\b\./,
      /\beval\b\(/,
      /\bglobalThis\b/,
      /\bwindow\b/,
      /\bfetch\b\(/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
    ];
    for (const pattern of blockedPatterns) {
      if (pattern.test(generatedCode)) {
        throw new Error(
          `Generated code contains blocked pattern: ${pattern.source}. Code execution denied for security.`,
        );
      }
    }

    // Limit code length to prevent abuse
    if (generatedCode.length > 10_000) {
      throw new Error(
        "Generated code exceeds maximum allowed length (10,000 chars)",
      );
    }

    // SECURITY NOTE: new Function() is used intentionally here for the Tool Factory feature.
    // It executes AI-generated pure computation code (math, data transforms, string ops).
    // All dangerous patterns (I/O, network, filesystem, process) are blocked above.
    // eslint-disable-next-line no-new-func
    const execute = new Function(`return (${generatedCode})();`);
    const result = await execute();

    return {
      objective,
      generatedCode,
      result,
      executionTimeMs: Date.now() - start,
    };
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
