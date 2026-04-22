/**
 * Tiny argv parser — no external deps.
 *
 * Extracted to its own module so tests can import it without touching
 * cli.ts (which has `main()` as a top-level side effect).
 *
 * Grammar:
 *   sovereign <command> [positional...] [--flag value] [--bool-flag] [-h|--help]
 */

export interface ParsedArgs {
  command: string | null;
  positional: string[];
  flags: Record<string, string | true>;
  showHelp: boolean;
}

export function parseArgv(argv: string[]): ParsedArgs {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  let showHelp = false;
  let command: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      showHelp = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags, showHelp };
}
