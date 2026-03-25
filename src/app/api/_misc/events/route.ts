import { NextResponse } from 'next/server';
import { eventBus } from '@/lib/events';

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // 1. Connection established event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'SSE Stream ready' })}\n\n`));

      // 2. Broadcast listener
      const listener = (event: Event) => {
        const customEvent = event as CustomEvent;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(customEvent.detail)}\n\n`));
      };

      eventBus.addEventListener('swarm-event', listener);

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 15000);

      // Clean up on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        eventBus.removeEventListener('swarm-event', listener);
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
