# Releasing @sovereignmatrix packages

Two packages live in this monorepo:

| Package | Path | Status |
|---|---|---|
| `@sovereignmatrix/agent-validator` | `packages/agent-validator` | Ready to publish |
| `@sovereignmatrix/cli` | `packages/sovereign-cli` | Ready to publish |

Both are MIT-licensed and the published distribution is `dist/**` (built from `src/**` via each package's `tsconfig.json`).

## One-time setup

### 1. Create the npm organization

Go to <https://www.npmjs.com/org/create> and create `sovereignmatrix` (scope name). Add your personal npm account as an owner.

### 2. Generate an Automation token

1. <https://www.npmjs.com/settings/sovereignmatrix/tokens>
2. "Generate New Token" → **Classic Token** → type **Automation**
3. Copy the token value (only shown once)

### 3. Add it to the GitHub repo

1. GitHub repo → Settings → Secrets and variables → Actions
2. "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: the automation token from step 2

## Publishing

### Option A — push a tag (recommended)

```bash
# Publish only the validator
git tag sam-validator-v1.0.0
git push origin sam-validator-v1.0.0

# Publish only the CLI
git tag sam-cli-v1.0.0
git push origin sam-cli-v1.0.0

# Publish both in one go
git tag sam-all-v1.0.0
git push origin sam-all-v1.0.0
```

The `publish-packages.yml` workflow picks up the tag prefix, builds + tests the right package, and publishes to npm with provenance attestation.

### Option B — workflow_dispatch

1. GitHub → Actions → "Publish packages to npm"
2. "Run workflow"
3. Pick `validator` / `cli` / `both`
4. Go

## Bumping versions

Update `package.json` → `"version"` in each package before tagging. Conventional order:

```bash
cd packages/agent-validator
npm version patch    # 1.0.0 → 1.0.1
# or
npm version minor    # 1.0.0 → 1.1.0
# or
npm version major    # 1.0.0 → 2.0.0
```

`npm version` commits the bump + creates a git tag locally. Push both:

```bash
git push && git push --tags
```

If you used `npm version`, the tag will be `v1.0.1` (not our `sam-validator-v1.0.1` convention) — so either push explicitly named tags alongside, or run `git tag sam-validator-v1.0.1 v1.0.1` to alias.

## Pre-publish checks

Before pushing a publish tag, verify locally:

```bash
# Validator
cd packages/agent-validator
npm install
npm run build
npm test
ls -la dist/             # should contain index.js + cli.js + types

# CLI
cd ../sovereign-cli
npm install
npm run build
ls -la dist/             # should contain cli.js + commands/*.js
```

## Troubleshooting

### "403 You do not have permission to publish"
The npm token is either missing the `automation` type or the organization/scope isn't set up. Re-check step 2 above.

### "402 Payment Required"
You're trying to publish a scoped package as private. Every publish in this workflow passes `--access public` — verify `package.json` doesn't override it to `private`.

### "E404 Not Found" on `@sovereignmatrix/...`
The scope doesn't exist yet. Create it via <https://www.npmjs.com/org/create>.

### "ETARGET No matching version found"
The version in `package.json` was already published. `npm version patch` to bump.
