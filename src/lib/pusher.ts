/**
 * Pusher stub — realtime not active.
 * Provides the same API shape as the real Pusher client
 * so TelemetryProvider doesn't crash.
 */
const noop = (...args: unknown[]) => {};
const noopChannel = { bind: noop, unbind: noop, unbind_all: noop };

export const pusherClient = {
  connection: {
    bind: noop,
    unbind: noop,
    unbind_all: noop,
    state: "disconnected" as string,
  },
  subscribe: (...args: unknown[]) => noopChannel,
  unsubscribe: noop,
  unbind_all: noop,
};
