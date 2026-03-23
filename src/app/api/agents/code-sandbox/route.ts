import { createAgentRoute } from "@/lib/agent-factory";

/**
 * CODE SANDBOX — Gemini generates AND executes code in a sandbox.
 *
 * Uses Gemini 2.5 Pro's code execution tool to write code,
 * run it in a sandboxed environment, and return the output.
 * Perfect for: data analysis, calculations, data transformation,
 * proof-of-concept scripts, math verification.
 *
 * Input: { task, language?: "python" }
 * Output: { code, output, executionResult }
 */

export const POST = createAgentRoute({
  name: "code-sandbox",
  requiredFields: ["task"],
  handler: async ({ input }) => {
    const task = input.task as string;

    const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return { error: "Google AI API key not configured." };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: task }],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: "You are a senior Python developer. Write clean, efficient code to solve the task. Use the code execution tool to run your code and verify the output. Always print the final result. No explanations unless the user asks — just write and run the code.",
              },
            ],
          },
          tools: [
            {
              codeExecution: {},
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4000,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return { error: `Gemini API error (${res.status})`, details: errorText };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Extract code blocks and execution results
    let code = "";
    let output = "";
    let explanation = "";

    for (const part of parts) {
      if (part.executableCode) {
        code = part.executableCode.code || "";
      } else if (part.codeExecutionResult) {
        output = part.codeExecutionResult.output || "";
      } else if (part.text) {
        explanation += part.text + "\n";
      }
    }

    return {
      code,
      output,
      explanation: explanation.trim() || undefined,
      executed: !!output,
      language: "python",
      model: "gemini-2.5-pro",
      feature: "code-execution",
    };
  },
});
