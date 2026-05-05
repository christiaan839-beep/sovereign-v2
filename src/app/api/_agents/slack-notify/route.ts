import { createAgentRoute } from "@/lib/agent-factory";

/**
 * Slack notify — posts a message to a configured Slack incoming webhook.
 * Listed in `src/app/api/agents/registry.ts` so the dynamic dispatcher
 * resolves. Real workspace OAuth lives in `oauth_connections` (see
 * `src/db/schema.ts:401`); this stub uses the simpler webhook URL.
 */
export const POST = createAgentRoute({
  name: "slack-notify",
  handler: async ({ input }) => {
    const { text, webhookUrl } = (input ?? {}) as {
      text?: string;
      webhookUrl?: string;
    };
    if (!text) return { error: "`text` is required." };
    const url = webhookUrl ?? process.env.SLACK_WEBHOOK_URL;
    if (!url) {
      return { error: "Provide `webhookUrl` or set SLACK_WEBHOOK_URL." };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      return { error: `Slack rejected: ${res.status}` };
    }
    return { ok: true };
  },
});
