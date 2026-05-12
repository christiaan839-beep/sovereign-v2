/**
 * SOVEREIGN MATRIX — CLI command dispatcher (Cook 59 / Tier 5 #24)
 *
 * Pure argv parser + command router for the `sovereign` CLI. The
 * existing scripts under `scripts/` and the partial CLI bundle a
 * lot of one-off shell — this module gives them a consistent
 * surface:
 *
 *   sovereign run <agent> --input ./file.json [--env=prod]
 *   sovereign verify <receiptId>
 *   sovereign replay <receiptId>
 *   sovereign attest --period=2026Q1 --tenant=acme
 *
 * Pure module: parses argv into a typed `CommandInvocation`, looks
 * up the matching handler in a registry, and returns the handler's
 * structured result. Side-effecting work (network, fs reads, stdout)
 * lives in the caller's handler.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface ArgSpec {
  /** Long name (`--name`). */
  name: string;
  /** Optional short flag (`-n`). */
  short?: string;
  /** Whether the flag accepts a value (default true). */
  takesValue?: boolean;
  /** Whether the flag is required. */
  required?: boolean;
  /** Default if omitted. */
  default?: string | boolean;
  /** Help string. */
  description: string;
}

export interface CommandSpec<TResult = unknown> {
  name: string;
  description: string;
  /** Positional argument names in order. */
  positional: string[];
  /** Named flags. */
  flags: ArgSpec[];
  handler: (invocation: CommandInvocation) => Promise<TResult>;
}

export interface CommandInvocation {
  command: string;
  positional: Record<string, string>;
  flags: Record<string, string | boolean>;
}

export type ParseOutcome =
  | { ok: true; command: string; invocation: CommandInvocation }
  | { ok: false; reason: string };

// ── Parsing ───────────────────────────────────────────────────────────────

/**
 * Parse argv (excluding `node`, script name, and the leading
 * `sovereign` token) into a typed invocation against the supplied
 * command spec. Pure.
 */
export function parseArgs(spec: CommandSpec, argv: string[]): ParseOutcome {
  const positionalTokens: string[] = [];
  const flagMap: Record<string, string | boolean> = {};

  // Pre-fill defaults so the consumer always sees a stable map.
  for (const f of spec.flags) {
    if (f.default !== undefined) flagMap[f.name] = f.default;
  }

  // Build short → long lookup.
  const shortIndex = new Map<string, ArgSpec>();
  const longIndex = new Map<string, ArgSpec>();
  for (const f of spec.flags) {
    longIndex.set(f.name, f);
    if (f.short) shortIndex.set(f.short, f);
  }

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok.startsWith("--")) {
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      const key = eq >= 0 ? body.slice(0, eq) : body;
      const inlineValue = eq >= 0 ? body.slice(eq + 1) : undefined;
      const fspec = longIndex.get(key);
      if (!fspec) return { ok: false, reason: `Unknown flag --${key}` };
      if (fspec.takesValue === false) {
        flagMap[key] = true;
        continue;
      }
      let value = inlineValue;
      if (value === undefined) {
        if (i + 1 >= argv.length || argv[i + 1].startsWith("-")) {
          return { ok: false, reason: `Flag --${key} expects a value` };
        }
        value = argv[++i];
      }
      flagMap[key] = value;
    } else if (tok.startsWith("-") && tok.length > 1) {
      const key = tok.slice(1);
      const fspec = shortIndex.get(key);
      if (!fspec) return { ok: false, reason: `Unknown flag -${key}` };
      if (fspec.takesValue === false) {
        flagMap[fspec.name] = true;
        continue;
      }
      if (i + 1 >= argv.length || argv[i + 1].startsWith("-")) {
        return { ok: false, reason: `Flag -${key} expects a value` };
      }
      flagMap[fspec.name] = argv[++i];
    } else {
      positionalTokens.push(tok);
    }
  }

  if (positionalTokens.length < spec.positional.length) {
    return {
      ok: false,
      reason: `Missing positional argument(s): ${spec.positional
        .slice(positionalTokens.length)
        .join(", ")}`,
    };
  }
  if (positionalTokens.length > spec.positional.length) {
    return {
      ok: false,
      reason: `Too many positional arguments (got ${positionalTokens.length}, expected ${spec.positional.length})`,
    };
  }

  for (const f of spec.flags) {
    if (f.required && flagMap[f.name] === undefined) {
      return { ok: false, reason: `Required flag --${f.name} is missing` };
    }
  }

  const positional: Record<string, string> = {};
  spec.positional.forEach((name, idx) => {
    positional[name] = positionalTokens[idx];
  });

  return {
    ok: true,
    command: spec.name,
    invocation: { command: spec.name, positional, flags: flagMap },
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────

export class CommandRegistry {
  private readonly commands = new Map<string, CommandSpec>();

  register<T>(spec: CommandSpec<T>): this {
    if (this.commands.has(spec.name)) {
      throw new Error(`Command '${spec.name}' already registered`);
    }
    this.commands.set(spec.name, spec as CommandSpec);
    return this;
  }

  list(): CommandSpec[] {
    return [...this.commands.values()];
  }

  /**
   * Dispatch a full argv (without the leading executable name).
   * Returns either the handler's result or a structured error.
   */
  async dispatch(
    argv: string[],
  ): Promise<
    | { ok: true; command: string; result: unknown }
    | { ok: false; reason: string; help?: string }
  > {
    if (argv.length === 0) {
      return { ok: false, reason: "Missing command", help: this.renderHelp() };
    }
    const [name, ...rest] = argv;
    const spec = this.commands.get(name);
    if (!spec) {
      return {
        ok: false,
        reason: `Unknown command '${name}'`,
        help: this.renderHelp(),
      };
    }
    const parsed = parseArgs(spec, rest);
    if (!parsed.ok) {
      return {
        ok: false,
        reason: parsed.reason,
        help: renderCommandHelp(spec),
      };
    }
    try {
      const result = await spec.handler(parsed.invocation);
      return { ok: true, command: spec.name, result };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  renderHelp(): string {
    const lines = ["Usage: sovereign <command> [args]", "", "Commands:"];
    for (const spec of this.commands.values()) {
      lines.push(`  ${spec.name.padEnd(14)} ${spec.description}`);
    }
    return lines.join("\n");
  }
}

export function renderCommandHelp(spec: CommandSpec): string {
  const lines = [
    `${spec.name} — ${spec.description}`,
    "",
    `Usage: sovereign ${spec.name} ${spec.positional.map((p) => `<${p}>`).join(" ")} [flags]`,
  ];
  if (spec.flags.length > 0) {
    lines.push("", "Flags:");
    for (const f of spec.flags) {
      const short = f.short ? `-${f.short}, ` : "    ";
      const req = f.required ? " (required)" : "";
      lines.push(`  ${short}--${f.name.padEnd(12)} ${f.description}${req}`);
    }
  }
  return lines.join("\n");
}
