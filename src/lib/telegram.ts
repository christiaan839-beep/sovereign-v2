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
// Default brand voice. Override per-deploy by editing the message
// bodies — these strings are what Telegram users see when async
// jobs change state.

export function formatJobStarted(goal: string, jobId: string): string {
  // jobId is a UUID — show the last 8 chars for readability.
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
  // Includes the job result summary, duration, and which agents
  // contributed. The dashboard URL gives the operator a one-tap
  // path back to the full result transcript.
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
  // Surfaces the error verbatim. Truncate at the call site if the
  // upstream error message is unbounded.
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
