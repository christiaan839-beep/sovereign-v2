import { createAgentRoute } from "@/lib/agent-factory";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeJsonParseObject } from "@/lib/safe-json";

/**
 * CLAUDE COMPUTER USE API — Autonomous Browser Control
 * Allows Claude 3.5 Sonnet to natively control the virtual browser:
 * clicking, typing, taking screenshots, and executing bash commands.
 */

export const POST = createAgentRoute({
  name: "computer-use",
  handler: async ({ input, email }) => {
    const {
      instructions,
      resolution = { type: "computer_20251124", display_width_px: 1920, display_height_px: 1080 },
      history = []
    } = input as Record<string, unknown>;

    if (!instructions && (history as unknown[]).length === 0) {
      throw new Error("Instructions or history required.");
    }

    // 1. Get Anthropic Key (BYOK) — use email from factory context
    let apiKey = process.env.ANTHROPIC_API_KEY || "";
    if (email) {
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userEmail, email)
      });
      if (userSettings?.apiKeys) {
        const keys = safeJsonParseObject<Record<string, string>>(
          userSettings.apiKeys,
          "settings.apiKeys (computer-use)",
        );
        if (keys.anthropic) apiKey = keys.anthropic;
      }
    }

    if (!apiKey) {
      throw new Error("Anthropic API Key required for Computer Use.");
    }

    // 2. Initialize Claude with Beta headers for Computer Use
    const anthropic = new Anthropic({ apiKey });
    const res = resolution as { display_width_px: number; display_height_px: number };

    const messages = [
      ...(history as Array<{ role: "user" | "assistant"; content: string }>),
      ...(instructions ? [{ role: "user" as const, content: instructions as string }] : [])
    ];

    // 3. Request Computer Use action
    const response = await anthropic.beta.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      betas: ["computer-use-2025-11-24"],
      system: "You are the Sovereign Matrix Ghost Browser. You have access to a virtual Linux desktop. Use the computer tools to navigate the web, analyze competitors, and fulfill the user's instructions. Always verify the UI state with screenshots before clicking.",
      tools: [
        {
          type: "computer_20251124",
          name: "computer",
          display_width_px: res.display_width_px,
          display_height_px: res.display_height_px,
          display_number: 1,
        },
        {
          type: "text_editor_20250429",
          name: "str_replace_based_edit_tool"
        },
        {
          type: "bash_20250124",
          name: "bash"
        }
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      messages: messages as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    // 4. Extract tool calls and text
    const textBlocks = response.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map(c => c.text).join("\n");
    const toolCalls = response.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");

    return {
      success: true,
      text: textBlocks,
      tool_calls: toolCalls,
      raw: response.content
    };
  },
});
