#!/usr/bin/env node
/**
 * SOVEREIGN MATRIX — Agent registry generator (Wave 31).
 *
 * Scans src/app/api/_agents for every folder containing a route.ts and
 * emits src/app/api/agents/registry.ts with a typed import-map. Kills
 * the 97/140 drift that's haunted the codebase since the registry was
 * first hand-rolled.
 *
 * Why a script:
 *   The "AGENT_REGISTRY" object must be a literal Record<string, () =>
 *   Promise<RouteModule>> so the Vercel serverless packer can statically
 *   trace the import paths. Dynamic import("@/app/api/_agents/" + slug)
 *   doesn't bundle on Vercel. A code-gen script gives us the static
 *   literal AND the truthful agent count in one move.
 *
 * Usage:
 *   npm run gen:registry           # write the file
 *   npm run gen:registry -- --check  # exit 1 if file is stale
 *
 * Stable output: the entries are emitted alphabetically by slug so two
 * runs over the same directory tree produce byte-identical output.
 * The header `Count:` line is always truthful.
 */

import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(__filename, "../..");
const AGENTS_DIR = join(ROOT, "src/app/api/_agents");
const OUT_FILE = join(ROOT, "src/app/api/agents/registry.ts");

function listAgentSlugs() {
  if (!existsSync(AGENTS_DIR)) {
    throw new Error(`agents directory not found: ${AGENTS_DIR}`);
  }
  const entries = readdirSync(AGENTS_DIR, { withFileTypes: true });
  const slugs = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const routePath = join(AGENTS_DIR, e.name, "route.ts");
    if (!existsSync(routePath)) continue;
    slugs.push(e.name);
  }
  // Stable lexicographic order so two runs match byte-for-byte.
  slugs.sort();
  return slugs;
}

function render(slugs) {
  const banner = `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Produced by scripts/generate-agent-registry.mjs from the on-disk
 * agent routes at src/app/api/_agents/<slug>/route.ts. Every agent
 * with a route.ts is bundled here so Vercel's serverless packer can
 * statically trace the import paths.
 *
 * Regenerate: npm run gen:registry
 * Verify:     npm run gen:registry -- --check (exit 1 if stale)
 *
 * Count: ${slugs.length} agents
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type RouteModule = Record<string, any>;

export const AGENT_REGISTRY: Record<string, () => Promise<RouteModule>> = {
`;
  const body = slugs
    .map((slug) => `  ${JSON.stringify(slug)}: () => import("@/app/api/_agents/${slug}/route"),\n`)
    .join("");
  const footer = `};

export const AGENT_SLUGS: readonly string[] = Object.freeze(
  Object.keys(AGENT_REGISTRY),
);
`;
  return banner + body + footer;
}

function main() {
  const slugs = listAgentSlugs();
  const next = render(slugs);

  const checkMode = process.argv.includes("--check");
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, "utf8") : "";

  if (checkMode) {
    if (current !== next) {
      process.stderr.write(
        `registry is stale (${slugs.length} agents on disk, file out of date).\n` +
          `Run: npm run gen:registry\n`,
      );
      process.exit(1);
    }
    process.stdout.write(`registry up to date — ${slugs.length} agents\n`);
    return;
  }

  if (current === next) {
    process.stdout.write(`registry unchanged — ${slugs.length} agents\n`);
    return;
  }

  writeFileSync(OUT_FILE, next, "utf8");
  process.stdout.write(`wrote ${OUT_FILE} — ${slugs.length} agents\n`);
}

main();
