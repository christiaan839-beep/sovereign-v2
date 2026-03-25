import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * CLAUDE COMPUTER USE API — Autonomous Browser Control
 * Allows Claude 3.5 Sonnet to natively control the virtual browser:
 * clicking, typing, taking screenshots, and executing bash commands.
 */

export async function POST(req: Request) {
  try {
    const { 
      instructions, 
      resolution = { type: "computer_20241022", display_width_px: 1920, display_height_px: 1080 },
      history = []
    } = await req.json();

    if (!instructions && history.length === 0) {
      return NextResponse.json({ error: "Instructions or history required." }, { status: 400 });
    }

    // 1. Get Anthropic Key (BYOK)
    let apiKey = process.env.ANTHROPIC_API_KEY || "";
    const user = await currentUser();
    if (user?.primaryEmailAddress?.emailAddress) {
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userEmail, user.primaryEmailAddress.emailAddress)
      });
      if (userSettings?.apiKeys) {
        const keys = JSON.parse(userSettings.apiKeys);
        if (keys.anthropic) apiKey = keys.anthropic;
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API Key required for Computer Use." }, { status: 401 });
    }

    // 2. Initialize Claude with Beta headers for Computer Use
    const anthropic = new Anthropic({ apiKey });

    const messages = [
      ...history,
      ...(instructions ? [{ role: "user" as const, content: instructions }] : [])
    ];

    // 3. Request Computer Use action
    const response = await anthropic.beta.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      betas: ["computer-use-2024-10-22"],
      system: "You are the Sovereign Matrix Ghost Browser. You have access to a virtual Linux desktop. Use the computer tools to navigate the web, analyze competitors, and fulfill the user's instructions. Always verify the UI state with screenshots before clicking.",
      tools: [
        {
          type: "computer_20241022",
          name: "computer",
          display_width_px: resolution.display_width_px,
          display_height_px: resolution.display_height_px,
          display_number: 1,
        },
        {
          type: "text_editor_20241022",
          name: "str_replace_editor"
        },
        {
          type: "bash_20241022",
          name: "bash"
        }
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
    });

    // 4. Extract tool calls and text
    const textBlocks = response.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map(c => c.text).join("\n");
    const toolCalls = response.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");

    return NextResponse.json({
      success: true,
      text: textBlocks,
      tool_calls: toolCalls,
      raw: response.content
    });

  } catch (error) {
    return NextResponse.json({ error: "Computer Use Engine Error", details: String(error) }, { status: 500 });
  }
}
