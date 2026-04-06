import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";

/**
 * STITCH SDK PAGE BUILDER — Generates complete HTML pages from text prompts.
 * Uses Google's Stitch SDK to autonomously build production-ready websites.
 *
 * Flow: Text prompt → Stitch API → Full HTML + Screenshot
 */

export const POST = createAgentRoute({
  name: "page-builder",
  requiredFields: ["prompt"],
  handler: async ({ input }) => {
    const { prompt, projectId } = input as Record<string, unknown>;

    const stitchKey = process.env.STITCH_API_KEY;

    if (!stitchKey) {
      // Fallback: Use NVIDIA NIM to generate HTML via code generation model
      if (!await getNimKey()) {
        throw new Error("Neither STITCH_API_KEY nor NVIDIA_NIM_API_KEY is configured.");
      }

      const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "mistralai/devstral-2-123b-instruct-2512",
          messages: [
            {
              role: "system",
              content: `You are a senior web designer. Generate a complete, production-ready HTML page based on the user's prompt. The page must:
1. Be a single self-contained HTML file with inline CSS and JS.
2. Use a dark premium aesthetic with modern design patterns.
3. Include responsive design, smooth animations, and sharp typography.
4. Be immediately usable — no placeholders, no TODOs.
Output ONLY the raw HTML. No markdown, no explanation.`,
            },
            { role: "user", content: prompt as string },
          ],
          max_tokens: 4096,
          temperature: 0.6,
        }),
      });

      const nimData = await nimRes.json();
      const generatedHtml = nimData?.choices?.[0]?.message?.content || "<html><body>Generation failed</body></html>";

      return {
        success: true,
        provider: "NVIDIA NIM (Devstral 2)",
        prompt,
        html: generatedHtml,
        screenshot: null,
      };
    }

    // Use Google Stitch SDK when API key is available
    const { stitch } = await import("@google/stitch-sdk");

    const project = projectId
      ? stitch.project(projectId as string)
      : await stitch.callTool("create_project", { title: `Sovereign - ${(prompt as string).substring(0, 30)}` });

    const pId = (projectId as string) || (project as { content?: Array<{ text?: string }> })?.content?.[0]?.text || "default";
    const proj = stitch.project(pId);
    const screen = await proj.generate(prompt as string);
    const html = await screen.getHtml();
    const imageUrl = await screen.getImage();

    return {
      success: true,
      provider: "Google Stitch SDK",
      prompt,
      projectId: pId,
      html,
      screenshot: imageUrl,
    };
  },
});
