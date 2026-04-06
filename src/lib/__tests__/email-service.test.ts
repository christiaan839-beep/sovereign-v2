/**
 * Tests for src/lib/email-service.ts — Email Delivery Infrastructure
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
  },
}));

vi.mock("@/db/schema", () => ({
  emailSequences: {},
  sequenceSteps: {},
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Test the email module's validation logic
import { sendEmail } from "@/lib/email";

describe("email.ts — Email Delivery", () => {
  it("rejects missing required fields", async () => {
    const result = await sendEmail({ to: "", subject: "", html: "" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing required fields");
  });

  it("returns error when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({ to: "test@example.com", subject: "Test", html: "<p>Hello</p>" });
    expect(result.success).toBe(false);
    expect(result.simulated).toBe(true);
  });

  it("result includes simulated flag when no API key", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({ to: "test@example.com", subject: "Test", html: "<p>Test</p>" });
    expect(result).toHaveProperty("simulated");
  });
});
