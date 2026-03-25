import { NextResponse } from "next/server";

/**
 * TELEGRAM AGENT ROUTER — Routes Telegram commands to the correct agent API.
 * 
 * Commands:
 * /translate <text> to <lang>  → Translator agent
 * /research <company>          → ABM Artillery
 * /pii <text>                  → PII Redactor
 * /blog <topic>                → SEO Blog Generator
 * /build <description>         → Page Builder
 * /image <prompt>              → Image Generator
 * /chain <name> <input>        → Chain Reactor
 * /deploy <name>               → NemoClaw Deploy
 * /agents                      → List all agents
 * /help                        → Show commands
 */

const AGENT_ROUTES: Record<string, { endpoint: string; buildBody: (args: string) => Record<string, unknown> }> = {
  "/translate": {
    endpoint: "/api/agents/translate",
    buildBody: (args) => {
      const match = args.match(/(.+)\s+to\s+(\w{2})$/i);
      return match
        ? { text: match[1].trim(), target_lang: match[2].toLowerCase() }
        : { text: args, target_lang: "es" };
    },
  },
  "/research": {
    endpoint: "/api/agents/abm-artillery",
    buildBody: (args) => ({ companyName: args }),
  },
  "/pii": {
    endpoint: "/api/agents/pii-redactor",
    buildBody: (args) => ({ text: args }),
  },
  "/blog": {
    endpoint: "/api/agents/blog-gen",
    buildBody: (args) => ({ topic: args }),
  },
  "/build": {
    endpoint: "/api/agents/page-builder",
    buildBody: (args) => ({ prompt: args }),
  },
  "/image": {
    endpoint: "/api/agents/image-gen",
    buildBody: (args) => ({ prompt: args }),
  },
  "/chain": {
    endpoint: "/api/agents/chain-reactor",
    buildBody: (args) => {
      const parts = args.split(" ");
      const chain = parts[0] || "lead-to-close";
      const input = parts.slice(1).join(" ");
      return { chain, input: { company: input, topic: input, content: input } };
    },
  },
  "/deploy": {
    endpoint: "/api/agents/nemoclaw",
    buildBody: (args) => ({ action: "deploy", config: { name: args || "TelegramAgent" } }),
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;

    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
    }

    const sendReply = async (reply: string) => {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply,
          parse_mode: "Markdown",
        }),
      });
    };

    // /help command
    if (text === "/help" || text === "/start") {
      await sendReply(
        `🤖 *Sovereign Matrix Agent Router*\n\n` +
        `Available commands:\n` +
        `\`/translate hello to es\` — Translate text\n` +
        `\`/research Tesla\` — Research a company\n` +
        `\`/pii John lives at 123 Main St\` — Detect PII\n` +
        `\`/blog AI marketing strategies\` — Generate SEO blog\n` +
        `\`/build luxury landing page\` — Generate HTML page\n` +
        `\`/image futuristic city at night\` — Generate image\n` +
        `\`/chain lead-to-close Acme Corp\` — Run agent chain\n` +
        `\`/deploy SalesBot\` — Deploy NemoClaw agent\n` +
        `\`/agents\` — List all active agents`
      );
      return NextResponse.json({ ok: true });
    }

    // /agents command
    if (text === "/agents") {
      const agentList = Object.keys(AGENT_ROUTES).map(cmd => `• \`${cmd}\``).join("\n");
      await sendReply(`⚡ *14 Active Agents*\n\n${agentList}\n\nUse /help for syntax.`);
      return NextResponse.json({ ok: true });
    }

    // Route to agent
    const command = Object.keys(AGENT_ROUTES).find(cmd => text.startsWith(cmd));

    if (!command) {
      await sendReply("❌ Unknown command. Type /help for available commands.");
      return NextResponse.json({ ok: true });
    }

    const route = AGENT_ROUTES[command];
    const args = text.slice(command.length).trim();

    if (!args) {
      await sendReply(`⚠️ Usage: \`${command} <input>\``);
      return NextResponse.json({ ok: true });
    }

    await sendReply(`⏳ Processing via *${command.replace("/", "").toUpperCase()}* agent...`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const agentRes = await fetch(`${baseUrl}${route.endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(route.buildBody(args)),
    });

    const agentData = await agentRes.json();

    // Format the response based on agent type
    let formattedReply = "";
    if (command === "/translate") {
      formattedReply = `🌐 *Translation Complete*\n\n${agentData.target?.text || JSON.stringify(agentData)}`;
    } else if (command === "/research") {
      formattedReply = `🎯 *Research Complete*\n\n${agentData.generatedEmail?.body?.substring(0, 500) || JSON.stringify(agentData).substring(0, 500)}`;
    } else if (command === "/pii") {
      formattedReply = `🔒 *PII Scan*\nEntities: ${agentData.entities_found || 0}\nRisk: ${agentData.risk_level || "N/A"}\n\n${agentData.redacted_text?.substring(0, 500) || ""}`;
    } else if (command === "/deploy") {
      formattedReply = `🛡️ *NemoClaw Agent Deployed*\nID: \`${agentData.agent?.id}\`\nName: ${agentData.agent?.name}\nGuardrails: ${agentData.agent?.guardrails?.length || 0}`;
    } else {
      formattedReply = `✅ *${command.replace("/", "").toUpperCase()} Complete*\n\n\`\`\`\n${JSON.stringify(agentData, null, 2).substring(0, 800)}\n\`\`\``;
    }

    await sendReply(formattedReply);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[TELEGRAM_ROUTER_ERROR]", error);
    return NextResponse.json({ ok: true });
  }
}
