// k6 load test — /api/health/ping baseline.
//
// Validates that the cheapest path on the platform responds quickly
// under sustained load. Vercel cron pings this every 4 minutes; this
// script ramps to 100 concurrent VUs to verify the response stays
// under 500ms p95 + 0% error rate.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://sovereignmatrix.agency";

export const options = {
  stages: [
    { duration: "30s", target: 20 },   // ramp to 20 VUs
    { duration: "60s", target: 100 },  // hold at 100 VUs for 1 min
    { duration: "30s", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health/ping`);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "responds in under 500ms": (r) => r.timings.duration < 500,
  });
  sleep(0.5);
}
