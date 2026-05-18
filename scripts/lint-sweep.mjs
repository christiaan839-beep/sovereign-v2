#!/usr/bin/env node
/**
 * Lint sweep — converts unused-var warnings into either:
 *   • prefix with `_` (for function args the signature requires)
 *   • removal from an import statement (for unused imports)
 *
 * Run via `node scripts/lint-sweep.mjs`. Idempotent — running twice
 * is a no-op once everything's clean.
 *
 * Strategy: parses ESLint's --format json output, groups messages by
 * file, and applies safe edits highest-line-number first so column
 * positions don't shift mid-file.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ALLOW_PREFIX_NAMES = new Set([
  "userId",
  "email",
  "request",
  "req",
  "res",
  "log",
  "err",
  "_err",
  "timeoutMs",
  "subscribe",
  "recordModelExecution",
  "normalizePlanId",
  "knownAgents",
  "beforeEach",
  "ai",
]);

const ALLOW_REMOVE_IMPORTS = new Set(["NextResponse", "log"]);

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
  const importRe =
    /^(\s*import\s*\{)([^}]*)(\}\s*from\s*["'][^"']+["'].*)$/;
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
  if (filtered.length === 0) return ""; // drop the whole line
  return `${prefix} ${filtered.join(", ")} ${suffix.trim()}`;
}

function prefixWithUnderscore(line, name, col) {
  const start = col - 1;
  if (start < 0 || start + name.length > line.length) return null;
  if (line.slice(start, start + name.length) !== name) return null;
  const before = start > 0 ? line[start - 1] : " ";
  const after = line[start + name.length] ?? " ";
  if (/[a-zA-Z0-9_$]/.test(before) || /[a-zA-Z0-9_$]/.test(after)) return null;
  return line.slice(0, start) + "_" + name + line.slice(start + name.length);
}

function apply(file, msgs) {
  let fixed = 0;
  const lines = readFileSync(file, "utf8").split("\n");

  const byLine = new Map();
  for (const m of msgs) {
    if (m.ruleId !== "@typescript-eslint/no-unused-vars") continue;
    const arr = byLine.get(m.line) ?? [];
    arr.push(m);
    byLine.set(m.line, arr);
  }

  const lineNumbers = [...byLine.keys()].sort((a, b) => b - a);

  for (const lineNum of lineNumbers) {
    const lineMsgs = byLine.get(lineNum);
    lineMsgs.sort((a, b) => b.column - a.column);

    let line = lines[lineNum - 1];
    const originalLine = line;
    let dropLine = false;

    for (const m of lineMsgs) {
      const name = extractName(m.message);
      if (!name) continue;

      if (ALLOW_REMOVE_IMPORTS.has(name) && line.includes("import")) {
        const next = removeFromImport(line, name);
        if (next !== null) {
          if (next === "") dropLine = true;
          else line = next;
          fixed++;
          continue;
        }
      }

      if (ALLOW_PREFIX_NAMES.has(name)) {
        const next = prefixWithUnderscore(line, name, m.column);
        if (next !== null) {
          line = next;
          fixed++;
          continue;
        }
      }
    }

    if (dropLine) {
      lines.splice(lineNum - 1, 1);
    } else if (line !== originalLine) {
      lines[lineNum - 1] = line;
    }
  }

  if (fixed > 0) {
    writeFileSync(file, lines.join("\n"));
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
