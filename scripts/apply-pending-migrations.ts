/**
 * Apply pending production migrations against the configured Neon database.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/apply-pending-migrations.ts
 *
 * The combined SQL is idempotent (every CREATE/ALTER uses IF NOT EXISTS),
 * so this is safe to run repeatedly. Statements run sequentially against
 * a single connection so failures stop the run.
 */
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL env var.");
  process.exit(1);
}

const sqlPath = path.join(process.cwd(), "drizzle", "PENDING_PROD.sql");
if (!fs.existsSync(sqlPath)) {
  console.error(`File not found: ${sqlPath}`);
  process.exit(1);
}

const fullSql = fs.readFileSync(sqlPath, "utf8");

// Split on top-level ; — naive but adequate for these migrations
// (no DO $$ blocks, no functions). Strips comment lines.
function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !s.startsWith("--"))
    .map((s) => (s.endsWith(";") ? s : s + ";"));
}

async function main() {
  const sql = neon(DATABASE_URL!);
  const statements = splitStatements(fullSql);

  console.log(`Applying ${statements.length} statements from PENDING_PROD.sql`);

  let applied = 0;
  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    try {
      await sql(stmt);
      applied++;
      console.log(`  ✓ ${preview}`);
    } catch (err) {
      console.error(`  ✗ Failed: ${preview}`);
      console.error(err);
      process.exit(1);
    }
  }

  console.log(`\nDone. ${applied} statements applied successfully.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
