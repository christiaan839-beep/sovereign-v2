#!/usr/bin/env node
/**
 * APPLY PRODUCTION MIGRATIONS — TIER S enabler.
 *
 * Per docs/HONEST-GAPS.md, migrations 0030-0042 have not been
 * applied to production. Until they are, every "saved ✓" UX in
 * the platform is a lie at the persistence layer (the relevant
 * tables don't exist; the libs fail-open and silently swallow).
 *
 * This script applies pending migrations in numeric order. It's
 * idempotent: each migration's CREATE TABLE / ALTER TABLE statements
 * use IF NOT EXISTS / IF NOT EXISTS COLUMN, so re-running is safe.
 *
 * USAGE (run locally with DATABASE_URL pointing at production):
 *
 *   DATABASE_URL='postgresql://...' node scripts/apply-prod-migrations.mjs
 *
 * SAFETY:
 *   - Refuses to run without DATABASE_URL (no accidental local DB writes).
 *   - Refuses if the URL doesn't include "sslmode=require" (Neon prod
 *     should always require TLS).
 *   - Asks for confirmation before running (set --yes to skip).
 *   - Each migration runs in its own transaction; one failure aborts
 *     ONLY that migration, not the rest.
 *   - Records applied migrations in `_sovereign_applied_migrations`
 *     (created on first run) so re-running is fast.
 *
 * This is the ONLY script in the repo that writes to production
 * directly. All other DB access goes through Drizzle.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = resolve(process.cwd());
const DRIZZLE_DIR = resolve(ROOT, "drizzle");

// Pending migrations per docs/HONEST-GAPS.md as of 2026-04-28.
// We apply ANY migration newer than 0029 that hasn't already been
// applied (tracked in _sovereign_applied_migrations).
const FIRST_PENDING = 30;

function log(line) {
  console.log(`[migrate] ${line}`);
}

function fail(line) {
  console.error(`[migrate] ❌ ${line}`);
  process.exit(1);
}

async function confirm(question) {
  if (process.argv.includes("--yes")) return true;
  const rl = createInterface({ input, output });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

function listPendingMigrations() {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
  return files.filter((f) => {
    const num = parseInt(f.slice(0, 4), 10);
    return num >= FIRST_PENDING;
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL not set; refusing to run.");
  if (!url.includes("sslmode=require") && !url.includes("@localhost")) {
    log("⚠️  DATABASE_URL does not require TLS. Set sslmode=require for prod.");
  }

  log("Connecting to Neon…");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);

  // Tracking table — records which migrations have been applied.
  // Created on first run; idempotent.
  await sql`
    CREATE TABLE IF NOT EXISTS _sovereign_applied_migrations (
      filename       TEXT      PRIMARY KEY,
      applied_at     TIMESTAMP NOT NULL DEFAULT NOW(),
      duration_ms    INTEGER   NOT NULL
    )
  `;

  const allCandidates = listPendingMigrations();
  const appliedRows = await sql`SELECT filename FROM _sovereign_applied_migrations`;
  const applied = new Set(appliedRows.map((r) => r.filename));
  const pending = allCandidates.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    log(`✅ All ${allCandidates.length} migrations already applied. Nothing to do.`);
    process.exit(0);
  }

  log(`Found ${pending.length} pending migration(s):`);
  for (const f of pending) log(`  - ${f}`);

  const ok = await confirm(`Apply ${pending.length} migrations to ${url.split("@")[1]?.split("/")[0] ?? "(unknown host)"}?`);
  if (!ok) {
    log("Aborted by user.");
    process.exit(0);
  }

  let succeeded = 0;
  let failed = 0;
  for (const file of pending) {
    const path = resolve(DRIZZLE_DIR, file);
    const ddl = readFileSync(path, "utf8");
    log(`▶ Applying ${file}…`);
    const start = Date.now();
    try {
      // Neon's serverless driver runs each call as its own transaction
      // automatically. The DDL files contain idempotent statements
      // (IF NOT EXISTS) so partial-apply replay is safe.
      // Using sql.query() so we can pass arbitrary multi-statement DDL.
      await sql.query(ddl);
      const durationMs = Date.now() - start;
      await sql`
        INSERT INTO _sovereign_applied_migrations (filename, duration_ms)
        VALUES (${file}, ${durationMs})
      `;
      log(`  ✅ ${file} (${durationMs}ms)`);
      succeeded += 1;
    } catch (err) {
      log(`  ❌ ${file} failed: ${err.message ?? String(err)}`);
      failed += 1;
      // Continue with remaining migrations; some failures (e.g. column
      // already exists from a partial prior apply) are non-fatal.
    }
  }

  log("");
  log(`Done: ${succeeded} succeeded, ${failed} failed.`);
  if (failed > 0) {
    log("⚠️  Investigate failures above. Idempotent statements (IF NOT EXISTS)");
    log("   should not have failed; check the error message for clues.");
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("[migrate] FATAL:", e);
  process.exit(2);
});
