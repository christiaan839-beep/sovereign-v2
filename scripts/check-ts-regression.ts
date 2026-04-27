/**
 * TypeScript regression gate.
 *
 * Compares the current `tsc --noEmit` errors against `.ts-error-baseline.txt`.
 * Fails CI when any file in the baseline grows in error count, or when a
 * brand-new file appears with errors.
 *
 * Existing legacy errors are tolerated (the build also runs with
 * `ignoreBuildErrors: true`), but new regressions are blocked.
 *
 * Usage:
 *   npx tsx scripts/check-ts-regression.ts
 *   # → exit 0 if no regression, exit 1 if regression detected
 *
 * To refresh the baseline (after intentionally adding TS errors):
 *   npx tsc --noEmit 2>&1 | grep "error TS" | awk -F'[(:]' '{print $1}' | sort | uniq -c | sort -rn > .ts-error-baseline.txt
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const baselinePath = path.join(process.cwd(), ".ts-error-baseline.txt");
if (!fs.existsSync(baselinePath)) {
  console.error(
    "Missing .ts-error-baseline.txt — run the refresh command first.",
  );
  process.exit(1);
}

function parseBaseline(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of text.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(.+)$/);
    if (m) map.set(m[2], Number(m[1]));
  }
  return map;
}

const baseline = parseBaseline(fs.readFileSync(baselinePath, "utf8"));

let tscOutput = "";
try {
  execSync("npx tsc --noEmit", { stdio: "pipe" });
} catch (err) {
  const e = err as { stdout?: Buffer; stderr?: Buffer };
  tscOutput = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
}

const currentCounts = new Map<string, number>();
for (const line of tscOutput.split("\n")) {
  const m = line.match(/^(.+?)\(\d+,\d+\): error TS/);
  if (m) {
    const file = m[1];
    currentCounts.set(file, (currentCounts.get(file) || 0) + 1);
  }
}

const regressions: string[] = [];
for (const [file, count] of currentCounts.entries()) {
  const allowed = baseline.get(file) ?? 0;
  if (count > allowed) {
    regressions.push(
      `  ${file}: baseline=${allowed} current=${count} (+${count - allowed})`,
    );
  }
}

if (regressions.length === 0) {
  const totalNow = Array.from(currentCounts.values()).reduce(
    (a, b) => a + b,
    0,
  );
  const totalBase = Array.from(baseline.values()).reduce((a, b) => a + b, 0);
  console.log(`✓ No TS regressions (${totalNow}/${totalBase} errors).`);
  process.exit(0);
}

console.error(`✗ TypeScript regressions detected:`);
for (const r of regressions) console.error(r);
console.error(
  `\nFix the new errors, or refresh the baseline (only if intentional).`,
);
process.exit(1);
