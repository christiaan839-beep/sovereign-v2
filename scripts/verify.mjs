#!/usr/bin/env node
/**
 * Every gate, one definition: `npm run verify`.
 *
 * Why this file exists rather than a list of steps in the CI workflow:
 * a check that lives only in YAML runs only when CI runs. When CI is
 * unavailable — an outage, an exhausted quota, a contributor without
 * push access — those checks silently stop happening, and nobody
 * notices until something ships broken.
 *
 * Before this file, "verified" meant three different things in three
 * places, and they had already drifted:
 *
 *   - .github/workflows/ci.yml  ran registry-drift and a blocking
 *     `npm audit`; pre-push ran neither. It ran migration parity SOFT.
 *   - scripts/git-hooks/pre-push ran the Suspense hook-trap scan that
 *     CI never ran, and ran migration parity HARD.
 *   - .claude/skills/deploy-check ran ssr:false / dynamic() / secret
 *     scans that neither of the other two ran, and told the reader
 *     `ignoreBuildErrors: true` so type errors were "advisory only" —
 *     next.config.ts:16 has said `false` since the strict-TS wave.
 *
 * So the definition lives here now, in code, runnable by anyone. Each
 * CI job calls this script for its own gate (`--only=`), which keeps
 * the parallel fan-out — a 15-minute build should not queue behind
 * lint — while leaving exactly one place where a gate is defined.
 *
 * Usage:
 *   npm run verify                    # every gate runnable here
 *   npm run verify -- --profile=quick # pre-push set (no build/audit)
 *   npm run verify -- --only=lint,tests
 *   npm run verify -- --list
 *
 * A gate that cannot run here (no DATABASE_URL, no build secrets)
 * reports as skipped, not as passed — a skip is visible in the output
 * and in the summary line so it can never be mistaken for a green.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/** Thrown by a gate that cannot run in this environment. Not a failure. */
class Skipped extends Error {}
const skip = (why) => {
  throw new Skipped(why);
};

/**
 * Run a command; throw with the tail of its output when it exits non-zero.
 *
 * maxBuffer is raised well above node's 1 MB default: `next build` and a
 * 4000-case vitest run both exceed it, and the default failure mode is a
 * truncated buffer reported as a spawn error rather than the real one.
 */
function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(
      out.trim().split("\n").slice(-25).join("\n") || `exit ${res.status}`,
    );
  }
  return out;
}

