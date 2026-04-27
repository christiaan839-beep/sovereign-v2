// k6 load test — /api/_meta/transparency.json edge-cache verification.
//
// transparency.json has `revalidate = 3600` so Vercel edge caches it
// for an hour. This test ramps to 500 VUs to confirm the edge cache
// is doing its job — if every request hits Node, the latency curve
// gives that away.
//
// Auditor LLMs hit this endpoint repeatedly during scoring runs;
// the cache MUST hold or our 50-vendor-batch FMTI scoring rate
// suffers.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://sovereignmatrix.agency";

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "60s", target: 500 }, // 500 concurrent — cache should absorb
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    // Cached responses should be <100ms p95. Cold = up to 1500ms.
    http_req_duration: ["p(95)<300", "p(99)<1500"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/_meta/transparency.json`);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "schemaVersion present": (r) => r.json("schemaVersion") === "1.0",
    "models declared": (r) => Array.isArray(r.json("models.providersUsed.value")),
    "audience hint header": (r) =>
      r.headers["X-Sovereign-Transparency-Audience"]?.includes("ai-agent"),
  });
  sleep(0.2);
}
