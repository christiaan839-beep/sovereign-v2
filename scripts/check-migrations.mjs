#!/usr/bin/env node
/**
 * MIGRATION PARITY CHECK
 *
 * Connects to the configured Neon database (DATABASE_URL) and verifies that
 * every table declared in src/db/schema.ts actually exists. Exits non-zero
 * on drift so CI can block deploys that would crash at runtime with 42P01.
 *
 * Why this exists: the project applies migrations manually via the Neon
 * SQL Editor (no `drizzle-kit migrate` step in deploy). That makes it easy
 * to forget a migration and ship code that reads from a missing table.
 * This script catches that before traffic hits prod.
 *
 * Usage:
 *   node scripts/check-migrations.mjs              # verify against $DATABASE_URL
 *   DATABASE_URL=postgres://... node scripts/...   # one-off check
 *   node scripts/check-migrations.mjs --soft       # warn, exit 0 (informational)
 *
 * In CI, set DATABASE_URL to a *read-only* role so the script can't be
 * weaponized into a write vector via env injection.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SCHEMA_PATH = join(REPO_ROOT, "src/db/schema.ts");

const SOFT = process.argv.includes("--soft");

/** Extract table names from `pgTable("<name>", ...)` declarations. */
function readSchemaTables() {
  const src = readFileSync(SCHEMA_PATH, "utf-8");
  const re = /pgTable\(\s*"([a-z_]+)"/g;
  const names = new Set();
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  return [...names].sort();
}

/** Read every drizzle/*.sql migration filename for the drift report. */
function readMigrationFiles() {
  const dir = join(REPO_ROOT, "drizzle");
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
}

async function checkTablesExist(dbUrl, tables) {
  // Lazy-load the Neon driver so the script works in repos that haven't
  // run `npm install` yet (CI installs first, but the failure mode there
  // should be a clean "module missing" message, not a stack trace).
  let neon;
  try {
    ({ neon } = await import("@neondatabase/serverless"));
  } catch (err) {
    console.error(
      "FAIL: @neondatabase/serverless is not installed. Run `npm install` first.",
    );
    console.error(String(err));
    process.exit(2);
  }

  const sql = neon(dbUrl);
  const present = new Set();
  let queryFailed = false;

  // Single round-trip — pull every public table once instead of N probes.
  try {
    const rows = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `;
    for (const row of rows) present.add(String(row.table_name));
  } catch (err) {
    queryFailed = true;
    console.error("FAIL: could not query information_schema.tables");
    console.error(err instanceof Error ? err.message : String(err));
  }

  return {
    present,
    missing: tables.filter((t) => !present.has(t)),
    queryFailed,
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("FAIL: DATABASE_URL is not set.");
    console.error(
      "      In CI, set it to a *read-only* Neon role so the script can only verify.",
    );
    process.exit(SOFT ? 0 : 2);
  }

  const expected = readSchemaTables();
  if (expected.length === 0) {
    console.error("FAIL: no tables found in src/db/schema.ts — schema parse error?");
    process.exit(2);
  }

  console.log(`Schema declares ${expected.length} tables.`);
  console.log(`Migrations on disk: ${readMigrationFiles().length} file(s).`);
  console.log(`Probing ${dbUrl.split("@").pop()?.split("/")[0] ?? "DB"}...\n`);

  const { present, missing, queryFailed } = await checkTablesExist(
    dbUrl,
    expected,
  );

  if (queryFailed) {
    console.error("Could not reach the database. Treating as drift.");
    process.exit(SOFT ? 0 : 1);
  }

  if (missing.length === 0) {
    console.log(`OK — all ${expected.length} tables present.`);
    console.log(`(Database has ${present.size} public tables in total.)`);
    process.exit(0);
  }

  console.error(
    `DRIFT — ${missing.length} expected table(s) missing in the database:`,
  );
  for (const t of missing) console.error(`  - ${t}`);
  console.error("\nApply pending migrations in Neon SQL Editor:");
  for (const f of readMigrationFiles()) console.error(`  drizzle/${f}`);
  console.error(
    "\nTip: set ADMIN_USER_IDS in Vercel and visit /dashboard/admin/setup",
  );
  console.error("     for a per-table green/red view.");

  process.exit(SOFT ? 0 : 1);
}

main().catch((err) => {
  console.error("Unexpected failure in migration parity check:");
  console.error(err);
  process.exit(SOFT ? 0 : 2);
});
