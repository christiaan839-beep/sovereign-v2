/**
 * GET /api/admin/activity-stream[?agent=<name>]
 *
 * Server-Sent-Events stream of live agent activity ticks — every
 * signed agent_run pushes one event. Admin-gated. Replays the last
 * 32 matching ticks on connect so the war-room loads with history.
 *
 * Wire-format: standard `text/event-stream`, one JSON line per event,
 * named "tick" — consumer:
 *   const es = new EventSource("/api/admin/activity-stream");
 *   es.addEventListener("tick", e => JSON.parse(e.data));
 *
 * Also emits a "stats" event every 5 seconds with the global
 * counters so a stale connection still looks alive in the dashboard.
 *
 * Connection is bounded — closed after 10 minutes server-side so
 * a stale tab doesn't pin the function indefinitely. Clients are
 * expected to reconnect (EventSource does this automatically).
 */
import { auth, clerkClient } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { subscribeTicks, getActivityStats } from "@/lib/agent-activity-bus";

const log = createLogger("admin-activity-stream");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const limiter = rateLimit({ interval: 60, limit: 12 });

const MAX_STREAM_MS = 10 * 60 * 1000;
const STATS_INTERVAL_MS = 5_000;

async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    return ADMIN_EMAILS.has(email);
  } catch (err) {
    log.warn("admin check failed", { error: String(err) });
    return false;
  }
}

function sseFrame(eventName: string, data: unknown): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${eventName}\ndata: ${payload}\n\n`;
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ error: "admin-only" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const agentFilter = url.searchParams.get("agent")?.trim() || null;
  const abort = new AbortController();
  // Hook the request signal so client disconnect closes the stream
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const writeFrame = (frame: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          closed = true;
        }
      };

      // Initial hello + first stats snapshot
      writeFrame(sseFrame("hello", { connectedAt: new Date().toISOString() }));
      writeFrame(sseFrame("stats", getActivityStats()));

      // Server-bounded duration
      const hardCloseTimer = setTimeout(() => {
        writeFrame(sseFrame("bye", { reason: "max-duration" }));
        abort.abort();
      }, MAX_STREAM_MS);

      // Periodic stats heartbeat (also keeps connection alive)
      const statsInterval = setInterval(() => {
        writeFrame(sseFrame("stats", getActivityStats()));
      }, STATS_INTERVAL_MS);

      const sub = subscribeTicks({
        agentFilter,
        signal: abort.signal,
        replay: 32,
      });

      try {
        for await (const tick of sub) {
          if (closed || abort.signal.aborted) break;
          writeFrame(sseFrame("tick", tick));
        }
      } catch (err) {
        log.warn("stream loop threw", { error: String(err) });
      } finally {
        clearTimeout(hardCloseTimer);
        clearInterval(statsInterval);
        sub.close();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        closed = true;
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
