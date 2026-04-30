/**
 * Aider Edge Node — pure-function + class tests with mocked runner.
 *
 * Real Aider invocation requires operator setup (Aider on PATH, model
 * API key, repo checkout). These tests use a mock runner so CI runs
 * without any of that.
 */

import { describe, it, expect } from "vitest";
import {
  validateDispatchTask,
  buildAiderArgs,
  parseAiderOutput,
  validateAiderConfig,
  buildAiderManifest,
  createAiderSoftwareEngineerNode,
  AiderSoftwareEngineerEdgeNode,
  AIDER_SOFTWARE_ENGINEER_EDGE_NODE_ID,
  AIDER_SUPPORTED_CAPABILITIES,
  type AiderSubprocessRunner,
  type AiderSubprocessRunResult,
} from "../personas/aider-software-engineer";
import type { DispatchRequest } from "../types";

function makeMockRunner(
  result: Partial<AiderSubprocessRunResult> & { exitCode?: number } = {},
): AiderSubprocessRunner {
  return {
    async run() {
      return {
        exitCode: result.exitCode ?? 0,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        timedOut: result.timedOut ?? false,
        durationMs: result.durationMs ?? 100,
      };
    },
  };
}

const FLAG_ON = {
  SOVEREIGN_AIDER_ENABLED: "true",
  AIDER_COMMAND: "aider",
} as unknown as NodeJS.ProcessEnv;
const FLAG_OFF = {} as unknown as NodeJS.ProcessEnv;

const makeDispatch = (overrides: Partial<DispatchRequest> = {}): DispatchRequest => ({
  userId: "u_test",
  capability: "fix-github-issue",
  task: { repoPath: "/tmp/repo", message: "fix bug X" },
  ...overrides,
});

