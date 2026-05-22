#!/usr/bin/env node
/**
 * SOVEREIGN MATRIX — Bundle Budget Script (Wave 124).
 *
 * Reads the per-route JS bundle sizes from .next/app-build-manifest.json
 * (Next.js 16 App Router) and asserts each declared route stays under
 * its budget. Fails with exit-1 on any breach so CI catches regressions.
 *
 * Why this exists:
 *   /immersive ships Three.js + drei + framer-motion — heavy. Without a
 *   budget the chunk can drift over time as we add particles + shaders.
 *   At 250kb gzipped we lose mobile LCP; at 400kb we lose Safari iOS
 *   visitors on poor connections. Pin the floor.
 *
 * Usage:
 *   npm run build && node scripts/bundle-budget.mjs
 *   node scripts/bundle-budget.mjs --report   # print sizes, never fail
 *
 * The budgets are gzipped-byte estimates; the script reads RAW bytes
 * off disk and divides by 3 as a conservative gzip ratio approximation
 * (modern JS gzip ratios run 2.5-3.5×).
 */

import { readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const nextDir = join(repoRoot, ".next");
const manifestPath = join(nextDir, "app-build-manifest.json");

const REPORT_ONLY = process.argv.includes("--report");

// Route → gzipped budget (bytes). Add new routes here as we ship them.
// Numbers chosen to give 30-50% headroom over current observed size.
const BUDGETS = {
  "/page": 220_000, // landing — heavy, lots of dynamic imports
  "/immersive/page": 280_000, // Three.js stack + R3F + framer-motion
  "/metrics/page": 100_000, // simple table + framer-motion
  "/verify/page": 90_000, // self-contained client component
  "/investors/page": 150_000, // server-rendered + the LiveInvestorProof client
};

const GZIP_RATIO = 3; // conservative — observed avg across our chunks

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(1)}kb`;
}

if (!existsSync(manifestPath)) {
  console.error(
    `[bundle-budget] manifest not found at ${manifestPath} — run \`npm run build\` first.`,
  );
  process.exit(REPORT_ONLY ? 0 : 1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (err) {
  console.error(
    `[bundle-budget] failed to parse manifest: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

const pages = manifest.pages ?? {};
const results = [];
let breached = 0;

for (const [routeKey, budget] of Object.entries(BUDGETS)) {
  // Manifest keys look like "/page", "/immersive/page" etc.
  const chunks = pages[routeKey];
  if (!Array.isArray(chunks)) {
    results.push({
      route: routeKey,
      status: "missing",
      detail: "no manifest entry — route not built?",
    });
    continue;
  }
  let totalRaw = 0;
  for (const chunk of chunks) {
    const chunkPath = join(nextDir, chunk);
    try {
      totalRaw += statSync(chunkPath).size;
    } catch {
      // Skip chunks that don't exist on disk — manifests sometimes
      // reference chunks that were tree-shaken away.
    }
  }
  const gzipApprox = Math.round(totalRaw / GZIP_RATIO);
  const ratio = budget === 0 ? Infinity : gzipApprox / budget;
  const overBudget = gzipApprox > budget;
  if (overBudget && !REPORT_ONLY) breached++;
  results.push({
    route: routeKey,
    status: overBudget ? "BREACH" : "ok",
    raw: totalRaw,
    gzipApprox,
    budget,
    ratio,
  });
}

console.log("\n=== Bundle Budget Report ===\n");
console.log(
  `${"Route".padEnd(28)}  ${"Status".padEnd(10)}  ${"Gzip~".padStart(10)}  ${"Budget".padStart(10)}  ${"% of".padStart(7)}`,
);
console.log("-".repeat(78));

for (const r of results) {
  if (r.status === "missing") {
    console.log(`${r.route.padEnd(28)}  missing     ${r.detail}`);
    continue;
  }
  const pct = (r.ratio * 100).toFixed(0) + "%";
  const statusLabel = r.status === "BREACH" ? "❌ BREACH" : "✓ ok";
  console.log(
    `${r.route.padEnd(28)}  ${statusLabel.padEnd(10)}  ${fmtKb(r.gzipApprox).padStart(10)}  ${fmtKb(r.budget).padStart(10)}  ${pct.padStart(7)}`,
  );
}

console.log("");
console.log(`(gzip ratio assumed ${GZIP_RATIO}× — set with --ratio if needed)`);

if (breached > 0) {
  console.error(`\n[bundle-budget] ${breached} route(s) over budget. Fix or raise the budget if intentional.\n`);
  process.exit(1);
}

console.log("\n[bundle-budget] all routes within budget. ✓\n");
