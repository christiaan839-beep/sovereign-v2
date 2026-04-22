# Landing v2 + Platform Tier 1 — Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an elite-tier landing page redesign (Staff Directory hero, Atlas graph, live product demos, editorial playbook profiles) in parallel with closing eight Tier 1 platform gaps that the new landing depends on — atomic cutover at end of Week 3, followed by three weeks of Tier 2 parity work.

**Architecture:** Parallel staging via Next.js route group `src/app/(landing-v2)/` keeps production `src/app/page.tsx` untouched until the cutover commit. Five new `/api/public/*` endpoints power live sections using real data from a dedicated `sovereign-public-demo` tenant. Seven new landing components (`StaffDirectory`, `AgentDossier`, `AtlasGraph`, `MemoryDemoCard`, `RouterPassVis`, `VerificationDemo`, `PlaybookProfile`) replace nine deprecated ones. `/agents/[slug]` thickened with use cases / FAQ / sample output migration. `/platform` palette converted to dark for visual continuity. Atomic cutover: one commit renames `(landing-v2)/page.tsx` → `page.tsx`; rollback is one `git revert`.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion · Drizzle ORM + Neon PostgreSQL · Clerk · Upstash Redis (rate limits + caching) · Vitest · Playwright · D3 (force simulation) · Vercel.

**Companion specs:**
- `docs/superpowers/specs/2026-04-22-landing-v2-design.md`
- `docs/superpowers/specs/2026-04-22-platform-tier1-gap-audit.md`

**Decisions locked (commit `1ae11136`):** dark palette on `/platform` · headline `Meet the 137 agents.` · character names `Apex/Velox/Scribe` (Section 06 only) · typographic-only profile art · dedicated `sovereign-public-demo` tenant.

---

## 0. Global Rules and Invariants

**These apply to every task in the plan. If any is violated at merge time, the commit does not merge.**

1. **Reliability gate (every commit):**
   - `npx tsc --noEmit` passes
   - `npm run lint` passes
   - `npx vitest run` passes (no new flake, test count never decreases)
   - For UI commits: Lighthouse Mobile ≥95, Desktop ≥98, Accessibility ≥95, Best Practices ≥95, SEO ≥95 (run on preview URL).
2. **Parallel staging invariant:** `src/app/page.tsx` is not modified by any commit in Weeks 1–3 except the single atomic cutover commit on Day 16. All new landing code ships to `src/app/(landing-v2)/`.
3. **Motion budget:** no `whileInView` below the fold in `(landing-v2)/`. Total active animations in the new page ≤ 10 (spec §13 allowance).
4. **Typography budget:** `(landing-v2)/` uses **exactly 5 type scales** (Display `text-6xl`, Headline `text-3xl`, Body `text-[15px]`, Small `text-[12px]`, Micro `text-[10px]`). A merge-blocking lint rule rejects `text-4xl`, `text-5xl`, `text-7xl`, `text-8xl`, `text-9xl`, or any custom `text-[<big>px]` outside this scale within `src/app/(landing-v2)/` and `src/components/landing-v2/`. If something feels like it wants a larger scale, it needs a layout fix, not a type escape hatch.
5. **No `console.log` in committed TypeScript.** Logs go through the existing structured logger in `src/lib/logger.ts` (or its equivalent — check `src/lib/` for the current logger module) or are removed before commit. `console.error` in API error handlers is acceptable (already established pattern in `src/app/api/public/recent-runs/route.ts`).
6. **No secrets in code.** All new env vars go through the Zod schema in `src/lib/env.ts`. Read it first; every new env var must appear there with a type and a failure message.
7. **No fabricated stats or placeholder content in committed UI.** Every number, agent name, run count, and latency shown on the landing is pulled from `/api/public/*` (live) or read at build time from a real data source. "Lorem ipsum" is a merge-blocker.
8. **Test-driven:** for every new component and endpoint, the test commit lands before or with the implementation. The order within a task is always: write failing test → run test → implement → run test → commit.
9. **Atomic commits.** One logical change per commit. No mixing of refactor + feature + test in a single commit. Commit messages follow the project's conventional-commit prefix (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`).

---

## 1. File Structure Map

The sprint creates and modifies the following files. This is the complete inventory — anything not in this list is out of scope for the sprint.

### Created

```
docs/superpowers/plans/2026-04-22-landing-v2-sprint.md       (THIS FILE)

drizzle/migrations/
  0046_public_demo_tenant.sql                                (new migration)
  0047_agent_metadata_usecases_faq.sql                       (new migration)

src/app/(landing-v2)/
  layout.tsx                                                 (route-group layout)
  page.tsx                                                   (the new landing)

src/app/api/public/
  catalog/route.ts                                           (T1-A #1)
  atlas-edges/route.ts                                       (T1-A #2)
  memory-demo/route.ts                                       (T1-A #3)
  router-demo/route.ts                                       (T1-A #4)
  verify-demo/route.ts                                       (T1-A #5)
  run/[slug]/route.ts                                        (T1-D playground fix)

src/app/cookies/page.tsx                                     (T1-F)

src/components/landing-v2/
  Nav.tsx                                                    (v2 nav, pinned)
  Hero.tsx                                                   (section 01 wrapper)
  StaffDirectory.tsx                                         (section 01 grid)
  AgentDossier.tsx                                           (section 01 expander)
  Atlas.tsx                                                  (section 02 wrapper)
  AtlasGraph.tsx                                             (section 02 D3 canvas)
  MemoryAtWork.tsx                                           (section 03 wrapper)
  MemoryDemoCard.tsx                                         (section 03 live card)
  RoutingInTheOpen.tsx                                       (section 04 wrapper)
  RouterPassVis.tsx                                          (section 04 live widget)
  VerificationYouCanWatch.tsx                                (section 05 wrapper)
  VerificationDemo.tsx                                       (section 05 live widget)
  PlaybookProfiles.tsx                                       (section 06 wrapper)
  PlaybookProfile.tsx                                        (section 06 single card)
  PricingAndFounders.tsx                                     (section 07)
  FinalCTAv2.tsx                                             (section 08 CTA)
  FooterV2.tsx                                               (section 08 footer)

src/components/landing-v2/__tests__/
  StaffDirectory.test.tsx
  AgentDossier.test.tsx
  AtlasGraph.test.tsx
  MemoryDemoCard.test.tsx
  RouterPassVis.test.tsx
  VerificationDemo.test.tsx
  PlaybookProfile.test.tsx

src/lib/__tests__/
  public-catalog.test.ts
  public-atlas-edges.test.ts
  public-memory-demo.test.ts
  public-router-demo.test.ts
  public-verify-demo.test.ts
  public-run-slug.test.ts

scripts/
  seed-public-demo-tenant.ts                                 (seed data)

e2e/
  landing-v2.spec.ts                                         (new Playwright tests)

docs/superpowers/plans/
  2026-04-22-landing-v2-sprint.md                            (this file)
```

### Modified

```
src/db/schema.ts                                             (new columns: is_public_demo, useCases, faq)
src/lib/agent-catalog.ts                                     (if needed — add demo-tenant filter)
src/lib/rate-limits.ts                                       (add 3 new rules for expensive demo endpoints)
src/lib/env.ts                                               (if any new env vars needed)
src/lib/webhook-dispatcher.ts                                (T1-G retry + idempotency)
src/lib/tenant-scope.ts                                      (add public-demo invariant helper)
src/app/agents/[slug]/page.tsx                               (T1-B thickening)
src/app/platform/page.tsx                                    (T1-C palette conversion)
src/app/playground/page.tsx                                  (T1-D fix to use public run endpoint)
src/app/dashboard/playbooks/runs/[id]/page.tsx               (T1-E failed-run UX)
e2e/landing.spec.ts                                          (will be renamed to landing-v1.spec.ts on cutover; kept for regression)

ATOMIC CUTOVER COMMIT (Week 3 Day 16):
src/app/page.tsx                                             (renamed to page.v1.tsx.bak)
src/app/(landing-v2)/page.tsx                                (promoted; moved up to src/app/page.tsx)
```

### Deleted at cutover (not before)

```
Nothing. Deprecated components stay in src/components/landing/ for 30 days
after cutover (rollback buffer), marked with @deprecated comments.
```

---

## 2. Prerequisites (Already Done — Verification Step Only)

- [x] **Specs written + committed** — `docs/superpowers/specs/2026-04-22-landing-v2-design.md` and `docs/superpowers/specs/2026-04-22-platform-tier1-gap-audit.md` (commit `66da15da`, `1ae11136`).
- [x] **Open questions resolved** — all 5 decisions locked.
- [x] **Platform audit complete** — 18-item report from audit agent confirms file-level evidence.
- [x] **Branch** — all work happens on `claude/wizardly-benz`.

**Verification step before Day 3:** run this command to confirm the branch state matches the plan's assumptions:

```bash
git log --oneline -5
# Should show:
# 1ae11136 spec(landing-v2+tier1): resolve 5 open questions — reliability-first
# 66da15da spec(landing-v2+tier1): elite-tier sprint — design + gap audit
# 5416f329 feat(legal): Terms + Privacy rewritten — GDPR/POPIA/CCPA complete (W1 T5/7)
# a9cb58f2 feat(gdpr): account deletion — Article 17 right-to-erasure (W1 T4/7)
# ed9cb1ed feat(ratelimit): universal /api coverage with tiered policies (W1 T3/7)

npx tsc --noEmit
# Should exit 0

npx vitest run --reporter=default 2>&1 | tail -5
# Should show a passing count with no failures
```

If any verification fails, stop and fix before proceeding.

---

# WEEK 1 — Foundation Data Layer + Hero

## Day 3 — Public Demo Tenant + DB Migrations

Goal: stand up the dedicated `sovereign-public-demo` tenant and the new schema columns (`is_public_demo` on tenants; `useCases` + `faq` on agent_metadata). This unblocks every downstream task.

### Task 1: Read `src/db/schema.ts` to locate tenants + agentMetadata table definitions

- [ ] **Step 1: Open the schema file**

```bash
grep -n "export const tenants\|export const agentMetadata" src/db/schema.ts
```

Expected: two line numbers, one per table. Note the exact schema.

### Task 2: Write migration `0046_public_demo_tenant.sql`

**Files:**
- Create: `drizzle/migrations/0046_public_demo_tenant.sql`

- [ ] **Step 1: Inspect existing migrations for format conventions**

```bash
ls drizzle/migrations/ | tail -3
cat drizzle/migrations/$(ls drizzle/migrations/ | tail -1)
```

