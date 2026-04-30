/**
 * AIDER SOFTWARE ENGINEER EDGE NODE — first real (non-stub) Edge Node
 * implementation for Move 3 of the proof-conversion arc.
 *
 * STRATEGIC PURPOSE:
 *
 *   The R120 Edge Node Framework shipped with three persona stubs
 *   (software-engineer, analyst, operator). Until this module, every
 *   stub failed closed with `edge_node_not_configured`. This file
 *   ships the FIRST real implementation — Aider, the open-source
 *   AI pair-programming CLI (https://aider.chat).
 *
 *   Strategic value: customers configure ONE environment variable
 *   (SOVEREIGN_AIDER_ENABLED=true) and the platform delegates
 *   fix-github-issue / open-pull-request / refactor-codebase to a
 *   real agentic coding system, under the full Sovereign trust
 *   substrate (R100 policy + R102 cost + R26 audit + R37 ACT).
 *
 * SAFETY POSTURE:
 *
 *   1. Feature-flagged. SOVEREIGN_AIDER_ENABLED must be "true" or
 *      describe() returns isStub:true and dispatch() refuses with
 *      `edge_node_not_configured`. No silent enablement.
 *
 *   2. Subprocess via the injected AiderSubprocessRunner. The default
 *      runner (./aider-runner.ts) uses spawn with shell:false so
 *      user-provided repoPath / files / message NEVER go through a
 *      shell. The args array is a sanitized list passed directly to
 *      the OS — no shell metacharacter injection vector.
 *
 *   3. Path traversal defense. repoPath / files MUST pass
 *      validateDispatchTask — no "..", no NUL bytes, no absolute
 *      paths inside `files`, repoPath must be absolute and exist.
 *
 *   4. Timeout enforcement. Every dispatch carries a hard timeout
 *      (default 600s, configurable via task.timeoutSeconds, capped
 *      at 1800s). Runner enforces SIGTERM then SIGKILL.
 *
 *   5. Pure-function core. validateDispatchTask / buildAiderArgs /
 *      parseAiderOutput / validateAiderConfig are pure and unit-
 *      testable. The class is a thin wrapper that composes them
 *      with a subprocess runner. Tests inject a mock runner.
 *
 *   6. Receipt-line discipline. Every dispatch — success or failure
 *      — produces a procurement-readable receipt that gets written
 *      to the R26 audit chain. SOC 2 + EU AI Act auditors filter
 *      on these.
 *
 * UPSTREAM: Aider — Apache-2.0 — github.com/paul-gauthier/aider
 */

import { isAbsolute, resolve } from "node:path";
import { promises as fs } from "node:fs";
import type {
  EdgeNode,
  EdgeNodeManifest,
  DispatchRequest,
  DispatchResult,
  EdgeNodeHealthStatus,
  EdgeNodeCapability,
} from "../types";
import { StubEdgeNode } from "../stub-edge-node";

export const AIDER_SOFTWARE_ENGINEER_EDGE_NODE_ID = "aider-software-engineer";

export const AIDER_SUPPORTED_CAPABILITIES: ReadonlyArray<EdgeNodeCapability> = [
  "fix-github-issue",
  "open-pull-request",
  "review-pull-request",
  "run-test-suite",
  "refactor-codebase",
];

export const AIDER_DEFAULT_TIMEOUT_SECONDS = 600;
export const AIDER_MAX_TIMEOUT_SECONDS = 1800;
export const AIDER_MAX_MESSAGE_LENGTH = 32_000;

export function isAiderEnabled(): boolean {
  return process.env.SOVEREIGN_AIDER_ENABLED === "true";
}

export interface AiderDispatchTask {
  repoPath: string;
  files?: string[];
  readOnlyFiles?: string[];
  message: string;
  model?: string;
  testCmd?: string;
  timeoutSeconds?: number;
}

export type DispatchValidation =
  | { ok: true; task: AiderDispatchTask }
  | {
      ok: false;
      reason:
        | "missing_message"
        | "missing_repo_path"
        | "repo_path_must_be_absolute"
        | "repo_path_traversal"
        | "files_must_be_relative"
        | "files_path_traversal"
        | "files_contain_nul"
        | "test_cmd_required_for_run_test_suite"
        | "timeout_out_of_range"
        | "model_invalid"
        | "message_too_long";
      details: string;
    };

