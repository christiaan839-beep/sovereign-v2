# `@sovereign/inspector` v1.0.0 — Publish Checklist

This is the operator-action checklist for publishing the inspector to
npm. The package is ready to publish — `npm pack --dry-run` produces a
valid 44.0 kB tarball with 17 files and a valid SHA-512 integrity hash.

**This is NOT a code change.** It is a sequence of commands the
operator (the human with Sovereign's npm credentials) runs to make
the package publicly installable.

---

## Pre-publish verification (already passes)

```bash
cd packages/inspector
npm pack --dry-run
```

Expected output:
- name: `@sovereign/inspector`
- version: `1.0.0`
- size: ~44 kB compressed, ~168 kB unpacked
- files: 17
- valid SHA-512 integrity hash

```bash
# Tests pass:
cd ../..
npx vitest run packages/inspector/__tests__/
# Expected: 5 test files, 140 tests, all green

# 103 named exports importable:
node --eval "
const i = await import('./packages/inspector/src/index.mjs');
console.log('exports:', Object.keys(i).length);
" --input-type=module
# Expected: exports: 103
```

---

## Step 1 — npm account + org

You need an npm account with publish access to the `@sovereign` scope.

### Option A: `@sovereign` org exists and you have access

```bash
npm login
npm whoami  # should print your npm username
npm org ls @sovereign  # should list you
```

### Option B: `@sovereign` is not yours and unavailable

The org may already be taken. Test:

```bash
npm view @sovereign/inspector
# 404 → org or package doesn't exist (good for us)
# Different package → org exists, owned by someone else
```

**If `@sovereign` is taken**, change the scope before publishing. Pick one:

- `@sovereignmatrix/inspector`
- `@sovereign-matrix/inspector`
- `@sovmatrix/inspector`

Then update `packages/inspector/package.json`:

```json
{
  "name": "@sovereignmatrix/inspector"
}
```

And update the README + every doc reference. Anti-drift CI will surface
any inconsistency.

### Option C: Create a new org

```bash
# Free for public packages
npm org create sovereignmatrix --access=public
```

---

## Step 2 — Publish

```bash
cd packages/inspector

# Final dry-run
npm publish --dry-run --access public

# Real publish
npm publish --access public
```

If it succeeds you'll see something like:

```
npm notice 📦  @sovereign/inspector@1.0.0
+ @sovereign/inspector@1.0.0
```

### Why `--access public`

Scoped packages default to private. `--access public` is required for
free public installs. Already declared in `package.json`'s
`publishConfig.access` so this should be redundant — but explicit is
safer.

---

## Step 3 — Verify the public install

From a fresh directory (not the repo):

```bash
mkdir /tmp/inspector-smoke && cd /tmp/inspector-smoke
npm install @sovereign/inspector
npx sovereign-inspect --help
```

Expected: usage banner showing all subcommands including
`verify-acat`, `verify-evidence`, `verify-perception-plan`,
`verify-edge-dispatch`, `verify-benchmark`.

Then run an end-to-end ACAT verification (this exercises the real
public package, not local source):

```bash
# Re-use the smoke ACAT we minted in Session 1
echo "<paste ACAT base64url here>" | npx @sovereign/inspector verify-acat \
  --pubkey "<the user pubkey from /tmp/session1-pubkey.txt>" \
  --amount 10000 \
  --currency USD \
  --merchant any \
  --category marketplace_b2c \
  --now 2026-06-15T12:00:00.000Z
```

Expected: `✓ VALID — agent authorized for this cart`

---

## Step 4 — Update public-facing docs

After publish succeeds:

1. **All `/trust/*` pages** currently say "install `@sovereign/inspector`"
   in their footers. Verify the package name matches what was actually
   published (especially if you used a different scope per Option B).

2. **`docs/AGENTIC-COMMERCE-LEADERSHIP.md`** references `@sovereign/inspector`
   in the procurement story. Verify the same.

3. **The 5 leadership docs** (commerce / control-plane / perception /
   edge-nodes / performance-observatory) all link to the inspector.
   Verify scope consistency.

4. **Anti-drift will catch any mismatch** between the published name and
   the docs — `scripts/weekly-health.mjs` greps for the inspector name
   in multiple places.

---

## Step 5 — Announce (optional)

The publish is the artifact. Announcement is optional but high-leverage:

- **Hacker News** — title: "Sovereign Inspector v1.0 — offline-verify
  your agent's audit trail without trusting the platform"
- **Product Hunt** — angle: "the procurement-grade trust artifact every
  AI agent platform should have but doesn't"
- **Twitter/X** — short thread on the 5-pillar offline verification
- **Procurement direct outreach** — email to CISOs you know with the
  npm install command and a 5-minute walkthrough video

The package is more credible than any of these announcements. The
announcement only matters once the package itself is verified working.

---

## Rollback

`npm unpublish` works for **72 hours** after initial publish. After that
the package is public-domain forever (this is intentional — npm
prevents supply-chain attacks via unpublish).

If you discover a critical bug within 72 hours:

```bash
npm unpublish @sovereign/inspector@1.0.0
# Then fix the bug, bump to 1.0.1, and re-publish
```

After 72 hours, you can only **deprecate** a version (it stays
installable but warns):

```bash
npm deprecate @sovereign/inspector@1.0.0 "Critical bug; use 1.0.1+"
```

This is why the pre-publish verification matters. We've already run
all of it.

---

## What this does NOT change

Publishing the inspector does **not**:

- Change anything in the platform itself (it's a separate package)
- Trigger any audit chain entries (no platform action)
- Affect any of the 591 anti-drift invariants currently green
- Break any of the 9 existing trust pages
- Require any change to `agent-factory.ts` or any production code path

It is a pure operator action that converts the platform's "verify
offline without trusting Sovereign" claim from CODE-COMPLETE to
PUBLICLY-INSTALLABLE.

---

## Status as of April 30, 2026

- [x] Code complete (all 5 pillars ported to inspector)
- [x] 140 inspector tests pass in 214ms
- [x] `npm pack` produces valid 44.0 kB tarball with valid integrity hash
- [x] 103 named exports importable from `index.mjs`
- [x] Anti-drift gate verifies all 5 pillar ports present
- [x] README documents every CLI subcommand and library usage pattern
- [ ] **`npm publish` run by operator** ← THIS IS THE ONLY REMAINING STEP

---

*Generated April 30, 2026. Reproducible by running each command from
the repo root in sequence. The package itself is in `packages/inspector/`.*
