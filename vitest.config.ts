import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/lib/**/*.ts",
        "src/app/api/**/route.ts",
        "src/components/**/*.{ts,tsx}",
      ],
      exclude: [
        "node_modules",
        ".next",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/__tests__/**",
        "src/lib/types/**",
        "src/lib/**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