/**
 * Pure: validate the structured task input. Path-traversal defense:
 * repoPath must be absolute, files must be relative + no "..", no
 * NUL bytes anywhere.
 */
export function validateDispatchTask(
  raw: Record<string, unknown>,
  capability: EdgeNodeCapability,
): DispatchValidation {
  const message = typeof raw.message === "string" ? raw.message : "";
  if (message.length === 0) {
    return { ok: false, reason: "missing_message", details: "task.message is required." };
  }
  if (message.length > AIDER_MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      reason: "message_too_long",
      details: `task.message exceeds ${AIDER_MAX_MESSAGE_LENGTH} chars.`,
    };
  }
  if (message.includes("\0")) {
    return { ok: false, reason: "files_contain_nul", details: "task.message contains NUL byte." };
  }

  const repoPath = typeof raw.repoPath === "string" ? raw.repoPath : "";
  if (repoPath.length === 0) {
    return { ok: false, reason: "missing_repo_path", details: "task.repoPath is required." };
  }
  if (!isAbsolute(repoPath)) {
    return { ok: false, reason: "repo_path_must_be_absolute", details: "task.repoPath must be absolute." };
  }
  if (repoPath.includes("\0")) {
    return { ok: false, reason: "files_contain_nul", details: "task.repoPath contains NUL byte." };
  }
  const resolved = resolve(repoPath);
  const normalized = repoPath.replace(/\/+$/, "");
  if (resolved !== normalized && resolved !== repoPath) {
    return { ok: false, reason: "repo_path_traversal", details: 'task.repoPath contains ".." segments.' };
  }

  const files = Array.isArray(raw.files) ? (raw.files as unknown[]) : [];
  const readOnlyFiles = Array.isArray(raw.readOnlyFiles) ? (raw.readOnlyFiles as unknown[]) : [];
  for (const list of [
    { name: "files" as const, arr: files },
    { name: "readOnlyFiles" as const, arr: readOnlyFiles },
  ]) {
    for (const v of list.arr) {
      if (typeof v !== "string" || v.length === 0) {
        return {
          ok: false,
          reason: "files_must_be_relative",
          details: `task.${list.name} must be non-empty strings.`,
        };
      }
      if (v.includes("\0")) {
        return {
          ok: false,
          reason: "files_contain_nul",
          details: `task.${list.name} entry contains NUL byte.`,
        };
      }
      if (isAbsolute(v)) {
        return {
          ok: false,
          reason: "files_must_be_relative",
          details: `task.${list.name} entry must be relative.`,
        };
      }
      if (v.split(/[\\/]/).includes("..")) {
        return {
          ok: false,
          reason: "files_path_traversal",
          details: `task.${list.name} entry contains "..".`,
        };
      }
    }
  }

  const testCmd = typeof raw.testCmd === "string" ? raw.testCmd : undefined;
  if (capability === "run-test-suite" && !testCmd) {
    return {
      ok: false,
      reason: "test_cmd_required_for_run_test_suite",
      details: "capability=run-test-suite requires task.testCmd.",
    };
  }

  let timeoutSeconds: number | undefined;
  const tRaw = raw.timeoutSeconds;
  if (tRaw !== undefined) {
    if (typeof tRaw !== "number" || !Number.isFinite(tRaw)) {
      return {
        ok: false,
        reason: "timeout_out_of_range",
        details: "task.timeoutSeconds must be finite.",
      };
    }
    if (tRaw < 1 || tRaw > AIDER_MAX_TIMEOUT_SECONDS) {
      return {
        ok: false,
        reason: "timeout_out_of_range",
        details: `timeout must be in [1, ${AIDER_MAX_TIMEOUT_SECONDS}].`,
      };
    }
    timeoutSeconds = Math.floor(tRaw);
  }

  const model = typeof raw.model === "string" ? raw.model : undefined;
  if (model !== undefined && (!/^[A-Za-z0-9._:/+-]+$/.test(model) || model.length > 128)) {
    return {
      ok: false,
      reason: "model_invalid",
      details: "task.model contains invalid characters.",
    };
  }

  return {
    ok: true,
    task: {
      repoPath,
      files: files as string[],
      readOnlyFiles: readOnlyFiles as string[],
      message,
      model,
      testCmd,
      timeoutSeconds,
    },
  };
}