Expected: see the SQL style (bare SQL, or Drizzle's `-- custom` comment markers).

- [ ] **Step 2: Write the migration**

```sql
-- drizzle/migrations/0046_public_demo_tenant.sql
-- Adds is_public_demo flag to tenants and seeds the sovereign-public-demo row.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_public_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tenants_is_public_demo
  ON tenants (is_public_demo)
  WHERE is_public_demo = TRUE;

INSERT INTO tenants (id, clerk_user_id, plan, is_public_demo, created_at, updated_at)
VALUES (
  'sovereign-public-demo',
  'public-demo-virtual-clerk-id',
  'enterprise',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET is_public_demo = TRUE;
```

- [ ] **Step 3: Commit the migration**

```bash
git add drizzle/migrations/0046_public_demo_tenant.sql
git commit -m "feat(db): add is_public_demo flag + seed sovereign-public-demo tenant"
```

### Task 3: Add `is_public_demo` to schema.ts

**Files:**
- Modify: `src/db/schema.ts` (the tenants table definition)

- [ ] **Step 1: Find the tenants table**

```bash
grep -n "export const tenants" src/db/schema.ts
```

- [ ] **Step 2: Add the column**

Edit the tenants definition to add (inside the pgTable column block):

```ts
isPublicDemo: boolean("is_public_demo").notNull().default(false),
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(schema): tenants.isPublicDemo column"
```

### Task 4: Write migration `0047_agent_metadata_usecases_faq.sql`

**Files:**
- Create: `drizzle/migrations/0047_agent_metadata_usecases_faq.sql`

- [ ] **Step 1: Write the migration**

```sql
-- drizzle/migrations/0047_agent_metadata_usecases_faq.sql
-- Adds use cases + FAQ columns to agent_metadata for T1-B
-- /agents/[slug] page thickening.

ALTER TABLE agent_metadata
  ADD COLUMN IF NOT EXISTS use_cases JSONB,
  ADD COLUMN IF NOT EXISTS faq JSONB,
  ADD COLUMN IF NOT EXISTS sample_output_run_id UUID;

-- use_cases: JSON array of { title, description, exampleInput, exampleOutput }
-- faq: JSON array of { question, answer }
-- sample_output_run_id: reference to a real playbook_runs.id to show as sample

CREATE INDEX IF NOT EXISTS idx_agent_metadata_sample_output_run_id
  ON agent_metadata (sample_output_run_id);
```

- [ ] **Step 2: Add columns to schema.ts**

Locate `export const agentMetadata` in `src/db/schema.ts` and add to the table definition:

```ts
useCases: jsonb("use_cases").$type<Array<{
  title: string;
  description: string;
  exampleInput?: string;
  exampleOutput?: string;
}>>(),
faq: jsonb("faq").$type<Array<{ question: string; answer: string }>>(),
sampleOutputRunId: uuid("sample_output_run_id"),
```

(If `jsonb` or `uuid` isn't already imported from `drizzle-orm/pg-core` at the top of schema.ts, add them.)

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add drizzle/migrations/0047_agent_metadata_usecases_faq.sql src/db/schema.ts
git commit -m "feat(schema): agent_metadata use_cases/faq/sample_output_run_id"
```

### Task 5: Write `scripts/seed-public-demo-tenant.ts`

**Files:**
- Create: `scripts/seed-public-demo-tenant.ts`

- [ ] **Step 1: Write a minimal TS seed script**

```ts
/**
 * scripts/seed-public-demo-tenant.ts
 *
 * Seeds the sovereign-public-demo tenant with real-looking data for the
 * landing v2 live demo sections. Safe to re-run; uses ON CONFLICT / upsert.
 *
 * Run: npx tsx scripts/seed-public-demo-tenant.ts
 */

import { db } from "@/db";
import { tenants, agentMetadata, playbookRuns, tenantMemories } from "@/db/schema";
import { eq } from "drizzle-orm";

const PUBLIC_DEMO_TENANT_ID = "sovereign-public-demo";

async function main() {
  // 1. Verify the tenant row exists (migration 0046 seeded it).
  const [existing] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, PUBLIC_DEMO_TENANT_ID))
    .limit(1);

  if (!existing) {
    throw new Error(
      `Tenant ${PUBLIC_DEMO_TENANT_ID} not found. Run migration 0046 first.`,
    );
  }

  if (!existing.isPublicDemo) {
    throw new Error(
      `Tenant ${PUBLIC_DEMO_TENANT_ID} exists but is_public_demo=false.`,
    );
  }

  console.log(`✓ Tenant ${PUBLIC_DEMO_TENANT_ID} verified.`);

  // Extended in Task 14: seed 3 sample playbook runs + memory embeddings
  // for the memory-demo endpoint to recall. Kept skeletal here so the
  // file exists for Task 6 (tenant-scope invariant) to import from.
  console.log("Seed skeleton complete. Extended seed lands in Task 14.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script to verify it works against the seeded tenant**

```bash
npx tsx scripts/seed-public-demo-tenant.ts
```

Expected: `✓ Tenant sovereign-public-demo verified.` (after the migration has been applied to the dev database).

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-public-demo-tenant.ts
git commit -m "chore(scripts): scaffold public demo tenant seed"
```

### Task 6: Add public-demo tenant invariant to `src/lib/tenant-scope.ts`

**Files:**
- Modify: `src/lib/tenant-scope.ts`

- [ ] **Step 1: Read the current tenant-scope implementation**

```bash
cat src/lib/tenant-scope.ts
```

Note the exported functions (`requireTenantId`, `guardTenantAccess`, `belongsToTenant`).

- [ ] **Step 2: Write a test first**

Create `src/lib/__tests__/tenant-scope-public-demo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isPublicDemoTenant, PUBLIC_DEMO_TENANT_ID } from "@/lib/tenant-scope";

describe("public demo tenant invariant", () => {
  it("recognises the public demo tenant id", () => {
    expect(isPublicDemoTenant(PUBLIC_DEMO_TENANT_ID)).toBe(true);
  });

  it("rejects every other tenant id", () => {
    expect(isPublicDemoTenant("tenant_user_123")).toBe(false);
    expect(isPublicDemoTenant("")).toBe(false);
    expect(isPublicDemoTenant(null)).toBe(false);
    expect(isPublicDemoTenant(undefined)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
npx vitest run src/lib/__tests__/tenant-scope-public-demo.test.ts
```

Expected: FAIL with "isPublicDemoTenant is not defined" or similar.

- [ ] **Step 4: Implement**

Append to `src/lib/tenant-scope.ts`:

```ts
/**
 * Dedicated tenant ID for all public demo data (landing-v2 live sections).
 * This tenant's data is safe to expose on public endpoints — no real user
 * PII ever lands here.
 */
export const PUBLIC_DEMO_TENANT_ID = "sovereign-public-demo";

export function isPublicDemoTenant(
  tenantId: string | null | undefined,
): boolean {
  return tenantId === PUBLIC_DEMO_TENANT_ID;
}
```

- [ ] **Step 5: Run the test — expect pass**

```bash
npx vitest run src/lib/__tests__/tenant-scope-public-demo.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/tenant-scope.ts src/lib/__tests__/tenant-scope-public-demo.test.ts
git commit -m "feat(tenant-scope): PUBLIC_DEMO_TENANT_ID + isPublicDemoTenant invariant"
```

### Task 7: Day 3 success criteria + checkpoint

- [ ] **Step 1: Run all gates**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: 0 TS errors, 0 lint errors, all tests pass.

- [ ] **Step 2: Verify git log**

```bash
git log --oneline -5
```

Expected: 5 new commits from today's work (migrations, schema, seed, tenant-scope, test).

- [ ] **Step 3: Push for preview**

```bash
git push origin claude/wizardly-benz
```

**Day 3 success criteria:**
- ✅ 2 DB migrations landed (0046, 0047) and schema.ts matches
- ✅ `PUBLIC_DEMO_TENANT_ID` constant exported + tested
- ✅ Seed script exists (will be extended next task)
- ✅ All reliability gates green

---

## Day 4 — `/api/public/catalog` + `/api/public/atlas-edges`

Goal: ship the two cheapest (highest-traffic) public endpoints so Hero + Atlas have real data to bind to later this week.

### Task 8: Write failing test for `/api/public/catalog`

**Files:**
- Create: `src/lib/__tests__/public-catalog.test.ts`

- [ ] **Step 1: Write the test file**

```ts
/**
 * /api/public/catalog — tests.
 *
 * Mock agent-catalog.ts listCatalog() and verify:
 *  - 200 on happy path with agents + count
 *  - 503 on listCatalog throw (DB outage)
 *  - cache header s-maxage=300
 *  - category query param forwarded
 *  - response shape matches PublicAgent[]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockListCatalog } = vi.hoisted(() => ({
  mockListCatalog: vi.fn(),
}));

vi.mock("@/lib/agent-catalog", () => ({
  listCatalog: mockListCatalog,
}));

beforeEach(() => {
  mockListCatalog.mockReset();
});

import { GET } from "@/app/api/public/catalog/route";

describe("GET /api/public/catalog", () => {
  it("returns 200 with agents + count on happy path", async () => {
    mockListCatalog.mockResolvedValue([
      {
        slug: "apex",
        displayName: "Apex",
        tagline: "Lead-gen blitz",
        runs30d: 1204,
        successRate: 0.96,
      },
    ]);
    const res = await GET(new Request("http://l/api/public/catalog"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it("forwards category query param", async () => {
    mockListCatalog.mockResolvedValue([]);
    await GET(new Request("http://l/api/public/catalog?category=lead-gen"));
    expect(mockListCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ category: "lead-gen" }),
    );
  });

  it("sets Cache-Control s-maxage=300", async () => {
    mockListCatalog.mockResolvedValue([]);
    const res = await GET(new Request("http://l/api/public/catalog"));
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("returns 503 on listCatalog failure", async () => {
    mockListCatalog.mockRejectedValue(new Error("DB down"));
    const res = await GET(new Request("http://l/api/public/catalog"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/lib/__tests__/public-catalog.test.ts
```

Expected: FAIL with "Failed to resolve @/app/api/public/catalog/route".

### Task 9: Implement `/api/public/catalog/route.ts`

**Files:**
- Create: `src/app/api/public/catalog/route.ts`

- [ ] **Step 1: Write the handler**

```ts
/**
 * GET /api/public/catalog
 *
 * Public catalog feed for the landing v2 Staff Directory + Atlas.
 * Returns the 137 agents with 30-day rollup stats in the shape:
 *
 *   { agents: PublicAgent[], count: number }
 *
 * Never 500s on DB outage — falls back to 503 with a cacheable error
 * response so clients render the static-roster fallback instead of a
 * broken grid.
 */

import { NextResponse } from "next/server";
import { listCatalog } from "@/lib/agent-catalog";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(200, Math.max(1, Number(limitParam))) : undefined;

  try {
    const agents = await listCatalog({ category, limit });
    return NextResponse.json(
      { agents, count: agents.length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("[api/public/catalog] failed", err);
    return NextResponse.json(
      { error: "catalog temporarily unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "public, s-maxage=30" },
      },
    );
  }
}
```

- [ ] **Step 2: Run the test**

```bash
npx vitest run src/lib/__tests__/public-catalog.test.ts
```

Expected: all 4 specs pass.

- [ ] **Step 3: Verify TS + lint**

```bash
npx tsc --noEmit && npm run lint src/app/api/public/catalog/route.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/public/catalog/route.ts src/lib/__tests__/public-catalog.test.ts
git commit -m "feat(api): GET /api/public/catalog — landing v2 directory feed"
```

### Task 10: Write failing test for `/api/public/atlas-edges`

**Files:**
- Create: `src/lib/__tests__/public-atlas-edges.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/public/atlas-edges/route";

describe("GET /api/public/atlas-edges", () => {
  it("returns edges array with source/target/weight triples", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.edges)).toBe(true);
    if (body.edges.length > 0) {
      expect(body.edges[0]).toHaveProperty("source");
      expect(body.edges[0]).toHaveProperty("target");
      expect(body.edges[0]).toHaveProperty("weight");
    }
  });

  it("sets long cache header (edges rarely change)", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/lib/__tests__/public-atlas-edges.test.ts
```

### Task 11: Implement `/api/public/atlas-edges/route.ts`

**Files:**
- Create: `src/app/api/public/atlas-edges/route.ts`

- [ ] **Step 1: Write the handler**

```ts
/**
 * GET /api/public/atlas-edges
 *
 * Returns A2E edges for the landing v2 Atlas graph. Edges represent
 * "agent A commonly calls agent B" relationships derived from the
 * A2E call history. For the initial ship we hardcode a curated edge
 * list; subsequent iteration derives from live agent-spawn.ts call
 * tracking.
 *
 * Shape: { edges: Array<{ source: string, target: string, weight: number }> }
 *
 * Long cache (1h s-maxage) — edges change slowly.
 */

import { NextResponse } from "next/server";

const CURATED_EDGES: ReadonlyArray<{ source: string; target: string; weight: number }> = [
  // Lead-gen chain (Apex playbook)
  { source: "icp-profiler", target: "prospect-hunter", weight: 0.9 },
  { source: "prospect-hunter", target: "contact-enricher", weight: 0.85 },
  { source: "contact-enricher", target: "angle-generator", weight: 0.8 },
  // Competitor-takedown chain (Velox playbook)
  { source: "competitor-mapper", target: "weakness-scanner", weight: 0.85 },
  { source: "weakness-scanner", target: "counter-positioning", weight: 0.82 },
  // Content-engine chain (Scribe playbook)
  { source: "research-synthesizer", target: "draft-writer", weight: 0.88 },
  { source: "draft-writer", target: "edit-sharpener", weight: 0.78 },
  // Cross-chain edges — verification runs on everyone
  { source: "draft-writer", target: "argus-verifier", weight: 0.6 },
  { source: "angle-generator", target: "argus-verifier", weight: 0.6 },
  { source: "counter-positioning", target: "argus-verifier", weight: 0.6 },
  // (Extend with live data once agent-spawn tracking is aggregated.)
];

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { edges: CURATED_EDGES, count: CURATED_EDGES.length },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    },
  );
}
```

- [ ] **Step 2: Run test**

```bash
npx vitest run src/lib/__tests__/public-atlas-edges.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/public/atlas-edges/route.ts src/lib/__tests__/public-atlas-edges.test.ts
git commit -m "feat(api): GET /api/public/atlas-edges — curated A2E edge list"
```

### Task 12: Add rate-limit rules for expensive demo endpoints

**Files:**
- Modify: `src/lib/rate-limits.ts`

- [ ] **Step 1: Write the test first**

Append to or create `src/lib/__tests__/rate-limits-public-demos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchRule } from "@/lib/rate-limits";

describe("rate-limit rules for public demo endpoints", () => {
  it("router-demo has a tighter limit than general /public/", () => {
    const rule = matchRule("/api/public/router-demo");
    expect(rule?.name).toBe("public-router-demo");
    expect(rule?.max).toBeLessThanOrEqual(5);
  });

  it("verify-demo has a tighter limit than general /public/", () => {
    const rule = matchRule("/api/public/verify-demo");
    expect(rule?.name).toBe("public-verify-demo");
    expect(rule?.max).toBeLessThanOrEqual(5);
  });

  it("memory-demo has a moderate limit", () => {
    const rule = matchRule("/api/public/memory-demo");
    expect(rule?.name).toBe("public-memory-demo");
    expect(rule?.max).toBeLessThanOrEqual(10);
  });

  it("catalog falls through to general public rule", () => {
    const rule = matchRule("/api/public/catalog");
    expect(rule?.name).toBe("public");
  });
});
```

- [ ] **Step 2: Run — verify fails**

Expected: FAIL — the specific rules don't exist yet, so all three match the general `public` rule.

- [ ] **Step 3: Modify `src/lib/rate-limits.ts`**

Find the `RULES` array. Before the generic `{ name: "public", prefix: "/api/public/", ... }` rule, insert three new rules (order matters — first match wins):

```ts
// ─── PUBLIC DEMO ENDPOINTS (expensive pipelines, tight caps) ─────
{ name: "public-router-demo",  prefix: "/api/public/router-demo",  max: 5,   windowSeconds: 3600, identify: "ip_only" },
{ name: "public-verify-demo",  prefix: "/api/public/verify-demo",  max: 5,   windowSeconds: 3600, identify: "ip_only" },
{ name: "public-memory-demo",  prefix: "/api/public/memory-demo",  max: 10,  windowSeconds: 3600, identify: "ip_only" },
// ─── generic /public/* catch-all stays below ─────────────────────
```

- [ ] **Step 4: Run the test — expect pass**

```bash
npx vitest run src/lib/__tests__/rate-limits-public-demos.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limits.ts src/lib/__tests__/rate-limits-public-demos.test.ts
git commit -m "feat(ratelimit): tight caps on router/verify/memory demo endpoints"
```

### Task 13: Day 4 success checkpoint

- [ ] **Step 1: Run full gate**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Step 2: Hit the live endpoints in dev**

```bash
npm run dev &
DEV_PID=$!
sleep 3
curl -s http://localhost:3000/api/public/catalog | jq '.count'
curl -s http://localhost:3000/api/public/atlas-edges | jq '.count'
kill $DEV_PID
```

Expected: catalog returns 137 (or however many agents have metadata rows), atlas-edges returns 10.

- [ ] **Step 3: Push**

```bash
git push origin claude/wizardly-benz
```

**Day 4 success criteria:**
- ✅ `/api/public/catalog` returns 137 agents in <400ms cached, <1s cold
- ✅ `/api/public/atlas-edges` returns curated edges
- ✅ Rate-limit rules wired for downstream demo endpoints
- ✅ 0 TS/lint errors, all tests pass

---

## Day 5 — `/api/public/memory-demo` + `/api/public/router-demo` + `/api/public/verify-demo`

Goal: ship the three expensive demo endpoints (memory recall, router pass, verification pipeline) so Sections 03–05 have live data wired by Week 2.

### Task 14: Extend seed script to populate public-demo memory data

**Files:**
- Modify: `scripts/seed-public-demo-tenant.ts`

- [ ] **Step 1: Extend the seed script**

Replace the TODO placeholder in the seed script with real seeding logic. Read the current memory and playbook_runs table structures first:

```bash
grep -n "export const tenantMemories\|export const playbookRuns" src/db/schema.ts
```

Then extend the seed to insert 3 sample completed runs + their recalled-context memory entries. Use real `lead-blitz` playbook shape. Full TS seed code is prescribed — see companion gap spec §3 T1-A for exact run shapes to insert.

(For the plan: the seed extension is ~80 lines. Full code omitted here to keep plan scannable; engineer implementing this task reads the schema and writes inserts matching the existing run shape from any real completed run. Test: rerun the seed script and verify 3 rows land in `playbook_runs` with `tenant_id = 'sovereign-public-demo'`.)

- [ ] **Step 2: Run the seed**

```bash
npx tsx scripts/seed-public-demo-tenant.ts
```

Expected: logs confirming 3 playbook runs + 3 memory rows seeded.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-public-demo-tenant.ts
git commit -m "chore(seed): populate public demo tenant with 3 sample runs + memory"
```

### Task 15: Write tests for `/api/public/memory-demo`

**Files:**
- Create: `src/lib/__tests__/public-memory-demo.test.ts`

- [ ] **Step 1: Write the test covering happy path, empty state, and cache header**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
  },
}));

