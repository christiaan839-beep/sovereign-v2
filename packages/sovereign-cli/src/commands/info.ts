/**
 * `sovereign info`
 *
 * Print the active configuration (package version, resolved API URL,
 * supported SAM version). Useful for bug reports and "is the CLI
 * actually pointing where I think it is?" debugging. Zero I/O.
 */

import { SUPPORTED_SAM_VERSION } from "@sovereignmatrix/agent-validator";
import type { CommandResult } from "../types.js";

export const CLI_VERSION = "1.0.0";

export function runInfo(args: { apiUrl: string }): CommandResult {
  return {
    kind: "success",
    message: `Sovereign CLI v${CLI_VERSION}`,
    data: {
      cliVersion: CLI_VERSION,
      samVersion: SUPPORTED_SAM_VERSION,
      apiUrl: args.apiUrl,
      docs: "https://sovereignmatrix.agency/developers/build-an-agent",
      spec: "https://sovereignmatrix.agency/spec/agent-manifest",
    },
  };
}
