import { describe, it, expect } from "vitest";
import { env, capabilities, validateEnvironment } from "./env.validated";

describe("env.validated", () => {
  it("exports env config object", () => {
    expect(env).toBeDefined();
    expect(typeof env).toBe("object");
  });

  it("env contains critical keys (may be empty in test)", () => {
    expect(env).toHaveProperty("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(env).toHaveProperty("CLERK_SECRET_KEY");
    expect(env).toHaveProperty("DATABASE_URL");
  });

  it("env contains AI provider keys", () => {
    expect(env).toHaveProperty("NVIDIA_NIM_API_KEY");
    expect(env).toHaveProperty("GOOGLE_GENERATIVE_AI_API_KEY");
    expect(env).toHaveProperty("ANTHROPIC_API_KEY");
    expect(env).toHaveProperty("GROQ_API_KEY");
  });
});

describe("capabilities", () => {
  it("returns booleans for all capability checks", () => {
    expect(typeof capabilities.ai).toBe("boolean");
    expect(typeof capabilities.nvidia).toBe("boolean");
    expect(typeof capabilities.gemini).toBe("boolean");
    expect(typeof capabilities.claude).toBe("boolean");
    expect(typeof capabilities.groq).toBe("boolean");
    expect(typeof capabilities.email).toBe("boolean");
    expect(typeof capabilities.sms).toBe("boolean");
    expect(typeof capabilities.whatsapp).toBe("boolean");
    expect(typeof capabilities.telegram).toBe("boolean");
    expect(typeof capabilities.stripe).toBe("boolean");
    expect(typeof capabilities.payfast).toBe("boolean");
    expect(typeof capabilities.paystack).toBe("boolean");
    expect(typeof capabilities.vectorMemory).toBe("boolean");
    expect(typeof capabilities.webSearch).toBe("boolean");
    expect(typeof capabilities.cache).toBe("boolean");
    expect(typeof capabilities.realtime).toBe("boolean");
  });
});

describe("validateEnvironment", () => {
  it("is a function", () => {
    expect(typeof validateEnvironment).toBe("function");
  });

  it("runs without throwing in server environment", () => {
    expect(() => validateEnvironment()).not.toThrow();
  });
});
