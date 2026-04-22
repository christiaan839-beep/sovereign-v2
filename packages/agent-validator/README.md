# @sovereignmatrix/agent-validator

Zero-dependency validator for the **Sovereign Agent Manifest (SAM) v1.0** spec.

- **CLI**: `sovereign-agent-validator manifest.json`
- **Programmatic**: `import { validate } from "@sovereignmatrix/agent-validator"`
- **Spec**: [sovereignmatrix.agency/spec/agent-manifest](https://sovereignmatrix.agency/spec/agent-manifest)
- **Schema**: [sovereignmatrix.agency/api/public/sam/schema](https://sovereignmatrix.agency/api/public/sam/schema)

## Install

```bash
npm install -g @sovereignmatrix/agent-validator
# or, as a dev dependency for a CI pipeline
npm install --save-dev @sovereignmatrix/agent-validator
```

## CLI usage

```bash
# From a file
sovereign-agent-validator path/to/manifest.json

# From stdin (CI-friendly)
curl -s https://example.com/my-agent.json | sovereign-agent-validator
cat manifest.json | sam-validate
```

Exit codes: `0` valid · `1` invalid · `2` input error.

## Programmatic usage

```typescript
import { validate, validateJson } from "@sovereignmatrix/agent-validator";

const result = validate(myManifest);
if (!result.valid) {
  for (const error of result.errors) {
    console.error(`${error.path}: ${error.message}`);
  }
}
```

Every error includes a stable `code` you can branch on:

```typescript
type ValidationErrorCode =
  | "missing_required"
  | "type_mismatch"
  | "additional_property"
  | "const_mismatch"
  | "enum_mismatch"
  | "pattern_mismatch"
  | "length_out_of_range"
  | "array_empty";
```

## What it checks

**9 required fields**: `sam`, `slug`, `displayName`, `purpose`, `category`, `version`, `inputs`, `output`, `guarantees`.

**Structural rules**:
- `sam` must equal `"1.0"` (spec version)
- `slug` must match `^[a-z][a-z0-9-]{2,63}$` (kebab-case, 3-64 chars)
- `displayName` 1-60 chars
- `purpose` 1-140 chars
- `category` must be one of 18: Growth, Content, Dev, Finance, HR, Legal, Ecommerce, Research, Cybersec, Real Estate, Gov, Productivity, Creative, Data, A2E, Meta, Integration, Safety
- `version` must be SemVer
- `guarantees` must have ≥1 entry; each 10-300 chars
- No unknown top-level properties (use `extensions` for custom fields)

## Versioning promise

SAM v1.0 is frozen for ≥12 months (April 2026 → April 2027 earliest).

Extensions live in the `extensions` namespace — opt-in, non-supporting runtimes MUST still execute the agent ignoring extension fields.

## License

MIT