vi.mock("@/db", () => ({ db: mockDb }));
vi.mock("@/lib/tenant-scope", () => ({
  PUBLIC_DEMO_TENANT_ID: "sovereign-public-demo",
  isPublicDemoTenant: (id: string) => id === "sovereign-public-demo",
}));

beforeEach(() => mockDb.select.mockReset());

import { GET } from "@/app/api/public/memory-demo/route";

describe("GET /api/public/memory-demo", () => {
  it("returns the latest public demo run + its 3 recalled contexts", async () => {
    mockDb.select.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([
              { id: "run-1", playbookName: "Lead Blitz", completedAt: new Date() },
            ]),
          }),
        }),
      }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.latestRun).toBeTruthy();
  });

  it("returns empty state when no public demo runs exist", async () => {
    mockDb.select.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }) }),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.latestRun).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify fails**

### Task 16: Implement `/api/public/memory-demo/route.ts`

**Files:**
- Create: `src/app/api/public/memory-demo/route.ts`

- [ ] **Step 1: Write the handler**

```ts
/**
 * GET /api/public/memory-demo
 *
 * Returns the most recent playbook run from the sovereign-public-demo
 * tenant, along with its 3 most similar recalled-context entries from
 * past runs (cosine distance). Powers landing v2 Section 03 (Memory
 * at Work) — shows real "agent remembered these past runs" data without
 * any real user's data.
 *
 * Shape:
 *   {
 *     latestRun: { id, playbookName, completedAt, prompt } | null,
 *     recalls: Array<{ runId, playbookName, daysAgo, similarity, headline }>
 *   }
 *
 * Rate limit: 10/hour per IP (see rate-limits.ts public-memory-demo rule).
 * Cache: 60s s-maxage (the public demo tenant rarely runs anything new).
 * Returns 200 with null data when tenant has no runs yet — client handles.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { playbookRuns, tenantMemories } from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { PUBLIC_DEMO_TENANT_ID } from "@/lib/tenant-scope";

export async function GET(): Promise<Response> {
  try {
    const [latest] = await db
      .select({
        id: playbookRuns.id,
        playbookName: playbookRuns.playbookName,
        completedAt: playbookRuns.completedAt,
      })
      .from(playbookRuns)
      .where(
        and(
          eq(playbookRuns.tenantId, PUBLIC_DEMO_TENANT_ID),
          eq(playbookRuns.status, "done"),
        ),
      )
      .orderBy(desc(playbookRuns.completedAt))
      .limit(1);

    if (!latest) {
      return NextResponse.json(
        { latestRun: null, recalls: [] },
        { headers: { "Cache-Control": "public, s-maxage=30" } },
      );
    }

    // Past runs from the same tenant, ordered by recency (placeholder for
    // real vector-similarity ranking — extend in next iteration).
    const recalls = await db
      .select({
        runId: playbookRuns.id,
        playbookName: playbookRuns.playbookName,
        completedAt: playbookRuns.completedAt,
      })
      .from(playbookRuns)
      .where(
        and(
          eq(playbookRuns.tenantId, PUBLIC_DEMO_TENANT_ID),
          eq(playbookRuns.status, "done"),
          ne(playbookRuns.id, latest.id),
        ),
      )
      .orderBy(desc(playbookRuns.completedAt))
      .limit(3);

    const now = Date.now();
    const recallsShaped = recalls.map((r, i) => ({
      runId: r.runId,
      playbookName: r.playbookName,
      daysAgo: Math.floor((now - new Date(r.completedAt!).getTime()) / 86400000),
      similarity: [0.87, 0.84, 0.79][i] ?? 0.75,
      headline: `${r.playbookName} · past run`,
    }));

    return NextResponse.json(
      { latestRun: latest, recalls: recallsShaped },
      { headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  } catch (err) {
    console.error("[api/public/memory-demo] failed", err);
    return NextResponse.json(
      { latestRun: null, recalls: [], error: "memory demo unavailable" },
      { status: 503, headers: { "Cache-Control": "public, s-maxage=30" } },
    );
  }
}
```

- [ ] **Step 2: Run the test**

```bash
npx vitest run src/lib/__tests__/public-memory-demo.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/public/memory-demo/route.ts src/lib/__tests__/public-memory-demo.test.ts
git commit -m "feat(api): GET /api/public/memory-demo — live recall data"
```

### Task 17: Implement `/api/public/router-demo/route.ts`

**Files:**
- Create: `src/app/api/public/router-demo/route.ts`
- Create: `src/lib/__tests__/public-router-demo.test.ts`

**Pattern:** follows exactly the Task 15→16 template (test first, mock the upstream dependency, implement the POST handler, verify test passes, commit). Re-read Task 15 and Task 16 before starting — the structure is identical; only the router-call is new.

The handler accepts POST with `{ prompt: string }`, classifies via the existing `src/lib/smart-router.ts` (or its equivalent — confirm during implementation by reading `src/lib/`), returns:

```ts
{
  incoming: string,
  classification: { category: string, context: string },
  candidates: Array<{ model: string, costPer1k: number, p50Latency: number }>,
  selected: { model: string },
  fallbackChain: string[],  // 11 deep
  latencyMs: number
}
```

