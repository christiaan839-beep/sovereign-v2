# Sovereign World — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 137 agents from a hidden registry into a **living, browsable universe**. Ship five surfaces: `/world` constellation, a marketplace upgrade with install+review flows, `/developers/submit` for 3rd-party agent submissions, public SEO pages at `/agents/[slug]`, and a live `/leaderboard`.

**Architecture:** Four new tables (`agent_metadata`, `agent_installs`, `agent_reviews`, `agent_stats_daily`) extend the existing agent registry without touching route code. Display metadata is a mix of code-generated defaults (from the route file's config) and DB-override rows so authors can edit without redeploying. A nightly cron rolls up `agent_activity` into `agent_stats_daily` for cheap dashboard reads. The `/world` page uses the same Canvas constellation pattern from the landing hero.

**Tech Stack:** Next.js 16 App Router · Drizzle ORM · Framer Motion · Canvas 2D · Vitest · Upstash (cache).

**Depends on:** Plan 1 (Revenue Engine) for paid-agent install charges.

---

## File Structure

### Database — New tables (migration 0020)

```
drizzle/0020_sovereign_world.sql
  ├── agent_metadata       (slug PK, displayName, category, creator, pricingCents, tags, featured)
  ├── agent_installs       (id, userId, agentSlug, installedAt)   — unique (userId, agentSlug)
  ├── agent_reviews        (id, userId, agentSlug, rating 1-5, comment, createdAt)
  └── agent_stats_daily    (agentSlug, day, runs, successes, avgDurationMs, totalCostCents)
```

### Library

| File | Purpose |
|---|---|
| `src/lib/agent-catalog.ts` | Single read API: `listCatalog()`, `getAgentPublic(slug)`. Joins registry + metadata + stats |
| `src/lib/agent-submission.ts` | Validation + safety review for submitted agents |
| `scripts/seed-agent-metadata.mjs` | Node script that reads the registry and upserts default metadata rows |

### API routes

| File | Method | Purpose |
|---|---|---|
| `src/app/api/catalog/route.ts` | GET | List all agents with filter/sort for `/world` + `/marketplace` |
| `src/app/api/catalog/[slug]/route.ts` | GET | Public agent details |
| `src/app/api/catalog/[slug]/install/route.ts` | POST/DELETE | Pin/unpin |
| `src/app/api/catalog/[slug]/reviews/route.ts` | GET/POST | Reviews (write: Clerk-gated) |
| `src/app/api/leaderboard/route.ts` | GET | Ranking by success / cost / speed / earnings |
| `src/app/api/developers/submit/route.ts` | POST | Agent submission flow |
| `src/app/api/cron/rollup-agent-stats/route.ts` | GET | Nightly stats rollup |

### Pages (client)

| File | What it renders |
|---|---|
| `src/app/world/page.tsx` | Full-screen Canvas constellation + filter rail + agent detail drawer |
| `src/components/world/Constellation.tsx` | Canvas drawing + interaction |
| `src/components/world/AgentCard.tsx` | Shared card used on /world, /marketplace, and /agents/[slug] |
| `src/app/marketplace/page.tsx` | Upgrade — real cards, categories, install buttons (replaces static grid) |
| `src/app/agents/[slug]/page.tsx` | SEO-optimized public page per agent |
| `src/app/agents/[slug]/layout.tsx` | JSON-LD Article schema + breadcrumbs |
| `src/app/leaderboard/page.tsx` | Sortable ranking table + charts |
| `src/app/developers/submit/page.tsx` | 3-step submission wizard |

### Tests

| File | Coverage |
|---|---|
| `src/lib/__tests__/agent-catalog.test.ts` | listCatalog + getAgentPublic shape + fallback when metadata missing |
| `src/lib/__tests__/agent-submission.test.ts` | Zod validation, slug collision, safety review result |
| `src/lib/__tests__/reviews-route.test.ts` | 1-review-per-user invariant, rating range validation |
| `src/lib/__tests__/install-route.test.ts` | Install requires credits for paid agents, idempotent |
| `src/lib/__tests__/leaderboard-route.test.ts` | Sort modes, tier cutoffs, recency windowing |

---

## Task 1: Migration 0020 — Four new tables

**Files:**
- Create: `drizzle/0020_sovereign_world.sql`
- Modify: `src/db/schema.ts` (add 4 pgTable exports)
- Test: `src/lib/__tests__/sovereign-world-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/sovereign-world-schema.test.ts
import { describe, it, expect } from "vitest";
import {
  agentMetadata,
  agentInstalls,
  agentReviews,
  agentStatsDaily,
} from "@/db/schema";

describe("sovereign-world Drizzle tables", () => {
  it("agentMetadata is keyed on slug", () => {
    expect(agentMetadata).toBeDefined();
    // Drizzle exposes the config as _.config (private but stable)
  });
  it("agentInstalls uniquely pairs userId + agentSlug", () => {
    expect(agentInstalls).toBeDefined();
  });
  it("agentReviews has rating constraint 1..5", () => {
    expect(agentReviews).toBeDefined();
  });
  it("agentStatsDaily is keyed on (agentSlug, day)", () => {
    expect(agentStatsDaily).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — FAIL**

```
npx vitest run src/lib/__tests__/sovereign-world-schema.test.ts
```

- [ ] **Step 3: Create the SQL migration**

```sql
-- drizzle/0020_sovereign_world.sql

-- ─── agent_metadata ────────────────────────────────────────
-- Display + pricing data per agent. Slug MUST match registry key.
-- Created rows override the code-derived defaults at read time.
CREATE TABLE IF NOT EXISTS agent_metadata (
  slug              TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  tagline           TEXT,
  description       TEXT,
  category          TEXT NOT NULL DEFAULT 'general',
  subcategory       TEXT,
  icon              TEXT,          -- emoji or lucide name
  hero_color        TEXT,          -- hex, for card accent
  creator_user_id   TEXT,          -- NULL = built-in (platform)
  creator_handle    TEXT,          -- public display name
  pricing_cents     INTEGER NOT NULL DEFAULT 0,
  tags              TEXT[],
  featured          BOOLEAN NOT NULL DEFAULT FALSE,
  verified          BOOLEAN NOT NULL DEFAULT FALSE,
  published         BOOLEAN NOT NULL DEFAULT TRUE,
  visibility        TEXT NOT NULL DEFAULT 'public',  -- public | unlisted | private
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_category ON agent_metadata(category);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_creator ON agent_metadata(creator_user_id) WHERE creator_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_metadata_featured ON agent_metadata(featured) WHERE featured = TRUE;

-- ─── agent_installs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_installs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  agent_slug     TEXT NOT NULL,
  installed_at   TIMESTAMP DEFAULT NOW(),
  CONSTRAINT agent_installs_unique UNIQUE (user_id, agent_slug)
);
CREATE INDEX IF NOT EXISTS idx_agent_installs_user ON agent_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_installs_agent ON agent_installs(agent_slug);

-- ─── agent_reviews ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  agent_slug  TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  CONSTRAINT agent_reviews_one_per_user UNIQUE (user_id, agent_slug)
);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_agent ON agent_reviews(agent_slug, created_at DESC);

