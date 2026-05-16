/**
 * SOVEREIGN MATRIX — /api/events (Wave 21 — SSE event stream)
 *
 * Authenticated Server-Sent Events stream. The dashboard subscribes
 * with the React `useSovereignEvents` hook (src/hooks/) and receives
 * a live feed of every event scoped to the caller's tenant.
 *
 * Admin callers (ADMIN_USER_IDS allowlist) can request `scope=*` and
 * receive every tenant's events for cross-fleet monitoring.
 *
 * Wire format: standard SSE.
 *   event: <SovereignEventType>
 *   id: <SovereignEvent.id>
 *   data: <JSON SovereignEvent>
 *
 *   :ping
 *
 * Heartbeats every 30s so reverse proxies don't close the connection.
 *
 * Caveat (documented inline in event-bus.ts): this is single-instance
 * pub/sub. Cross-lambda fanout requires an external bus (Upstash
 * Pub/Sub or Postgres NOTIFY) — Wave 26.
 */
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin-auth";
import { subscribe } from "@/lib/event-bus";
import { startRemotePoller } from "@/lib/event-bus-fanout";
import { resolveTenantId } from "@/lib/tenant-resolver";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/events");

// SSE streams must be long-lived; bump Vercel's default 60s function
// timeout to the highest the platform allows (5min on serverless).
// The client reconnects on close, so this just bounds idle streams.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 30_000;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const wantPlatformWide = url.searchParams.get("scope") === "*";

  // Platform-wide subscriptions are admin-only — a tenant-scoped user
  // who requests scope=* would otherwise read every tenant's events.
  let subscriptionScope: string | "*" = "tenant";
  if (wantPlatformWide) {
    if (!isAdmin(userId)) {
      return new Response(JSON.stringify({ error: "scope=* requires admin" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    subscriptionScope = "*";
  } else {
    const tenantId = await resolveTenantId(userId).catch(() => null);
    if (!tenantId) {
      // No tenant context resolvable — fall back to a noop stream so
      // the client doesn't error. (Better UX than 404; the heartbeat
      // tells them the stream is alive.)
      subscriptionScope = `noop:${userId}`;
    } else {
      subscriptionScope = tenantId;
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(line: string) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(line));
        } catch {
          closed = true;
        }
      }

      // Immediately emit a stream-ready marker so the client knows the
      // connection is live; React DevTools / curl debugging surfaces it.
      send(`:open\n\n`);
      send(
        `event: stream.open\nid: 0\ndata: ${JSON.stringify({
          ok: true,
          scope: subscriptionScope,
          openedAt: new Date().toISOString(),
        })}\n\n`,
      );

      // Wave 33: cross-instance fanout. When Upstash is configured the
      // poller drains remote events into the local bus every 2s; from
      // there the existing subscribe(...) delivers them to this SSE
      // client. No-op when UPSTASH env is unset.
      const stopFanout = startRemotePoller();

      const unsubscribe = subscribe(subscriptionScope, (evt) => {
        send(
          `event: ${evt.type}\nid: ${evt.id}\ndata: ${JSON.stringify(evt)}\n\n`,
        );
      });

      const heartbeat = setInterval(() => {
        send(`:ping\n\n`);
      }, HEARTBEAT_MS);

      const onClose = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        stopFanout();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        log.info("SSE stream closed", { scope: subscriptionScope });
      };

      // Abort signal fires when the client disconnects.
      req.signal.addEventListener("abort", onClose);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no", // disable nginx buffering on self-host
    },
  });
}