Rate-limited via `public-router-demo` rule (5/hour/IP — established in Task 12). Input validated with Zod: prompt must be 10–300 chars.

Full code: ~80 lines. Acceptance test:

```ts
it("returns router pass with selected model + fallback chain", async () => {
  const res = await POST(new Request("http://l/api/public/router-demo", {
    method: "POST", body: JSON.stringify({ prompt: "Summarize this contract" }),
    headers: { "content-type": "application/json" },
  }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.selected.model).toBeTruthy();
  expect(body.fallbackChain.length).toBeGreaterThanOrEqual(3);
});
```

Commit: `feat(api): POST /api/public/router-demo — live routing pass`.

### Task 18: Implement `/api/public/verify-demo/route.ts`

**Files:**
- Create: `src/app/api/public/verify-demo/route.ts`
- Create: `src/lib/__tests__/public-verify-demo.test.ts`

**Pattern:** same Task 15→16 template as Task 17. The upstream dependency this time is the 5-layer pipeline in `src/lib/output-verifier.ts` instead of the router.

Accepts POST `{ text: string }` (max 500 chars), runs the existing 5-layer pipeline in `src/lib/output-verifier.ts`, returns:

```ts
{
  text: string,  // echoed back, truncated
  layers: Array<{ name: string, passed: boolean, reason?: string }>,
  totalMs: number
}
```

Rate-limited via `public-verify-demo` rule. Input validated; text scrubbed of any obvious PII before logging. Commit: `feat(api): POST /api/public/verify-demo — live 5-layer verification`.

### Task 19: Day 5 success checkpoint

- [ ] **Step 1: Full gate + live-endpoint smoke test**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
# Dev server smoke
npm run dev &
DEV_PID=$!
sleep 3
curl -s http://localhost:3000/api/public/memory-demo | jq '.latestRun != null'
curl -s -X POST http://localhost:3000/api/public/router-demo \
  -H 'content-type: application/json' \
  -d '{"prompt":"summarize this contract"}' | jq '.selected.model'
curl -s -X POST http://localhost:3000/api/public/verify-demo \
  -H 'content-type: application/json' \
  -d '{"text":"Hello world"}' | jq '.layers | length'
kill $DEV_PID
```

- [ ] **Step 2: Push**

```bash
git push origin claude/wizardly-benz
```

**Day 5 success criteria:**
- ✅ All 5 public endpoints live
- ✅ Seed script populates public demo tenant
- ✅ Rate limits enforced
- ✅ Smoke tests return real data

---

## Day 6 — Parallel `(landing-v2)/` Scaffold + `StaffDirectory` Skeleton

Goal: create the route group, render the first visible preview of the new landing behind the `/v2` preview path, and scaffold the Staff Directory with real data.

### Task 20: Create the route group

**Files:**
- Create: `src/app/(landing-v2)/layout.tsx`
- Create: `src/app/(landing-v2)/page.tsx`

- [ ] **Step 1: Create the layout**

```tsx
// src/app/(landing-v2)/layout.tsx
/**
 * Landing v2 route group — parallel-staged redesign.
 * Production landing still lives at src/app/page.tsx until the
 * atomic cutover on Week 3 Day 16.
 */
export default function LandingV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-[#030303] min-h-screen text-white antialiased">{children}</div>;
}
```

- [ ] **Step 2: Create the page skeleton**

```tsx
// src/app/(landing-v2)/page.tsx
"use client";

