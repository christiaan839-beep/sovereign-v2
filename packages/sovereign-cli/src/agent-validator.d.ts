/**
 * Ambient declaration for @sovereignmatrix/agent-validator.
 *
 * The CLI package imports the validator by package name. In production
 * (published npm install) the real types come from node_modules. In
 * the monorepo source tree, this file tells tsc what the module looks
 * like without requiring `npm install` or a workspaces setup.
 *
 * Stays trivially in sync by mirroring the validator's public API. If
 * the validator breaks its API, this file needs an update — which is
 * exactly the signal we want (CLI should fail type-check, not
 * silently drift).
 */

declare module "@sovereignmatrix/agent-validator" {
  export type ValidationErrorCode =
    | "missing_required_field"
    | "invalid_sam_version"
    | "invalid_slug"
    | "invalid_category"
    | "invalid_version"
    | "invalid_guarantees"
    | "invalid_type"
    | "schema_violation";

  export interface ValidationError {
    path: string;
    message: string;
    code: ValidationErrorCode;
  }

  export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
  }

  export function validate(manifest: unknown): ValidationResult;
  export function validateJson(jsonString: string): ValidationResult;
  export const SUPPORTED_SAM_VERSION: "1.0";
}
