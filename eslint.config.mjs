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
      // React 19 compiler purity rule — downgrade to warn for animation components
      // that intentionally use Math.random() during render for particle effects, delays, etc.
      "react-hooks/purity": "warn",
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
