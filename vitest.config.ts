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
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js's `server-only` package throws at import time when loaded
      // outside a server context. Vitest runs in plain node, so we alias
      // it to a noop module — the build-time guarantee still holds, this
      // only neutralises the runtime trap during tests.
      "server-only": path.resolve(
        __dirname,
        "./src/__tests__/server-only-shim.ts",
      ),
    },
  },
});