-- ─── agent_stats_daily ─────────────────────────────────────
-- Denormalized daily rollup from agent_activity. Rebuilt nightly by
-- /api/cron/rollup-agent-stats. Read-side queries stay fast.
CREATE TABLE IF NOT EXISTS agent_stats_daily (
  agent_slug          TEXT NOT NULL,
  day                 DATE NOT NULL,
  runs                INTEGER NOT NULL DEFAULT 0,
  successes           INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms     INTEGER,
  total_cost_cents    INTEGER NOT NULL DEFAULT 0,
  unique_users        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (agent_slug, day)
);
CREATE INDEX IF NOT EXISTS idx_agent_stats_day ON agent_stats_daily(day DESC);

-- ─── RLS ───────────────────────────────────────────────────
ALTER TABLE agent_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_metadata_select_public ON agent_metadata;
CREATE POLICY agent_metadata_select_public ON agent_metadata
  FOR SELECT USING (visibility = 'public' OR creator_user_id = current_setting('app.current_user', true));

DROP POLICY IF EXISTS agent_installs_select_own ON agent_installs;
CREATE POLICY agent_installs_select_own ON agent_installs
  FOR SELECT USING (user_id = current_setting('app.current_user', true));

DROP POLICY IF EXISTS agent_reviews_select_public ON agent_reviews;
CREATE POLICY agent_reviews_select_public ON agent_reviews FOR SELECT USING (true);
```

- [ ] **Step 4: Add Drizzle schema bindings**

```typescript
// src/db/schema.ts — append:

