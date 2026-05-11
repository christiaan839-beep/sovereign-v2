/**
 * SOVEREIGN TELEGRAM — Shared notification layer
 * Used by the async job runner to push results directly to your Telegram.
 */

export async function sendTelegram(
  chatId: string,
  text: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Message Formatters ──────────────────────────────────────────────────────
// Customize the strings below to match your brand voice.
// These control exactly what Telegram messages look like when jobs complete.

export function formatJobStarted(goal: string, jobId: string): string {
  const shortId = jobId.slice(-8);
  return [
    `⚡ *Job queued* \`${shortId}\``,
    ``,
    `*Goal:* ${goal}`,
    ``,
    `I'll notify you when it's done.`,
  ].join("\n");
}

export function formatJobDone(
  goal: string,
  jobId: string,
  durationMs: number,
  agentsUsed: string[],
): string {
  const shortId = jobId.slice(-8);
  const seconds = (durationMs / 1000).toFixed(1);
  const agentList = agentsUsed.length ? agentsUsed.join(", ") : "auto";
  return [
    `✅ *Job complete* \`${shortId}\``,
    ``,
    `*Goal:* ${goal}`,
    `*Agents:* ${agentList}`,
    `*Time:* ${seconds}s`,
    ``,
    `View results at /dashboard/results`,
  ].join("\n");
}

export function formatJobFailed(
  goal: string,
  jobId: string,
  error: string,
): string {
  const shortId = jobId.slice(-8);
  return [
    `❌ *Job failed* \`${shortId}\``,
    ``,
    `*Goal:* ${goal}`,
    `*Error:* ${error}`,
    ``,
    `Try again at /dashboard`,
  ].join("\n");
}
