/**
 * Tests for src/lib/cli-dispatcher.ts — Cook 59 CLI.
 *
 *   - parseArgs:
 *       - positional ordering enforced.
 *       - missing required flag rejected.
 *       - --flag=value AND --flag value both parse.
 *       - boolean flags (takesValue=false) toggle without consuming next arg.
 *       - unknown flags rejected.
 *       - too many / too few positionals rejected.
 *   - CommandRegistry:
 *       - register duplicate throws.
 *       - dispatch unknown command returns structured error with help.
 *       - dispatch happy path returns handler result.
 *       - handler throws → structured error.
 *   - renderHelp + renderCommandHelp produce non-empty strings.
 */

import { describe, it, expect, vi } from "vitest";
import {
  parseArgs,
  CommandRegistry,
  renderCommandHelp,
  type CommandSpec,
} from "../cli-dispatcher";

const RUN_SPEC: CommandSpec = {
  name: "run",
  description: "Run an agent",
  positional: ["agent"],
  flags: [
    {
      name: "input",
      short: "i",
      description: "Input JSON path",
      required: true,
    },
    {
      name: "env",
      description: "Target environment",
      default: "prod",
    },
    {
      name: "verbose",
      short: "v",
      description: "Verbose output",
      takesValue: false,
      default: false,
    },
  ],
  handler: async (inv) => ({ ran: inv.positional.agent, flags: inv.flags }),
};

describe("parseArgs — positional", () => {
  it("captures the positional argument", () => {
    const r = parseArgs(RUN_SPEC, ["lead-blitz", "--input", "./i.json"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.invocation.positional.agent).toBe("lead-blitz");
  });

  it("rejects too few positionals", () => {
    const r = parseArgs(RUN_SPEC, ["--input", "i.json"]);
    expect(r.ok).toBe(false);
  });

  it("rejects too many positionals", () => {
    const r = parseArgs(RUN_SPEC, ["lead-blitz", "extra", "--input", "i.json"]);
    expect(r.ok).toBe(false);
  });
});

describe("parseArgs — flag styles", () => {
  it("accepts --flag=value form", () => {
    const r = parseArgs(RUN_SPEC, ["lead-blitz", "--input=./i.json"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.invocation.flags.input).toBe("./i.json");
  });

  it("accepts --flag value form", () => {
    const r = parseArgs(RUN_SPEC, ["lead-blitz", "--input", "./i.json"]);
    if (r.ok) expect(r.invocation.flags.input).toBe("./i.json");
  });

  it("accepts short -i value form", () => {
    const r = parseArgs(RUN_SPEC, ["lead-blitz", "-i", "./i.json"]);
    if (r.ok) expect(r.invocation.flags.input).toBe("./i.json");
  });

  it("pre-fills defaults for omitted optional flags", () => {
    const r = parseArgs(RUN_SPEC, ["lead-blitz", "--input", "./i.json"]);
    if (r.ok) expect(r.invocation.flags.env).toBe("prod");
  });

  it("boolean flag toggles without consuming the next token", () => {
    const r = parseArgs(RUN_SPEC, [
      "lead-blitz",
      "--input",
      "./i.json",
      "--verbose",
    ]);
    if (r.ok) {
      expect(r.invocation.flags.verbose).toBe(true);
      expect(r.invocation.flags.input).toBe("./i.json");
    }
  });
});

describe("parseArgs — rejection", () => {
  it("rejects missing required flag", () => {
    const r = parseArgs(RUN_SPEC, ["lead-blitz"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("--input");
  });

  it("rejects unknown long flag", () => {
    const r = parseArgs(RUN_SPEC, [
      "lead-blitz",
      "--input",
      "./i.json",
      "--unknown",
      "x",
    ]);
    expect(r.ok).toBe(false);
  });

  it("rejects unknown short flag", () => {
    const r = parseArgs(RUN_SPEC, [
      "lead-blitz",
      "--input",
      "./i.json",
      "-x",
      "y",
    ]);
    expect(r.ok).toBe(false);
  });

  it("rejects --flag with missing value", () => {
    const r = parseArgs(RUN_SPEC, ["lead-blitz", "--input"]);
    expect(r.ok).toBe(false);
  });
});

describe("CommandRegistry", () => {
  it("rejects duplicate registration", () => {
    const r = new CommandRegistry();
    r.register(RUN_SPEC);
    expect(() => r.register(RUN_SPEC)).toThrow();
  });

  it("returns Unknown command error for missing command", async () => {
    const r = new CommandRegistry();
    const out = await r.dispatch(["nope"]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/Unknown command/);
  });

  it("dispatch returns the handler's result on happy path", async () => {
    const r = new CommandRegistry();
    r.register(RUN_SPEC);
    const out = await r.dispatch(["run", "lead-blitz", "--input", "./i.json"]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.command).toBe("run");
      expect((out.result as { ran: string }).ran).toBe("lead-blitz");
    }
  });

  it("dispatch returns structured error when handler throws", async () => {
    const r = new CommandRegistry();
    r.register({
      ...RUN_SPEC,
      handler: async () => {
        throw new Error("kaboom");
      },
    });
    const out = await r.dispatch(["run", "lead-blitz", "--input", "./i.json"]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("kaboom");
  });

  it("dispatch with no args returns help text", async () => {
    const r = new CommandRegistry();
    r.register(RUN_SPEC);
    const out = await r.dispatch([]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.help).toContain("Usage:");
  });
});

describe("help rendering", () => {
  it("renderHelp lists registered commands", () => {
    const r = new CommandRegistry();
    r.register(RUN_SPEC);
    expect(r.renderHelp()).toContain("run");
  });

  it("renderCommandHelp shows usage and required flags", () => {
    const help = renderCommandHelp(RUN_SPEC);
    expect(help).toContain("run");
    expect(help).toContain("<agent>");
    expect(help).toContain("--input");
    expect(help).toContain("(required)");
  });
});

describe("handler integration", () => {
  it("flags map is fully populated for the handler", async () => {
    const seen = vi.fn().mockResolvedValue("ok");
    const r = new CommandRegistry();
    r.register({ ...RUN_SPEC, handler: seen });
    await r.dispatch(["run", "lead-blitz", "--input", "./i.json", "--verbose"]);
    expect(seen).toHaveBeenCalled();
    const inv = seen.mock.calls[0][0];
    expect(inv.flags.input).toBe("./i.json");
    expect(inv.flags.verbose).toBe(true);
    expect(inv.flags.env).toBe("prod"); // default
  });
});
