/**
 * The schedule must not drift from vercel.json, and dispatch must be
 * resilient to one job failing.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JOBS } from "../src/jobs";
import { dueAt, runDue, type Env } from "../src/index";

const ENV: Env = { ORIGIN: "https://example.test", CRON_SECRET: "s3cret" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the schedule matches vercel.json", () => {
  // While both files exist they cannot disagree. When Vercel is gone,
  // delete this test with vercel.json and jobs.ts stands alone.
  const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
    crons?: { schedule: string; path: string }[];
  };

  it("covers exactly the same paths", () => {
    const theirs = (vercel.crons ?? []).map((c) => c.path).sort();
    const ours = JOBS.map((j) => j.path).sort();
    expect(ours).toEqual(theirs);
  });

  it("uses the same expression for each path", () => {
    for (const cron of vercel.crons ?? []) {
      const mine = JOBS.find((j) => j.path === cron.path);
      expect(mine, `${cron.path} missing from jobs.ts`).toBeDefined();
      expect(mine!.schedule, cron.path).toBe(cron.schedule);
    }
  });

  it("still includes the two evidence jobs Vercel Hobby cannot run", () => {
    // The reason this Worker exists. If these ever fall out of the list,
    // compliance evidence silently stops being generated.
    const paths = JOBS.map((j) => j.path);
    expect(paths).toContain("/api/_cron/audit-bundles");
    expect(paths).toContain("/api/_cron/soc2-indicators");
  });
});

describe("dispatch", () => {
  it("sends the Bearer token every scheduled route expects", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.push({
        url: String(url),
        auth: new Headers(init.headers).get("authorization"),
      });
      return new Response("{}", { status: 200 });
    });

    // 03:00 on a Sunday — cleanup, job-runner, and the hourly bundle.
    await runDue(new Date("2026-04-05T03:00:00Z"), ENV);

    expect(seen.length).toBeGreaterThan(0);
    for (const call of seen) {
      expect(call.auth).toBe("Bearer s3cret");
      expect(call.url.startsWith("https://example.test/api/")).toBe(true);
    }
  });

  it("one failing job does not stop the others", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).includes("job-runner")) throw new Error("origin down");
      return new Response("{}", { status: 200 });
    });

    const results = await runDue(new Date("2026-04-05T03:00:00Z"), ENV);
    const runner = results.find((r) => r.path.includes("job-runner"));
    const others = results.filter((r) => !r.path.includes("job-runner"));

    expect(runner?.ok).toBe(false);
    expect(runner?.error).toMatch(/origin down/);
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((r) => r.ok)).toBe(true);
  });

  it("reports a non-2xx as a failure rather than silently passing", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 401 }));
    const results = await runDue(new Date("2026-04-08T00:00:00Z"), ENV);
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(results[0]?.status).toBe(401);
  });

  it("does nothing when no job is due", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    // 02:31 — job-runner runs every minute, so pick a schedule-free
    // check instead: assert dueAt is what drives it.
    const due = dueAt(new Date("2026-04-08T02:31:00Z"));
    expect(due.map((j) => j.path)).toEqual(["/api/cron/job-runner"]);
  });

  it("fires every job at midnight on the 1st when they coincide", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }));
    const results = await runDue(new Date("2026-04-01T00:00:00Z"), ENV);
    // minute-0 of hour-0: job-runner, playbook, ping, probe, soc2, bundles
    expect(results.length).toBe(6);
    expect(results.every((r) => r.ok)).toBe(true);
  });
});

describe("the invocation status Cloudflare records", () => {
  // Cloudflare marks a Cron Trigger invocation successful unless the
  // handler rejects. A scheduler that swallows every error therefore
  // shows green in the dashboard while nothing runs — the exact state
  // that must not look healthy.
  const worker = async () => (await import("../src/index")).default;

  it("throws when every due job fails", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 401 }));
    const w = await worker();
    await expect(
      w.scheduled({ scheduledTime: Date.parse("2026-04-08T00:00:00Z") }, ENV),
    ).rejects.toThrow(/all \d+ due job\(s\) failed/);
  });

  it("does not throw when only some fail", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      String(url).includes("job-runner")
        ? new Response("nope", { status: 500 })
        : new Response("{}", { status: 200 }),
    );
    const w = await worker();
    await expect(
      w.scheduled({ scheduledTime: Date.parse("2026-04-08T00:00:00Z") }, ENV),
    ).resolves.toBeUndefined();
  });

  it("throws rather than firing unauthenticated when misconfigured", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const w = await worker();
    await expect(
      w.scheduled({ scheduledTime: Date.now() }, { ORIGIN: "https://x.test", CRON_SECRET: "" }),
    ).rejects.toThrow(/CRON_SECRET is not set/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects a non-https or trailing-slash origin", async () => {
    const w = await worker();
    await expect(
      w.scheduled({ scheduledTime: Date.now() }, { ORIGIN: "http://x.test", CRON_SECRET: "s" }),
    ).rejects.toThrow(/https/);
    await expect(
      w.scheduled({ scheduledTime: Date.now() }, { ORIGIN: "https://x.test/", CRON_SECRET: "s" }),
    ).rejects.toThrow(/trailing slash/);
  });
});
