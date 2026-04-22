/**
 * sovereign-cli unit tests.
 *
 * Every command is a pure function that takes adapter interfaces
 * (FileSystem, HttpClient). We inject in-memory fakes so tests are
 * fast, deterministic, and don't touch real disk or real network.
 */

import { describe, expect, it } from "vitest";
import { parseArgv } from "../parse-argv.js";
import { runInfo } from "../commands/info.js";
import { runSubmit } from "../commands/submit.js";
import { runValidate } from "../commands/validate.js";
import type { FileSystem, HttpClient } from "../types.js";

/* ─── Test fixtures ───────────────────────────────────────────── */

const VALID_MANIFEST = {
  sam: "1.0",
  slug: "extract-invoice",
  displayName: "Invoice Extractor",
  purpose: "Extract structured data from invoice text",
  category: "Finance",
  version: "1.0.0",
  inputs: [{ name: "text", type: "string", required: true }],
  output: { type: "object" },
  guarantees: ["Never fabricates missing fields"],
};

function inMemoryFs(files: Record<string, string>): FileSystem {
  return {
    async readTextFile(path) {
      if (path in files) return files[path];
      throw new Error(`ENOENT: ${path}`);
    },
  };
}

function fakeHttp(
  expectedUrl: string | RegExp,
  response: { status: number; body: unknown },
): HttpClient {
  return {
    async postJson(url) {
      if (expectedUrl instanceof RegExp) {
        expect(url).toMatch(expectedUrl);
      } else {
        expect(url).toBe(expectedUrl);
      }
      return response;
    },
  };
}

/* ─── parseArgv ───────────────────────────────────────────────── */

describe("parseArgv()", () => {
  it("extracts a single command", () => {
    const p = parseArgv(["validate"]);
    expect(p.command).toBe("validate");
    expect(p.positional).toEqual([]);
  });

  it("captures positional arguments", () => {
    const p = parseArgv(["validate", "./my.sam.json"]);
    expect(p.command).toBe("validate");
    expect(p.positional).toEqual(["./my.sam.json"]);
  });

  it("captures --flag value pairs", () => {
    const p = parseArgv(["submit", "a.json", "--email", "dev@example.com"]);
    expect(p.flags.email).toBe("dev@example.com");
    expect(p.positional).toEqual(["a.json"]);
  });

  it("treats a trailing --flag (no value) as boolean true", () => {
    const p = parseArgv(["submit", "a.json", "--dry-run"]);
    expect(p.flags["dry-run"]).toBe(true);
  });

  it("recognises -h and --help", () => {
    expect(parseArgv(["--help"]).showHelp).toBe(true);
    expect(parseArgv(["-h"]).showHelp).toBe(true);
  });
});

/* ─── runValidate ─────────────────────────────────────────────── */

describe("runValidate()", () => {
  it("returns usage failure when path is missing", async () => {
    const r = await runValidate({ path: undefined, fs: inMemoryFs({}) });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") {
      expect(r.exitCode).toBe(3);
      expect(r.message).toMatch(/Usage:/);
    }
  });

  it("returns usage failure when file doesn't exist", async () => {
    const r = await runValidate({
      path: "nope.json",
      fs: inMemoryFs({}),
    });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") {
      expect(r.exitCode).toBe(3);
      expect(r.message).toMatch(/Cannot read file/);
    }
  });

  it("returns usage failure on invalid JSON", async () => {
    const r = await runValidate({
      path: "a.json",
      fs: inMemoryFs({ "a.json": "{ not json" }),
    });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") {
      expect(r.exitCode).toBe(3);
      expect(r.message).toMatch(/not valid JSON/);
    }
  });

  it("returns validation failure (exit 1) when manifest is bad", async () => {
    const bad = { ...VALID_MANIFEST, sam: "0.9" };
    const r = await runValidate({
      path: "a.json",
      fs: inMemoryFs({ "a.json": JSON.stringify(bad) }),
    });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") {
      expect(r.exitCode).toBe(1);
      const errs = r.details?.errors as Array<{ path: string }>;
      expect(errs.length).toBeGreaterThan(0);
    }
  });

  it("returns success with summary data for a valid manifest", async () => {
    const r = await runValidate({
      path: "a.json",
      fs: inMemoryFs({ "a.json": JSON.stringify(VALID_MANIFEST) }),
    });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      expect(r.data?.slug).toBe("extract-invoice");
      expect(r.data?.displayName).toBe("Invoice Extractor");
    }
  });
});

