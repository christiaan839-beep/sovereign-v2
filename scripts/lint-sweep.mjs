#!/usr/bin/env node
/**
 * Lint sweep — targeted, safe version (Wave 56 rewrite).
 *
 * Only handles three CATEGORICALLY SAFE patterns:
 *   (a) Unused import names — remove from the named-import list.
 *   (b) Unused top-level `const X = ...` declarations — drop the line.
 *   (c) Unused caught errors `catch (err)` — prefix to `(_err)`.
 *
 * EXPLICITLY SKIPPED:
 *   • Function args in destructure patterns (need alias-rename,
 *     not just prefix; the Wave-49 naive sweep broke TS by writing
 *     `_email` where the type required `email`).
 *   • Function args in positional parameters matching framework
 *     callback signatures (would change semantics).
 *
 * Run via `node scripts/lint-sweep.mjs`. Idempotent.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const REMOVABLE_IMPORTS = new Set(["NextResponse", "log", "ai", "beforeEach"]);
const PREFIXABLE_CATCH = new Set(["err"]);
const REMOVABLE_TOPLEVEL_VARS = new Set([
  "log",
  "ai",
  "CARD_REGEX",
  "EMAIL_REGEX",
  "CanonicalPlanId",
  "TOutput",
  "knownAgents",
  "normalizePlanId",
  "subscribe",
  "recordModelExecution",
  "timeoutMs",
  "getRelevantLearnings",
  "beforeEach",
]);

function loadEslintJson() {
  const raw = execSync("npx eslint . --format json", {
    encoding: "utf8",
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 100,
    stdio: ["inherit", "pipe", "ignore"],
  });
  return JSON.parse(raw);
}

function extractName(message) {
  const m = message.match(/^'([^']+)' is (defined|assigned)/);
  return m ? m[1] : null;
}

function removeFromImport(line, name) {
  const importRe = /^(\s*import\s*\{)([^}]*)(\}\s*from\s*["'][^"']+["'].*)$/;
  const m = line.match(importRe);
  if (!m) return null;
  const [, prefix, body, suffix] = m;
  const names = body
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const filtered = names.filter((n) => {
    const baseName = n.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
    return baseName !== name;
  });
  if (filtered.length === names.length) return null;
  if (filtered.length === 0) return "";
  return `${prefix} ${filtered.join(", ")} ${suffix.trim()}`;
}

function prefixCatchErr(line, col, name) {
  if (!/catch\s*\(/.test(line)) return null;
  const start = col - 1;
  if (line.slice(start, start + name.length) !== name) return null;
  const before = start > 0 ? line[start - 1] : " ";
  const after = line[start + name.length] ?? " ";
  if (/[a-zA-Z0-9_$]/.test(before) || /[a-zA-Z0-9_$]/.test(after)) return null;
  return line.slice(0, start) + "_" + name + line.slice(start + name.length);
}

function isSingleLineTopLevelConst(line, name) {
  const re = new RegExp(`^const\\s+${name}\\b`);
  return re.test(line) && line.trimEnd().endsWith(";");
}

function apply(file, msgs) {
  let fixed = 0;
  const lines = readFileSync(file, "utf8").split("\n");
  const dropLines = new Set();

  const sorted = msgs
    .filter((m) => m.ruleId === "@typescript-eslint/no-unused-vars")
    .sort((a, b) => b.line - a.line);

  for (const m of sorted) {
    const name = extractName(m.message);
    if (!name) continue;
    const line = lines[m.line - 1];
    if (line === undefined) continue;

    if (REMOVABLE_IMPORTS.has(name) && line.includes("import")) {
      const next = removeFromImport(line, name);
      if (next !== null) {
        if (next === "") dropLines.add(m.line - 1);
        else lines[m.line - 1] = next;
        fixed++;
        continue;
      }
    }

    if (
      REMOVABLE_TOPLEVEL_VARS.has(name) &&
      isSingleLineTopLevelConst(line, name)
    ) {
      dropLines.add(m.line - 1);
      fixed++;
      continue;
    }

    if (PREFIXABLE_CATCH.has(name)) {
      const next = prefixCatchErr(line, m.column, name);
      if (next !== null) {
        lines[m.line - 1] = next;
        fixed++;
        continue;
      }
    }
  }

  if (fixed > 0) {
    const out = lines.filter((_, i) => !dropLines.has(i)).join("\n");
    writeFileSync(file, out);
  }
  return fixed;
}

function main() {
  const results = loadEslintJson();
  let totalFixed = 0;
  let filesTouched = 0;
  for (const result of results) {
    if (!result.messages || result.messages.length === 0) continue;
    const fixed = apply(result.filePath, result.messages);
    if (fixed > 0) {
      filesTouched++;
      totalFixed += fixed;
      console.log(`${result.filePath}: -${fixed}`);
    }
  }
  console.log(`\nfixed ${totalFixed} warnings across ${filesTouched} files`);
}

main();
