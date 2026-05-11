import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "packages/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/**/*.ts", "src/app/api/**/route.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/__tests__/**",
        "src/app/api/agents/registry.ts", // auto-generated
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
