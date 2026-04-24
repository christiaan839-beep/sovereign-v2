#!/usr/bin/env node
/**
 * apply-migrations.mjs — idempotent SQL migration applier for Neon.
 *
 * WHY THIS EXISTS
 * ───────────────
 * drizzle-kit's migrate command only tracks migrations in its own journal
 * (drizzle/meta/_journal.json). From 0002 onward we write hand-rolled SQL
 * files that never touch drizzle-kit — they drift out of the journal but
 * are still real, required migrations.
 *
 * This script is the honest applier:
 *   • scans drizzle/*.sql in lex order (0000, 0001, 0002, …)
 *   • tracks applied state in `_ops_migrations` (separate from drizzle's
 *     own `__drizzle_migrations` so the two systems can't stomp each other)
 *   • stores SHA-256 checksum per file — warns if an applied migration's
 *     content has changed on disk (Rule 3 violation check)
 *   • wraps each file in a single transaction via `Client` (not `neon()`,
 *     which is HTTP-per-query and can't span statements)
 *
 * USAGE
 * ─────
 *   node scripts/apply-migrations.mjs               # apply all pending
 *   node scripts/apply-migrations.mjs --dry-run     # show what would apply
 *   node scripts/apply-migrations.mjs --only 0031   # substring match
 *   node scripts/apply-migrations.mjs --force 0031  # re-apply (dangerous)
 *
 * ENV
 * ───
 *   DATABASE_URL   (required)  — Neon connection string (postgresql://)
 *   MIGRATIONS_DIR (optional)  — default "drizzle"
 *
 * EXIT CODES
 * ──────────
 *   0  success (nothing to do, or all applied)
 *   1  a migration failed, or DATABASE_URL missing, or drift detected
 *   2  bad command-line arguments
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// The serverless Client speaks to Neon over WebSockets. In Node.js we must
// point it at a WebSocket implementation — Bun and edge runtimes ship one
// natively, Node does not. `ws` is already in the monorepo as a transitive.
neonConfig.webSocketConstructor = ws;

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function c(color, text) {
  return `${ANSI[color]}${text}${ANSI.reset}`;
}

function parseArgs(argv) {
  const args = { dryRun: false, only: null, force: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run" || a === "-n") args.dryRun = true;
    else if (a === "--only") args.only = argv[++i];
    else if (a === "--force") args.force = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(HELP_TEXT);
      process.exit(0);
    } else {
      console.error(c("red", `Unknown argument: ${a}`));
      process.exit(2);
    }
  }
  return args;
}

const HELP_TEXT = `apply-migrations.mjs — idempotent SQL migration applier

  --dry-run        Show what would apply without touching the DB
  --only <match>   Only consider files whose name contains <match>
  --force <match>  Re-apply the matched file even if recorded
  -h, --help       This help
`;

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function listMigrations(dir) {
  const entries = await readdir(dir);
  return entries
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, "en"));
}

async function ensureTrackingTable(client) {
  // Separate from drizzle's __drizzle_migrations to avoid stomping its state.
  await client.query(`
    CREATE TABLE IF NOT EXISTS _ops_migrations (
      filename   TEXT PRIMARY KEY,
      checksum   TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(client) {
  const { rows } = await client.query(
    `SELECT filename, checksum FROM _ops_migrations`,
  );
  return new Map(rows.map((r) => [r.filename, r.checksum]));
}

async function applyOne(client, filename, content, checksum) {
  // PostgreSQL happily runs multiple statements separated by semicolons
  // in a single `query()` call as long as there are no bound parameters.
  // Our migration files have no params, so a single query-with-tx works.
  await client.query("BEGIN");
  try {
    await client.query(content);
    await client.query(
      `INSERT INTO _ops_migrations (filename, checksum) VALUES ($1, $2)
       ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
      [filename, checksum],
    );
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // swallow — original error is the one we want to surface
    }
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv);

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(c("red", "✖ DATABASE_URL is required"));
    console.error(c("dim", "  Set it in .env.local or export it in your shell."));
    process.exit(1);
  }

  const dir = resolve(process.env.MIGRATIONS_DIR ?? "drizzle");
  const files = await listMigrations(dir);
  if (files.length === 0) {
    console.log(c("dim", `(no .sql files found in ${dir})`));
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await ensureTrackingTable(client);
    const applied = await getApplied(client);

    let pending = 0;
    let reApplied = 0;
    let drift = 0;
    let skipped = 0;

    for (const file of files) {
      if (args.only && !file.includes(args.only)) {
        skipped++;
        continue;
      }
      const path = join(dir, file);
      const content = await readFile(path, "utf8");
      const checksum = sha256(content);
      const prev = applied.get(file);
      const forceMatch = args.force && file.includes(args.force);

      if (prev && !forceMatch) {
        if (prev !== checksum) {
          console.warn(
            c(
              "yellow",
              `⚠ drift: ${file} was applied but its content changed on disk`,
            ),
          );
          console.warn(
            c(
              "dim",
              `  stored ${prev.slice(0, 12)}… vs. disk ${checksum.slice(0, 12)}…`,
            ),
          );
          console.warn(c("dim", `  (use --force ${file} to re-apply)`));
          drift++;
        }
        continue;
      }

      if (args.dryRun) {
        console.log(c("cyan", `• would ${prev ? "RE-" : ""}apply ${file}`));
        console.log(
          c(
            "dim",
            `  ${content.split("\n").length} lines, ${content.length} bytes`,
          ),
        );
        pending++;
        continue;
      }

      const label = prev ? "re-applying" : "applying";
      process.stdout.write(c("cyan", `→ ${label} ${file} `));
      const t0 = Date.now();
      try {
        await applyOne(client, file, content, checksum);
        const ms = Date.now() - t0;
        console.log(c("green", `ok`) + c("dim", ` (${ms}ms)`));
        if (prev) reApplied++;
        else pending++;
      } catch (err) {
        console.log(c("red", "FAIL"));
        console.error(c("red", `  ${err?.message ?? String(err)}`));
        console.error(c("dim", `  file rolled back — DB is unchanged for ${file}`));
        process.exit(1);
      }
    }

    console.log(
      c("bold", "\nsummary"),
      `— applied: ${pending}, re-applied: ${reApplied}, skipped: ${skipped}, drift: ${drift}`,
    );

    if (drift > 0) {
      console.error(
        c(
          "yellow",
          `\n⚠ ${drift} migration(s) drifted on disk — review and --force if intended.`,
        ),
      );
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(c("red", `\n✖ fatal: ${err?.message ?? String(err)}`));
  if (err?.stack) console.error(c("dim", err.stack));
  process.exit(1);
});
