/**
 * SOVEREIGN MATRIX — Marketplace listings store (Cook 70 backing).
 *
 * In-memory persistence for marketplace listings. Survives the
 * lifetime of a single serverless instance. Swap to a Drizzle query
 * over `marketplaceAgents` once migration 0021 is applied — the
 * shape is intentionally identical to the schema.
 */

import type { MarketplaceListing } from "@/lib/marketplace-core";

export type StoredListing = MarketplaceListing & { id: string };

const STORE = new Map<string, StoredListing>();

export function listAll(): StoredListing[] {
  return [...STORE.values()];
}

export function get(id: string): StoredListing | undefined {
  return STORE.get(id);
}

export function findBySlug(slug: string): StoredListing | undefined {
  for (const l of STORE.values()) {
    if (l.slug === slug) return l;
  }
  return undefined;
}

export function put(listing: StoredListing): void {
  STORE.set(listing.id, listing);
}

export function remove(id: string): boolean {
  return STORE.delete(id);
}
