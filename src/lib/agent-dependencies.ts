/**
 * SAM agent dependencies — "NPM for agents" basics.
 *
 * A manifest can declare a `dependsOn` array of slugs:
 *
 *   {
 *     "sam": "1.0",
 *     "slug": "invoice-audit",
 *     "dependsOn": ["invoice-ocr", "expense-categorizer"],
 *     ...
 *   }
 *
 * At submission time we verify every dep exists + is verified (no
 * "depends on pending" traps). At render time the detail page shows
 * the dependency graph visually.
 *
 * Why this matters: composition is what turned npm from a registry
 * into infrastructure. Agents that can build on each other make a
 * marketplace self-reinforcing — every new agent makes every
 * downstream agent more capable.
 *
 * Scope for v1: declaration + resolution + display. Actual runtime
 * orchestration (invoke A → pass output to B) is future work — this
 * commit lays the graph foundation.
 */

import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-dependencies");

/* ─── Types ───────────────────────────────────────────────────── */

export interface DependencyRef {
  slug: string;
  name: string;
  verified: boolean;
  /** Live URL the dependency renders at. */
  url: string;
}

export interface ResolveResult {
  declared: string[];
  resolved: DependencyRef[];
  missing: string[];
  unverified: string[];
  cycles: string[][];
}

/* ─── Extract deps from a manifest ────────────────────────────── */

export function parseDependsOn(manifestRaw: unknown): string[] {
  if (!manifestRaw || typeof manifestRaw !== "object" || Array.isArray(manifestRaw)) {
    return [];
  }
  const m = manifestRaw as Record<string, unknown>;
  const raw = m.dependsOn;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim().length > 0) {
      out.push(item.trim().toLowerCase());
    }
  }
  // Dedupe preserving order.
  return [...new Set(out)];
}

/* ─── Detect self-dependency + obvious cycles ────────────────── */

/**
 * Check if this manifest would introduce a cycle — i.e. any of its
 * dependsOn entries transitively depends on this slug.
 *
 * For v1, this is a BFS up to depth 4 — enough to catch any practical
 * composition mistake without burning a full graph traversal on every
 * submission. Creator can always submit, see the failure, and restructure.
 */
export async function detectCycles(args: {
  thisSlug: string;
  dependsOn: string[];
}): Promise<string[][]> {
  if (!args.dependsOn.length) return [];

  // Self-dep check first — free and catches the most common mistake
  // without DB access. This runs BEFORE the DATABASE_URL guard so
  // self-cycles are caught even in tests / local dev without Neon.
  const cycles: string[][] = [];
  if (args.dependsOn.includes(args.thisSlug)) {
    cycles.push([args.thisSlug, args.thisSlug]);
  }

  // Transitive-cycle detection requires DB access.
  if (!process.env.DATABASE_URL) return cycles;

  try {
    // BFS up to depth 4 looking for thisSlug reachable from deps.
    const visited = new Set<string>();
    let frontier = args.dependsOn.filter((s) => s !== args.thisSlug);
    for (let depth = 0; depth < 4 && frontier.length > 0; depth++) {
      const rows = await db
        .select({
          slug: marketplaceAgents.slug,
          manifestRaw: marketplaceAgents.manifestRaw,
        })
        .from(marketplaceAgents)
        .where(
          and(
            inArray(
              marketplaceAgents.slug,
              frontier.filter((s): s is string => typeof s === "string"),
            ),
            eq(marketplaceAgents.verificationStatus, "verified"),
          ),
        );
      const next: string[] = [];
      for (const r of rows) {
        if (!r.slug) continue;
        if (visited.has(r.slug)) continue;
        visited.add(r.slug);
        const subDeps = parseDependsOn(r.manifestRaw);
        if (subDeps.includes(args.thisSlug)) {
          cycles.push([args.thisSlug, r.slug, args.thisSlug]);
        }
        next.push(...subDeps);
      }
      frontier = next;
    }
  } catch (err) {
    log.warn("cycle detection failed; allowing submission through", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return cycles;
}

/* ─── Resolve deps against the DB ─────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

export async function resolveDependencies(
  manifestRaw: unknown,
): Promise<ResolveResult> {
  const declared = parseDependsOn(manifestRaw);
  if (declared.length === 0) {
    return { declared: [], resolved: [], missing: [], unverified: [], cycles: [] };
  }
  if (!databaseIsConfigured()) {
    // Graceful: without a DB, all declared deps land in "missing" so
    // a human reviewer can intervene rather than silent-pass.
    return {
      declared,
      resolved: [],
      missing: declared,
      unverified: [],
      cycles: [],
    };
  }

  try {
    const rows = await db
      .select({
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        verificationStatus: marketplaceAgents.verificationStatus,
        isPublic: marketplaceAgents.isPublic,
      })
      .from(marketplaceAgents)
      .where(
        and(
          inArray(
            marketplaceAgents.slug,
            declared.filter((s): s is string => typeof s === "string"),
          ),
          // Surface UUID-slug lookups too (legacy).
          or(
            eq(marketplaceAgents.verificationStatus, "verified"),
            eq(marketplaceAgents.verificationStatus, "pending"),
          ),
        ),
      );

    const found = new Map(rows.map((r) => [r.slug, r]));
    const resolved: DependencyRef[] = [];
    const missing: string[] = [];
    const unverified: string[] = [];

    for (const slug of declared) {
      const row = found.get(slug);
      if (!row) {
        missing.push(slug);
        continue;
      }
      const isVerified =
        row.verificationStatus === "verified" && row.isPublic === true;
      if (!isVerified) {
        unverified.push(slug);
      }
      resolved.push({
        slug: row.slug ?? slug,
        name: row.name,
        verified: isVerified,
        url: `/marketplace/${row.slug ?? slug}`,
      });
    }

    return { declared, resolved, missing, unverified, cycles: [] };
  } catch (err) {
    log.error("resolveDependencies failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      declared,
      resolved: [],
      missing: declared,
      unverified: [],
      cycles: [],
    };
  }
}
