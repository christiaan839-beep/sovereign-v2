import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    // Include the monorepo packages so workspace packages (agent-validator,
    // sovereign-cli) get CI coverage alongside the main app's tests.
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "packages/*/src/**/*.test.ts",
    ],
    exclude: ["node_modules", ".next", "packages/*/dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/**/*.ts", "packages/*/src/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Map the workspace package name to its source so tests don't need
      // a built dist/ or an npm-install symlink. Production consumers
      // install from npm; this alias only affects vitest.
      "@sovereignmatrix/agent-validator": path.resolve(
        __dirname,
        "./packages/agent-validator/src/index.ts",
      ),
    },
  },
});
