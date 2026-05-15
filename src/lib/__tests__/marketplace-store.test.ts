/**
 * Tests for src/lib/marketplace-store.ts — Cook 70 in-memory store.
 *
 * Locks:
 *   - listAll returns every put listing.
 *   - get / findBySlug round-trip.
 *   - remove deletes by id and returns boolean.
 *   - Multiple writes update in place.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  findBySlug,
  get,
  listAll,
  put,
  remove,
  type StoredListing,
} from "../marketplace-store";

function make(id: string, slug: string): StoredListing {
  return {
    id,
    slug,
    developerId: "dev-1",
    displayName: "Test",
    description: "x",
    pricePerRunCents: 25,
    status: "draft",
    safetyLayers: ["jailbreak"],
  };
}

describe("marketplace-store", () => {
  beforeEach(() => {
    // Clear via remove() to avoid cross-test contamination.
    for (const l of listAll()) remove(l.id);
  });

  it("put + get round-trips a listing", () => {
    put(make("a", "alpha"));
    expect(get("a")?.slug).toBe("alpha");
  });

  it("findBySlug finds the right listing", () => {
    put(make("a", "alpha"));
    put(make("b", "beta"));
    expect(findBySlug("alpha")?.id).toBe("a");
    expect(findBySlug("beta")?.id).toBe("b");
    expect(findBySlug("gamma")).toBeUndefined();
  });

  it("listAll returns every put listing", () => {
    put(make("a", "alpha"));
    put(make("b", "beta"));
    const ids = listAll()
      .map((l) => l.id)
      .sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("put updates in place on collision", () => {
    put(make("a", "alpha"));
    put({ ...make("a", "alpha"), displayName: "Updated" });
    expect(get("a")?.displayName).toBe("Updated");
    expect(listAll().length).toBe(1);
  });

  it("remove deletes by id and returns true; false on missing", () => {
    put(make("a", "alpha"));
    expect(remove("a")).toBe(true);
    expect(remove("a")).toBe(false);
    expect(get("a")).toBeUndefined();
  });
});
