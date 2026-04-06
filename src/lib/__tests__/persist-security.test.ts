/**
 * Tests for src/lib/persist.ts — Path Traversal Prevention
 */
import { describe, it, expect, vi } from "vitest";

// Mock filesystem to prevent actual file operations
vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue("{}"),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { persistRead, persistWrite } from "@/lib/persist";

describe("persist.ts — Security", () => {
  it("handles normal keys without error", () => {
    expect(() => persistRead("normal-key", null)).not.toThrow();
  });

  it("handles path traversal attempts without throwing", () => {
    // sanitizeKey strips ../ and separators — should not throw
    expect(() => persistRead("../../../etc/passwd", "default")).not.toThrow();
    expect(() => persistRead("..\\..\\windows\\system32", "default")).not.toThrow();
  });

  it("handles slash-containing keys", () => {
    expect(() => persistRead("path/to/secret", "default")).not.toThrow();
    expect(() => persistRead("path\\to\\secret", "default")).not.toThrow();
  });

  it("handles empty keys", () => {
    expect(() => persistRead("", "default")).not.toThrow();
    expect(persistRead("", "fallback")).toBe("fallback");
  });

  it("write handles path traversal keys", () => {
    expect(() => persistWrite("../../evil", { data: "test" })).not.toThrow();
  });
});
