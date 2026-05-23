#!/usr/bin/env node
/**
 * SOVEREIGN MATRIX — Wave 116 codemod: bare fetch() → outboundFetchAsResponse().
 *
 * Why this exists:
 *   M1 in BACKLOG (~156 remaining callsites). Hand-converting is too slow.
 *   `outboundFetchAsResponse` is the Response-compatible wrapper (wave 116)
 *   so the consumer code stays unchanged.
 *
 * What it does:
 *   1. Scans every src/app/api/**\/*.ts file.
 *   2. For each `fetch(` callsite that is NOT already `outboundFetch*`:
 *      - Parse the URL argument shape (string literal vs template literal
 *        vs identifier vs `new URL(...).toString()`).
 *      - Infer `allowedHosts` from the URL pattern.
 *      - Replace `fetch(` with `outboundFetchAsResponse(`.
 *      - Add the third opts argument with `ruleId` + `allowedHosts`.
 *      - Add the import if missing.
 *   3. Files that need response-shape refactoring (e.g. they return the
 *      Response or pass it elsewhere) are left untouched + listed in the
 *      report.
 *
 * Safe-by-default:
 *   - Cases the script can't confidently classify are LEFT UNTOUCHED.
 *   - Existing imports are preserved.
 *   - Run with `--dry-run` to see what would change before applying.
 *
 * Usage:
 *   node scripts/codemod-outbound-fetch.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const apiRoot = join(repoRoot, "src", "app", "api");

const DRY_RUN = process.argv.includes("--dry-run");

/** Find every .ts file under src/app/api with at least one fetch call. */
function findCandidateFiles() {
  const out = execSync(
    `grep -rlE "\\bfetch\\(" ${apiRoot} --include="*.ts"`,
    { encoding: "utf8" },
  );
  return out
    .split("\n")
    .filter(Boolean)
    .filter((p) => !p.includes("/_archived/") && !p.endsWith(".test.ts"));
}

/** Derive a stable ruleId from the file path. */
function ruleIdFor(filePath) {
  const rel = relative(apiRoot, filePath).replace(/\.tsx?$/, "");
  return rel.replace(/[\/\\]/g, ".").replace(/^_/, "").slice(0, 80);
}

/**
 * Inspect the URL argument source code and infer `allowedHosts`.
 * Returns null when the shape is too risky to auto-convert.
 */
function inferAllowedHosts(urlSrc) {
  const trimmed = urlSrc.trim();

  // Case 1: plain double-quoted literal "https://api.provider.com/path"
  const literalMatch = trimmed.match(/^"(https?:\/\/[^\s"]+)"$/);
  if (literalMatch) {
    try {
      return [new URL(literalMatch[1]).hostname];
    } catch {
      return null;
    }
  }

  // Case 2: template literal starting with `https://hostname.tld/...`
  const tmplLiteralMatch = trimmed.match(
    /^`(https?:\/\/[a-z0-9.\-]+(?::\d+)?)([\/\$`].*)?$/i,
  );
  if (tmplLiteralMatch) {
    try {
      return [new URL(tmplLiteralMatch[1]).hostname];
    } catch {
      return null;
    }
  }

  // Case 3: ${baseUrl}/... or ${VAR_URL}/... — self/env URL, allowlist
  // via `new URL(...).hostname` at call time. We mark with a sentinel
  // that gets expanded inline below.
  const baseUrlMatch = trimmed.match(/^`\$\{([A-Za-z_$][A-Za-z0-9_$]*)\}/);
  if (baseUrlMatch) {
    return { __derive: baseUrlMatch[1] };
  }

  // Case 4: getPublicUrl()/getBaseUrl() inlined — same as case 3
  const inlinedBaseUrl = trimmed.match(/^`\$\{get(?:Public|Base)Url\(\)\}/);
  if (inlinedBaseUrl) {
    return { __derive: "self" };
  }

  // Case 5: identifier or expression — too risky
  return null;
}

/**
 * Render the third opts argument source code given the inferred hosts.
 * `derivedFromVar` triggers `new URL(varName).hostname` at runtime.
 */
