/**
 * SOVEREIGN MATRIX — Receipt schema versioning + migrations (Cook 123).
 *
 * Today every receipt carries an implicit v1 shape; new fields land
 * by addition. As the platform evolves we'll need v2 (Cook 92
 * provenance graph), v3 (Cook 112 envelope disclosure), v4 (Cook 94
 * ratchet epoch). This module:
 *
 *   1. Defines a typed `SchemaVersion` enum.
 *   2. Stores per-version validators + UP-migrators.
 *   3. Lets a verifier migrate an OLD receipt up to its current
 *      schema for replay, while preserving the original signature
 *      verification against the old shape.
 *
 * Pure module — caller wires migrations once at boot.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export type SchemaVersion = 1 | 2 | 3 | 4;

export const CURRENT_SCHEMA_VERSION: SchemaVersion = 4;

export interface ReceiptHeader {
  /** Receipt id. */
  id: string;
  /** Schema version this receipt was sealed under. */
  schemaVersion: SchemaVersion;
  /** Stable timestamp. */
  sealedAt: number;
}

export interface VersionedReceipt<TBody = unknown> {
  header: ReceiptHeader;
  body: TBody;
  /** Optional signatures — different versions carry different shapes. */
  signatures: Record<string, string>;
}

export type MigrationStep<TIn = unknown, TOut = unknown> = (body: TIn) => TOut;

// ── Migration registry ───────────────────────────────────────────────────

const MIGRATIONS = new Map<string, MigrationStep>();

function key(from: SchemaVersion, to: SchemaVersion): string {
  return `${from}->${to}`;
}

/** Register a one-step migration from version `from` to `from + 1`. */
export function registerMigration<TIn, TOut>(
  from: SchemaVersion,
  step: MigrationStep<TIn, TOut>,
): void {
  if (from < 1 || from >= CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `registerMigration: from must be in [1, ${CURRENT_SCHEMA_VERSION - 1}]`,
    );
  }
  MIGRATIONS.set(key(from, (from + 1) as SchemaVersion), step as MigrationStep);
}

/** Reset for tests. */
export function _resetMigrations(): void {
  MIGRATIONS.clear();
}

// ── Migrate up ───────────────────────────────────────────────────────────

/**
 * Migrate a receipt body forward through every registered step. Pure:
 * input + same migration table → same output.
 *
 * Returns the migrated body PLUS a trail of versions that were
 * actually applied (for the audit log).
 */
export function migrateUp<TIn = unknown, TOut = unknown>(
  receipt: VersionedReceipt<TIn>,
  target: SchemaVersion = CURRENT_SCHEMA_VERSION,
): { body: TOut; trail: SchemaVersion[] } {
  if (target < receipt.header.schemaVersion) {
    throw new Error(
      `migrateUp: target ${target} < receipt version ${receipt.header.schemaVersion}`,
    );
  }
  let current: unknown = receipt.body;
  const trail: SchemaVersion[] = [receipt.header.schemaVersion];
  for (
    let v = receipt.header.schemaVersion;
    v < target;
    v = (v + 1) as SchemaVersion
  ) {
    const migrate = MIGRATIONS.get(key(v, (v + 1) as SchemaVersion));
    if (!migrate) {
      throw new Error(
        `migrateUp: no migration registered for ${v} -> ${v + 1}`,
      );
    }
    current = migrate(current);
    trail.push((v + 1) as SchemaVersion);
  }
  return { body: current as TOut, trail };
}

// ── Schema fingerprint ───────────────────────────────────────────────────

/**
 * Stable hash of a receipt body under a specific version. Used by
 * the audit log to group "this receipt's content + schema produced
 * this fingerprint" so a future migration that loses information
 * (mistake) shows up as a fingerprint mismatch.
 */
export function fingerprint(receipt: VersionedReceipt): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: receipt.header.schemaVersion,
        body: receipt.body,
      }),
    )
    .digest("hex");
}

/**
 * Validate that the receipt's claimed `schemaVersion` is one we
 * understand. Caller decides what to do on invalid (reject vs
 * quarantine). Pure check; no I/O.
 */
export function validateVersion(receipt: VersionedReceipt): {
  valid: boolean;
  reason?: string;
} {
  if (!Number.isInteger(receipt.header.schemaVersion)) {
    return { valid: false, reason: "schemaVersion must be an integer" };
  }
  if (
    receipt.header.schemaVersion < 1 ||
    receipt.header.schemaVersion > CURRENT_SCHEMA_VERSION
  ) {
    return {
      valid: false,
      reason: `schemaVersion ${receipt.header.schemaVersion} not in [1, ${CURRENT_SCHEMA_VERSION}]`,
    };
  }
  return { valid: true };
}
