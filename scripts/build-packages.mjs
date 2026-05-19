#!/usr/bin/env node
/**
 * Build all wrapper/exporter workspace packages in dependency order.
 *
 * Why this exists:
 *   - verifiable-receipts has its own `prepare` script that builds dist/
 *     during npm install (no workspace deps, so it can self-build).
 *   - The 6 wrapper/exporter packages depend on verifiable-receipts at
 *     compile time, so they can't safely use a prepare script — npm's
 *     workspace install doesn't guarantee verifiable-receipts is built
 *     before they try to resolve its types.
 *   - This script runs AFTER `npm install` (wired in vercel.json's
 *     installCommand) so verifiable-receipts/dist already exists.
 *
 * Idempotent — skips packages that already have a fresh dist/.
 *
 * Cross-platform — pure Node, no shell-isms.
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const PACKAGES = [
  "openai-receipts",
  "anthropic-receipts",
  "google-receipts",
  "ai-sdk-receipts",
  "annex-iv",
  "iso-42001",
  "nist-ai-rmf",
  "soc2-evidence",
  "mcp",
];

function newestMtime(dir) {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtime(full));
    } else {
      const mtime = statSync(full).mtimeMs;
      if (mtime > newest) newest = mtime;
    }
  }
  return newest;
}

let built = 0;
let skipped = 0;

for (const pkg of PACKAGES) {
  const pkgDir = join(repoRoot, "packages", pkg);
  if (!existsSync(join(pkgDir, "package.json"))) {
    console.error(`  ✗ ${pkg}: no package.json — skipping`);
    continue;
  }

  const srcDir = join(pkgDir, "src");
  const distDir = join(pkgDir, "dist");

  // Skip if dist/index.js is newer than every src/ file.
  if (existsSync(join(distDir, "index.js"))) {
    const srcNewest = newestMtime(srcDir);
    const distNewest = newestMtime(distDir);
    if (distNewest >= srcNewest) {
      console.log(`  ⏭  ${pkg}: dist is up to date`);
      skipped++;
      continue;
    }
  }

  console.log(`  → ${pkg}: building`);
  try {
    execFileSync("npx", ["tsc", "-p", "tsconfig.json"], {
      cwd: pkgDir,
      stdio: "inherit",
    });
    built++;
  } catch (err) {
    console.error(`  ✗ ${pkg}: tsc failed`);
    throw err;
  }
}

console.log(`\nDone. Built ${built}, skipped ${skipped} (already up to date).`);