export const agentMetadata = pgTable("agent_metadata", {
  slug: text("slug").primaryKey(),
  displayName: text("display_name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  category: text("category").notNull().default("general"),
  subcategory: text("subcategory"),
  icon: text("icon"),
  heroColor: text("hero_color"),
  creatorUserId: text("creator_user_id"),
  creatorHandle: text("creator_handle"),
  pricingCents: integer("pricing_cents").notNull().default(0),
  tags: text("tags").array(),
  featured: boolean("featured").notNull().default(false),
  verified: boolean("verified").notNull().default(false),
  published: boolean("published").notNull().default(true),
  visibility: text("visibility").notNull().default("public"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_agent_metadata_category").on(table.category),
  index("idx_agent_metadata_featured").on(table.featured),
]);

export const agentInstalls = pgTable("agent_installs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  agentSlug: text("agent_slug").notNull(),
  installedAt: timestamp("installed_at").defaultNow(),
}, (table) => [
  uniqueIndex("agent_installs_unique").on(table.userId, table.agentSlug),
  index("idx_agent_installs_user").on(table.userId),
  index("idx_agent_installs_agent").on(table.agentSlug),
]);

export const agentReviews = pgTable("agent_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  agentSlug: text("agent_slug").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("agent_reviews_one_per_user").on(table.userId, table.agentSlug),
  index("idx_agent_reviews_agent").on(table.agentSlug, table.createdAt),
]);

export const agentStatsDaily = pgTable("agent_stats_daily", {
  agentSlug: text("agent_slug").notNull(),
  day: timestamp("day", { mode: "date" }).notNull(),
  runs: integer("runs").notNull().default(0),
  successes: integer("successes").notNull().default(0),
  avgDurationMs: integer("avg_duration_ms"),
  totalCostCents: integer("total_cost_cents").notNull().default(0),
  uniqueUsers: integer("unique_users").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.agentSlug, table.day] }),
  index("idx_agent_stats_day").on(table.day),
]);
```

Also import `primaryKey` from `drizzle-orm/pg-core` at the top of schema.ts.

- [ ] **Step 5: Run — PASS**

```
npx vitest run src/lib/__tests__/sovereign-world-schema.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add drizzle/0020_sovereign_world.sql src/db/schema.ts src/lib/__tests__/sovereign-world-schema.test.ts
git commit -m "feat(world): migration 0020 — agent_metadata/installs/reviews/stats_daily (plan 2.1)"
```

---

## Task 2: Seed script — populate default metadata from registry

**Files:**
- Create: `scripts/seed-agent-metadata.mjs`

- [ ] **Step 1: Write the seed script**

```javascript
// scripts/seed-agent-metadata.mjs
/**
 * Seeds default agent_metadata rows from the generated registry.
 * Idempotent — ON CONFLICT DO NOTHING so it never overwrites hand-edited rows.
 *
 * Run:  node scripts/seed-agent-metadata.mjs
 * Run on every deploy via: "postbuild" in package.json (optional)
 */

