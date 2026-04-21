/**
 * Seeds default agent_metadata rows from the code registry.
 *
 * Idempotent — `ON CONFLICT (slug) DO NOTHING` so it never overwrites
 * a row that an admin has hand-edited. Safe to run on every deploy.
 *
 * Usage:
 *   node scripts/seed-agent-metadata.mjs
 *
 * Wire to package.json postbuild (optional — recommend running manually
 * the first time then as a periodic admin task).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set — aborting seed.");
  process.exit(1);
}

// ─── Helpers ────────────────────────────────────────────────────

const ACRONYMS = new Set([
  "ai", "api", "asr", "b2b", "b2c", "cdp", "ceo", "cfo",
  "crm", "ctr", "cpm", "eu", "gdpr", "hitl", "kpi", "kyc",
  "llm", "mcp", "mrr", "ocr", "pci", "pii", "qa", "qr",
  "rag", "roi", "rpa", "saas", "seo", "sla", "sms", "soc",
  "sql", "ssl", "tls", "tts", "ui", "ux", "vsl",
]);

/** "seo-dominator" → "SEO Dominator". Preserves known acronyms in uppercase. */
function humanize(slug) {
  return slug
    .split("-")
    .map((word) => {
      if (ACRONYMS.has(word)) return word.toUpperCase();
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** Heuristic category inference from slug keywords. Overridable in UI later. */
function inferCategory(slug) {
  if (/^(seo|blog|content|copy|post|article|rewrite|caption)/.test(slug)) return "content";
  if (/^(lead|prospect|outbound|cold|email|abm)/.test(slug)) return "leads";
  if (/(competitor|intel|market|pricing-check|ad-report)/.test(slug)) return "intelligence";
  if (/(voice|speech|asr|tts|transcribe|audio)/.test(slug)) return "voice";
  if (/(safety|guard|audit|compliance|pii|jailbreak)/.test(slug)) return "safety";
  if (/(image|video|visual|diffusion|flux|render)/.test(slug)) return "creative";
  if (/(code|dev|github|refactor|review)/.test(slug)) return "engineering";
  if (/(finance|revenue|billing|cost|budget)/.test(slug)) return "finance";
  if (/(social|twitter|linkedin|facebook|meta-)/.test(slug)) return "social";
  if (/(research|analytics|report|benchmark)/.test(slug)) return "analysis";
  return "general";
}

/** Pull all slugs from the auto-generated registry. */
async function loadRegistrySlugs() {
  const registryPath = resolve(__dirname, "../src/app/api/agents/registry.ts");
  const text = await readFile(registryPath, "utf8");
  // Pattern: "slug-name": () => import(
  const matches = text.matchAll(/"([a-z][a-z0-9-]+)":\s*\(\)\s*=>/g);
  return [...matches].map((m) => m[1]);
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("Loading registry slugs…");
  const slugs = await loadRegistrySlugs();
  console.log(`Found ${slugs.length} agents in registry.`);

  console.log("Connecting to Postgres…");
  const sql = neon(DATABASE_URL);

  let inserted = 0;
  let skipped = 0;
  const categoryCounts = {};

  for (const slug of slugs) {
    const displayName = humanize(slug);
    const category = inferCategory(slug);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;

    const res = await sql`
      INSERT INTO agent_metadata (slug, display_name, category, published, visibility)
      VALUES (${slug}, ${displayName}, ${category}, TRUE, 'public')
      ON CONFLICT (slug) DO NOTHING
      RETURNING slug
    `;

    if (res.length > 0) inserted++;
    else skipped++;
  }

  console.log("");
  console.log("─── Seed complete ───────────────────");
  console.log(`  Inserted:  ${inserted}`);
  console.log(`  Skipped:   ${skipped} (already existed)`);
  console.log("");
  console.log("  Category breakdown:");
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat.padEnd(14)} ${count}`);
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
