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
// Slugs file is a separate physical file so importing it does NOT
// trigger Turbopack to bundle the registry's handler-import map.
// agent-catalog + the OG image route + any non-runtime surface should
// import from this slugs file, NOT registry.ts.
const SLUGS_OUTPUT = resolve(ROOT, "src/app/api/agents/slugs.ts");

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
    " * Use ONLY from runtime-invocation paths (api/v1/* gateway, agent",
    " * factory fallthrough). Pulling this in from non-runtime contexts",
    " * (Edge OG image, public catalog) drags 200+ handler files + their",
    " * transitive node:* deps into bundles that don't need them — and",
    " * Turbopack emits a wall of 'node module loaded in Edge runtime'",
    " * warnings as a result.",
    " *",
    " * For read-only existence checks, import from `./slugs` instead.",
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

function renderSlugs(slugs) {
  const lines = [
    "/**",
    " * AUTO-GENERATED — DO NOT EDIT BY HAND.",
    " *",
    " * Produced by scripts/generate-agent-registry.mjs alongside",
    " * registry.ts. Importing this file does NOT pull in any handler",
    " * module — it's just a frozen string array + Set.",
    " *",
    " * Use this in:",
    " *   - agent-catalog.ts (public catalog)",
    " *   - api/og/agent/[slug]/route.tsx (Edge OG image)",
    " *   - any other context that needs 'is this a valid slug?' without",
    " *     invoking the handler",
    " *",
    " * If you find yourself wanting `Record<string, () => Promise<...>>`,",
    " * you want `./registry`, not this file.",
    " *",
    ` * Regenerate: \`npm run gen:registry\``,
    ` * Count: ${slugs.length} agents`,
    " */",
    "",
    "export const AGENT_SLUGS: readonly string[] = [",
  ];
  for (const slug of slugs) {
    lines.push(`  ${JSON.stringify(slug)},`);
  }
  lines.push("] as const;");
  lines.push("");
  lines.push("/** Convenience Set for O(1) existence checks. */");
  lines.push("export const AGENT_SLUG_SET: ReadonlySet<string> = new Set(AGENT_SLUGS);");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const slugs = await collectAgentSlugs();
  await writeFile(OUTPUT, renderRegistry(slugs), "utf8");
  await writeFile(SLUGS_OUTPUT, renderSlugs(slugs), "utf8");
  // eslint-disable-next-line no-console -- intentional build diagnostic
  console.log(
    `[gen:registry] wrote ${slugs.length} agents → ${OUTPUT} + ${SLUGS_OUTPUT}`,
  );
}

main().catch((err) => {
  console.error("[gen:registry] failed:", err);
  process.exit(1);
});