describe("validateDispatchTask", () => {
  it("rejects empty message", () => {
    const v = validateDispatchTask({ repoPath: "/tmp/r", message: "" }, "fix-github-issue");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_message");
  });

  it("rejects message > AIDER_MAX_MESSAGE_LENGTH", () => {
    const long = "x".repeat(40_000);
    const v = validateDispatchTask({ repoPath: "/tmp/r", message: long }, "fix-github-issue");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("message_too_long");
  });

  it("rejects NUL byte in message", () => {
    const v = validateDispatchTask({ repoPath: "/tmp/r", message: "ok\0bad" }, "fix-github-issue");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("files_contain_nul");
  });

  it("rejects relative repoPath", () => {
    const v = validateDispatchTask({ repoPath: "relative/path", message: "hi" }, "fix-github-issue");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("repo_path_must_be_absolute");
  });

  it("rejects repoPath traversal", () => {
    const v = validateDispatchTask({ repoPath: "/tmp/repo/../etc", message: "hi" }, "fix-github-issue");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("repo_path_traversal");
  });

  it("rejects absolute file paths in files[]", () => {
    const v = validateDispatchTask(
      { repoPath: "/tmp/repo", message: "hi", files: ["/etc/passwd"] },
      "fix-github-issue",
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("files_must_be_relative");
  });

  it("rejects '..' segment in files[]", () => {
    const v = validateDispatchTask(
      { repoPath: "/tmp/repo", message: "hi", files: ["src/../../../etc/passwd"] },
      "fix-github-issue",
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("files_path_traversal");
  });

  it("requires testCmd for run-test-suite", () => {
    const v = validateDispatchTask({ repoPath: "/tmp/repo", message: "hi" }, "run-test-suite");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("test_cmd_required_for_run_test_suite");
  });

  it("rejects out-of-range timeout", () => {
    const v = validateDispatchTask(
      { repoPath: "/tmp/repo", message: "hi", timeoutSeconds: 99_999 },
      "fix-github-issue",
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("timeout_out_of_range");
  });

  it("rejects model with shell metacharacters", () => {
    const v = validateDispatchTask(
      { repoPath: "/tmp/repo", message: "hi", model: "gpt$(rm -rf /)" },
      "fix-github-issue",
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("model_invalid");
  });

  it("accepts a valid task", () => {
    const v = validateDispatchTask(
      {
        repoPath: "/tmp/repo",
        files: ["src/app.ts"],
        readOnlyFiles: ["docs/spec.md"],
        message: "fix bug X",
        model: "gpt-4o",
        testCmd: "pytest -q",
        timeoutSeconds: 300,
      },
      "fix-github-issue",
    );
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.task.repoPath).toBe("/tmp/repo");
      expect(v.task.files).toEqual(["src/app.ts"]);
      expect(v.task.timeoutSeconds).toBe(300);
    }
  });
});

describe("buildAiderArgs", () => {
  it("emits --message --yes-always --no-auto-commits", () => {
    const args = buildAiderArgs({ repoPath: "/tmp/r", message: "fix it" }, "fix-github-issue");
    expect(args).toContain("--message");
    expect(args).toContain("fix it");
    expect(args).toContain("--yes-always");
    expect(args).toContain("--no-auto-commits");
  });

  it("emits --no-stream for review-pull-request", () => {
    const args = buildAiderArgs({ repoPath: "/tmp/r", message: "review" }, "review-pull-request");
    expect(args).toContain("--no-stream");
  });

  it("emits --test for run-test-suite", () => {
    const args = buildAiderArgs(
      { repoPath: "/tmp/r", message: "run", testCmd: "pytest" },
      "run-test-suite",
    );
    expect(args).toContain("--test");
    expect(args).toContain("--test-cmd");
    expect(args).toContain("pytest");
  });

  it("emits --read for each readOnlyFile", () => {
    const args = buildAiderArgs(
      { repoPath: "/tmp/r", message: "hi", readOnlyFiles: ["a.md", "b.md"] },
      "fix-github-issue",
    );
    const reads = args.filter((a, i) => args[i - 1] === "--read");
    expect(reads).toEqual(["a.md", "b.md"]);
  });

  it("appends files as positional args last", () => {
    const args = buildAiderArgs(
      { repoPath: "/tmp/r", message: "hi", files: ["src/a.ts", "src/b.ts"] },
      "fix-github-issue",
    );
    expect(args.slice(-2)).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("parseAiderOutput", () => {
  it("extracts edited file paths", () => {
    const out = "Edited src/a.ts\nApplied edit to src/b.ts\nModified docs/c.md\n";
    const parsed = parseAiderOutput(out, 0);
    expect(parsed.filesEdited).toEqual(["src/a.ts", "src/b.ts", "docs/c.md"]);
  });

  it("detects passing tests", () => {
    expect(parseAiderOutput("12 tests passed", 0).testStatus).toBe("pass");
  });

  it("detects failing tests", () => {
    expect(parseAiderOutput("3 tests failed", 0).testStatus).toBe("fail");
  });

  it("returns 'unknown' when no test signal present", () => {
    expect(parseAiderOutput("no test mentions", 0).testStatus).toBe("unknown");
  });

  it("summary reflects exit code on failure", () => {
    const parsed = parseAiderOutput("", 2);
    expect(parsed.summary).toContain("aider failed with code 2");
  });
});

describe("validateAiderConfig", () => {
  it("rejects when feature flag off", () => {
    const v = validateAiderConfig(FLAG_OFF);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("feature_flag_off");
  });

  it("accepts default command 'aider' when flag on", () => {
    const v = validateAiderConfig(FLAG_ON);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.config.command).toBe("aider");
  });

  it("rejects shell-meta in AIDER_COMMAND", () => {
    const v = validateAiderConfig({
      SOVEREIGN_AIDER_ENABLED: "true",
      AIDER_COMMAND: "aider; rm -rf /",
    } as unknown as NodeJS.ProcessEnv);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("command_invalid");
  });
});

describe("buildAiderManifest", () => {
  it("isStub: true when flag off", () => {
    const m = buildAiderManifest(FLAG_OFF);
    expect(m.isStub).toBe(true);
    expect(m.id).toBe(AIDER_SOFTWARE_ENGINEER_EDGE_NODE_ID);
    expect(m.persona).toBe("software-engineer");
  });

  it("isStub: false when flag on", () => {
    const m = buildAiderManifest(FLAG_ON);
    expect(m.isStub).toBe(false);
  });

  it("declares all 5 supported capabilities", () => {
    const m = buildAiderManifest(FLAG_ON);
    for (const cap of AIDER_SUPPORTED_CAPABILITIES) {
      expect(m.capabilities).toContain(cap);
    }
  });

  it("cites Apache-2.0 license for upstream", () => {
    const m = buildAiderManifest(FLAG_ON);
    expect(m.upstreamProjects[0].license).toContain("Apache-2.0");
  });
});

describe("AiderSoftwareEngineerEdgeNode.dispatch", () => {
  it("refuses unsupported capability", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner(),
      env: FLAG_ON,
      pathExists: async () => true,
    });
    const out = await node.dispatch(
      makeDispatch({ capability: "ingest-documents" as never }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("capability_unsupported");
  });

  it("refuses when feature flag off", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner(),
      env: FLAG_OFF,
      pathExists: async () => true,
    });
    const out = await node.dispatch(makeDispatch());
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("edge_node_not_configured");
  });

  it("refuses when repoPath does not exist", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner(),
      env: FLAG_ON,
      pathExists: async () => false,
    });
    const out = await node.dispatch(makeDispatch());
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("internal_error");
      expect(out.receiptLine).toContain("repo_path_unreachable");
    }
  });

  it("refuses when validation fails (path traversal)", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner(),
      env: FLAG_ON,
      pathExists: async () => true,
    });
    const out = await node.dispatch(
      makeDispatch({
        task: { repoPath: "/tmp/repo", message: "x", files: ["../etc/passwd"] },
      }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("internal_error");
      expect(out.details).toContain("files_path_traversal");
    }
  });

  it("dispatches successfully on exit 0", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner({
        exitCode: 0,
        stdout: "Edited src/a.ts\n2 tests passed\n",
        durationMs: 1234,
      }),
      env: FLAG_ON,
      pathExists: async () => true,
    });
    const out = await node.dispatch(makeDispatch());
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.output.filesEdited).toEqual(["src/a.ts"]);
      expect(out.output.testStatus).toBe("pass");
      expect(out.durationMs).toBe(1234);
      expect(out.costCents).toBe(0);
      expect(out.receiptLine).toContain("ok via aider-software-engineer");
    }
  });

  it("returns timeout when runner reports timedOut", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner({ timedOut: true, exitCode: 137 }),
      env: FLAG_ON,
      pathExists: async () => true,
    });
    const out = await node.dispatch(makeDispatch());
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("timeout");
  });

  it("returns upstream_error on non-zero exit", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner({ exitCode: 2, stderr: "auth failed" }),
      env: FLAG_ON,
      pathExists: async () => true,
    });
    const out = await node.dispatch(makeDispatch());
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("upstream_error");
      expect(out.details).toContain("auth failed");
    }
  });

  it("returns internal_error when runner throws", async () => {
    const throwingRunner: AiderSubprocessRunner = {
      async run() {
        throw new Error("spawn ENOENT");
      },
    };
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: throwingRunner,
      env: FLAG_ON,
      pathExists: async () => true,
    });
    const out = await node.dispatch(makeDispatch());
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("internal_error");
      expect(out.details).toContain("spawn ENOENT");
    }
  });

  it("clamps timeout based on validation", async () => {
    let observedTimeoutMs = -1;
    const observingRunner: AiderSubprocessRunner = {
      async run({ timeoutMs }) {
        observedTimeoutMs = timeoutMs;
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false, durationMs: 10 };
      },
    };
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: observingRunner,
      env: FLAG_ON,
      pathExists: async () => true,
    });
    // Out-of-range timeout: validation rejects, runner not called
    await node.dispatch(
      makeDispatch({
        task: { repoPath: "/tmp/repo", message: "hi", timeoutSeconds: 9999 },
      }),
    );
    expect(observedTimeoutMs).toBe(-1);

    // Valid in-range timeout reaches runner
    await node.dispatch(
      makeDispatch({
        task: { repoPath: "/tmp/repo", message: "hi", timeoutSeconds: 60 },
      }),
    );
    expect(observedTimeoutMs).toBe(60_000);
  });
});

