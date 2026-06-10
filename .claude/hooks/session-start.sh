#!/bin/bash
#
# SessionStart hook — Claude Code on the web.
#
# Installs npm dependencies so a fresh remote container can run
# `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`
# the moment the session starts.
#
# Runs SYNCHRONOUSLY: the session waits for dependencies to land
# before the agent loop is ready. Slower startup, but no race where
# Claude tries to run a tool before its module is on disk.
# Switch to async mode by uncommenting the asyncTimeout line if the
# wait gets long enough to be annoying.
#
# Guarded with $CLAUDE_CODE_REMOTE so local dev environments are
# never touched — your `node_modules` on your laptop stays intact.

set -euo pipefail

# Local dev: do nothing. The hook is only meaningful in the
# ephemeral web sandbox.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Echo async config? Leaving sync for now. Uncomment to flip:
# echo '{"async": true, "asyncTimeout": 600000}'

cd "$CLAUDE_PROJECT_DIR"

# `npm install` (not `npm ci`) so the install is idempotent and
# benefits from container-state caching between sessions. Lockfile
# is respected for transitive resolution but missing modules can be
# added without aborting.
echo "[session-start] running npm install..."
npm install --no-audit --no-fund --loglevel=error

# Workspace packages (@sovereign-matrix/*) publish from dist/; without
# this, `npm run typecheck` fails on ~25 TS2307 module-not-found errors
# in the compliance pages. Idempotent — skips packages with fresh dist/.
# Mirrors vercel.json's installCommand.
echo "[session-start] building workspace packages..."
npm run build:packages

echo "[session-start] dependencies ready."
