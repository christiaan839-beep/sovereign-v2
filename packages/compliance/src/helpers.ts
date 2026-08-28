/**
 * Rollups over a control matrix.
 *
 * Every framework wants the same shape of answer — "how many of these
 * carry evidence, grouped by something" — but groups by a different
 * something: SOC 2 by Trust Services category, HIPAA by required vs
 * addressable, the NIST AI RMF by function and by trustworthy-AI
 * characteristic. One function, a different key.
 *
 * @packageDocumentation
 */

import type { ControlEvidence, ControlMatrixReport } from "./types.js";

/** Controls in a group, and how many of them carry evidence. */
export interface GroupTally {
  /** Group key, verbatim from the catalogue. */
  key: string;
  total: number;
  withEvidence: number;
  /** withEvidence / total, 0..1. 0 for an empty group. */
  coverageRate: number;
  /** Receipts evidencing anything in the group. */
  evidenceCount: number;
}

function tally(key: string, controls: readonly ControlEvidence[]): GroupTally {
  const withEvidence = controls.filter((c) => c.evidence.count > 0).length;
  return {
    key,
    total: controls.length,
    withEvidence,
    coverageRate: controls.length > 0 ? withEvidence / controls.length : 0,
    evidenceCount: controls.reduce((s, c) => s + c.evidence.count, 0),
  };
}

/**
 * Group the matrix by any field, then tally each group.
 *
 * `by` reads the group key off a control; controls it returns
 * `undefined` for are left out, which is what you want for a `meta`
 * key not every catalogue entry carries.
 */
export function groupBy(
  report: ControlMatrixReport,
  by: (control: ControlEvidence) => string | undefined,
): GroupTally[] {
  const groups = new Map<string, ControlEvidence[]>();
  for (const c of report.controls) {
    const key = by(c);
    if (key === undefined) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(c);
    else groups.set(key, [c]);
  }
  return [...groups].map(([key, controls]) => tally(key, controls));
}

/** Tally by the catalogue's own category vocabulary. */
export function byCategory(report: ControlMatrixReport): GroupTally[] {
  return groupBy(report, (c) => c.category);
}

/**
 * Tally by one of the pack's `meta` keys — HIPAA's `classification`,
 * the RMF's `characteristic`, the CRA's `annexReference`.
 */
export function byMeta(report: ControlMatrixReport, key: string): GroupTally[] {
  return groupBy(report, (c) => c.meta?.[key]);
}

/**
 * Look one group up directly, for the common case of a single number
 * on a page. Returns a zero tally rather than undefined, so a caller
 * rendering a stat tile never has to branch.
 */
export function groupTally(groups: readonly GroupTally[], key: string): GroupTally {
  return (
    groups.find((g) => g.key === key) ?? {
      key,
      total: 0,
      withEvidence: 0,
      coverageRate: 0,
      evidenceCount: 0,
    }
  );
}
