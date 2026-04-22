/**
 * Programmatic API for sovereign-cli.
 *
 * Most users will invoke the CLI directly; a subset (build pipelines,
 * bespoke integrations) want the commands as importable functions.
 * This file is the public surface for that.
 *
 * Everything exported here is pure + takes explicit adapters. See
 * `src/cli.ts` for the wired-up real-world shell.
 */

export { runValidate } from "./commands/validate.js";
export { runSubmit, DEFAULT_API_URL } from "./commands/submit.js";
export { runInfo, CLI_VERSION } from "./commands/info.js";

export type {
  CommandResult,
  CommandSuccess,
  CommandFailure,
  FileSystem,
  HttpClient,
} from "./types.js";
