import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          // Framework-mandated arg names — every agent-route handler
          // receives `{ input, userId, email, request }` from the
          // AgentContext type. Most handlers use only a subset, but
          // renaming the destructured property to `_userId` would
          // break the destructure (the property comes from a typed
          // object) and lose the documentation value. The names
          // ARE the contract; their unused-ness is not slop.
          //
          // Also allow plain `_`-prefix for genuinely-unused args
          // outside the framework signature.
          argsIgnorePattern: "^(_|email$|userId$|request$|req$|res$)",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // React 19 compiler purity rule — downgrade to warn for animation components
      // that intentionally use Math.random() during render for particle effects, delays, etc.
      "react-hooks/purity": "warn",
    },
  },
  // ── Wave-107 SSRF guardrail ─────────────────────────────────────────
  // Bare `fetch(url)` in API routes accepts ANY URL including
  // RFC1918 / 169.254.169.254 (cloud metadata) / localhost / file://.
  // `src/lib/outbound-fetch.ts` (293 LOC) implements hostname
  // allowlisting + private-net blocking. New code in API routes
  // MUST go through it. This rule prevents regressions; the
  // existing 177 callsites get codemodded in a follow-up wave.
  {
    files: ["src/app/api/**/*.ts", "src/app/api/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            "Bare fetch() in API routes is SSRF-unsafe. Use `outboundFetch` from @/lib/outbound-fetch — it enforces hostname allowlist + blocks RFC1918 / cloud-metadata / localhost.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build artifacts — never lint minified output
    ".vercel/**",
    // Test files handled by their own configs
    "e2e/**",
    "playwright.config.ts",
    // Chrome extension (plain JS, not TypeScript)
    "chrome-extension/**",
    // Distributable extension shells (plain JS, runtime-resolved require / globals)
    "extensions/**",
    // Utility scripts (plain JS, use require())
    "scripts/**",
    "server/**",
    // MCP server (separate TypeScript project)
    "mcp-server/**",
  ]),
]);

export default eslintConfig;
