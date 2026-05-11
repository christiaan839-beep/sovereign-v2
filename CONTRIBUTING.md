# Contributing to Sovereign Matrix

The repository contains two intentionally different licensing zones.
Read the LICENSE file before contributing. The short version:

- **Open zones** — the VAOS 1.0 specification, the npm verifier
  package (`packages/vaos-verifier/`), the CLI (`cli/`), and the
  outreach templates (`docs/outreach/`) accept community
  contributions under their respective licenses (CC0, MIT, MIT,
  CC BY 4.0). PRs welcome from anyone.
- **Proprietary zones** — the platform itself (everything not
  listed above) accepts contributions only from authorized
  collaborators. If you're not sure whether you're authorized,
  email spec@sovereignmatrix.agency first.

This document covers the open zones. For platform contributions,
your contract or invitation is the source of truth.

---

## Quick start

```bash
git clone https://github.com/christiaan839-beep/sovereign-v2.git
cd sovereign-v2
npm install
npm run hooks:install   # installs the pre-push gate
cp .env.example .env.local  # fill in at least DATABASE_URL + Clerk keys
npm run dev
```

The pre-push hook runs `npm run lint`, `npm test`, `npm run typecheck`,
and a Suspense-trap scanner before any push leaves your machine. Bypass
with `PRE_PUSH_SKIP=1` for emergencies; fix forward immediately after.

## What we're looking for (in the open zones)

| Zone                      | Welcome contributions                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vaos-verifier/` | New language ports (Python, Rust, Go, Swift). Bug fixes. Performance. Conformance test vectors.                                                            |
| `cli/`                    | New subcommands, better error messages, color/no-color toggles.                                                                                            |
| `docs/specs/vaos-1.0.md`  | Editorial fixes, clarifications, test vectors. Substantive changes via discussion first — the spec is at version `1.0` and changes require a version bump. |
| `docs/outreach/`          | Improvements to the templates based on what actually converted. New target verticals.                                                                      |

## What we're NOT looking for

- Pull requests that add a new agent without a clear use case + tests.
- Pull requests that touch `src/lib/agent-runs.ts` or any signature /
  canonicalization code without prior coordination — these are security-
  critical and changes invalidate every receipt issued before the
  change.
- Pull requests that disable the output verifier (`useVerifier: false`)
  on a route without a stated reason in the PR description.
- Cosmetic "renames" or "reorganize" PRs. The code style is what it is;
  large structural changes need an issue first.

## How to propose a change

1. **For substantive changes**, open a GitHub Discussion or issue
   first. Saves you time if the answer is "we're not taking that
   direction."
2. **For drive-by fixes** (typo, broken link, obvious bug), just open
   a PR with a clear title. No issue needed.
3. **Branch from `main`**, name your branch `your-username/short-description`.
4. **Write tests.** If you can't test it, explain in the PR body why.
5. **Run `npm run typecheck && npm test && npm run lint`** before
   pushing — the pre-push hook will catch you if you forget.
6. **Open the PR** with the template (auto-applied — fill in the
   risk-surface checklist honestly).

## Code style

The repository uses Prettier + ESLint with the configuration in this
repo. Run `npm run lint -- --fix` to auto-fix what's auto-fixable. The
formatter runs on every save in most editors and on every commit via
the pre-push hook.

Specific conventions:

- **TypeScript strict.** No `any` without an `eslint-disable` comment
  explaining why.
- **No console.log in committed code.** Use `src/lib/logger.ts`.
- **No comments that say WHAT the code does.** Only WHY — hidden
  constraints, gotchas, future-reader warnings.
- **Tests in `src/**tests**/**`mirroring the source layout** (e.g.`src/lib/foo.ts`→`src/**tests**/lib/foo.test.ts`).
- **One feature per PR.** Reviewers reject feature mixing.

## Tests

- **Unit tests** under `src/__tests__/lib/**` for pure functions.
- **Route tests** under `src/__tests__/api/**` for HTTP endpoints,
  using vitest's request/response stubbing.
- **End-to-end** in `e2e/smoke.spec.ts` (Playwright). Smoke is
  informational, not blocking — it's a deploy-time check.
- **Test vectors** in `docs/specs/vaos-1.0.md` §12 are normative for
  any verifier implementation. Adding test vectors to the spec is a
  cross-implementation contract change — coordinate first.

## Security disclosures

Do NOT open a public issue or PR for a security vulnerability. See
`SECURITY.md` for the disclosure path.

## CLA / DCO

We do not require a CLA. For substantive contributions to the open
zones, we may ask you to sign off your commits per the Developer
Certificate of Origin (DCO):

```bash
git commit -s -m "..."
```

This is for clarity of provenance, not for license assignment — your
contribution stays under its source-tree license (MIT, CC0, etc).

## Community norms

See `CODE_OF_CONDUCT.md`. Be helpful, be specific, be honest. If you
think a maintainer's decision is wrong, say so — but bring evidence,
not vibes.

## Maintainer cadence

There is currently one maintainer. Response times:

- Critical bug PRs: same day if I see them.
- Feature PRs: within 7 days for triage, longer for actual review.
- Issues: within 14 days for triage.

If something's been sitting for longer than that, ping
`spec@sovereignmatrix.agency` with the issue/PR number.
