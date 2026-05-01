# Sovereign Trust Manifest — Governance

This document describes how the Sovereign Trust Manifest specification
evolves and how stewardship transitions from a single-author model to
a multi-vendor working group.

---

## Current state (Working Draft 1.0)

**Stewardship:** Sovereign Matrix is the sole author of the v1.0 spec.
This is the "vendor-author phase" — appropriate for a Working Draft
where the spec is still proving its compatibility surface against real
implementations.

**Decision authority:** Sovereign Matrix accepts or rejects proposed
changes via pull requests against this spec repo. Decisions are
documented in CHANGELOG.md.

**Versioning:** Semver-pinned in the `$schema` URL field of the
manifest. Backward-compatible additions bump the minor version (e.g.
1.0 → 1.1). Removing a capability flag, an endpoint key, or a verifier
surface bumps the major version (e.g. 1.x → 2.0).

---

## Transition trigger

When the spec has 3+ independent implementors live in production
(verified by `/.well-known/sovereign-trust` reachable at their canonical
URLs, with a passing conformance test), governance transitions from
single-author to a multi-vendor working group.

**Why this trigger:** below 3 implementors, the spec is one vendor's
manifest; above 3, a single-vendor steward is structurally inappropriate.
The threshold is borrowed from the IETF "rough consensus" pattern — 3
independent implementations is the bar for promoting an Internet-Draft
to RFC.

---

## Working-group phase (post-transition)

When the trigger fires, the spec moves to a multi-vendor working group
with the following properties:

### Membership

- One representative per implementor organization (verified manifest).
- One academic or independent observer seat (rotating; nominated by
  consensus).
- One end-user / procurement-team seat (representing buyers, rotating).

### Decision-making

- Proposed changes require **rough consensus** (2/3 of working-group
  members in favor; no strong objection from a quorum of 4+).
- Changes that move a capability from `true` to `false` (i.e., reduce
  what the spec promises) require **explicit consensus** (no objections).
- Sovereign Matrix retains a permanent **founder seat** but no veto
  power. The founder seat is on the byline of v1.0 indefinitely.

### Process

- All discussion happens in the open: GitHub issues + discussions on
  the spec repo, plus a public mailing list once volume warrants.
- All proposed changes go through a 2-week comment period before
  acceptance.
- Working-group meetings are summarized publicly within 7 days.

### Forks

- Forks are permitted (CC BY 4.0). A fork that diverges substantively
  from the canonical spec MUST rename itself to avoid confusion (e.g.,
  "AcmeCorp Trust Manifest 1.0 (derived from Sovereign Trust Manifest
  1.0)").

---

## Standards-body submission (post-working-group)

Once the working group has 5+ implementors and a stable v1.0 release,
the spec should be submitted to one of:

- **OWASP** (most likely — Agent Security Initiative working group)
- **IETF** (as an Internet-Draft, candidate for RFC)
- **W3C** (as a candidate Recommendation)
- **ISO/IEC JTC 1/SC 42** (AI standards)

The submission target depends on which body has the strongest
ecosystem fit at that point. Sovereign Matrix commits to leading the
submission process and remaining a maintainer through standards-body
publication.

---

## Why this governance model

We've watched specs die from two failure modes:

1. **Single-vendor capture** — the spec stays under one vendor's
   control; other vendors don't adopt because they don't trust the
   roadmap. Examples: Adobe Flash, Microsoft OOXML in early years.

2. **Premature multi-stakeholder paralysis** — too many cooks before
   the spec proves itself; the working group never agrees on anything.
   Examples: many failed W3C drafts.

The 3-implementor trigger threads the needle. Until 3 vendors are
live, single-vendor stewardship is appropriate (someone has to make
decisions). After 3, the working-group transition is structurally
required.

---

## Founder commitments

The author of the v1.0 spec (Sovereign Matrix) commits to:

1. **Open the repository.** This spec is hosted as a separately-licensed
   artifact, with its own CC BY 4.0 license. Forking is welcomed.
2. **Implement the reference deployment.** Sovereign Matrix maintains
   a live implementation at sovereignmatrix.agency that conforms to
   the spec exactly. Drift between the spec and the reference is a
   bug.
3. **Cede authority on the trigger.** When 3 independent implementors
   land, governance transitions per this document. No founder veto.
4. **Maintain the schema in perpetuity.** Even if Sovereign Matrix the
   company is acquired, merged, or wound down, the founder seat persists
   as a maintainer commitment.

---

## Compatibility guarantee

Within a major version, the spec maintains backward compatibility:

- **Additive changes only.** New capability flags, endpoint keys, or
  verifier surfaces can be added.
- **No silent removals.** A capability flag, endpoint key, or verifier
  surface MUST NOT be removed within a major version. Deprecated items
  remain in the schema with a `"deprecated": true` annotation.
- **Major version bumps are rare.** v2.0 represents a substantial
  redesign. Implementors should expect to support v1.x for at least 5
  years after v2.0 ships.

---

## How to verify governance is being followed

Anyone can audit governance compliance:

1. Read CHANGELOG.md — every spec change is documented with rationale.
2. Read repo issues + PRs — every accepted change has an open
   discussion trail.
3. Ping a working-group member if you need clarification.

If you find a process violation, file an issue tagged
`governance/violation`. The working group must respond within 14 days.
