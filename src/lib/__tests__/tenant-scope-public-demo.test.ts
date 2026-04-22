import { describe, it, expect } from "vitest";
import { isPublicDemoUser, PUBLIC_DEMO_USER_ID } from "@/lib/tenant-scope";

describe("public demo user invariant", () => {
  it("recognises the public demo user id", () => {
    expect(isPublicDemoUser(PUBLIC_DEMO_USER_ID)).toBe(true);
  });

  it("rejects every other user id", () => {
    expect(isPublicDemoUser("user_real_person")).toBe(false);
    expect(isPublicDemoUser("")).toBe(false);
    expect(isPublicDemoUser(null)).toBe(false);
    expect(isPublicDemoUser(undefined)).toBe(false);
  });

  it("PUBLIC_DEMO_USER_ID follows Clerk user_* prefix convention", () => {
    expect(PUBLIC_DEMO_USER_ID).toMatch(/^user_/);
  });
});
