#!/usr/bin/env node
/**
 * SOVEREIGN MATRIX — Bundle Budget Script (Wave 124 + Wave 125 Turbopack).
 *
 * Asserts client-bundle size stays under budget after `npm run build`.
 *
 * Next.js 16 + Turbopack changed the manifest layout:
 *   • OLD (webpack): .next/app-build-manifest.json with per-route chunk lists
 *   • NEW (turbopack): no per-route chunk mapping in any single manifest;
 *     chunks live flat in .next/static/chunks/ with hashed names
 *
 * Wave 125 adapts: we measure the AGGREGATE client-static budget
 * (every byte the browser will fetch) plus the root-main shell. That's
 * the actual cost a visitor pays. Per-route granularity is gone but
 * the more honest metric — what the wire pays — is preserved.
 *
 * Usage:
 *   npm run build && node scripts/bundle-budget.mjs
 *   node scripts/bundle-budget.mjs --report   # print sizes, never fail
 */

import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const nextDir = join(repoRoot, ".next");
const buildManifest = join(nextDir, "build-manifest.json");
const staticChunks = join(nextDir, "static", "chunks");

const REPORT_ONLY = process.argv.includes("--report");

// All sizes are in BYTES of raw on-disk JS. Gzipped is approximately
// 3× smaller for modern minified JS bundles. Budgets here are RAW
// because that's what we can measure cheaply without re-running a
// gzip pass.
//
// Cap rationale:
//   • root-main shell — paid by EVERY visitor on first paint. Tight.
//   • total static — entire .next/static/chunks delivered cumulatively
//     across a session (each visited route adds its chunks).
//   • largest chunk — Three.js + R3F + drei load on /immersive as a
//     dynamic import. The library floor is ~750kb raw; budget 950kb
//     leaves headroom for incremental scene complexity (more uniforms,
//     post-processing passes, etc) before we should investigate.
const BUDGETS = {
  rootMainShell: 600_000, // root-main client chunks (every visitor)
  totalClientStatic: 25_000_000, // all .next/static/chunks JS combined
  immersiveCanvasChunk: 950_000, // Three.js + R3F + drei floor
};

const GZIP_RATIO = 3;

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(1)}kb`;
}
function fmtMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)}mb`;
}

if (!existsSync(buildManifest)) {
  console.error(
    `[bundle-budget] manifest not found at ${buildManifest} — run \`npm run build\` first.`,
  );
  process.exit(REPORT_ONLY ? 0 : 1);
}

const manifest = JSON.parse(readFileSync(buildManifest, "utf8"));
const rootMainFiles = manifest.rootMainFiles ?? [];

// Sum the root-main shell size (every visitor pays this).
let rootMainBytes = 0;
for (const rel of rootMainFiles) {
  const p = join(nextDir, rel);
  try {
    rootMainBytes += statSync(p).size;
  } catch {
    /* skip — file may have been tree-shaken */
  }
}

// Sum total client static chunks size + find the largest single chunk.
let totalStaticBytes = 0;
let largestChunk = { name: "", size: 0 };
if (existsSync(staticChunks)) {
  for (const entry of readdirSync(staticChunks, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".js")) {
      const p = join(staticChunks, entry.name);
      try {
        const s = statSync(p).size;
        totalStaticBytes += s;
        if (s > largestChunk.size) {
          largestChunk = { name: entry.name, size: s };
        }
      } catch {
        /* skip */
      }
    }
  }
}

const checks = [
  {
    label: "Root-main shell (every visitor)",
    raw: rootMainBytes,
    gzip: Math.round(rootMainBytes / GZIP_RATIO),
    budget: BUDGETS.rootMainShell,
  },
  {
    label: "Total client static (.js)",
    raw: totalStaticBytes,
    gzip: Math.round(totalStaticBytes / GZIP_RATIO),
    budget: BUDGETS.totalClientStatic,
  },
  {
    label: `Largest single chunk (${largestChunk.name.slice(0, 30)}…)`,
    raw: largestChunk.size,
    gzip: Math.round(largestChunk.size / GZIP_RATIO),
    budget: BUDGETS.immersiveCanvasChunk,
  },
];

console.log("\n=== Bundle Budget Report ===\n");
let breached = 0;
for (const c of checks) {
  const pct = c.budget === 0 ? "∞" : `${((c.raw / c.budget) * 100).toFixed(0)}%`;
  const overBudget = c.raw > c.budget;
  if (overBudget && !REPORT_ONLY) breached++;
  const statusLabel = overBudget ? "❌ BREACH" : "✓ ok";
  const rawHuman = c.raw >= 1024 * 1024 ? fmtMb(c.raw) : fmtKb(c.raw);
  const budgetHuman =
    c.budget >= 1024 * 1024 ? fmtMb(c.budget) : fmtKb(c.budget);
  console.log(
    `${c.label.padEnd(50)}  ${statusLabel.padEnd(10)}  raw ${rawHuman.padStart(10)}  gzip≈ ${fmtKb(c.gzip).padStart(8)}  budget ${budgetHuman.padStart(10)}  ${pct.padStart(5)}`,
  );
}

console.log("");
console.log(
  "(gzip ratio assumed 3× — actual ratios run 2.5-3.5× for modern minified JS)",
);

if (breached > 0) {
  console.error(
    `\n[bundle-budget] ${breached} check(s) over budget. Fix or raise the budget if intentional.\n`,
  );
  process.exit(1);
}

console.log("\n[bundle-budget] within budget. ✓\n");
