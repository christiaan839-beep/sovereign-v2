# ADR-NNNN: Short title (verb-led, declarative)

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNNN
**Date:** YYYY-MM-DD
**Deciders:** @founder, @reviewer
**Affects:** `src/path/to/file.ts`, `docs/RELATED.md`

## Context

Why are we deciding this now? What's the situation? What forces are
pulling on the decision? Use full paragraphs, not bullet lists — the
shape of an ADR is "story → choice → consequence", not a checklist.

A reader 6 months from now should be able to understand the world
that produced this decision without needing the original chat log.

### Constraints

- Time / budget / staffing constraints that bound the option space.
- Existing commitments that can't be changed.
- Hard requirements (compliance, contracts, technology lock-in).

### Options considered

#### Option A — name

What it is. ~3 sentences. Pros and cons explicit.

#### Option B — name

Same shape. The default ADR comparison is at least 2 options, often 3.

#### Option C — name (rejected)

Why it was rejected. Rejected options matter because they tell the
future reader "we already thought of that".

## Decision

Which option, and the ONE-SENTENCE reason. The full reasoning lives
in the next section; this is the "in case you only read one line"
summary.

## Consequences

### Positive

- What we get from this choice.

### Negative

- What we lose. Be honest. No ADR is free.

### Mitigations

- Concrete plans for the negatives. If the negative is "harder for
  new contributors to understand", the mitigation is a code comment
  with a backlink to this ADR.

## Implementation

- File-level changes required: `src/foo.ts`, `drizzle/0042_x.sql`, ...
- Migration / rollout plan if applicable.
- How we'll know this worked: a metric, a test, a code-review smell
  test.

## Alternatives left on the table

If this ADR is provisional or partial, list what's intentionally
out of scope and might be revisited in a follow-up ADR.

---

*Pattern guidance:*
- Keep ADRs ≤ 1 page. If it sprawls, it's probably 2+ ADRs.
- Use prose. Bullet lists hide reasoning behind shape.
- Status "Proposed" → "Accepted" should happen via review (PR), not
  via auto-merge. ADRs are the appellate record for this codebase.
- A "Superseded by" ADR doesn't delete the old one — it links forward.
  The history of how thinking changed is part of the record.
