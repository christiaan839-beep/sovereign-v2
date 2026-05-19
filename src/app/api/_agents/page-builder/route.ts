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
      if (!(await getNimKey())) {
        throw new Error(
          "Neither STITCH_API_KEY nor NVIDIA_NIM_API_KEY is configured.",
        );
      }

      const nimRes = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getNimKey()}`,
          },
          body: JSON.stringify({
            model: "mistralai/devstral-2-123b-instruct-2512",
            messages: [
              {
                role: "system",
                // Opus 4.7 prompt pattern (Wave 89). The page-builder is the
                // UI-codegen surface where "AI slop" (generic gradients, Inter
                // font, hero-with-emoji-icons clichés) shows up worst — the
                // <frontend_aesthetics> tag is the documented Opus 4.7 escape
                // hatch that produces context-specific rather than templated UI.
                content: `<role>
You are a senior web designer producing a single, self-contained,
production-shippable HTML page. The output goes straight to a public
URL — no human touches it before deployment.
</role>

<step_by_step>
(1) Read the user prompt; extract the SINGLE strongest visual hook
    implied by the subject matter (not a generic gradient — something
    specific to the topic).
(2) Choose a typeface combination that fits the topic, NOT the default
    web-app sans. See <frontend_aesthetics> for forbidden defaults.
(3) Design the layout from the content out — not a card grid by reflex.
(4) Add one tasteful micro-interaction (hover, scroll-into-view fade,
    or a subtle parallax). One. Not three.
(5) Output ONLY the raw HTML document. No markdown fence, no comment
    block preamble, no "Here is your page".
</step_by_step>

<output_requirements>
- ONE self-contained HTML file: <!doctype html> through </html>.
- Inline CSS (no external stylesheet). Inline JS only if interactivity needed.
- Mobile-first responsive — usable at 320px width.
- Sharp typography (line-height 1.2 on display, 1.55 on body).
- Dark theme by default; system-light query handled.
- No placeholders, no Lorem ipsum, no "TODO" comments.
- No emoji icons in primary navigation.
</output_requirements>

<frontend_aesthetics>
FORBIDDEN (default AI-slop signatures):
- Inter / Roboto / Poppins fonts unless explicitly requested.
- Purple-to-pink linear gradients on dark backgrounds.
- Generic hero with centered headline + two buttons + image-right.
- "Beautiful gradient text" rainbow CSS treatment.
- Rounded-2xl on everything; cookie-cutter card grid layouts.
- Lucide React-style icon set as decorative content.

PREFER:
- Typography that signals the topic (a finance page uses different
  type from a music venue page).
- Asymmetric layouts, off-grid breaks, intentional whitespace.
- Color palettes derived from the topic (not the default Tailwind
  emerald/cyan/indigo).
- Negative space as a composition tool, not gap-filler.
</frontend_aesthetics>`,
              },
              { role: "user", content: prompt as string },
            ],
            max_tokens: 4096,
            temperature: 0.6,
          }),
        },
      );

      const nimData = await nimRes.json();
      const generatedHtml =
        nimData?.choices?.[0]?.message?.content ||
        "<html><body>Generation failed</body></html>";

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
      : await stitch.callTool("create_project", {
          title: `Sovereign - ${(prompt as string).substring(0, 30)}`,
        });

    const pId =
      (projectId as string) ||
      (project as { content?: Array<{ text?: string }> })?.content?.[0]?.text ||
      "default";
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