describe("AiderSoftwareEngineerEdgeNode.health", () => {
  it("not-configured when flag off", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner(),
      env: FLAG_OFF,
    });
    const h = await node.health();
    expect(h.status).toBe("not-configured");
  });

  it("ready when --version exits 0", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner({ exitCode: 0, stdout: "aider 0.50.0\n" }),
      env: FLAG_ON,
    });
    const h = await node.health();
    expect(h.status).toBe("ready");
    expect(h.detail).toContain("aider 0.50.0");
  });

  it("configured-but-unreachable on --version timeout", async () => {
    const node = new AiderSoftwareEngineerEdgeNode({
      runner: makeMockRunner({ timedOut: true }),
      env: FLAG_ON,
    });
    const h = await node.health();
    expect(h.status).toBe("configured-but-unreachable");
  });
});

describe("createAiderSoftwareEngineerNode factory", () => {
  it("returns StubEdgeNode when flag off", () => {
    const node = createAiderSoftwareEngineerNode({ env: FLAG_OFF });
    expect(node.describe().isStub).toBe(true);
    expect(node.describe().id).toBe(AIDER_SOFTWARE_ENGINEER_EDGE_NODE_ID);
  });

  it("throws when flag on but no runner provided", () => {
    expect(() => createAiderSoftwareEngineerNode({ env: FLAG_ON })).toThrow(/requires a runner/);
  });

  it("returns real adapter when flag on and runner provided", () => {
    const node = createAiderSoftwareEngineerNode({
      env: FLAG_ON,
      runner: makeMockRunner(),
    });
    expect(node.describe().isStub).toBe(false);
  });
});
