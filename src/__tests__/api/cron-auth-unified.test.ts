/**
 * Every scheduled route authenticates the same way.
 *
 * Why this exists: `cron/*` used `requireCronAuth` (an
 * `Authorization: Bearer $CRON_SECRET` header) while `_cron/*` checked a
 * raw `x-cron-secret` header inline. Same secret, two headers. A
 * scheduler configured with the standard Bearer — which is what both
 * Vercel's own cron invoker and every external scheduler send — got 401
 * from exactly two routes and no others.
 *
 * Those two were `_cron/audit-bundles` and `_cron/soc2-indicators`: the
 * evidence-generating jobs. A silent 401 on those is the failure mode
 * least likely to be noticed and most expensive to have missed, because
 * the product's whole claim is that the evidence exists.
 *
 * This pins the unification. It asserts the shape of the auth contract,
 * not the handlers' business logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const SECRET = "test-cron-secret";
const ROUTES = [
  { name: "_cron/audit-bundles", load: () => import("@/app/api/_cron/audit-bundles/route") },
  { name: "_cron/soc2-indicators", load: () => import("@/app/api/_cron/soc2-indicators/route") },
  // Added later: this one was missed by the first unification and kept
  // reading a raw `x-cron-secret` header. It is the job that anchors the
  // audit log to Bitcoin, so it 401'ing silently is the failure nobody
  // notices until an auditor asks for the anchor.
  { name: "cron/audit-log-anchor", load: () => import("@/app/api/cron/audit-log-anchor/route") },
] as const;

const req = (headers: Record<string, string>) =>
  new Request("https://sovereignmatrix.agency/api/_cron/x", { headers });

describe("scheduled routes share one auth contract", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  for (const route of ROUTES) {
    describe(route.name, () => {
      it("accepts the standard Authorization: Bearer header", async () => {
        const { GET } = await route.load();
        const res = await GET(req({ authorization: `Bearer ${SECRET}` }));
        // Past the auth gate. The handler may still fail downstream on
        // missing config — what matters here is that it is not a 401.
        expect(res.status).not.toBe(401);
      });

      it("rejects a request with no credentials", async () => {
        const { GET } = await route.load();
        expect((await GET(req({}))).status).toBe(401);
      });

      it("rejects the wrong secret", async () => {
        const { GET } = await route.load();
        expect((await GET(req({ authorization: "Bearer wrong" }))).status).toBe(401);
      });

      it("rejects the retired x-cron-secret header", async () => {
        // Not a regression — a deliberate narrowing. If a scheduler is
        // still configured with the old header this fails loudly rather
        // than silently, which is the point.
        const { GET } = await route.load();
        expect((await GET(req({ "x-cron-secret": SECRET }))).status).toBe(401);
      });

      it('rejects the literal string "Bearer undefined"', async () => {
        // The bypass requireCronAuth was written to prevent: naive code
        // interpolates an unset secret into "Bearer undefined", which an
        // attacker can simply send.
        const { GET } = await route.load();
        expect((await GET(req({ authorization: "Bearer undefined" }))).status).toBe(401);
      });

      it("fails closed with 503 when CRON_SECRET is unset", async () => {
        delete process.env.CRON_SECRET;
        vi.resetModules();
        const { GET } = await route.load();
        const res = await GET(req({ authorization: "Bearer undefined" }));
        expect(res.status).toBe(503);
        expect(res.status).not.toBe(200);
      });
    });
  }
});

describe("no scheduled route reads a raw cron header", () => {
  // The per-route tests above only cover routes someone remembered to
  // list. This reads vercel.json — the actual schedule — and checks every
  // route it names. `audit-log-anchor` was missed by the first
  // unification precisely because nothing enumerated the schedule.
  it("every path in vercel.json uses requireCronAuth", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");

    const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons?: { path: string }[];
    };
    const offenders: string[] = [];

    for (const cron of vercel.crons ?? []) {
      const file = join(process.cwd(), "src", "app", cron.path.replace(/^\//, ""), "route.ts");
      if (!existsSync(file)) {
        offenders.push(`${cron.path} — no route.ts at ${file}`);
        continue;
      }
      const src = readFileSync(file, "utf8");

      // /api/health/ping is deliberately open: it is a liveness probe and
      // is meant to answer an unauthenticated GET.
      if (cron.path === "/api/health/ping") continue;

      if (/headers\.get\(\s*["'`]x-cron-secret/.test(src)) {
        offenders.push(`${cron.path} reads the retired x-cron-secret header`);
      }
      if (!/requireCronAuth/.test(src)) {
        offenders.push(`${cron.path} does not call requireCronAuth`);
      }
    }

    expect(offenders, `\n${offenders.join("\n")}\n`).toEqual([]);
  });
});
