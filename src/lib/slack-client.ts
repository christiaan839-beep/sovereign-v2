import { db } from "@/db";
import { oauthConnections } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { safeDecrypt } from "@/lib/crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("slack-client");

/**
 * Per-user Slack client.
 *
 * Usage in an agent:
 *   const slack = await slackClient(userId);
 *   if (!slack) throw new Error("User has not connected Slack");
 *   await slack.postMessage({ channel: "#sales", text: "Lead qualified!" });
 *
 * Handles:
 *   - DB lookup of the user's active Slack OAuth connection
 *   - Decryption of the access token at call time (plaintext never logged)
 *   - 401 "invalid_auth" → marks connection revoked so the UI can prompt
 *     the user to reconnect
 *   - 429 rate-limit with Retry-After — surfaces a typed error
 */

export interface SlackClient {
  workspaceId: string;
  workspaceName: string;
  postMessage(params: { channel: string; text: string; blocks?: unknown[] }): Promise<{ ok: true; ts: string; channel: string }>;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
}

export async function slackClient(userId: string): Promise<SlackClient | null> {
  const [row] = await db
    .select({
      workspaceId: oauthConnections.workspaceId,
      workspaceName: oauthConnections.workspaceName,
      accessToken: oauthConnections.accessToken,
      id: oauthConnections.id,
    })
    .from(oauthConnections)
    .where(and(
      eq(oauthConnections.userId, userId),
      eq(oauthConnections.provider, "slack"),
      isNull(oauthConnections.revokedAt),
    ))
    .limit(1);

  if (!row) return null;

  // Decrypt ONLY in the request scope. Never stored back, never logged.
  const accessToken = safeDecrypt(row.accessToken);

  async function call<T = SlackApiResponse>(method: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const retry = res.headers.get("retry-after") ?? "60";
      const err = new Error(`Slack rate-limited; retry after ${retry}s`);
      (err as unknown as { code: string; retryAfter: number }).code = "SLACK_RATE_LIMIT";
      (err as unknown as { code: string; retryAfter: number }).retryAfter = Number(retry);
      throw err;
    }

    const data = (await res.json()) as SlackApiResponse;

    // Slack returns 200 with ok:false on logical errors (invalid token,
    // channel_not_found, etc). invalid_auth means the user revoked from
    // Slack's side or the token was wiped.
    if (!data.ok && data.error === "invalid_auth") {
      await db.update(oauthConnections)
        .set({ revokedAt: new Date() })
        .where(eq(oauthConnections.id, row.id));
      log.warn("Slack token invalid — connection marked revoked", { userId, workspaceId: row.workspaceId });
    }

    if (!data.ok) {
      throw new Error(`Slack ${method} failed: ${data.error ?? "unknown"}`);
    }

    return data as T;
  }

  return {
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName ?? "Slack Workspace",
    async postMessage({ channel, text, blocks }) {
      const body: Record<string, unknown> = { channel, text };
      if (blocks) body.blocks = blocks;
      const res = await call<SlackApiResponse>("chat.postMessage", body);
      if (!res.ts || !res.channel) throw new Error("Slack postMessage returned no ts/channel");
      return { ok: true, ts: res.ts, channel: res.channel };
    },
  };
}
