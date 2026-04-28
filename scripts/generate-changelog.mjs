#!/usr/bin/env node
/**
 * AUTO-CHANGELOG GENERATOR — R27 Permanence Sprint.
 *
 * Why this exists: CHANGELOG.md drifts. The current top entry is dated
 * 2026-04-03; we've shipped ~25 sessions of work since (per CLAUDE.md)
 * with the changelog growing maybe twice. The fix is automation:
 * derive the changelog from git, not from human discipline.
 *
 * What it does:
 *   1. Reads git log since the last release tag (or last CHANGELOG entry).
 *   2. Categorises each commit by Conventional Commits prefix
 *      (feat / fix / docs / refactor / test / chore / ...) OR by
 *      heuristic when the prefix is missing (matches "fix:", "add",
 *      "remove", "improve" etc. in the subject).
 *   3. Groups into Added / Fixed / Changed / Removed sections.
 *   4. Emits a markdown block that matches the existing CHANGELOG.md
 *      shape ("## [VERSION] — YYYY-MM-DD" with ###Added/Fixed/...).
 *
 * Modes:
 *   --check   exits 1 if there are commits since the last release that
 *             aren't reflected in CHANGELOG.md (used by anti-drift).
 *   --emit    prints the new section to stdout (for human paste).
 *   --update  prepends the new section to CHANGELOG.md in place.
 *
 * Design:
 *   - Pure Node, no deps (no chalk, no semver lib).
 *   - Uses execFileSync (not execSync) — no shell interpolation,
 *     no injection vector even on future edits.
 *   - Heuristics are intentionally lossy: a commit subject is signal,
 *     but not the canonical record. The canonical record is the diff.
 *     This script's job is to surface "you have N undocumented commits"
 *     so the human can review, not to be the canonical changelog.
 *   - The anti-drift gate calls --check, so unreviewed shipping
 *     becomes a CI failure — not a tribal-knowledge problem.
 *
 * Usage:
 *   node scripts/generate-changelog.mjs --check
 *   node scripts/generate-changelog.mjs --emit > /tmp/changelog-section.md
 *   node scripts/generate-changelog.mjs --update --version 2.2.0
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const CHANGELOG_PATH = resolve(ROOT, "CHANGELOG.md");

// Categorisation heuristics. Order matters — first match wins.
// The Conventional Commits prefix takes priority over keyword scan.
const CATEGORISERS = [
  // Conventional Commits prefixes (highest priority).
  { regex: /^(feat|feature)(\(.*\))?:\s*/i, category: "Added" },
  { regex: /^(fix|bugfix|hotfix)(\(.*\))?:\s*/i, category: "Fixed" },
  { regex: /^(refactor|perf|style)(\(.*\))?:\s*/i, category: "Changed" },
  { regex: /^(remove|deprecate)(\(.*\))?:\s*/i, category: "Removed" },
  { regex: /^(docs|chore|test|build|ci)(\(.*\))?:\s*/i, category: "Internal" },
  // Heuristic fallback — natural-English commit subjects.
  { regex: /^(add|introduce|ship|wire|implement|land)\b/i, category: "Added" },
  { regex: /^(fix|repair|patch|resolve|correct|prevent)\b/i, category: "Fixed" },
  { regex: /^(remove|delete|deprecate|drop)\b/i, category: "Removed" },
  { regex: /^(update|improve|enhance|refactor|simplify|tighten|harden|migrate)\b/i, category: "Changed" },
];

function categorise(subject) {
  for (const { regex, category } of CATEGORISERS) {
    const m = subject.match(regex);
    if (m) {
      // Strip the prefix for display when it's a Conventional Commits prefix.
      const stripped = subject.replace(regex, "").trim();
      return { category, display: stripped || subject };
    }
  }
  // Default: bucket as "Changed" (cleaner than "Other" for users).
  return { category: "Changed", display: subject };
}

/**
 * Get the last released version + date by parsing CHANGELOG.md
 * for "## [version] — YYYY-MM-DD". Returns null if not found.
 */