/* ─── runSubmit ───────────────────────────────────────────────── */

describe("runSubmit()", () => {
  const FS = inMemoryFs({ "a.json": JSON.stringify(VALID_MANIFEST) });

  it("propagates local validation failure without calling HTTP", async () => {
    let httpCalled = false;
    const http: HttpClient = {
      async postJson() {
        httpCalled = true;
        return { status: 999, body: {} };
      },
    };

    const bad = inMemoryFs({ "bad.json": "{ not json" });
    const r = await runSubmit({
      path: "bad.json",
      email: undefined,
      apiUrl: "https://example.com",
      fs: bad,
      http,
    });
    expect(r.kind).toBe("failure");
    expect(httpCalled).toBe(false);
  });

  it("returns success on 201 live response (auto-published)", async () => {
    const http = fakeHttp(/\/api\/creators\/submit$/, {
      status: 201,
      body: {
        success: true,
        referenceId: "SAM-abcdef01-c0de",
        status: "live",
        policy: "open",
        reason: "all SAM-valid manifests publish immediately",
        liveUrl: "/marketplace/extract-invoice",
      },
    });

    const r = await runSubmit({
      path: "a.json",
      email: "dev@example.com",
      apiUrl: "https://example.com",
      fs: FS,
      http,
    });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      expect(r.data?.status).toBe("live");
      expect(r.data?.liveUrl).toBe("/marketplace/extract-invoice");
      expect(r.message).toMatch(/live/i);
    }
  });

  it("returns success on 202 queued response (curated/trust-tiered)", async () => {
    const http = fakeHttp(/\/api\/creators\/submit$/, {
      status: 202,
      body: {
        success: true,
        referenceId: "SAM-deadbeef-abc1",
        status: "queued",
        policy: "curated",
        reason: "queued for operator review",
      },
    });
    const r = await runSubmit({
      path: "a.json",
      email: undefined,
      apiUrl: "https://example.com",
      fs: FS,
      http,
    });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      expect(r.data?.status).toBe("queued");
      expect(r.data?.liveUrl).toBeUndefined();
    }
  });

  it("returns exit 1 on HTTP 400 (server rejected manifest)", async () => {
    const http = fakeHttp(/\/api\/creators\/submit$/, {
      status: 400,
      body: { error: "Manifest failed SAM v1.0 validation." },
    });
    const r = await runSubmit({
      path: "a.json",
      email: undefined,
      apiUrl: "https://example.com",
      fs: FS,
      http,
    });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") expect(r.exitCode).toBe(1);
  });

  it("returns exit 2 on HTTP 5xx (server error)", async () => {
    const http = fakeHttp(/\/api\/creators\/submit$/, {
      status: 500,
      body: { error: "internal" },
    });
    const r = await runSubmit({
      path: "a.json",
      email: undefined,
      apiUrl: "https://example.com",
      fs: FS,
      http,
    });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") expect(r.exitCode).toBe(2);
  });

  it("returns exit 2 on network error (HttpClient throws)", async () => {
    const http: HttpClient = {
      async postJson() {
        throw new Error("ECONNREFUSED");
      },
    };
    const r = await runSubmit({
      path: "a.json",
      email: undefined,
      apiUrl: "https://example.com",
      fs: FS,
      http,
    });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") {
      expect(r.exitCode).toBe(2);
      expect(r.message).toMatch(/Network error/);
    }
  });

  it("resolves the API URL via new URL() (path is appended correctly)", async () => {
    let capturedUrl = "";
    const http: HttpClient = {
      async postJson(url) {
        capturedUrl = url;
        return { status: 202, body: { success: true, referenceId: "SAM-aaa-bbb" } };
      },
    };
    await runSubmit({
      path: "a.json",
      email: undefined,
      apiUrl: "https://alt.example.com/",
      fs: FS,
      http,
    });
    expect(capturedUrl).toBe("https://alt.example.com/api/creators/submit");
  });
});

/* ─── runInfo ─────────────────────────────────────────────────── */

describe("runInfo()", () => {
  it("echoes the resolved API URL and the CLI version", () => {
    const r = runInfo({ apiUrl: "https://custom.example.com" });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      expect(r.data?.apiUrl).toBe("https://custom.example.com");
      expect(r.data?.cliVersion).toMatch(/^\d+\.\d+\.\d+/);
      expect(r.data?.samVersion).toBe("1.0");
    }
  });
});