import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Capitalize slug like "seo-dominator" → "SEO Dominator"
function humanize(slug) {
  return slug
    .split("-")
    .map((w) => {
      // Known acronyms
      if (/^(seo|api|roi|vsl|ocr|rag|tts|asr|ocr|ai|pii)$/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

// Category heuristics from slug keywords
function inferCategory(slug) {
  if (/seo|content|blog|copy/.test(slug)) return "content";
  if (/lead|prospect|outbound|email/.test(slug)) return "leads";
  if (/competitor|intel|market/.test(slug)) return "intelligence";
  if (/voice|speech|asr|tts/.test(slug)) return "voice";
  if (/safety|guard|audit|compliance/.test(slug)) return "safety";
  if (/image|video|visual|diffusion/.test(slug)) return "creative";
  if (/code|dev|github/.test(slug)) return "engineering";
  if (/finance|revenue|billing/.test(slug)) return "finance";
  return "general";
}

async function main() {
  const registryText = await readFile(
    new URL("../src/app/api/agents/registry.ts", import.meta.url),
    "utf8",
  );
  const slugMatches = registryText.matchAll(/"([a-z][a-z0-9-]+)":\s*\(\)\s*=>/g);
  const slugs = [...slugMatches].map((m) => m[1]);
  console.log(`Found ${slugs.length} agents in the registry`);

  const sql = neon(DATABASE_URL);
  let inserted = 0;
  for (const slug of slugs) {
    const res = await sql`
      INSERT INTO agent_metadata (slug, display_name, category, published)
      VALUES (${slug}, ${humanize(slug)}, ${inferCategory(slug)}, TRUE)
      ON CONFLICT (slug) DO NOTHING
      RETURNING slug
    `;
    if (res.length > 0) inserted++;
  }
  console.log(`Seeded ${inserted} new rows; ${slugs.length - inserted} already existed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it locally against your dev DB**

```bash
node scripts/seed-agent-metadata.mjs
```
Expected output: `Seeded 137 new rows; 0 already existed` (first run).

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-agent-metadata.mjs
git commit -m "feat(world): seed script for agent_metadata defaults (plan 2.2)"
```

---

## Task 3: agent-catalog.ts — unified read API

**Files:**
- Create: `src/lib/agent-catalog.ts`
- Test: `src/lib/__tests__/agent-catalog.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// src/lib/__tests__/agent-catalog.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ leftJoin: () => ({ where: () => mockQuery() }) }) }) },
}));
vi.mock("@/db/schema", () => ({
  agentMetadata: {}, agentStatsDaily: {}, agentReviews: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), and: vi.fn(), gte: vi.fn(), desc: vi.fn(), sql: {raw: (s: string) => s},
}));
vi.mock("@/app/api/agents/registry", () => ({
  AGENT_REGISTRY: {
    "seo-dominator": () => Promise.resolve({}),
    "lead-blitz": () => Promise.resolve({}),
  },
}));

import { listCatalog, getAgentPublic } from "@/lib/agent-catalog";

beforeEach(() => mockQuery.mockReset());

describe("agent-catalog", () => {
  it("listCatalog returns rows from DB", async () => {
    mockQuery.mockResolvedValue([{ slug: "seo-dominator", displayName: "SEO Dominator", runs30d: 42 }]);
    const rows = await listCatalog();
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("seo-dominator");
  });

  it("getAgentPublic returns null when slug not in registry", async () => {
    const agent = await getAgentPublic("nonexistent-slug");
    expect(agent).toBeNull();
  });

  it("getAgentPublic falls back to humanized displayName when metadata row missing", async () => {
    mockQuery.mockResolvedValue([]); // no metadata row
    const agent = await getAgentPublic("seo-dominator");
    expect(agent).toBeTruthy();
    expect(agent?.displayName).toMatch(/SEO/i);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/lib/agent-catalog.ts
import { db } from "@/db";
import { agentMetadata, agentStatsDaily, agentReviews } from "@/db/schema";
import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { and, desc, eq, gte, sql } from "drizzle-orm";

/**
 * Public shape served to /world, /marketplace, and /agents/[slug].
 * Fields that the client renders; do NOT include creator_user_id or
 * internal routing details.
 */
export interface PublicAgent {
  slug: string;
  displayName: string;
  tagline: string | null;
  description: string | null;
  category: string;
  icon: string | null;
  heroColor: string | null;
  creatorHandle: string | null;
  pricingCents: number;
  tags: string[];
  featured: boolean;
  verified: boolean;
  // rollup stats (30-day windows)
  runs30d: number;
  successRate: number;
  avgDurationMs: number | null;
  avgRating: number | null;
  reviewCount: number;
}

/**
 * Humanize slug → display name, matching the seed script logic.
 * Used when metadata row is missing — older agents in the registry
 * that haven't been seeded yet still render something sane.
 */
function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => {
      if (/^(seo|api|roi|vsl|ocr|rag|tts|asr|ai|pii)$/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** List all public agents with 30d rollup stats. */
export async function listCatalog(
  opts: { category?: string; limit?: number } = {},
): Promise<PublicAgent[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      slug: agentMetadata.slug,
      displayName: agentMetadata.displayName,
      tagline: agentMetadata.tagline,
      description: agentMetadata.description,
      category: agentMetadata.category,
      icon: agentMetadata.icon,
      heroColor: agentMetadata.heroColor,
      creatorHandle: agentMetadata.creatorHandle,
      pricingCents: agentMetadata.pricingCents,
      tags: agentMetadata.tags,
      featured: agentMetadata.featured,
      verified: agentMetadata.verified,
      runs30d: sql<number>`COALESCE(SUM(${agentStatsDaily.runs}), 0)::int`,
      successes30d: sql<number>`COALESCE(SUM(${agentStatsDaily.successes}), 0)::int`,
      avgDurationMs: sql<number>`AVG(${agentStatsDaily.avgDurationMs})::int`,
    })
    .from(agentMetadata)
    .leftJoin(
      agentStatsDaily,
      and(
        eq(agentStatsDaily.agentSlug, agentMetadata.slug),
        gte(agentStatsDaily.day, since),
      ),
    )
    .where(
      opts.category ? eq(agentMetadata.category, opts.category) : sql`TRUE`,
    )
    .groupBy(agentMetadata.slug);

  return rows.map((r) => ({
    slug: r.slug,
    displayName: r.displayName,
    tagline: r.tagline,
    description: r.description,
    category: r.category,
    icon: r.icon,
    heroColor: r.heroColor,
    creatorHandle: r.creatorHandle,
    pricingCents: r.pricingCents,
    tags: r.tags ?? [],
    featured: r.featured,
    verified: r.verified,
    runs30d: r.runs30d,
    successRate: r.runs30d > 0 ? r.successes30d / r.runs30d : 0,
    avgDurationMs: r.avgDurationMs,
    avgRating: null,     // filled by getAgentPublic for single-agent pages
    reviewCount: 0,
  }));
}

/**
 * Single-agent public detail — used by /agents/[slug] and marketplace detail.
 * Returns null when the slug isn't in the registry (invalid URL).
 */
export async function getAgentPublic(slug: string): Promise<PublicAgent | null> {
  if (!(slug in AGENT_REGISTRY)) return null;

  const [metadata] = await db
    .select()
    .from(agentMetadata)
    .where(eq(agentMetadata.slug, slug))
    .limit(1);

  // Fallback — agent in registry but not seeded yet
  if (!metadata) {
    return {
      slug,
      displayName: humanize(slug),
      tagline: null,
      description: null,
      category: "general",
      icon: null,
      heroColor: null,
      creatorHandle: null,
      pricingCents: 0,
      tags: [],
      featured: false,
      verified: false,
      runs30d: 0,
      successRate: 0,
      avgDurationMs: null,
      avgRating: null,
      reviewCount: 0,
    };
  }

  // Reviews rollup
  const [reviewAgg] = await db
    .select({
      avgRating: sql<number>`COALESCE(AVG(${agentReviews.rating}), 0)::real`,
      reviewCount: sql<number>`COUNT(*)::int`,
    })
    .from(agentReviews)
    .where(eq(agentReviews.agentSlug, slug));

  // 30d stats
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [stats] = await db
    .select({
      runs: sql<number>`COALESCE(SUM(${agentStatsDaily.runs}), 0)::int`,
      successes: sql<number>`COALESCE(SUM(${agentStatsDaily.successes}), 0)::int`,
      avgDuration: sql<number>`AVG(${agentStatsDaily.avgDurationMs})::int`,
    })
    .from(agentStatsDaily)
    .where(and(eq(agentStatsDaily.agentSlug, slug), gte(agentStatsDaily.day, since)));

  return {
    slug,
    displayName: metadata.displayName,
    tagline: metadata.tagline,
    description: metadata.description,
    category: metadata.category,
    icon: metadata.icon,
    heroColor: metadata.heroColor,
    creatorHandle: metadata.creatorHandle,
    pricingCents: metadata.pricingCents,
    tags: metadata.tags ?? [],
    featured: metadata.featured,
    verified: metadata.verified,
    runs30d: stats?.runs ?? 0,
    successRate: stats && stats.runs > 0 ? stats.successes / stats.runs : 0,
    avgDurationMs: stats?.avgDuration ?? null,
    avgRating: reviewAgg?.avgRating ?? null,
    reviewCount: reviewAgg?.reviewCount ?? 0,
  };
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-catalog.ts src/lib/__tests__/agent-catalog.test.ts
git commit -m "feat(world): agent-catalog module (plan 2.3)"
```

---

## Task 4: GET /api/catalog — list endpoint

**Files:**
- Create: `src/app/api/catalog/route.ts`
- Test: `src/lib/__tests__/catalog-list-route.test.ts`

- [ ] **Step 1: Test**

```typescript
// src/lib/__tests__/catalog-list-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const { mockListCatalog } = vi.hoisted(() => ({ mockListCatalog: vi.fn() }));
vi.mock("@/lib/agent-catalog", () => ({ listCatalog: mockListCatalog }));
import { GET } from "@/app/api/catalog/route";

beforeEach(() => mockListCatalog.mockReset());

describe("GET /api/catalog", () => {
  it("returns the full catalog with counts", async () => {
    mockListCatalog.mockResolvedValue([
      { slug: "a", displayName: "A", category: "general", featured: true, runs30d: 10 },
    ]);
    const res = await GET(new Request("http://l/api/catalog"));
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
    expect(body.counts.general).toBe(1);
  });

  it("passes category filter to listCatalog", async () => {
    mockListCatalog.mockResolvedValue([]);
    await GET(new Request("http://l/api/catalog?category=leads"));
    expect(mockListCatalog).toHaveBeenCalledWith(expect.objectContaining({ category: "leads" }));
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/app/api/catalog/route.ts
import { NextResponse } from "next/server";
import { listCatalog } from "@/lib/agent-catalog";

/**
 * GET /api/catalog?category=<cat>&limit=<n>
 * Public. Cached for 60s at the edge via Cache-Control.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "500");

  const agents = await listCatalog({ category, limit });
  const counts = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json(
    { agents, counts, total: agents.length },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
  );
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/app/api/catalog/route.ts src/lib/__tests__/catalog-list-route.test.ts
git commit -m "feat(world): GET /api/catalog (plan 2.4)"
```

---

## Task 5: GET /api/catalog/[slug] — detail endpoint

Same TDD pattern as Task 4 — test → fail → implement → pass → commit.

**Files:**
- Create: `src/app/api/catalog/[slug]/route.ts`
- Test: `src/lib/__tests__/catalog-detail-route.test.ts`

Implementation summary:

```typescript
// src/app/api/catalog/[slug]/route.ts
import { NextResponse } from "next/server";
import { getAgentPublic } from "@/lib/agent-catalog";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = await getAgentPublic(slug);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(
    { agent },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
  );
}
```

Commit: `feat(world): GET /api/catalog/[slug] (plan 2.5)`

---

## Task 6: Install / uninstall endpoints

**Files:**
- Create: `src/app/api/catalog/[slug]/install/route.ts`
- Test: `src/lib/__tests__/install-route.test.ts`

Implementation pattern (test-first):

```typescript
// POST  → install. Idempotent via unique constraint.
// DELETE → uninstall.
// Paid agents require credit balance >= pricingCents (Plan 1).
export async function POST(_req: Request, { params }: { params: Promise<{slug: string}> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await params;

  const agent = await getAgentPublic(slug);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Paid agents: verify balance at install time
  if (agent.pricingCents > 0) {
    const balance = await getBalance(userId);
    if (balance < agent.pricingCents) {
      return NextResponse.json({
        error: "Insufficient credits",
        required: agent.pricingCents,
        available: balance,
        topUpUrl: "/dashboard/billing?topup=true",
      }, { status: 402 });
    }
  }

  await db.insert(agentInstalls).values({ userId, agentSlug: slug }).onConflictDoNothing();
  return NextResponse.json({ installed: true });
}
```

Test covers: unauth → 401; paid with no balance → 402; ok → 200 + idempotent on second call.

Commit: `feat(world): install/uninstall endpoints with credit gating (plan 2.6)`

---

## Task 7: Reviews endpoints

**Files:**
- Create: `src/app/api/catalog/[slug]/reviews/route.ts`
- Test: `src/lib/__tests__/reviews-route.test.ts`

GET (public) returns reviews sorted by createdAt desc, limit 20.
POST (Clerk-required) upserts a single review per (userId, slug). Zod-validated rating in 1..5, comment max 2000 chars.

Test cases: anonymous GET works; POST unauth → 401; POST rating=0 → 400; POST twice same user → updates not duplicates.

Commit: `feat(world): reviews GET/POST with 1-per-user invariant (plan 2.7)`

---

## Task 8: Leaderboard endpoint

**Files:**
- Create: `src/app/api/leaderboard/route.ts`
- Test: `src/lib/__tests__/leaderboard-route.test.ts`

Supports `?sort=success|cost|speed|earnings&window=7d|30d|all`.
Default: sort=success, window=30d.
Returns top 50 agents by the chosen metric, joining `agent_metadata` + `agent_stats_daily`.

Commit: `feat(world): leaderboard endpoint (plan 2.8)`

---

## Task 9: Stats rollup cron

**Files:**
- Create: `src/app/api/cron/rollup-agent-stats/route.ts`
- Test: `src/lib/__tests__/rollup-cron.test.ts`
- Modify: `vercel.json` (add cron entry `0 4 * * *` — 4 AM UTC daily)

Rollup logic:
```typescript
// Aggregate yesterday's agent_activity rows into agent_stats_daily.
// Upsert on (agent_slug, day) so re-runs are idempotent.
```

Cron auth: `Bearer ${CRON_SECRET}`.

Commit: `feat(world): nightly stats rollup cron (plan 2.9)`

---

## Task 10: /world constellation page

**Files:**
- Create: `src/app/world/page.tsx`
- Create: `src/components/world/Constellation.tsx`
- Create: `src/components/world/AgentDrawer.tsx`

Design spec for the constellation:
- Full-screen black canvas, 137 nodes clustered by category (8 clusters)
- Node radius proportional to `log(runs30d + 1)` — viral agents look bigger
- Copper-tinted line between any two nodes within 180px (hub nodes 250px)
- Click → node pulse animation + `AgentDrawer` slides in from right with full details
- Filter rail (left): category checkboxes, "Only installed", search
- Keyboard: ⌘K opens search, arrow keys navigate nodes, Enter opens drawer

Implementation uses the Canvas pattern from the landing hero's `ConstellationField`. Key difference: nodes are clickable, each carries an agent slug.

```typescript
// src/app/world/page.tsx — skeleton
export default function WorldPage() {
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalog").then(r => r.json()).then(d => setAgents(d.agents));
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <FilterRail />
      <Constellation agents={agents} onSelect={setSelected} />
      <AgentDrawer slug={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
```

Task broken into 6 sub-steps:
- [ ] Step 1: AgentDrawer component (test render with dummy data)
- [ ] Step 2: Constellation component — canvas setup
- [ ] Step 3: Constellation — node physics + draw loop
- [ ] Step 4: Constellation — click detection → select callback
- [ ] Step 5: Filter rail
- [ ] Step 6: Mount on /world page + commit

Commit: `feat(world): /world constellation page (plan 2.10)`

---

## Task 11: Marketplace upgrade

**Files:**
- Modify: `src/app/marketplace/page.tsx` (replace static grid with live catalog)
- Create: `src/components/world/AgentCard.tsx` (shared with /world drawer)

Marketplace becomes:
- Hero: featured 3 agents
- Filter bar: category tabs, sort (trending / newest / rating)
- Grid: AgentCards with install button
- Clicking card → `/agents/[slug]`

Commit: `feat(world): marketplace upgrade with live catalog (plan 2.11)`

---

## Task 12: /agents/[slug] public page

**Files:**
- Create: `src/app/agents/[slug]/page.tsx`
- Create: `src/app/agents/[slug]/layout.tsx` (JSON-LD)
- Create: `src/app/agents/[slug]/InstallButton.tsx` (client)

Server component — great SEO:
- Hero with icon + displayName + tagline
- "Try it" form that runs the agent with sample input (unauthenticated gets 3 free runs via `/api/free/run`)
- Stats row: runs30d, success rate, avg duration, rating
- Reviews section
- Related agents (same category)
- `generateMetadata()` for OG + Twitter cards
- Article JSON-LD in layout

Commit: `feat(world): /agents/[slug] SEO-optimized public pages (plan 2.12)`

---

## Task 13: /leaderboard page

**Files:**
- Create: `src/app/leaderboard/page.tsx`
- Create: `src/components/world/LeaderboardTable.tsx`

Features:
- Top-level tabs: Success / Cost / Speed / Earnings
- Window selector: 7d / 30d / all
- Medal emoji for top-3, rank badges 4-10
- Click row → `/agents/[slug]`

Commit: `feat(world): /leaderboard page (plan 2.13)`

---

## Task 14: /developers/submit — agent submission flow

**Files:**
- Create: `src/app/developers/submit/page.tsx`
- Create: `src/app/api/developers/submit/route.ts`
- Create: `src/lib/agent-submission.ts`

3-step wizard:
1. **Define** — name, category, tagline, pricing
2. **Configure** — paste a system prompt OR link to a hosted endpoint OR upload a route.ts
3. **Submit** — runs through NemoGuard safety pipeline, then enters review queue

Submitted agents start with `visibility='unlisted'` + `verified=false`. Admin approval promotes them to `public`. Creator earns 80% of pricing_cents per run (Plan 1 infra handles the split via a second credit ledger entry).

Commit: `feat(world): /developers/submit wizard + submission review (plan 2.14)`

---

## Quality Gate

- [ ] Migration 0020 applies clean
- [ ] Seed script populates 137 rows on first run
- [ ] All catalog endpoints pass tests
- [ ] `/world`, `/marketplace`, `/agents/[slug]`, `/leaderboard`, `/developers/submit` all render without auth (public pages)
- [ ] Install flow gated on credits for paid agents
- [ ] Typecheck + all tests green
- [ ] Build succeeds