/**
 * Pure: convert validated task + capability into the args array passed
 * to the runner. NEVER concatenates user input into shell-sensitive
 * strings — every arg is a separate element.
 */
export function buildAiderArgs(
  task: AiderDispatchTask,
  capability: EdgeNodeCapability,
): string[] {
  const args: string[] = [];
  args.push("--message", task.message);
  args.push("--yes-always");
  args.push("--no-auto-commits");
  if (capability === "review-pull-request") args.push("--no-stream");
  if (task.model) args.push("--model", task.model);
  if (task.testCmd) {
    args.push("--test-cmd", task.testCmd);
    if (capability === "run-test-suite") args.push("--test");
  }
  for (const f of task.readOnlyFiles ?? []) args.push("--read", f);
  for (const f of task.files ?? []) args.push(f);
  return args;
}

export interface AiderParseResult {
  filesEdited: string[];
  testStatus: "pass" | "fail" | "unknown";
  summary: string;
}

/**
 * Pure: heuristic parse of Aider stdout. Best-effort; failure to parse
 * does NOT crash dispatch.
 */
export function parseAiderOutput(stdout: string, exitCode: number): AiderParseResult {
  const filesEdited: string[] = [];
  const editRe = /(?:Edited|Applied edit to|Modified)\s+(\S+)/g;
  for (const m of stdout.matchAll(editRe)) {
    if (!filesEdited.includes(m[1])) filesEdited.push(m[1]);
  }
  let testStatus: "pass" | "fail" | "unknown" = "unknown";
  if (/tests? passed/i.test(stdout) || /\bok\b.*tests/i.test(stdout)) testStatus = "pass";
  else if (/tests? failed/i.test(stdout) || /failed: \d+/i.test(stdout)) testStatus = "fail";
  const summary =
    exitCode === 0
      ? filesEdited.length > 0
        ? `aider edited ${filesEdited.length} file(s); test=${testStatus}`
        : `aider completed with no edits; test=${testStatus}`
      : `aider failed with code ${exitCode}; test=${testStatus}`;
  return { filesEdited, testStatus, summary: summary.slice(0, 200) };
}

export interface AiderResolvedConfig {
  command: string;
  defaultModel: string | null;
}

export type ConfigValidation =
  | { ok: true; config: AiderResolvedConfig }
  | {
      ok: false;
      reason: "feature_flag_off" | "command_not_configured" | "command_invalid";
      details: string;
    };

/**
 * Pure: read env vars and validate the runtime configuration.
 */
export function validateAiderConfig(env: NodeJS.ProcessEnv): ConfigValidation {
  if (env.SOVEREIGN_AIDER_ENABLED !== "true") {
    return {
      ok: false,
      reason: "feature_flag_off",
      details: "SOVEREIGN_AIDER_ENABLED is not 'true'.",
    };
  }
  const command = env.AIDER_COMMAND ?? "aider";
  if (!/^[A-Za-z0-9._/-]+$/.test(command) || command.length > 256) {
    return {
      ok: false,
      reason: "command_invalid",
      details: "AIDER_COMMAND contains invalid characters.",
    };
  }
  return { ok: true, config: { command, defaultModel: env.AIDER_MODEL ?? null } };
}

export interface AiderSubprocessRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

export interface AiderSubprocessRunner {
  run(input: {
    command: string;
    args: string[];
    cwd: string;
    timeoutMs: number;
    env?: NodeJS.ProcessEnv;
  }): Promise<AiderSubprocessRunResult>;
}

