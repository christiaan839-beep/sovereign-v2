/**
 * Tests for src/lib/with-timeout.ts — Wave 24.
 *
 * Hermetic — no real network. Exercises every TimeoutResult branch
 * plus the abort-forwarding behavior.
 */
import { describe, it, expect, vi } from "vitest";
import { withTimeout, safeFetch } from "@/lib/with-timeout";

describe("withTimeout", () => {
  it("returns ok=true when the work resolves before the deadline", async () => {
    const r = await withTimeout(async () => "hello", { ms: 1000 });
    expect(r).toEqual({ ok: true, value: "hello" });
  });

  it("returns reason='timeout' when the work outruns the deadline", async () => {
    const r = await withTimeout(
      (signal) =>
        new Promise<string>((_resolve, reject) => {
          // Reject only when the signal aborts — that's what real fetch does.
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
      { ms: 20 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("timeout");
  });

  it("returns reason='error' when the work throws (not via abort)", async () => {
    const r = await withTimeout(
      async () => {
        throw new Error("boom");
      },
      { ms: 1000 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("error");
      expect(r.error).toBeInstanceOf(Error);
    }
  });

  it("returns reason='aborted' when the caller's signal aborts", async () => {
    const callerCtl = new AbortController();
    const promise = withTimeout(
      (signal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
      { ms: 1000, signal: callerCtl.signal },
    );
    // Abort externally before the deadline.
    setTimeout(() => callerCtl.abort(), 5);
    const r = await promise;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("aborted");
  });

  it("clamps ms to the hard 60s ceiling — extreme values don't hang", async () => {
    // Just confirm the call accepts huge values and still returns
    // on a fast resolution (the clamp itself is unobservable here).
    const r = await withTimeout(async () => "ok", { ms: 999_999_999 });
    expect(r).toEqual({ ok: true, value: "ok" });
  });

  it("supports the label option for SRE log correlation", async () => {
    // The label is purely a logging concern; we exercise the path
    // to make sure it doesn't break anything.
    const r = await withTimeout(async () => 42, {
      ms: 100,
      label: "my-call",
    });
    expect(r.ok).toBe(true);
  });
});

describe("safeFetch", () => {
  it("wraps a successful fetch in ok=true", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(
      async () => new Response("hello", { status: 200 }),
    ) as unknown as typeof fetch;
    try {
      const r = await safeFetch("https://example.com");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.status).toBe(200);
        expect(await r.value.text()).toBe("hello");
      }
    } finally {
      globalThis.fetch = original;
    }
  });

  it("returns reason='timeout' when the upstream hangs past ms", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal!.reason),
          );
        }),
    ) as unknown as typeof fetch;
    try {
      const r = await safeFetch("https://example.com", { ms: 25 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("timeout");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("surfaces a network failure as reason='error'", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    try {
      const r = await safeFetch("https://example.com");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("error");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("non-2xx response is ok=true (still need to inspect status)", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(
      async () => new Response("err", { status: 500 }),
    ) as unknown as typeof fetch;
    try {
      const r = await safeFetch("https://example.com");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.status).toBe(500);
    } finally {
      globalThis.fetch = original;
    }
  });
});