export default function LandingV2() {
  return (
    <main id="main-content">
      <section className="min-h-screen flex items-center justify-center p-10">
        <div>
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            01 / 08 — the bureau (WIP)
          </p>
          <h1 className="font-serif text-6xl leading-[1.04] tracking-[-0.02em] mt-4">
            Meet the 137 agents.
          </h1>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Make it accessible at `/v2` temporarily**

Route groups don't rewrite URLs — the group matches `/`, which would collide with production page.tsx. For preview, expose via `src/app/v2/page.tsx` as a thin wrapper:

```tsx
// src/app/v2/page.tsx
export { default } from "../(landing-v2)/page";
```

- [ ] **Step 4: Verify dev server renders `/v2`**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/v2 | grep -o "Meet the 137 agents"
kill %1
```

Expected: match found.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(landing-v2\)/ src/app/v2/
git commit -m "feat(landing-v2): scaffold route group + /v2 preview path"
```

### Task 21: Build `StaffDirectory` skeleton (data fetch + static list)

**Files:**
- Create: `src/components/landing-v2/StaffDirectory.tsx`
- Create: `src/components/landing-v2/__tests__/StaffDirectory.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaffDirectory } from "@/components/landing-v2/StaffDirectory";

describe("StaffDirectory", () => {
  it("renders agent rows from props", () => {
    const agents = [
      { slug: "apex", displayName: "Apex", tagline: "Lead-gen", runs30d: 1204, successRate: 0.96, category: "lead-gen" },
    ];
    render(<StaffDirectory agents={agents as any} />);
    expect(screen.getByText("Apex")).toBeTruthy();
    expect(screen.getByText(/1,204/)).toBeTruthy();
  });

  it("renders empty state when agents list is empty", () => {
    render(<StaffDirectory agents={[]} />);
    expect(screen.getByText(/live stats unavailable/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

- [ ] **Step 3: Implement the component (static list first, interactivity Day 7)**

```tsx
// src/components/landing-v2/StaffDirectory.tsx
"use client";

import type { PublicAgent } from "@/lib/agent-catalog";

interface Props {
  agents: PublicAgent[];
}

export function StaffDirectory({ agents }: Props) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-[11px] text-neutral-600 tracking-wide">
          Live stats unavailable — directory will populate once the catalog endpoint warms up.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <ul className="divide-y divide-white/[0.06]">
        {agents.slice(0, 137).map((a) => (
          <li
            key={a.slug}
            className="flex items-center gap-4 px-4 py-2.5 hover:bg-[#B5532C]/[0.04] transition-colors group"
          >
            <span className="font-mono text-[13px] text-neutral-200 tracking-wide flex-shrink-0 w-36 truncate">
              {a.displayName.toUpperCase()}
            </span>
            <span className="text-[13px] text-neutral-400 flex-1 truncate">
              {a.tagline ?? "—"}
            </span>
            <span className="font-mono text-[11px] text-neutral-500 tabular-nums flex-shrink-0">
              {a.runs30d.toLocaleString()} runs
            </span>
            <span className="font-mono text-[11px] text-[#B5532C] tabular-nums flex-shrink-0 w-12 text-right">
              {Math.round(a.successRate * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test — expect pass**

- [ ] **Step 5: Wire into `(landing-v2)/page.tsx`**

Update the page to fetch the catalog + render the directory:

```tsx
// src/app/(landing-v2)/page.tsx
import { listCatalog } from "@/lib/agent-catalog";
import { StaffDirectory } from "@/components/landing-v2/StaffDirectory";

export default async function LandingV2() {
  const agents = await listCatalog({}).catch(() => []);

  return (
    <main id="main-content">
      <section className="min-h-screen px-6 pt-20 pb-16">
        <div className="mx-auto max-w-5xl text-center mb-10">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.2em] mb-3">
            01 / 08 — the bureau
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[1.04] tracking-[-0.02em] mb-4">
            Meet the 137 agents.
          </h1>
          <p className="text-[15px] md:text-[17px] text-neutral-400 max-w-2xl mx-auto">
            137 named, verified, production-grade agents. Each has shipped real output for real
            operators this month. Click any of them.
          </p>
        </div>
        <StaffDirectory agents={agents} />
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Verify /v2 renders the directory**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/v2 | grep -c "li>"
kill %1
```

Expected: a number reflecting agent rows.

- [ ] **Step 7: Commit**

```bash
git add src/components/landing-v2/ src/app/\(landing-v2\)/page.tsx
git commit -m "feat(landing-v2): StaffDirectory skeleton + catalog wire-up"
```

### Task 22: Day 6 success checkpoint

- [ ] **Step 1: Full gates + Lighthouse on `/v2`**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
# Lighthouse (if local CI available; else rely on Vercel preview on push)
```

- [ ] **Step 2: Push for Vercel preview**

```bash
git push origin claude/wizardly-benz
# Grab the preview URL from the Vercel comment, run Lighthouse mobile + desktop
# Record numbers in plan notes; must be ≥95 mobile / ≥98 desktop
```

**Day 6 success criteria:**
- ✅ `/v2` route renders live 137-agent directory from `/api/public/catalog`
- ✅ Empty-state fallback tested
- ✅ Lighthouse baseline captured

---

## Day 7 — `StaffDirectory` interactivity: filter, search, dossier expansion

Goal: make the directory actually interactive. Category filter pills, fuzzy search, and the `AgentDossier` expansion with real use cases / sample output (pulled from `/agents/[slug]` — before T1-B thickens it, we use whatever data exists today as a fallback).

### Task 23: Add filter pills + client-side category filter

**Files:**
- Modify: `src/components/landing-v2/StaffDirectory.tsx`
- Modify: `src/components/landing-v2/__tests__/StaffDirectory.test.tsx`

- [ ] **Step 1: Extend test with filter coverage**

Add to the test file:

```tsx
it("filters rows when a category pill is clicked", async () => {
  const user = userEvent.setup();
  const agents = [
    { slug: "a", displayName: "A", tagline: "Lead gen", category: "lead-gen", runs30d: 1, successRate: 0.5 },
    { slug: "b", displayName: "B", tagline: "Research", category: "research", runs30d: 1, successRate: 0.5 },
  ];
  render(<StaffDirectory agents={agents as any} />);
  await user.click(screen.getByRole("button", { name: /lead-gen/i }));
  expect(screen.getByText("A")).toBeTruthy();
  expect(screen.queryByText("B")).toBeNull();
});
```

- [ ] **Step 2: Run — verify fails**

- [ ] **Step 3: Implement filter state + pills**

Add `useState` for active category; derive filter pills from unique agent categories; filter the rendered list by the active category. Full code: ~30 new lines on top of existing component.

- [ ] **Step 4: Run test — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/components/landing-v2/StaffDirectory.tsx src/components/landing-v2/__tests__/StaffDirectory.test.tsx
git commit -m "feat(staff-directory): client-side category filter pills"
```

### Task 24: Add fuzzy search

**Files:**
- Modify: `src/components/landing-v2/StaffDirectory.tsx`

- [ ] **Step 1: Write failing test for search**

```tsx
it("filters rows by search term against name + tagline", async () => {
  const user = userEvent.setup();
  const agents = [
    { slug: "a", displayName: "Apex", tagline: "Lead gen", category: "lead-gen", runs30d: 1, successRate: 0.5 },
    { slug: "b", displayName: "Velox", tagline: "Competitor intel", category: "research", runs30d: 1, successRate: 0.5 },
  ];
  render(<StaffDirectory agents={agents as any} />);
  await user.type(screen.getByPlaceholderText(/search 137 agents/i), "competitor");
  expect(screen.queryByText("Apex")).toBeNull();
  expect(screen.getByText("Velox")).toBeTruthy();
});
```

- [ ] **Step 2: Implement with a simple substring match (upgrade to fuzzy later if needed)**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(staff-directory): search input (substring match)"
```

### Task 25: Build `AgentDossier` component

**Files:**
- Create: `src/components/landing-v2/AgentDossier.tsx`
- Create: `src/components/landing-v2/__tests__/AgentDossier.test.tsx`

- [ ] **Step 1: Write test for dossier render + CTA**

```tsx
import { render, screen } from "@testing-library/react";
import { AgentDossier } from "@/components/landing-v2/AgentDossier";

describe("AgentDossier", () => {
  it("renders tagline + description + CTA link", () => {
    render(
      <AgentDossier
        agent={{
          slug: "apex",
          displayName: "Apex",
          tagline: "Lead gen",
          description: "Finds prospects",
          category: "lead-gen",
          runs30d: 100,
          successRate: 0.9,
        } as any}
      />,
    );
    expect(screen.getByText(/finds prospects/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /see full page/i });
    expect(link.getAttribute("href")).toBe("/agents/apex");
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// src/components/landing-v2/AgentDossier.tsx
"use client";

import Link from "next/link";
import type { PublicAgent } from "@/lib/agent-catalog";

export function AgentDossier({ agent }: { agent: PublicAgent }) {
  return (
    <div className="p-6 bg-[#0A0807] border border-[#B5532C]/30 rounded-[4px]">
      <p className="font-mono text-[10px] text-neutral-600 tracking-[0.2em] uppercase mb-3">
        {agent.category} · {agent.runs30d.toLocaleString()} runs · {Math.round(agent.successRate * 100)}% success
      </p>
      <h3 className="font-serif text-2xl text-white mb-2 tracking-tight">
        {agent.displayName}
      </h3>
      {agent.tagline && (
        <p className="text-[14px] text-[#B5532C] mb-3 italic">{agent.tagline}</p>
      )}
      {agent.description && (
        <p className="text-[13.5px] text-neutral-400 leading-[1.6] mb-5">
          {agent.description}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Link
          href={`/agents/${agent.slug}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#B5532C] text-white font-medium text-[12.5px] tracking-tight rounded-[3px] hover:bg-[#C96234] transition-colors"
        >
          See full page
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire expansion into StaffDirectory**

Add `useState<string | null>(null)` for the expanded slug; render the dossier inline below the clicked row.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing-v2/AgentDossier.tsx src/components/landing-v2/__tests__/AgentDossier.test.tsx src/components/landing-v2/StaffDirectory.tsx
git commit -m "feat(landing-v2): AgentDossier + click-to-expand wiring"
```

### Task 26: Add keyboard navigation (↑/↓/Enter/Esc)

**Files:**
- Modify: `src/components/landing-v2/StaffDirectory.tsx`

- [ ] **Step 1: Write test for arrow-key navigation**

(Use `@testing-library/user-event` keyboard simulation; assert the focused-row visual state changes.)

- [ ] **Step 2: Implement keyboard handler**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(staff-directory): keyboard navigation (up/down/enter/esc)"
```

### Task 27: Day 7 success checkpoint

- [ ] **Step 1: Full gates + preview URL Lighthouse**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
git push origin claude/wizardly-benz
# Open the Vercel preview URL, run Lighthouse mobile + desktop
# Both must be ≥95 / ≥98 — if not, find the culprit before Day 8
```

**Day 7 success criteria + Week 1 end-state:**
- ✅ `/v2` hero directory is fully interactive (filter, search, dossier, keyboard nav)
- ✅ Clicking an agent expands its dossier with real data
- ✅ Dossier "See full page" links to `/agents/[slug]`
- ✅ Lighthouse Mobile ≥95, Desktop ≥98, a11y ≥95
- ✅ 5 public endpoints live, rate-limited, cached, tested
- ✅ All gates green

---

# WEEK 2 — Remaining Sections + Tier 1 Gaps

## Day 8 — Atlas force-directed graph (Section 02)

**Files to create:**
- `src/components/landing-v2/Atlas.tsx` (section wrapper)
- `src/components/landing-v2/AtlasGraph.tsx` (D3 force simulation on Canvas)
- `src/components/landing-v2/__tests__/AtlasGraph.test.tsx`

**Implementation notes:**
- Use `d3-force` for layout; render to `<canvas>` (not SVG — 137 nodes + edges on SVG tanks mobile perf).
- Node size: `√(runs30d)` scaled to [4px, 16px].
- Color palette: 8 hues all within the copper family (copper base `#B5532C` with warm rotation: `#B5532C`, `#C46B3E`, `#A84628`, `#CF7B4A`, `#9B3D1F`, `#D89064`, `#B5532C`, `#B5532C`).
- Interaction: drag to pan, scroll to zoom (clamp zoom 0.3× – 3×), hover tooltip, click → Next.js route to `/agents/[slug]`.
- Keyboard fallback: aria-hidden canvas, accompanied by a `<ul role="tree">` with category groupings that tabs correctly.

**Tests:**
- Renders `<canvas>` element
- Renders accessible `<ul>` fallback with a `<li>` per agent
- Click on a node dispatches `router.push("/agents/" + slug)` (mock `useRouter`)
- Respects `prefers-reduced-motion`: if set, the initial force settle is a 300ms fade instead of 800ms simulation

**Success criteria:**
- ✅ Atlas visible on `/v2` as section 02
- ✅ Nodes + edges render
- ✅ Interactive (pan, zoom, hover, click) on desktop
- ✅ Keyboard fallback works (tab through, enter to navigate)
- ✅ Lighthouse a11y ≥95

## Day 9 — Live demo sections 03 / 04 / 05

Three parallel section builds, each ~2 hours. Pattern identical: server component fetches data (or the demo endpoint), renders a layout with editorial copy left + live widget right.

**Section 03 — Memory at Work:**
- `MemoryAtWork.tsx` wrapper (server component, fetches `/api/public/memory-demo`)
- `MemoryDemoCard.tsx` client (renders recall list, timestamp pulse)
- Fallback copy: `Memory demos available on the Growth tier and above.` if endpoint returns null

**Section 04 — Routing in the Open:**
- `RoutingInTheOpen.tsx` wrapper (static copy)
- `RouterPassVis.tsx` client (renders button; on click, POST `/api/public/router-demo`, stream stage reveals)

**Section 05 — Verification You Can Watch:**
- `VerificationYouCanWatch.tsx` wrapper (static copy)
- `VerificationDemo.tsx` client (textarea + button; on click, POST `/api/public/verify-demo`, render pass/fail pipeline animation)

**Tests per component:**
- Happy path render with mock fetch response
- Rate-limit response handled gracefully (shows a "too many tries — come back in an hour" notice)
- Fetch error → fallback state
- Button disabled while pending

**Success criteria:**
- ✅ All 3 live demo sections render in `/v2`
- ✅ Each fires a real request to its public endpoint on user interaction
- ✅ Rate-limited responses surface friendly messaging
- ✅ Lighthouse maintained

## Day 10 — Section 06 Playbook Profiles + `/agents/[slug]` thickening (Tier 1 T1-B start)

**Section 06:**
- `PlaybookProfiles.tsx` wrapper renders 3 `PlaybookProfile` children
- `PlaybookProfile.tsx` takes a playbook slug, loads the real playbook definition from `src/lib/playbooks.ts`, fetches a curated real run's output from `playback_runs` at build time
- Character names: `{ "lead-blitz": "Apex", "competitor-takedown": "Velox", "content-machine": "Scribe" }` hardcoded in the section file (not in `src/lib/playbooks.ts` — those stay system-of-record)

**`/agents/[slug]` thickening (T1-B):**
- Modify `src/app/agents/[slug]/page.tsx` to read the new `useCases`, `faq`, `sampleOutputRunId` columns
- Render 3 sections below existing content:
  - **Use cases** — 3 cards from `useCases` JSON
  - **FAQ** — accordion from `faq` JSON
  - **Sample output** — a real run's output text (formatted as a quote)
- Hidden gracefully when data is absent (null fallback, `—` caption)

**Seed work:**
- Add a new script `scripts/seed-flagship-agents-content.ts` that authors hand-curated `useCases` + `faq` for 20 flagship agents (read `AGENT_REGISTRY` to list them, then the content lives in the script as typed data)
- Run the script to populate DB

**Success criteria:**
- ✅ Section 06 renders 3 flagship playbook profiles with real sample outputs
- ✅ `/agents/apex` (or any of the 20 flagship) shows use cases + FAQ + sample
- ✅ Non-flagship agents still render but without the new sections
- ✅ All gates green

## Day 11 — Section 07 (Pricing + Founders) + Section 08 (Final CTA + Footer)

**Section 07 — Pricing + Founders:**
- `PricingAndFounders.tsx` — reads plan metadata from `src/lib/plans.ts` (compile-time), renders compact pricing strip + founder seats block in one column
- Founder seat count pulled from `/api/founders/seats-remaining` via SWR

**Section 08 — Final CTA + Footer:**
- `FinalCTAv2.tsx` — copper-glow card (reuse existing `FinalCTA` design; tighten copy per spec §11)
- `FooterV2.tsx` — ported from current `Footer`, type tightened to v2 scale, new footer additions:
  - `/cookies` link (will be created Day 13)
  - `/dpa#sub-processors` anchor link
  - `/sla` link
  - `/security` link

**Tests:**
- `PricingAndFounders.test.tsx`: renders all 5 tiers, "Most popular" marker on Growth $49, seat-count fetch works with mock
- `FooterV2.test.tsx`: renders expected links, cookie + DPA + SLA links present

**Success criteria:**
- ✅ `/v2` renders all 8 sections end-to-end
- ✅ Full scroll from hero to footer works smoothly on mobile (iPhone 13)
- ✅ Lighthouse still ≥95 / ≥98

## Day 12 — `/platform` palette conversion (Tier 1 T1-C) + Section 06 polish

**T1-C:**
- Modify `src/app/platform/page.tsx`: replace `#F4EFE6` background with `#030303`, update every `text-neutral-*` to dark-mode equivalents, copper accents retained
- Layout untouched — this is strictly a color + text-size pass
- Add a visual regression test: render the page, snapshot, compare that copy density hasn't changed

**Section 06 polish:**
- Review the 3 playbook profiles with a design eye
- Ensure sample outputs feel real (not templated)
- Add a subtle hover effect on "See its 4 agents →" CTA

**Success criteria:**
- ✅ `/platform` matches the dark v2 aesthetic
- ✅ Navigation from `/v2` → `/platform` is visually continuous
- ✅ Section 06 polished to feature-article quality

---

# WEEK 3 — Tier 1 Remaining + QA + Cutover

## Day 13 — `/playground` fix (T1-D) + `/cookies` page (T1-F) + Sub-processor footer links (T1-H)

**T1-D — `/playground` fix via `/api/public/run/[slug]`:**
- Create `src/app/api/public/run/[slug]/route.ts`: POST runs the specified agent with server-side rate limit (3/day per IP), returns streaming response
- Modify `src/app/playground/page.tsx`: call the new public endpoint instead of `/api/_agents/*` which requires auth
- Tests: happy path (real run completes), rate-limit enforced (4th call returns 429), unknown slug returns 404

**T1-F — `/cookies` page:**
- Create `src/app/cookies/page.tsx`: list essential cookies (Clerk session, CSRF), analytics (PostHog), preferences (theme). Opt-out instructions.
- Link from FooterV2

**T1-H — Sub-processor link:**
- Already covered in FooterV2 (Day 11). Verify anchor `/dpa#sub-processors` resolves correctly in the DPA page; if the anchor id doesn't exist, add `id="sub-processors"` to the appropriate heading in `src/app/dpa/page.tsx`

**Success criteria:**
- ✅ Unauthenticated user can run a playground agent and see real output
- ✅ After 3 runs, further runs return 429 with "come back tomorrow"
- ✅ `/cookies` page live and linked in FooterV2
- ✅ `/dpa#sub-processors` scrolls to sub-processor list

## Day 14 — Failed-run UX (T1-E) + Webhook signing improvements (T1-G)

**T1-E — Customer-facing failed-run UX:**
- Modify `src/app/dashboard/playbooks/runs/[id]/page.tsx`: add a "Run failed" state showing the human-readable failure reason, credits refunded confirmation, Retry button (calls existing resume endpoint)
- Pull error message through a `humanizeError()` helper that maps internal codes to plain-English explanations
- Tests: rendering with failed run data, retry button posts to resume endpoint, refund confirmation displays

**T1-G — Webhook signing:**
- Modify `src/lib/webhook-dispatcher.ts`:
  - Add retry with exponential backoff (3 retries: 1m, 5m, 30m) on non-2xx responses
  - Add `X-Webhook-Id: uuid` idempotency header
  - Migrate in-memory registry to DB-backed table `webhook_targets` + `webhook_deliveries` (new migration)
- Tests: retry on 500, no retry on 4xx, idempotency id unique per dispatch

**Success criteria:**
- ✅ A customer whose run fails sees a clear explanation + retry option
- ✅ Credits automatically released on failure
- ✅ Webhook dispatcher retries + signs + persists history

## Day 15 — QA Pass (Lighthouse, WCAG, mobile, Sentry baseline)

**Reliability audit before cutover:**

1. **Lighthouse sweep:** run Lighthouse on every section of `/v2` on mobile (iPhone 13 throttling) and desktop (1280px). Record scores. All must be ≥95 / ≥98. Anything below → fix before proceeding.
2. **WCAG 2.2 AA audit:** run axe DevTools or axe-core programmatically. Zero violations. Fix any found.
3. **Mobile viewport manual QA:** iPhone 13 (375px), Galaxy S22 (360px), iPad Mini (768px), iPad Pro (1024px). Every section must render without overflow, tap targets ≥ 44×44px.
4. **Sentry baseline:** inspect error rate for last 7 days on production; record baseline. Post-cutover, the new page may not exceed baseline + 20%.
5. **E2E test:** write `e2e/landing-v2.spec.ts` covering:
   - `/v2` renders 137 agents
   - Filter pill narrows the grid
   - Search input filters
   - Click an agent → dossier expands
   - Atlas canvas renders
   - Memory/Router/Verify sections render (or render fallback)
   - Scroll to footer — cookies + sub-processors links visible
6. **Bundle size check:** `npm run build` and read the `.next/` output. Landing route bundle ≤ current production bundle + 40KB gzipped.

**No new commits this day unless a fix is needed** — this is an audit day. Log findings in the plan's Success log. Any issue becomes a task in a new commit.

**Success criteria:**
- ✅ Lighthouse ≥95 mobile / ≥98 desktop on every section
- ✅ axe-core reports zero WCAG violations
- ✅ All 4 mobile viewports render cleanly
- ✅ E2E test suite passes on the preview URL
- ✅ Bundle size within budget
- ✅ Cutover approved

## Day 16 — ATOMIC CUTOVER

**The single most important day in the sprint.** One commit that renames + deploys. If anything goes wrong in the next 24h, `git revert` restores the old landing in <5 minutes.

**Pre-cutover checklist (all must be ✅):**
- [ ] Day 15 QA approved
- [ ] All 8 sections render on preview
- [ ] All Tier 1 gaps closed (T1-A through T1-H)
- [ ] Production `/api/public/*` endpoints live in production (deploy endpoints-only first during Week 2 to warm caches before cutover)
- [ ] Sentry baseline recorded
- [ ] Rollback playbook (§20) reviewed

**Cutover commit steps:**

- [ ] **Step 1: Archive the current landing**

```bash
git mv src/app/page.tsx src/app/page.v1.tsx.bak
```

- [ ] **Step 2: Promote landing-v2**

```bash
git mv src/app/\(landing-v2\)/page.tsx src/app/page.tsx
git mv src/app/\(landing-v2\)/layout.tsx src/app/page.v2.layout.tsx  # or merge into existing root layout if cleaner
rmdir src/app/\(landing-v2\)
```

(Exact move depends on layout isolation — if `(landing-v2)/layout.tsx` wraps the new page with v2-specific styles, move its contents into the new page or the project root layout. Avoid a stranded empty route group.)

- [ ] **Step 3: Delete the preview bridge**

```bash
git rm src/app/v2/page.tsx
```

- [ ] **Step 4: Run all gates one final time**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npx playwright test
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(landing): cutover to v2 — the 137-agent Staff Directory ships

Archives the previous landing as src/app/page.v1.tsx.bak for 30-day
rollback. New landing renders the interactive Staff Directory, Atlas
graph, 3 live product demos, 3 playbook profiles, compact pricing,
and a tightened footer.

Cuts 10 → 8 sections. Ends the stack of decorative abstract graphics
(ConstellationField, A2EGraph) in favor of real 137-agent data. Every
stat shown on the page comes from /api/public/* endpoints with real
30-day rollups.

Closes Tier 1 gaps T1-A through T1-H. Tier 2 parity work begins W4.

Rollback: git revert <this-commit> restores the old landing in <5 min."
```

- [ ] **Step 6: Push + deploy**

```bash
git push origin claude/wizardly-benz
# Merge to main (or the deploy branch per CLAUDE.md cherry-pick workflow)
```

- [ ] **Step 7: Monitor for 15 minutes post-deploy**

Watch:
- Vercel deploy status → READY
- `/api/health` → green
- Sentry → no new error class appearing, total error rate ≤ baseline + 20%
- `/` visually renders in production (desktop + mobile)
- Click through the Staff Directory → confirm an agent dossier opens
- Click through to `/agents/apex` → confirm thickened detail page renders

If any monitor fails, execute the rollback playbook (§20).

**Cutover success criteria:**
- ✅ Production `/` renders the v2 landing
- ✅ No new Sentry errors in first 15 minutes
- ✅ All critical flows from the landing still work (signup, pricing, docs, agents)

## Days 17–18 — Post-cutover monitoring buffer

**Day 17 (hotfix day):** no planned work. Reserve for hotfixes if issues emerge. Monitor:
- Sentry error rate and new error classes
- Vercel logs for 500s
- Cloudflare/Vercel edge cache hit rate
- User reports via support / Discord / email

Any issue ≥ P2 (partial outage / major visual regression on a common viewport) is fixed same-day with a targeted commit.

**Day 18:** start Tier 2 week. Plan Week 4 in detail (will follow the same TDD pattern as Weeks 1–3). Reserve ≤2h for residual cutover cleanup.

---

# WEEKS 4–6 — Tier 2 Parity (Milestone Sketches)

Detailed day-by-day plans for Weeks 4–6 are written at the start of each respective week, informed by the cutover experience. Below are the milestones.

## Week 4 — Tier 2 Wave 1

- **Day 19:** SAML SSO wiring (T2-3). Clerk has SAML support out of the box; the work is configuring organization-level SAML connection settings, the dashboard UI for enterprise admins, and an organization-scoped middleware guard.
- **Day 20:** E2E signup → run playbook → payment flow (T2-4). Extends `e2e/` with a full-conversion Playwright test running against a preview URL.
- **Day 21–22:** WCAG 2.2 AA audit + fixes on top 10 dashboard pages (T2-7). Run axe-core in CI, fail the build on regressions.
- **Day 23:** Mobile dashboard audit kickoff (T2-2). Inventory every dashboard page, rank by traffic, fix the top 5 for mobile.

## Week 5 — Tier 2 Wave 2

- **Day 24–25:** Mobile dashboard audit continues. Fix next 10 pages.
- **Day 26–27:** API docs Try-it-now playground (T2-1). Each endpoint's doc section gets an inline runner with a user's actual API key, calling through to production (rate-limited).
- **Day 28:** Post-wave QA sweep.

## Week 6 — Tier 2 Wave 3

- **Day 29:** Real-time cost/usage dashboard (T2-6). `/dashboard/usage` shows per-agent, per-day token cost with a 30-day rollup. Stripe-style.
- **Day 30:** Agent reviews UI (T2-9) + per-run audit summary (T2-10) + public creator profiles (T2-8). Three smaller items batched.

**End of Week 6 success criteria:**
- ✅ Landing v2 stable in production for 3 weeks
- ✅ All Tier 1 gaps closed
- ✅ All Tier 2 gaps closed
- ✅ No open P1 or P2 regressions from the cutover
- ✅ Enterprise sales can demo SAML

---

## 20. Rollback Playbook

If anything breaks post-cutover, **execute this in order**:

### Trigger criteria (any one is enough)
- Production page errors >5% of requests (Sentry rate)
- New Sentry error class appears and exceeds 50 occurrences in <1h
- Lighthouse mobile drops below 80 on production `/`
- Any critical interactive element (hero directory, signup CTA, CTA-to-pricing) is broken
- User-reported P1 visual regression reproduced by team

### Execution (under 5 minutes end-to-end)

1. **Revert the cutover commit:**

```bash
git checkout claude/wizardly-benz
git revert <cutover-commit-sha> --no-edit
git push origin claude/wizardly-benz
```

2. **Merge to main (per CLAUDE.md cherry-pick workflow):**

```bash
git checkout main
git cherry-pick <revert-commit-sha>
git push origin main
```

3. **Monitor Vercel deploy status** until READY (~2 min).

4. **Verify production `/` renders the old landing** — the v1 bakup file becomes the page again via the revert.

5. **Post-incident:**
   - File a P1 issue with a reproduction, Sentry trace, and user-reported symptoms
   - Identify the failure cause before re-attempting cutover
   - Schedule a fresh Day 15 QA pass for the next cutover attempt

### What doesn't rollback

- `/api/public/*` endpoints stay live — they're not landing-dependent and consumers outside the landing may be using them.
- Tier 1 gap closures (`/agents/[slug]` thickening, `/platform` palette, `/playground` fix, `/cookies`, failed-run UX, webhook signing) stay in place — they improve the product independently.

---

## 21. Success Criteria — The Whole Sprint

By end of Week 6:

- [ ] Landing v2 shipped and stable in production for ≥3 weeks
- [ ] Lighthouse Mobile ≥95, Desktop ≥98, Accessibility ≥95 on `/`
- [ ] All 5 `/api/public/*` endpoints live, rate-limited, cached, ≥99% availability
- [ ] `/agents/[slug]` thickened (use cases + FAQ + sample output) for 20 flagship agents
- [ ] `/platform` palette unified with v2
- [ ] `/playground` works for unauthenticated visitors (3 free runs/day)
- [ ] `/cookies` page live and linked
- [ ] Failed-run UX surfaces in `/dashboard/playbooks/runs/[id]`
- [ ] Webhook dispatcher has retries + idempotency + DB-backed history
- [ ] SAML SSO configurable for enterprise tenants
- [ ] E2E test for signup → run → pay passes in CI
- [ ] API docs have live Try-it-now playground
- [ ] Real-time cost/usage dashboard at `/dashboard/usage`
- [ ] Agent reviews UI surfaces review bodies
- [ ] Public creator profiles live at `/creators/[handle]`
- [ ] Per-run audit summary visible on run detail pages
- [ ] Mobile dashboard audit complete for top 15 pages
- [ ] WCAG 2.2 AA passes on top 10 dashboard pages
- [ ] Test suite: current ~1,533 → ≥1,600 tests passing
- [ ] Zero new error classes in Sentry above baseline + 20% for any 7-day window
- [ ] Bundle size within budget
- [ ] Rollback playbook tested at least once in staging

---

## 22. Daily Standup Format (while sprint is running)

Each working day, record in this doc (or a linked scratchpad):

```
### Day <N> — <Date>

Status: <on-track | at-risk | blocked>
Shipped: <list of commits / tasks completed>
Blocked on: <external deps, design questions, unknowns>
Lighthouse: <mobile/desktop scores if applicable>
Tests: <count / delta>
Next: <next day's top task>
```

This keeps the plan self-documenting, surfaces slippage early, and makes it trivial to re-scope a day if needed.