function getLastRelease() {
  try {
    const md = readFileSync(CHANGELOG_PATH, "utf8");
    // Match the FIRST "## [version] — YYYY-MM-DD" header.
    const match = md.match(/^##\s*\[([^\]]+)\]\s*[—-]\s*(\d{4}-\d{2}-\d{2})/m);
    if (!match) return null;
    return { version: match[1], date: match[2] };
  } catch {
    return null;
  }
}

/**
 * Get all commits since the last release date. We use date rather
 * than tag because the project ships from `claude/wizardly-benz` →
 * `main` and tags aren't strictly maintained. Date is the boundary
 * the changelog itself documents.
 *
 * Uses execFileSync (not execSync) so the date argument can never
 * become a shell-injection vector even after future edits.
 */
function getCommitsSinceLastRelease() {
  const last = getLastRelease();
  // The since arg goes to execFile as a separate array element, not
  // through the shell — so a CHANGELOG.md tampered to inject `; rm -rf /`
  // into the date capture would fail the regex match earlier, and even
  // if it slipped through, would be a literal arg to git, not a shell command.
  const sinceArg = last ? `--since=${last.date}` : "--since=30.days.ago";
  try {
    const out = execFileSync(
      "git",
      ["log", sinceArg, "--pretty=format:%H%x09%s", "--no-merges"],
      { cwd: ROOT, encoding: "utf8" },
    );
    if (!out.trim()) return [];
    return out
      .trim()
      .split("\n")
      .map((line) => {
        const [hash, ...subjectParts] = line.split("\t");
        return { hash, subject: subjectParts.join("\t").trim() };
      })
      .filter((c) => c.subject && c.hash);
  } catch (err) {
    console.error("git log failed:", err.message);
    return [];
  }
}

/**
 * Group commits by category and emit a markdown section. Skips
 * "Internal" commits from the user-visible changelog by default
 * (those land in CONTRIBUTING.md or session learnings instead).
 */
function buildSection({ version, date, commits, includeInternal }) {
  const buckets = { Added: [], Fixed: [], Changed: [], Removed: [], Internal: [] };
  for (const c of commits) {
    const { category, display } = categorise(c.subject);
    buckets[category].push(`- ${display} (${c.hash.slice(0, 7)})`);
  }

  const sections = [];
  for (const cat of ["Added", "Fixed", "Changed", "Removed"]) {
    if (buckets[cat].length > 0) {
      sections.push(`### ${cat}\n${buckets[cat].join("\n")}`);
    }
  }
  if (includeInternal && buckets.Internal.length > 0) {
    sections.push(`### Internal\n${buckets.Internal.join("\n")}`);
  }

  if (sections.length === 0) return null;
  return `## [${version}] — ${date}\n\n${sections.join("\n\n")}\n`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ── Modes ──────────────────────────────────────────────────────────

function modeCheck() {
  const commits = getCommitsSinceLastRelease();
  const last = getLastRelease();
  // Tolerance: tiny doc-only deltas shouldn't fail the gate. We
  // require the changelog only when there are 5+ undocumented commits
  // OR commits with user-facing prefixes (feat/fix). Anything below
  // that bar is noise — code-comment tweaks, internal refactors, etc.
  const userFacing = commits.filter((c) =>
    /^(feat|feature|fix|bugfix|hotfix|remove|deprecate)/i.test(c.subject),
  );
  if (commits.length === 0 || (commits.length < 5 && userFacing.length === 0)) {
    console.log(
      `✅ CHANGELOG.md ok (${commits.length} commits, ${userFacing.length} user-facing).`,
    );
    process.exit(0);
  }
  console.log(
    `❌ ${commits.length} commit(s) (${userFacing.length} user-facing) since CHANGELOG entry [${last?.version ?? "(none)"}]:`,
  );
  for (const c of commits.slice(0, 10)) {
    console.log(`   ${c.hash.slice(0, 7)} ${c.subject}`);
  }
  if (commits.length > 10) {
    console.log(`   ... and ${commits.length - 10} more.`);
  }
  console.log(
    "\nRun: node scripts/generate-changelog.mjs --emit  (review)",
  );
  console.log(
    "Or:  node scripts/generate-changelog.mjs --update --version X.Y.Z  (apply)",
  );
  process.exit(1);
}

function modeEmit({ version }) {
  const commits = getCommitsSinceLastRelease();
  if (commits.length === 0) {
    console.error("No commits since last release; nothing to emit.");
    process.exit(0);
  }
  const section = buildSection({
    version: version ?? "UNRELEASED",
    date: todayIso(),
    commits,
    includeInternal: false,
  });
  if (!section) {
    console.error("All commits filtered out (likely all Internal).");
    process.exit(0);
  }
  console.log(section);
}

function modeUpdate({ version }) {
  if (!version) {
    console.error("--update requires --version X.Y.Z");
    process.exit(2);
  }
  const commits = getCommitsSinceLastRelease();
  if (commits.length === 0) {
    console.error("No commits since last release; nothing to update.");
    process.exit(0);
  }
  const section = buildSection({
    version,
    date: todayIso(),
    commits,
    includeInternal: false,
  });
  if (!section) {
    console.error("All commits filtered out; not updating CHANGELOG.");
    process.exit(0);
  }

  let md;
  try {
    md = readFileSync(CHANGELOG_PATH, "utf8");
  } catch {
    md = "# Changelog\n\nAll notable changes to Sovereign Matrix are documented here.\n\n";
  }

  // Insert AFTER the H1 + intro paragraph and BEFORE the first existing release.
  // The intro is everything up to (but not including) the first "## [".
  const insertPoint = md.indexOf("\n## [");
  let next;
  if (insertPoint === -1) {
    next = md.trimEnd() + "\n\n" + section;
  } else {
    next = md.slice(0, insertPoint + 1) + section + "\n" + md.slice(insertPoint + 1);
  }

  writeFileSync(CHANGELOG_PATH, next);
  console.log(`✅ CHANGELOG.md updated with ${commits.length} commits as v${version}.`);
}

// ── Entry ──────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const versionArgIdx = argv.indexOf("--version");
const version = versionArgIdx >= 0 ? argv[versionArgIdx + 1] : undefined;

if (argv.includes("--check")) modeCheck();
else if (argv.includes("--emit")) modeEmit({ version });
else if (argv.includes("--update")) modeUpdate({ version });
else {
  console.log("Usage:");
  console.log("  node scripts/generate-changelog.mjs --check");
  console.log("  node scripts/generate-changelog.mjs --emit [--version 2.2.0]");
  console.log("  node scripts/generate-changelog.mjs --update --version 2.2.0");
  process.exit(2);
}
