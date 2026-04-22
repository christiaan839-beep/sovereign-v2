/**
 * Minimal ANSI output helpers — no external dependencies.
 *
 * Colors auto-disable when:
 *   - stdout isn't a TTY (e.g. piped to a file or CI)
 *   - NO_COLOR env var is set (https://no-color.org/)
 *   - FORCE_COLOR is set to "0"
 *
 * These rules match what chalk / picocolors / kleur do. Writing our
 * own means no dep to keep in lockstep with Node's module resolution,
 * and no supply-chain risk for a 20-line file.
 */

const SUPPORTS_COLOR = (() => {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === "0") return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
})();

function wrap(code: number, text: string): string {
  if (!SUPPORTS_COLOR) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

export const color = {
  green: (s: string) => wrap(32, s),
  red: (s: string) => wrap(31, s),
  yellow: (s: string) => wrap(33, s),
  cyan: (s: string) => wrap(36, s),
  gray: (s: string) => wrap(90, s),
  bold: (s: string) => wrap(1, s),
} as const;

export const symbol = {
  check: SUPPORTS_COLOR ? "✓" : "[OK]",
  cross: SUPPORTS_COLOR ? "✗" : "[X]",
  arrow: SUPPORTS_COLOR ? "→" : "->",
  bullet: SUPPORTS_COLOR ? "•" : "-",
} as const;
