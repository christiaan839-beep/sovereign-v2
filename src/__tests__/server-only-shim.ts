/**
 * Vitest shim for Next.js's `server-only` package.
 *
 * The real package's index.js throws on import outside a server build to
 * enforce that callers don't accidentally bundle a server-only module
 * into the client. Tests run in plain node and load both server-only and
 * client modules in the same process, so we alias the package to this
 * empty file via `vitest.config.ts`. The build-time enforcement is
 * unaffected — only the runtime trap is neutralised during tests.
 */
export {};