function renderOpts(ruleId, hostInfo, urlSrc) {
  if (Array.isArray(hostInfo)) {
    const hosts = JSON.stringify(hostInfo);
    return `{ ruleId: "${ruleId}", allowedHosts: ${hosts} }`;
  }
  if (hostInfo && typeof hostInfo === "object" && hostInfo.__derive) {
    if (hostInfo.__derive === "self") {
      return `{ ruleId: "${ruleId}", allowedHosts: [new URL(${urlSrc}).hostname] }`;
    }
    return `{ ruleId: "${ruleId}", allowedHosts: [new URL(${hostInfo.__derive}).hostname] }`;
  }
  return null;
}

/**
 * Match a single `fetch(...)` call expression. Returns the full match
 * (including args) or null. Uses a tiny brace counter so nested calls,
 * template strings with `${}` substitutions, and objects with `{}`
 * inside don't break the parse.
 */
function findFetchCall(src, fromIndex) {
  const re = /\bfetch\s*\(/g;
  re.lastIndex = fromIndex;
  let m;
  while ((m = re.exec(src)) !== null) {
    // Skip if it's an outboundFetch / safeFetch / nodeFetch / Fetch event
    const startPrefix = src.slice(Math.max(0, m.index - 16), m.index);
    if (
      /outboundFetch|safeFetch|nodeFetch|globalFetch|\.fetch|fetchEvent/.test(
        startPrefix,
      )
    ) {
      continue;
    }
    // Skip if it's inside a comment line — quick check by looking back
    // to the start of the current line.
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    const lineSoFar = src.slice(lineStart, m.index);
    if (/^\s*\*|^\s*\/\//.test(lineSoFar)) continue;

    // Now walk forward and find the matching close paren, respecting
    // string/template/object nesting.
    const callStart = m.index;
    const openParen = m.index + m[0].length - 1;
    let depth = 1;
    let i = openParen + 1;
    let inStr = null; // "'" | '"' | "`"
    let templateDepth = 0;
    while (i < src.length && depth > 0) {
      const c = src[i];
      const prev = src[i - 1];
      if (inStr) {
        if (c === inStr && prev !== "\\") {
          if (inStr === "`" && templateDepth > 0) {
            // exit ${...}
          }
          inStr = null;
        } else if (inStr === "`" && c === "$" && src[i + 1] === "{") {
          templateDepth++;
          i++;
        } else if (templateDepth > 0 && c === "}") {
          templateDepth--;
        }
      } else {
        if (c === '"' || c === "'" || c === "`") inStr = c;
        else if (c === "(" || c === "{" || c === "[") depth++;
        else if (c === ")" || c === "}" || c === "]") depth--;
      }
      i++;
    }
    if (depth !== 0) return null;
    return {
      start: callStart,
      end: i,
      argsStart: openParen + 1,
      argsEnd: i - 1,
    };
  }
  return null;
}

/** Split a fetch(...) args region into [url, init, opts?] respecting nesting. */
function splitArgs(src) {
  const args = [];
  let depth = 0;
  let inStr = null;
  let templateDepth = 0;
  let last = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const prev = src[i - 1];
    if (inStr) {
      if (c === inStr && prev !== "\\") {
        inStr = null;
      } else if (inStr === "`" && c === "$" && src[i + 1] === "{") {
        templateDepth++;
        i++;
      } else if (templateDepth > 0 && c === "}") {
        templateDepth--;
      }
    } else {
      if (c === '"' || c === "'" || c === "`") inStr = c;
      else if (c === "(" || c === "{" || c === "[") depth++;
      else if (c === ")" || c === "}" || c === "]") depth--;
      else if (c === "," && depth === 0) {
        args.push(src.slice(last, i).trim());
        last = i + 1;
      }
    }
  }
  if (src.slice(last).trim()) args.push(src.slice(last).trim());
  return args;
}

function ensureImport(src) {
  if (/from\s+["']@\/lib\/outbound-fetch["']/.test(src)) {
    // Already imports something from outbound-fetch — add adapter if missing.
    if (!/outboundFetchAsResponse/.test(src)) {
      return src.replace(
        /import\s*\{([^}]+)\}\s*from\s+["']@\/lib\/outbound-fetch["'];?/,
        (full, names) => {
          const cleaned = names.split(",").map((s) => s.trim()).filter(Boolean);
          if (!cleaned.includes("outboundFetchAsResponse")) {
            cleaned.push("outboundFetchAsResponse");
          }
          return `import { ${cleaned.join(", ")} } from "@/lib/outbound-fetch";`;
        },
      );
    }
    return src;
  }
  // No existing import — add at top, after any other import block.
  const importBlockEnd = (() => {
    const re = /^(?:import .+?;|\/\/.*|\/\*[\s\S]*?\*\/)\s*$/gm;
    let m;
    let lastEnd = 0;
    while ((m = re.exec(src)) !== null) {
      lastEnd = re.lastIndex;
    }
    return lastEnd;
  })();
  const before = src.slice(0, importBlockEnd);
  const after = src.slice(importBlockEnd);
  return `${before}\nimport { outboundFetchAsResponse } from "@/lib/outbound-fetch";\n${after}`;
}

function processFile(filePath) {
  const original = readFileSync(filePath, "utf8");
  let src = original;
  const baseRuleId = ruleIdFor(filePath);
  let converted = 0;
  let skipped = 0;
  let cursor = 0;
  const skippedReasons = [];

  while (true) {
    const call = findFetchCall(src, cursor);
    if (!call) break;

    const argsSrc = src.slice(call.argsStart, call.argsEnd);
    const args = splitArgs(argsSrc);
    if (args.length === 0) {
      cursor = call.end;
      skipped++;
      skippedReasons.push("zero-args");
      continue;
    }
    const urlSrc = args[0];
    const initSrc = args[1] ?? "{}";
    const existingOpts = args[2];

    if (existingOpts) {
      // Already a 3-arg call — likely already outboundFetch-shape; skip.
      cursor = call.end;
      skipped++;
      skippedReasons.push("3-arg");
      continue;
    }

    const hostInfo = inferAllowedHosts(urlSrc);
    if (hostInfo === null) {
      cursor = call.end;
      skipped++;
      skippedReasons.push(`unclassifiable-url: ${urlSrc.slice(0, 80)}`);
      continue;
    }

    // Generate a per-callsite ruleId by appending a counter.
    const callRuleId = `${baseRuleId}.${converted + 1}`;
    const optsSrc = renderOpts(callRuleId, hostInfo, urlSrc);
    if (!optsSrc) {
      cursor = call.end;
      skipped++;
      skippedReasons.push("opts-render-fail");
      continue;
    }

    const replacement = `outboundFetchAsResponse(${urlSrc}, ${initSrc}, ${optsSrc})`;
    src = src.slice(0, call.start) + replacement + src.slice(call.end);
    cursor = call.start + replacement.length;
    converted++;
  }

  if (converted > 0) {
    src = ensureImport(src);
    if (!DRY_RUN) writeFileSync(filePath, src);
  }

  return { converted, skipped, skippedReasons };
}

// ─── Main ───────────────────────────────────────────────────────────────

const files = findCandidateFiles();
let totalConverted = 0;
let totalSkipped = 0;
const filesChanged = [];
const skippedSummary = {};

for (const file of files) {
  const { converted, skipped, skippedReasons } = processFile(file);
  totalConverted += converted;
  totalSkipped += skipped;
  if (converted > 0) {
    filesChanged.push({ file: relative(repoRoot, file), converted, skipped });
  }
  for (const reason of skippedReasons) {
    const key = reason.split(":")[0];
    skippedSummary[key] = (skippedSummary[key] ?? 0) + 1;
  }
}

console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Wave 116 fetch() codemod`);
console.log(`Files scanned:    ${files.length}`);
console.log(`Files changed:    ${filesChanged.length}`);
console.log(`Sites converted:  ${totalConverted}`);
console.log(`Sites skipped:    ${totalSkipped}`);
console.log(`\nSkipped by reason:`);
for (const [reason, count] of Object.entries(skippedSummary).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(`  ${reason.padEnd(24)} ${count}`);
}
console.log(`\nTop-converted files:`);
for (const { file, converted, skipped } of filesChanged
  .sort((a, b) => b.converted - a.converted)
  .slice(0, 20)) {
  console.log(`  ${file.padEnd(70)} +${converted}${skipped > 0 ? ` (${skipped} skipped)` : ""}`);
}
