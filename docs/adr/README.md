# Architecture Decision Records

ADRs capture *why* a decision was made — not what the code does
(that's the source) and not what's planned (that's roadmap), but
the reasoning behind a choice that shaped the codebase.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [0001](./0001-free-tool-rate-limit-identity.md) | Free-tool rate-limit identity strategy | Accepted | 2026-04-19 |
| [0002](./0002-byok-e2e-encryption.md) | BYOK end-to-end encryption | Accepted | 2026-04-21 |
| [0003](./0003-slack-oauth-first-integration.md) | Slack OAuth-first integration | Accepted | 2026-04-23 |
| [0004](./0004-permanence-sprint-self-healing-and-cost-guard.md) | Permanence Sprint — self-healing telemetry + cost-runaway guard | Accepted | 2026-04-28 |

## When to write an ADR

Write one when you make a decision that:

- **Has multiple defensible options** (not a one-way door).
- **Will be visible in the code shape** for years.
- **Will need to be re-explained to future contributors**, including
  Future You.
- **Touches a Constitution Principle** (see `docs/PROJECT-CONSTITUTION.md`).

You do NOT need an ADR for:

- Bug fixes or refactors that preserve behaviour.
- Library version bumps (covered by Renovate + dep-rot detector).
- Feature scope additions that follow established patterns.

## Process

1. Copy `TEMPLATE.md` to `NNNN-short-title.md` (next number, kebab-case).
2. Fill in the Context / Constraints / Options Considered sections.
3. Open a PR with the ADR alongside the implementation.
4. Reviewer challenges the **rejected options** — that's the most
   important section. If a reviewer can find a missed option that
   should have been considered, the ADR is incomplete.
5. After merge, update this README's index table.
6. If a future ADR supersedes this one, set Status to "Superseded by
   ADR-NNNN" and link forward. Do NOT delete the old ADR — the
   history of how thinking changed is part of the record.

## Constitutional ADRs

ADRs that amend or override a Constitution Principle (per
`docs/PROJECT-CONSTITUTION.md`) require a 14-day comment period
before merging. They are tagged "Constitutional Amendment" in the
PR title and listed separately at the bottom of this index when
they exist.

## Why this format

We use **prose-heavy ADRs**, not tables of pros/cons. The shape of an
ADR is "story → choice → consequence" — a future reader needs the
narrative, not just the bullet list. If you find yourself making a
table, consider whether the story-form would carry more meaning.

The `Options considered` section is **always** at least 2, often 3.
A decision recorded as "we picked X" without listing the rejected
alternatives leaves a future reader wondering "did they think of Y?"
The rejected options are the proof that the decision was deliberate.
