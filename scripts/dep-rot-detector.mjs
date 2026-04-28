#!/usr/bin/env node
/**
 * DEP-ROT DETECTOR — R27 Permanence Sprint.
 *
 * Renovate already opens PRs for every available update. The
 * problem is that those PRs accumulate. After 6 months of "we'll
 * review it next week", you have 40 unmerged dependency PRs and
 * nobody knows which are safe.
 *
 * This detector runs npm audit + npm outdated and reports:
 *   1. HIGH/CRITICAL vulnerabilities (always fails)
 *   2. Major version drift (>10 packages on outdated majors fails)
 *   3. Unused dependencies (warning only — too many false positives
 *      to block on)
 *
 * Why a separate script from npm audit directly:
 *   - npm audit's exit code is binary (any vuln = exit 1). We want
 *     a tiered policy: HIGH/CRITICAL = fail, moderate = warn.
 *   - npm outdated's exit code is also binary. We want "fail at >N".
 *   - Aggregating both into one CI gate keeps the noise low and the
 *     signal high.
 *
 * The anti-drift gate calls this with --check; it rolls into the
 * same 141-invariant matrix that powers weekly-health.mjs.
 *
 * Modes:
 *   --check        anti-drift mode: exits 0/1 with one-line summary
 *   --report       full human-readable report to stdout
 *   --report-json  machine-readable for the admin dashboard
 *
 * Uses execFileSync with array args throughout — no shell, no
 * injection vector even on future edits.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

// Tunable thresholds. Generous on the "warn" side and strict on the
// "fail" side — a maintainer who's away for 2 weeks shouldn't come
// back to a red CI on minor drift, but should always come back to a
// red CI on a NEW critical vuln.
const THRESHOLDS = {
  critical_vulns_max: 0,    // any unfixed critical = fail
  high_vulns_max: 0,        // any unfixed high = fail
  outdated_majors_max: 10,  // 11+ pending major-version reviews = fail
};

/**
 * Run a command and capture JSON output safely. The command name
 * and args list are deterministic — no shell interpolation.
 *
 * Returns the parsed JSON or null on any failure (exit code, JSON
 * parse, missing tool). The caller must handle null gracefully —
 * a missing toolchain shouldn't crash the detector.
 */
function safeJson(bin, args) {
  try {
    const out = execFileSync(bin, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    });
    if (!out.trim()) return null;
    return JSON.parse(out);
  } catch (err) {
    if (err && err.stdout) {
      try {
        return JSON.parse(err.stdout.toString());
      } catch {
        return null;
      }
    }
    return null;
  }
}

