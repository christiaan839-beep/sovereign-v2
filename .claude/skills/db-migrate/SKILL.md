---
name: db-migrate
description: "Drizzle migration workflow for Sovereign Matrix. Generates a new migration from the current schema, validates it against src/db/schema.ts, shows the SQL, and guides through running it in Neon Console. Use this skill when the user says 'create migration', 'db migrate', 'drizzle generate', 'update schema', 'new migration', or whenever schema.ts is modified and a migration is needed. Make sure to use this skill whenever the user modifies src/db/schema.ts, even if they don't explicitly ask for a migration."
disable-model-invocation: true
---

# DB Migrate

Drizzle migration workflow for Sovereign Matrix. Keeps the Drizzle schema and production Neon DB in sync.

## When to Run

- Right after editing `src/db/schema.ts`
- Before shipping code that queries a new column or table
- When CLAUDE.md's "Pending Manual Steps" lists outstanding migrations

## The Workflow

### Step 1: Generate

```bash
npx drizzle-kit generate
```

This reads `src/db/schema.ts` and writes a new migration SQL file into `drizzle/`. Drizzle picks the next sequential name (e.g., `0005_<random_word>.sql`).

### Step 2: Review

Read the generated SQL file carefully. Check for:

- **Unintended drops** — Drizzle will drop columns/tables you rename. If you see `DROP COLUMN` or `DROP TABLE`, confirm it's intentional. For renames, edit the SQL manually to use `ALTER TABLE ... RENAME COLUMN`.
- **Type changes on populated columns** — `ALTER COLUMN ... TYPE` can lose data. Add a `USING` clause if needed.
- **NOT NULL additions** — Adding `NOT NULL` to an existing column without a default will fail on populated tables. Either provide a default or use a two-step migration (add nullable, backfill, then `ALTER ... SET NOT NULL`).
- **Missing indexes** — If the schema added an index, verify it's in the SQL.

### Step 3: Graceful Handling Audit

Per CLAUDE.md, all API routes must handle PostgreSQL error 42P01 (missing table) gracefully — return empty arrays or 503, never crash. Before shipping code that reads from a new table, check the routes that query it:

```bash
grep -rn "from(<new_table_name>)" src/app/api/
```

Each caller needs try/catch around the query with a 42P01 check.

### Step 4: Run in Neon Console

The user runs migrations manually in Neon Console → SQL Editor. DO NOT attempt to run the migration from the shell — we don't have the production `DATABASE_URL` locally.

Provide the user with:

1. **Open**: https://console.neon.tech/
2. **Navigate**: Project → SQL Editor
3. **Paste**: The full SQL from `drizzle/0005_*.sql`
4. **Run**: Click "Run"
5. **Verify**: Query the affected table to confirm the change took effect

### Step 5: Update CLAUDE.md Tracking

The "Pending Manual Steps" section in CLAUDE.md tracks outstanding migrations. After the user confirms the migration ran successfully, remove the migration from the pending list (or add it if it's still pending).

### Step 6: Verify Code Paths

After the migration runs, verify:

```bash
# Smoke test: the app should compile
npm run build 2>&1 | tail -20

# Run any tests that touch the migrated schema
npm run test -- --reporter=verbose
```

## Common Pitfalls

**Pitfall 1: Renaming a column shows as drop + add.**
Drizzle can't detect renames. Edit the generated SQL to use `ALTER TABLE ... RENAME COLUMN old TO new` instead of `DROP + ADD`.

**Pitfall 2: Adding a NOT NULL column to a populated table.**
The migration will fail on production if the table has rows. Two-step approach:

```sql
ALTER TABLE users ADD COLUMN new_field TEXT; -- nullable
UPDATE users SET new_field = 'default_value' WHERE new_field IS NULL;
ALTER TABLE users ALTER COLUMN new_field SET NOT NULL;
```

**Pitfall 3: Schema drift.**
If `drizzle-kit generate` says "no schema changes detected" but you think there should be, verify that the schema file was saved and check for import errors.

**Pitfall 4: Missing 42P01 handling.**
API routes that query the new table without graceful 42P01 handling will crash until the migration runs. Always add the handler before shipping the code.

## Current Pending Migrations (from CLAUDE.md)

- 0002 (async_jobs)
- 0003 (playbook_runs)
- 0004 (graph memory, affiliates, audit logs, workflows, tenant onboarding columns)

These need to be run in Neon Console before the associated features work in production.

## Why This Skill is User-Only

Running production database migrations is a decision the user makes with full awareness of the risk. Claude can generate, review, and advise — but the user confirms and executes in Neon Console.
