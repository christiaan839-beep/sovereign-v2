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
// The client-safe slug list. It carries its own copy of the slugs because
// importing registry.ts from a "use client" component drags every agent
// route into the client bundle. That copy drifted to 136 slugs against a
// 140-agent registry — four agents with working routes were invisible on
// /agents, /marketplace, /api/agents and the OpenAPI spec, because the
// file claimed to be generated but nothing generated it. Now it is.
const SLUGS_FILE = join(ROOT, "src/lib/agent-slugs.ts");

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

function renderSlugs(slugs) {
  const banner = `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * AGENT_SLUGS — client-safe list of agent identifiers.
 *
 * The full registry at src/app/api/agents/registry.ts maps slugs to dynamic
 * route imports. Importing that map from a "use client" component drags every
 * agent route into the client bundle (Turbopack statically analyses the
 * dynamic import arms and pulls Node-only code like fs/path through transitive
 * \`persist.ts\` / \`pinecone\` deps). This file is a pure data array — safe to
 * import anywhere.
 *
 * Regenerate: npm run gen:registry
 * Verify:     npm run gen:registry -- --check (exit 1 if stale)
 *
 * Count: ${slugs.length} agents
 */

export const AGENT_SLUGS: ReadonlyArray<string> = Object.freeze([
`;
  const body = slugs.map((slug) => `  ${JSON.stringify(slug)},\n`).join("");
  const footer = `]);

export const AGENT_SLUG_SET: ReadonlySet<string> = new Set(AGENT_SLUGS);
`;
  return banner + body + footer;
}

function main() {
  const slugs = listAgentSlugs();
  const targets = [
    { file: OUT_FILE, next: render(slugs), label: "registry" },
    { file: SLUGS_FILE, next: renderSlugs(slugs), label: "slug list" },
  ];

  const checkMode = process.argv.includes("--check");

  if (checkMode) {
    const stale = targets.filter(
      (t) => (existsSync(t.file) ? readFileSync(t.file, "utf8") : "") !== t.next,
    );
    if (stale.length > 0) {
      process.stderr.write(
        `${stale.map((t) => t.label).join(" + ")} stale ` +
          `(${slugs.length} agents on disk, file out of date).\n` +
          `Run: npm run gen:registry\n`,
      );
      process.exit(1);
    }
    process.stdout.write(`registry up to date — ${slugs.length} agents\n`);
    return;
  }

  const written = [];
  for (const t of targets) {
    const current = existsSync(t.file) ? readFileSync(t.file, "utf8") : "";
    if (current === t.next) continue;
    writeFileSync(t.file, t.next, "utf8");
    written.push(t.file);
  }

  if (written.length === 0) {
    process.stdout.write(`registry unchanged — ${slugs.length} agents\n`);
    return;
  }
  process.stdout.write(
    `wrote ${written.join(", ")} — ${slugs.length} agents\n`,
  );
}

main();
