#!/usr/bin/env node
/**
 * Auto-generate src/app/api/agents/registry.ts from the directory
 * structure of src/app/api/_agents/<slug>/route.ts.
 *
 * Why this exists:
 *   Vercel's serverless bundler requires every import() path to be
 *   statically analyzable. Hand-maintaining the registry means every
 *   new agent requires a companion commit — which gets forgotten,
 *   and the agent returns 404 in production even though `npm run
 *   dev` works locally.
 *
 * How it runs:
 *   - `npm run gen:registry` — one-off regeneration
 *   - `npm run build` — chained via the build script, ensures every
 *     deploy has a registry that matches the filesystem
 *
 * What it does NOT do:
 *   - Modify agent code. It only writes the registry file.
 *   - Re-run if nothing changed — the content is deterministic so
 *     Git sees no diff when the directory is unchanged.
 *   - Delete manually-added entries. This is a full overwrite.
 *     If you need a special import path (e.g. aliased), don't put
 *     it in _agents/ — this script owns that tree.
 *
 * Invariants:
 *   - Sort order is alphabetical by slug (stable diffs)
 *   - Only directories containing route.ts are registered
 *   - Trailing newline for POSIX cleanliness
 */

import { readdir, stat, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AGENTS_DIR = resolve(ROOT, "src/app/api/_agents");
const OUTPUT = resolve(ROOT, "src/app/api/agents/registry.ts");

async function collectAgentSlugs() {
  const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
  const slugs = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const routePath = join(AGENTS_DIR, e.name, "route.ts");
    try {
      const s = await stat(routePath);
      if (s.isFile()) slugs.push(e.name);
    } catch {
      // No route.ts — skip this directory silently. Some folders
      // hold shared helpers (e.g. `_shared/`) or fixtures.
    }
  }
  return slugs.sort((a, b) => a.localeCompare(b));
}

function renderRegistry(slugs) {
  const lines = [
    "/**",
    " * AUTO-GENERATED — DO NOT EDIT BY HAND.",
    " *",
    " * Produced by scripts/generate-agent-registry.mjs on every build.",
    " * Every agent whose route.ts lives at src/app/api/_agents/<slug>/route.ts",
    " * is bundled here so Vercel's serverless packer can see the import paths.",
    " *",
    ` * Regenerate: \`npm run gen:registry\``,
    ` * Count: ${slugs.length} agents`,
    " */",
    "",
    "/* eslint-disable @typescript-eslint/no-explicit-any */",
    "type RouteModule = Record<string, any>;",
    "",
    "export const AGENT_REGISTRY: Record<string, () => Promise<RouteModule>> = {",
  ];
  for (const slug of slugs) {
    lines.push(`  ${JSON.stringify(slug)}: () => import("@/app/api/_agents/${slug}/route"),`);
  }
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const slugs = await collectAgentSlugs();
  const content = renderRegistry(slugs);
  await writeFile(OUTPUT, content, "utf8");
  // eslint-disable-next-line no-console -- intentional build diagnostic
  console.log(`[gen:registry] wrote ${slugs.length} agents → ${OUTPUT}`);
}

main().catch((err) => {
  console.error("[gen:registry] failed:", err);
  process.exit(1);
});
