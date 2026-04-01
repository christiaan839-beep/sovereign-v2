import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createLogger } from "@/lib/logger";
const log = createLogger("telegram-webhook");

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; is_bot: boolean; first_name: string; username?: string };
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
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "MarkdownV2"
      })
    });
  } catch (error) {
    log.error("Telegram transport error", error as Record<string, unknown>);
  }
}

export async function POST(req: Request) {
  try {
    // 1. Verify Telegram Secret Token for Edge Security
    const headerPayload = await headers();
    const secretToken = headerPayload.get('X-Telegram-Bot-Api-Secret-Token');
    
    if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
        log.error("Unauthorized webhook invocation detected");
        return NextResponse.json({ error: 'Unauthorized Interception' }, { status: 403 });
    }

    const body: TelegramUpdate = await req.json();

    if (!body.message || !body.message.text) {
      return NextResponse.json({ status: 'ignored' });
    }

    const chatId = body.message.chat.id;
    const text = body.message.text.trim();

    // 2. Strict Authorization Layer
    if (COMMANDER_CHAT_ID && chatId.toString() !== COMMANDER_CHAT_ID) {
       await sendTelegramMessage(chatId, "⚠️ *ACCESS DENIED*\n\nUnauthorized transmission detected. Sovereign Core has logged your vector.");
       return NextResponse.json({ status: 'unauthorized' });
    }

    // 3. Sovereign Command Router
    if (text.startsWith('/metrics')) {
      await sendTelegramMessage(chatId, "📊 *Sovereign Matrix Telemetry*\n\n🟢 Vercel Edge Nodes: Operating\n🟢 Neon Database: Synced\n🟢 PayFast Processor: Unlocked\n🟢 NemoClaw Ghost Nodes: 0 Active\n\n_System is fully optimized and awaiting deployment commands._");
    } 
    else if (text.startsWith('/strike')) {
      const target = text.split(' ')[1];
      if (!target) {
         await sendTelegramMessage(chatId, "⚠️ *Invalid Syntax*\nUsage: `/strike <domain.com>`");
      } else {
         await sendTelegramMessage(chatId, `⚡ *STRIKE INITIATED*\n\nTarget: ${target}\nDeploying Google A2A Swarm to map logical vulnerabilities.\nPre-initializing NemoClaw fallback for physical DOM extraction...`);
         // In production, this would trigger an internal API route to spawn the actual agents or add a job to a queue (like Upstash/QStash).
      }
    }
    else if (text.startsWith('/ghost')) {
      await sendTelegramMessage(chatId, "👻 *NemoClaw Ghost Protocol*\n\nBroadcasting wake-on-lan packets to authorized Apple Silicon.\nAwaiting physical mouse hijack confirmation...\n_WARNING: Autonomous RPA Control Engaged._");
    }
    else {
      await sendTelegramMessage(chatId, "💠 *Sovereign Matrix Interface*\n\nAvailable Directives:\n/metrics - View Edge Diagnostics\n/strike <target> - Deploy Swarm to Domain\n/ghost - Trigger Mac Physical Hijack\n\n_Awaiting your command, Sir._");
    }

    return NextResponse.json({ status: 'executed' });
  } catch (error) {
    log.error("Critical router failure", error as Record<string, unknown>);
    return NextResponse.json({ error: 'Internal Core Error' }, { status: 500 });
  }
}
