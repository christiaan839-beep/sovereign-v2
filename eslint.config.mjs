import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "server/**",
  ]),
  {
    rules: {
      // Warn on explicit any — nudge toward proper types
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow @ts-expect-error (with description) but warn on @ts-ignore
      "@typescript-eslint/ban-ts-comment": ["warn", {
        "ts-expect-error": "allow-with-description",
        "ts-ignore": true,
        "ts-nocheck": true,
      }],
      // Catch React hooks bugs
      "react-hooks/exhaustive-deps": "warn",
      // Unused vars — allow underscore prefix for intentional ignores
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      // Allow require() in specific cases (dynamic imports in Node scripts)
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
]);

export default eslintConfig;