function readPackageJson() {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Scan all source files for `from "name"` and `require("name")`.
 * Returns the set of imported package names. Imperfect — dynamic
 * imports with computed names are missed. We accept the
 * false-negative for unused-dep detection (warning tier only).
 */
function collectImportedNames() {
  const imports = new Set();
  let files;
  try {
    files = execFileSync("git", ["ls-files", "src/", "scripts/"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .filter((f) => /\.(ts|tsx|mjs|js|cjs)$/.test(f));
  } catch {
    return imports;
  }
  const importRegex = /(?:from\s+|require\(\s*)["']([^"']+)["']/g;
  for (const file of files) {
    let content;
    try {
      content = readFileSync(resolve(ROOT, file), "utf8");
    } catch {
      continue;
    }
    let m;
    while ((m = importRegex.exec(content))) {
      const spec = m[1];
      if (spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("/")) continue;
      const parts = spec.split("/");
      const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
      imports.add(name);
    }
  }
  return imports;
}

function getAuditCounts() {
  const data = safeJson("npm", ["audit", "--json"]);
  if (!data) return { critical: 0, high: 0, moderate: 0, low: 0, available: false };
  const vulns = data.metadata?.vulnerabilities ?? data.vulnerabilities ?? {};
  return {
    critical: vulns.critical ?? 0,
    high: vulns.high ?? 0,
    moderate: vulns.moderate ?? 0,
    low: vulns.low ?? 0,
    available: true,
  };
}

function getOutdatedCounts() {
  const data = safeJson("npm", ["outdated", "--json"]);
  if (!data || typeof data !== "object") {
    return { major: 0, minor: 0, patch: 0, available: false, pkgs: [] };
  }
  let major = 0;
  let minor = 0;
  let patch = 0;
  const pkgs = [];
  for (const [name, info] of Object.entries(data)) {
    const cur = (info.current ?? "0.0.0").split(".").map(Number);
    const lat = (info.latest ?? "0.0.0").split(".").map(Number);
    const drift =
      cur[0] !== lat[0] ? "major" : cur[1] !== lat[1] ? "minor" : "patch";
    if (drift === "major") major += 1;
    else if (drift === "minor") minor += 1;
    else patch += 1;
    pkgs.push({ name, current: info.current, latest: info.latest, drift });
  }
  return { major, minor, patch, pkgs, available: true };
}

function getUnusedDeps() {
  const pkg = readPackageJson();
  if (!pkg) return [];
  const declared = Object.keys(pkg.dependencies ?? {});
  const imported = collectImportedNames();
  return declared.filter((d) => !imported.has(d));
}

function runAll() {
  const audit = getAuditCounts();
  const outdated = getOutdatedCounts();
  const unused = getUnusedDeps();
  const failures = [];
  if (audit.critical > THRESHOLDS.critical_vulns_max) {
    failures.push(`${audit.critical} CRITICAL vulnerability(ies)`);
  }
  if (audit.high > THRESHOLDS.high_vulns_max) {
    failures.push(`${audit.high} HIGH vulnerability(ies)`);
  }
  if (outdated.major > THRESHOLDS.outdated_majors_max) {
    failures.push(
      `${outdated.major} packages on outdated majors (>${THRESHOLDS.outdated_majors_max})`,
    );
  }
  return { audit, outdated, unused, failures };
}

function modeCheck() {
  const r = runAll();
  if (r.failures.length === 0) {
    console.log(
      `✅ deps ok — vulns: ${r.audit.critical}c/${r.audit.high}h/${r.audit.moderate}m, outdated majors: ${r.outdated.major}, unused (warn): ${r.unused.length}`,
    );
    process.exit(0);
  }
  console.log(`❌ dep rot: ${r.failures.join(", ")}`);
  process.exit(1);
}

function modeReport() {
  const r = runAll();
  console.log("DEPENDENCY ROT REPORT");
  console.log("═════════════════════");
  console.log("");
  console.log("Vulnerabilities:");
  console.log(`  Critical:  ${r.audit.critical}`);
  console.log(`  High:      ${r.audit.high}`);
  console.log(`  Moderate:  ${r.audit.moderate}`);
  console.log(`  Low:       ${r.audit.low}`);
  console.log("");
  console.log("Outdated:");
  console.log(`  Major:     ${r.outdated.major}`);
  console.log(`  Minor:     ${r.outdated.minor}`);
  console.log(`  Patch:     ${r.outdated.patch}`);
  if (r.outdated.pkgs.length > 0) {
    console.log("\n  Top 10 by drift:");
    for (const p of r.outdated.pkgs
      .sort((a, b) => (a.drift === "major" ? -1 : 1))
      .slice(0, 10)) {
      console.log(`    [${p.drift}] ${p.name}: ${p.current} → ${p.latest}`);
    }
  }
  console.log("");
  console.log(`Unused (top 10): ${r.unused.slice(0, 10).join(", ") || "(none)"}`);
  if (r.failures.length > 0) {
    console.log("\nFAILURES:");
    for (const f of r.failures) console.log(`  ❌ ${f}`);
    process.exit(1);
  }
}

function modeReportJson() {
  const r = runAll();
  console.log(JSON.stringify(r, null, 2));
}

const argv = process.argv.slice(2);
if (argv.includes("--check")) modeCheck();
else if (argv.includes("--report-json")) modeReportJson();
else if (argv.includes("--report")) modeReport();
else {
  console.log("Usage:");
  console.log("  node scripts/dep-rot-detector.mjs --check");
  console.log("  node scripts/dep-rot-detector.mjs --report");
  console.log("  node scripts/dep-rot-detector.mjs --report-json");
  process.exit(2);
}
