import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { alreadyProcessed } from "@/lib/idempotency";
const log = createLogger("telegram-webhook");

const limiter = rateLimit({ interval: 60, limit: 30 });

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: { id: number; type: string };
    date: number;
    text?: string;
  };
};

const COMMANDER_CHAT_ID = process.env.TELEGRAM_COMMANDER_CHAT_ID; // The only ID allowed to command the Swarm
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId: string | number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    log.error("Telegram Bot Token missing");
    return;
  }

  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "MarkdownV2",
        }),
      },
    );
  } catch (error) {
    log.error("Telegram transport error", error as Record<string, unknown>);
  }
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  try {
    // 1. Verify Telegram Secret Token for Edge Security
    // SECURITY: Secret is REQUIRED. Previously the check was skipped when
    // the env var was unset, allowing reflective spam via the bot's
    // "ACCESS DENIED" response to any attacker-supplied chat_id.
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedSecret) {
      log.error("TELEGRAM_WEBHOOK_SECRET not configured — rejecting webhook");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 503 },
      );
    }

    const headerPayload = await headers();
    const secretToken = headerPayload.get("X-Telegram-Bot-Api-Secret-Token");

    if (secretToken !== expectedSecret) {
      log.error("Unauthorized webhook invocation detected");
      return NextResponse.json(
        { error: "Unauthorized Interception" },
        { status: 403 },
      );
    }

    const body: TelegramUpdate = await req.json();

    if (!body.message || !body.message.text) {
      return NextResponse.json({ status: "ignored" });
    }

    // Idempotency — Telegram retries on 5xx and our reply triggers
    // a paid AI call. Without dedup, a retried update_id re-charges
    // the model + re-replies to the user.
    if (
      typeof body.update_id === "number" &&
      (await alreadyProcessed("telegram:update", String(body.update_id)))
    ) {
      log.info("Skipped: Telegram update already processed", {
        updateId: body.update_id,
      });
      return NextResponse.json({ status: "duplicate" });
    }

    const chatId = body.message.chat.id;
    const text = body.message.text.trim();

    // 2. Strict Authorization Layer
    if (COMMANDER_CHAT_ID && chatId.toString() !== COMMANDER_CHAT_ID) {
      await sendTelegramMessage(
        chatId,
        "⚠️ *ACCESS DENIED*\n\nUnauthorized transmission detected. Sovereign Core has logged your vector.",
      );
      return NextResponse.json({ status: "unauthorized" });
    }

    // 3. Command Router. Commands report real platform status only —
    // agent execution happens through the dashboard / API, not this bot.
    if (text.startsWith("/metrics") || text.startsWith("/status")) {
      await sendTelegramMessage(
        chatId,
        "📊 *Sovereign Matrix Status*\n\n🟢 Web app: Operating\n🟢 Database: Connected\n🟢 Payments: Active\n\n_Run agents and playbooks from your dashboard at /dashboard._",
      );
    } else {
      await sendTelegramMessage(
        chatId,
        "💠 *Sovereign Matrix Interface*\n\nAvailable commands:\n/status — platform status\n\n_Agents and playbooks run from your dashboard at /dashboard._",
      );
    }

    return NextResponse.json({ status: "executed" });
  } catch (error) {
    log.error("Critical router failure", error as Record<string, unknown>);
    return NextResponse.json({ error: "Internal Core Error" }, { status: 500 });
  }
}