export function buildAiderManifest(env: NodeJS.ProcessEnv): EdgeNodeManifest {
  const enabled = env.SOVEREIGN_AIDER_ENABLED === "true";
  return {
    id: AIDER_SOFTWARE_ENGINEER_EDGE_NODE_ID,
    persona: "software-engineer",
    name: "Aider Software Engineer Edge Node",
    description:
      "Aider — open-source AI pair programmer (Apache-2.0). Drives focused code edits, refactors, and test-driven fixes from a natural-language brief, with all dispatches wrapped in Sovereign's R26 audit + R100 policy + R102 cost + R37 ACT trust substrate.",
    capabilities: [...AIDER_SUPPORTED_CAPABILITIES],
    upstreamProjects: [
      { name: "Aider", license: "Apache-2.0", url: "https://github.com/paul-gauthier/aider" },
    ],
    deployment: "customer-cloud",
    costBand: "low",
    outputClass: "tenant-private",
    isStub: !enabled,
    regulatoryNotes: [
      "SOC 2 CC8.1 (change management) — every Aider dispatch is audit-chained with the resulting filesEdited list.",
      "ISO 27001 A.14.2.2 (system change control) — dispatch refusals are receipted.",
    ],
  };
}

export interface AiderEdgeNodeOptions {
  runner: AiderSubprocessRunner;
  env?: NodeJS.ProcessEnv;
  pathExists?: (path: string) => Promise<boolean>;
}

const defaultPathExists = async (path: string): Promise<boolean> => {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
};

export class AiderSoftwareEngineerEdgeNode implements EdgeNode {
  private readonly runner: AiderSubprocessRunner;
  private readonly env: NodeJS.ProcessEnv;
  private readonly pathExistsCheck: (path: string) => Promise<boolean>;

  constructor(opts: AiderEdgeNodeOptions) {
    this.runner = opts.runner;
    this.env = opts.env ?? process.env;
    this.pathExistsCheck = opts.pathExists ?? defaultPathExists;
  }

  describe(): EdgeNodeManifest {
    return buildAiderManifest(this.env);
  }

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const id = AIDER_SOFTWARE_ENGINEER_EDGE_NODE_ID;
    const head = `[edge-node-dispatch] user=${request.userId} cap=${request.capability}`;

    if (!AIDER_SUPPORTED_CAPABILITIES.includes(request.capability)) {
      return {
        ok: false,
        edgeNodeId: id,
        capability: request.capability,
        reason: "capability_unsupported",
        details: `Aider does not implement capability ${request.capability}.`,
        receiptLine: `${head} → REFUSED via ${id} (capability_unsupported)`,
      };
    }

    const cfg = validateAiderConfig(this.env);
    if (!cfg.ok) {
      return {
        ok: false,
        edgeNodeId: id,
        capability: request.capability,
        reason: "edge_node_not_configured",
        details: cfg.details,
        receiptLine: `${head} → REFUSED via ${id} (edge_node_not_configured) — ${cfg.reason}`,
      };
    }

    const v = validateDispatchTask(request.task, request.capability);
    if (!v.ok) {
      return {
        ok: false,
        edgeNodeId: id,
        capability: request.capability,
        reason: "internal_error",
        details: `${v.reason}: ${v.details}`,
        receiptLine: `${head} → REFUSED via ${id} (internal_error) — ${v.reason}`,
      };
    }
    const task = v.task;

    const exists = await this.pathExistsCheck(task.repoPath);
    if (!exists) {
      return {
        ok: false,
        edgeNodeId: id,
        capability: request.capability,
        reason: "internal_error",
        details: `repoPath ${task.repoPath} does not exist or is not accessible.`,
        receiptLine: `${head} → REFUSED via ${id} (internal_error) — repo_path_unreachable`,
      };
    }

    const taskWithModel: AiderDispatchTask = {
      ...task,
      model: task.model ?? cfg.config.defaultModel ?? undefined,
    };
    const args = buildAiderArgs(taskWithModel, request.capability);

    const timeoutSec = Math.min(
      Math.max(taskWithModel.timeoutSeconds ?? AIDER_DEFAULT_TIMEOUT_SECONDS, 1),
      AIDER_MAX_TIMEOUT_SECONDS,
    );