/** Files matching `pattern` under `paths`, as a list. Never throws on no-match. */
function grepFiles(pattern, paths, extraArgs = []) {
  const res = spawnSync(
    "grep",
    ["-rlE", pattern, ...extraArgs, ...paths],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return (res.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Strip ANSI colour codes.
 *
 * vitest colours its summary, so `Tests 4491 passed` arrives with escape
 * sequences between the label and the number and a naive regex silently
 * matches nothing — which is how a gate reports "passing" with no count.
 */
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

/** Does this file opt into the client bundle? */
function isClientComponent(file) {
  try {
    return /^\s*["']use client["']/m.test(
      readFileSync(file, "utf8").slice(0, 512),
    );
  } catch {
    return false;
  }
}

// ─── Gates ──────────────────────────────────────────────────────────────
//
// `profiles` decides which named profile runs a gate. `blocking: false`
// means the gate reports but never fails the run — used where the check
// is a heuristic with known false positives.

const GATES = [
  {
    name: "registry drift",
    profiles: ["quick", "full"],
    run: () => {
      run("node", ["scripts/generate-agent-registry.mjs", "--check"]);
      return "agent registry matches disk";
    },
  },

  {
    name: "ssr:false placement",
    profiles: ["quick", "full"],
    // next/dynamic with ssr:false is invalid in a server component under
    // Next 16 — it must sit inside a "use client" file. CLAUDE.md states
    // the rule; nothing enforced it until now.
    run: () => {
      const hits = grepFiles("ssr: *false", ["src/app", "src/components"], [
        "--include=*.tsx",
        "--include=*.ts",
      ]);
      const offenders = hits.filter((f) => !isClientComponent(f));
      if (offenders.length) {
        throw new Error(
          `ssr:false in a server component (wrap in a "use client" component first):\n  ${offenders.join("\n  ")}`,
        );
      }
      return `${hits.length} use(s), all in client components`;
    },
  },

  {
    name: "suspense trap",
    profiles: ["quick", "full"],
    blocking: false,
    // Heuristic, ported from the pre-push hook: a "use client" file that
    // calls a dynamic-rendering hook without mentioning Suspense. A parent
    // may legitimately wrap it, so this warns rather than blocks.
    run: () => {
      const hooked = grepFiles(
        "(useSearchParams|useParams|useSelectedLayoutSegment)\\b",
        ["src/app", "src/components"],
      );
      const risky = hooked.filter(
        (f) => isClientComponent(f) && !readFileSync(f, "utf8").includes("Suspense"),
      );
      if (risky.length) {
        throw new Error(
          `dynamic-rendering hook with no Suspense in the file — confirm a parent wraps it:\n  ${risky.join("\n  ")}`,
        );
      }
      return "no unwrapped dynamic-rendering hooks";
    },
  },

  {
    name: "secret scan",
    profiles: ["quick", "full"],
    // Staged diff only. Patterns match secret *values*, not identifiers:
    // the deploy-check skill's `_secret|_api_key|password` fired on every
    // variable name in the diff, which is why it was never automated.
    run: () => {
      const staged = spawnSync("git", ["diff", "--cached", "--unified=0"], {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
      const diff = staged.stdout ?? "";
      if (!diff.trim()) skip("nothing staged");

      const PATTERNS = [
        [/\bsk_live_[A-Za-z0-9]{8,}/, "Stripe live secret key"],
        [/\brk_live_[A-Za-z0-9]{8,}/, "Stripe live restricted key"],
        [/\bsk-ant-[A-Za-z0-9_-]{16,}/, "Anthropic API key"],
        [/\bsk-[A-Za-z0-9]{32,}/, "OpenAI-style API key"],
        [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
        [/\bghp_[A-Za-z0-9]{20,}/, "GitHub personal access token"],
        [/\bgithub_pat_[A-Za-z0-9_]{20,}/, "GitHub fine-grained PAT"],
        [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
        [
          /(SECRET|API_KEY|APIKEY|TOKEN|PASSWORD|PRIVATE_KEY)\s*[:=]\s*["'][^"']{16,}["']/i,
          "inline secret assignment",
        ],
      ];
      // Placeholders in examples and tests are not findings.
      const PLACEHOLDER =
        /(process\.env|your[-_]|example|placeholder|changeme|dummy|xxxx|<[a-z-]+>|\$\{)/i;

      const findings = [];
      for (const line of diff.split("\n")) {
        if (!line.startsWith("+") || line.startsWith("+++")) continue;
        if (PLACEHOLDER.test(line)) continue;
        for (const [re, label] of PATTERNS) {
          if (re.test(line)) {
            findings.push(`${label}: ${line.slice(0, 100).trim()}`);
            break;
          }
        }
      }
      if (findings.length) {
        throw new Error(
          `possible secrets in the staged diff — do not commit:\n  ${findings.join("\n  ")}`,
        );
      }
      return "staged diff clean";
    },
  },

  {
    name: "lint",
    profiles: ["quick", "full"],
    run: () => {
      if (!existsSync("node_modules")) skip("node_modules missing");
      run("npm", ["run", "--silent", "lint"]);
      return "eslint clean";
    },
  },

  {
    name: "typecheck",
    profiles: ["quick", "full"],
    // next.config.ts sets ignoreBuildErrors: false, so a type error is a
    // build failure. This gate blocks; the deploy-check skill used to say
    // otherwise and was wrong.
    run: () => {
      if (!existsSync("node_modules")) skip("node_modules missing");
      run("npx", ["tsc", "--noEmit"]);
      return "strict, 0 errors";
    },
  },

  {
    name: "tests",
    profiles: ["quick", "full"],
    run: () => {
      if (!existsSync("node_modules")) skip("node_modules missing");
      const out = stripAnsi(run("npx", ["vitest", "run"]));
      const tests = out.match(/Tests\s+(\d+) passed/);
      const files = out.match(/Test Files\s+(\d+) passed/);
      const skippedTests = out.match(/(\d+) skipped/);
      if (!tests) return "passing";
      return [
        `${tests[1]} passing`,
        files ? `${files[1]} files` : null,
        skippedTests ? `${skippedTests[1]} skipped` : null,
      ]
        .filter(Boolean)
        .join(", ");
    },
  },

  {
    name: "migration parity",
    // In "quick" too: the pre-push hook already ran this, and it skips
    // itself without DATABASE_URL, so including it preserves the hook's
    // behaviour exactly rather than quietly dropping a gate.
    profiles: ["quick", "full"],
    // pre-push ran this HARD and ci.yml ran it --soft, so the same schema
    // drift failed on a laptop and passed in CI. The split is deliberate
    // (ci.yml: "soft until baseline established"), so it stays — but it is
    // one env var in one file now instead of an accident across two.
    //
    // To make CI blocking: drop VERIFY_MIGRATIONS_SOFT from ci.yml. That is
    // the whole change.
    run: () => {
      if (!process.env.DATABASE_URL) skip("DATABASE_URL not set");
      const soft = process.env.VERIFY_MIGRATIONS_SOFT === "1";
      run(
        "node",
        ["scripts/check-migrations.mjs", ...(soft ? ["--soft"] : [])],
      );
      return soft ? "schema checked (soft — drift warns)" : "schema matches drizzle/";
    },
  },

  {
    name: "build",
    profiles: ["full"],
    run: () => {
      if (!existsSync("node_modules")) skip("node_modules missing");
      const need = [
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "CLERK_SECRET_KEY",
        "DATABASE_URL",
      ].filter((k) => !process.env[k]);
      if (need.length) skip(`missing ${need.join(", ")}`);
      run("npm", ["run", "build"]);
      return ".next/ emitted";
    },
  },

  {
    name: "audit (high+)",
    profiles: ["full"],
    run: () => {
      if (!existsSync("node_modules")) skip("node_modules missing");
      run("npm", ["audit", "--audit-level=high"]);
      return "0 high or critical";
    },
  },
];

// ─── Runner ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

if (argv.includes("--list")) {
  console.log("\n  gates\n");
  for (const g of GATES) {
    const marks = [
      g.profiles.join(", "),
      g.blocking === false ? "warn-only" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    console.log(`    ${g.name.padEnd(22)} ${DIM}${marks}${RESET}`);
  }
  console.log();
  process.exit(0);
}

const only = flag("only");
const profile = flag("profile", "full");
const selected = only
  ? only.split(",").map((s) => s.trim()).flatMap((want) => {
      const hit = GATES.filter((g) => g.name.split(" ")[0] === want || g.name === want);
      if (!hit.length) {
        console.error(`${RED}unknown gate: ${want}${RESET} (try --list)`);
        process.exit(2);
      }
      return hit;
    })
  : GATES.filter((g) => g.profiles.includes(profile));

if (!selected.length) {
  console.error(`${RED}no gates match profile "${profile}"${RESET} (try --list)`);
  process.exit(2);
}

let failed = 0;
let warned = 0;
let skipped = 0;

console.log(
  `\n  sovereign-matrix — verification gates ${DIM}(${only ? `only=${only}` : `profile=${profile}`})${RESET}\n`,
);

for (const g of selected) {
  const started = Date.now();
  try {
    const detail = await g.run();
    const ms = Date.now() - started;
    console.log(
      `${GREEN}✓${RESET} ${g.name.padEnd(22)} ${DIM}${detail ?? ""} (${ms}ms)${RESET}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof Skipped) {
      skipped++;
      console.log(`${DIM}∅ ${g.name.padEnd(22)} skipped — ${msg}${RESET}`);
    } else if (g.blocking === false) {
      warned++;
      console.log(`${YELLOW}⚠${RESET} ${g.name}`);
      console.log(`  ${YELLOW}${msg}${RESET}`);
    } else {
      failed++;
      console.log(`${RED}✗${RESET} ${g.name}`);
      console.log(`  ${RED}${msg}${RESET}`);
    }
  }
}

const tally = [
  `${selected.length - failed - warned - skipped} passed`,
  warned ? `${warned} warned` : null,
  skipped ? `${skipped} skipped` : null,
  failed ? `${failed} failed` : null,
]
  .filter(Boolean)
  .join(", ");

if (failed) {
  console.log(`\n  ${RED}${tally}${RESET}\n`);
  process.exit(1);
}
// "all gates passed" is reserved for a run with nothing warned and nothing
// skipped — a skipped gate is an unknown, not a green, and saying otherwise
// is how a missing DATABASE_URL turns into a clean-looking CI run.
const clean = !warned && !skipped;
console.log(
  clean
    ? `\n  ${GREEN}all gates passed${RESET} ${DIM}— ${tally}${RESET}\n`
    : `\n  ${GREEN}no blocking failures${RESET} ${DIM}— ${tally}${RESET}\n`,
);
