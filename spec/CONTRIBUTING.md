# Contributing to Sovereign Trust Manifest

The spec is open. Contributions are welcomed from anyone — vendors,
auditors, regulators, academic researchers, end users.

---

## What kinds of contributions land

| Contribution kind | Likely outcome |
|--|--|
| Spec ambiguity report (a section is unclear or contradicts itself) | Accepted; clarification PR |
| New capability flag for a primitive 3+ implementors already publish | Accepted as additive change |
| New verifier surface following the same response shape | Accepted as additive change |
| New optional endpoint key | Accepted as additive change |
| Stricter constraint on existing field | Considered; may require major version bump |
| Removal of a deprecated field | Accepted only at major version transition |
| Change to the load-bearing rule (§6: "instance MUST NOT be a required trust anchor") | Rejected unless a fundamentally better alternative is proposed |

---

## How to propose a change

1. **Open an issue first.** Describe the gap or improvement. This
   avoids wasted PR effort if the change isn't aligned with the spec's
   direction.
2. **Wait for a maintainer signal.** A maintainer will tag the issue:
   - `accept-pr` — go ahead and submit a PR
   - `needs-discussion` — let's clarify scope first
   - `out-of-scope` — this won't land; here's why
3. **Submit the PR.** The PR must include:
   - Updated SPEC.md text (if the change touches the normative spec)
   - Updated schema/sovereign-trust.schema.json (if the change touches
     the JSON Schema)
   - Updated CHANGELOG.md
   - Updated examples/reference-manifest.json (if the change touches a
     field that appears in the reference)
   - A note describing how existing implementations should migrate

---

## What makes a strong proposal

- **Implementor evidence.** "Vendor X already publishes this" or
  "OWASP / NIST / EU AI Act requires this" is the strongest case.
- **Backward compatibility.** Changes that don't break existing
  implementations land faster than ones that do.
- **Verifiability.** A new claim must come with a proposed verifier
  surface (or amendment to an existing one).
- **No vendor lock-in.** Proposals that benefit one vendor over others
  are rejected; the spec exists to be vendor-neutral.

---

## What makes a weak proposal

- **"Sovereign Matrix should support X."** This is a Sovereign Matrix
  feature request, not a spec proposal. File it against the
  Sovereign Matrix repo instead.
- **"All implementations should be required to support X."** Strict
  requirements need substantial implementor evidence and consensus.
  Default to making new fields optional.
- **"This would be cleaner if we removed Y."** Removal is a major
  version bump. Defer it; document the deprecation; mark it for the
  next major.

---

## The CHANGELOG.md format

Every change appends an entry:

```
## [unreleased]

### Added
- New capability flag `xyzPrimitive` for ... (PR #N)

### Changed
- Clarified §3 wording on ... (PR #N)

### Deprecated
- (none)

### Removed
- (none — major version bumps only)

### Fixed
- Schema regex for ... (PR #N)
```

When a release ships, the `[unreleased]` section is renamed to the new
version with date.

---

## Conformance test

Every PR that touches the spec or schema MUST run the conformance test
(reference implementation):

```bash
git clone https://github.com/christiaan839-beep/sovereign-v2.git
cd sovereign-v2
npm install
npx vitest run src/app/api/__tests__/sovereign-trust-conformance.test.ts
```

The conformance test verifies the live `/.well-known/sovereign-trust`
output matches the spec text. Any change to the spec that breaks the
reference implementation MUST include a corresponding fix to the
reference.

---

## Code of Conduct

Be respectful. Disagreements about the spec are normal; personal
attacks are not. Maintainers may close issues that violate this
without further discussion.

We follow the Contributor Covenant. See:
https://www.contributor-covenant.org/version/2/1/code_of_conduct/

---

## Asking for help

- Open a GitHub Discussion (not an issue) for "how do I implement X"
  questions.
- Email security@sovereignmatrix.agency for security-sensitive
  questions about the spec or the reference implementation.
- Tag the maintainers in a PR if you've been waiting > 14 days for
  feedback.
