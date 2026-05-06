/**
 * Deployment-profile + request-tenant tests.
 *
 * Doesn't hit Postgres — exercises the in-memory provider allow-list
 * matrix and the AsyncLocalStorage scoping for tenant context. The
 * actual `getDeploymentProfile()` DB lookup is covered by the
 * migration 0023 verification SQL in MIGRATIONS-RUNME.sql; here we
 * pin the behaviour that the platform relies on at runtime.
 */

import { describe, it, expect } from "vitest";
import { isProviderAllowed, DEPLOYMENT_PROFILES } from "../deployment-profile";
import { withTenant, getCurrentTenantId } from "../request-tenant";

describe("deployment-profile allow-list", () => {
  it("cloud profile permits every provider", () => {
    const providers = [
      "ollama",
      "nvidia-nim",
      "nvidia-nim-local",
      "cerebras",
      "anthropic",
      "gemini",
      "openai",
      "groq",
      "mistral",
      "portkey",
    ] as const;
    for (const p of providers) {
      expect(isProviderAllowed(p, "cloud")).toBe(true);
    }
  });

  it("byo-gpu profile blocks external paid providers", () => {
    expect(isProviderAllowed("ollama", "byo-gpu")).toBe(true);
    expect(isProviderAllowed("nvidia-nim", "byo-gpu")).toBe(true);
    expect(isProviderAllowed("nvidia-nim-local", "byo-gpu")).toBe(true);
    expect(isProviderAllowed("portkey", "byo-gpu")).toBe(true);

    expect(isProviderAllowed("anthropic", "byo-gpu")).toBe(false);
    expect(isProviderAllowed("gemini", "byo-gpu")).toBe(false);
    expect(isProviderAllowed("openai", "byo-gpu")).toBe(false);
    expect(isProviderAllowed("groq", "byo-gpu")).toBe(false);
    expect(isProviderAllowed("cerebras", "byo-gpu")).toBe(false);
  });

  it("air-gapped profile permits only local providers", () => {
    expect(isProviderAllowed("ollama", "air-gapped")).toBe(true);
    expect(isProviderAllowed("nvidia-nim-local", "air-gapped")).toBe(true);

    // Even the public NIM API is refused — that's still an outbound
    // call to build.nvidia.com.
    expect(isProviderAllowed("nvidia-nim", "air-gapped")).toBe(false);
    expect(isProviderAllowed("anthropic", "air-gapped")).toBe(false);
    expect(isProviderAllowed("gemini", "air-gapped")).toBe(false);
    expect(isProviderAllowed("portkey", "air-gapped")).toBe(false);
  });

  it("exports the canonical profile list", () => {
    expect(DEPLOYMENT_PROFILES).toEqual(["cloud", "byo-gpu", "air-gapped"]);
  });
});

describe("request-tenant async context", () => {
  it("returns null outside of a withTenant scope", () => {
    expect(getCurrentTenantId()).toBeNull();
  });

  it("propagates tenant id through nested awaits", async () => {
    const captured = await withTenant("tenant-A", async () => {
      // Force a microtask boundary so we know AsyncLocalStorage
      // survives an `await` (the property the cost-ledger relies on).
      await Promise.resolve();
      return getCurrentTenantId();
    });
    expect(captured).toBe("tenant-A");
  });

  it("isolates concurrent tenants — no leakage between scopes", async () => {
    const [a, b] = await Promise.all([
      withTenant("tenant-A", async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getCurrentTenantId();
      }),
      withTenant("tenant-B", async () => {
        await new Promise((r) => setTimeout(r, 1));
        return getCurrentTenantId();
      }),
    ]);
    expect(a).toBe("tenant-A");
    expect(b).toBe("tenant-B");
  });

  it("nested withTenant shadows the outer scope", async () => {
    const result = await withTenant("outer", async () => {
      const inner = await withTenant("inner", () => getCurrentTenantId());
      const outerAfterInner = getCurrentTenantId();
      return { inner, outerAfterInner };
    });
    expect(result.inner).toBe("inner");
    expect(result.outerAfterInner).toBe("outer");
  });

  it("withTenant(null) clears the tenant for the inner scope", async () => {
    const result = await withTenant("outer", async () => {
      const cleared = await withTenant(null, () => getCurrentTenantId());
      return cleared;
    });
    expect(result).toBeNull();
  });
});