    let result: AiderSubprocessRunResult;
    try {
      result = await this.runner.run({
        command: cfg.config.command,
        args,
        cwd: task.repoPath,
        timeoutMs: timeoutSec * 1_000,
        env: this.env,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        edgeNodeId: id,
        capability: request.capability,
        reason: "internal_error",
        details: `runner threw: ${detail}`,
        receiptLine: `${head} → REFUSED via ${id} (internal_error) — runner_exception`,
      };
    }

    if (result.timedOut) {
      return {
        ok: false,
        edgeNodeId: id,
        capability: request.capability,
        reason: "timeout",
        details: `aider timed out after ${timeoutSec}s.`,
        receiptLine: `${head} → REFUSED via ${id} (timeout, ${timeoutSec}s)`,
      };
    }

    const parsed = parseAiderOutput(result.stdout, result.exitCode);
    if (result.exitCode !== 0) {
      return {
        ok: false,
        edgeNodeId: id,
        capability: request.capability,
        reason: "upstream_error",
        details: `aider failed with code ${result.exitCode}: ${result.stderr.slice(0, 400)}`,
        receiptLine: `${head} → REFUSED via ${id} (upstream_error, code=${result.exitCode})`,
      };
    }

    const costCents = 0;
    return {
      ok: true,
      edgeNodeId: id,
      capability: request.capability,
      output: {
        filesEdited: parsed.filesEdited,
        testStatus: parsed.testStatus,
        summary: parsed.summary,
        durationMs: result.durationMs,
        stdoutPreview: result.stdout.slice(0, 4_000),
      },
      durationMs: result.durationMs,
      costCents,
      receiptLine: `${head} → ok via ${id} (${result.durationMs}ms, ${costCents}¢, ${parsed.filesEdited.length} edits, test=${parsed.testStatus})`,
    };
  }

  async health(): Promise<{ status: EdgeNodeHealthStatus; detail?: string; lastReadyAt?: string }> {
    const cfg = validateAiderConfig(this.env);
    if (!cfg.ok) return { status: "not-configured", detail: cfg.details };
    try {
      const result = await this.runner.run({
        command: cfg.config.command,
        args: ["--version"],
        cwd: process.cwd(),
        timeoutMs: 5_000,
        env: this.env,
      });
      if (result.timedOut)
        return { status: "configured-but-unreachable", detail: "aider --version timed out after 5s" };
      if (result.exitCode !== 0)
        return {
          status: "configured-but-unreachable",
          detail: `aider --version failed with code ${result.exitCode}`,
        };
      return {
        status: "ready",
        detail: result.stdout.trim().slice(0, 100) || "aider available",
        lastReadyAt: new Date().toISOString(),
      };
    } catch (err) {
      return { status: "error", detail: err instanceof Error ? err.message : String(err) };
    }
  }
}

export function createAiderSoftwareEngineerNode(
  opts: Partial<AiderEdgeNodeOptions> = {},
): EdgeNode {
  const env = opts.env ?? process.env;
  if (env.SOVEREIGN_AIDER_ENABLED !== "true") {
    const m = buildAiderManifest(env);
    return new StubEdgeNode({
      id: AIDER_SOFTWARE_ENGINEER_EDGE_NODE_ID,
      manifestOverlay: {
        id: m.id,
        persona: m.persona,
        name: m.name,
        description: m.description,
        capabilities: m.capabilities,
        upstreamProjects: m.upstreamProjects,
        deployment: m.deployment,
        costBand: m.costBand,
        outputClass: m.outputClass,
        regulatoryNotes: m.regulatoryNotes,
      },
      detailsOverride:
        "Aider Edge Node is fail-closed by default. Set SOVEREIGN_AIDER_ENABLED=true and ensure `aider` is on the PATH (or set AIDER_COMMAND).",
    });
  }
  if (!opts.runner) {
    throw new Error(
      "createAiderSoftwareEngineerNode: SOVEREIGN_AIDER_ENABLED=true requires a runner. Import { defaultAiderRunner } from './aider-runner' and pass it explicitly.",
    );
  }
  return new AiderSoftwareEngineerEdgeNode({
    runner: opts.runner,
    env: opts.env,
    pathExists: opts.pathExists,
  });
}
