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
