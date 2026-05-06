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
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // The 100+ legacy agent routes pass user-shaped JSON through
      // their own runtime Zod validators; the static `any` cast on
      // the AgentContext.input field is a deliberate trade for
      // route flexibility. Demote to warning so `npx eslint .` runs
      // cleanly without per-file disable comments.
      "@typescript-eslint/no-explicit-any": "warn",
      // React 19 compiler purity rule — downgrade to warn for animation components
      // that intentionally use Math.random() during render for particle effects, delays, etc.
      "react-hooks/purity": "warn",
      // Downgraded for data-fetch effects: `setState` after `await fetch()`
      // inside `useEffect` is the canonical pattern recommended by React 19
      // docs before `use()` adoption. The rule's preferred refactor (server
      // components + Suspense) is staged behind a separate dashboard rewrite.
      "react-hooks/set-state-in-effect": "warn",
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
    // Utility scripts (plain JS, use require())
    "scripts/**",
    "server/**",
    // MCP server (separate TypeScript project)
    "mcp-server/**",
  ]),
]);

export default eslintConfig;
