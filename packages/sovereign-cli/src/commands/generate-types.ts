/**
 * `sovereign generate-types <path>`
 *
 * Reads a SAM manifest and emits a TypeScript type describing the
 * agent's output shape. Enables type-safe integration — downstream
 * code that invokes a marketplace agent can import the generated
 * type and get IntelliSense / tsc checks on the result.
 *
 * Where the shape comes from (in order of preference):
 *   1. manifest.extensions.outputSchema — a JSON Schema describing
 *      the full output object (SAM 1.1 extension, backwards-compatible)
 *   2. manifest.output.properties — if the SAM 1.0 `output` field
 *      already carries properties (some agents do), use them
 *   3. Fall back to a generic `unknown` type, plus a comment pointing
 *      the creator to add outputSchema for type safety
 *
 * Output is written to stdout by default, or to --out <path> if
 * specified.
 */

import type { CommandResult, FileSystem } from "../types.js";

export interface GenerateTypesArgs {
  path: string | undefined;
  outPath?: string;
  fs: FileSystem;
  /** Optional write-to-disk hook. Only used when outPath is set. */
  writeTextFile?: (path: string, content: string) => Promise<void>;
}

/* ─── JSON Schema → TypeScript (tiny subset) ──────────────────── */

interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  enum?: unknown[];
  description?: string;
  additionalProperties?: boolean | JsonSchemaNode;
}

function primitiveType(t: string | undefined): string {
  if (t === "string") return "string";
  if (t === "number" || t === "integer") return "number";
  if (t === "boolean") return "boolean";
  if (t === "null") return "null";
  return "unknown";
}

function schemaToTs(node: JsonSchemaNode | undefined, indent = 0): string {
  if (!node || typeof node !== "object") return "unknown";

  const pad = "  ".repeat(indent);
  const innerPad = "  ".repeat(indent + 1);

  if (Array.isArray(node.type)) {
    const parts = node.type.map((t) => primitiveType(t));
    return parts.join(" | ");
  }

  if (node.enum && node.enum.length > 0) {
    return node.enum
      .map((v) => (typeof v === "string" ? JSON.stringify(v) : String(v)))
      .join(" | ");
  }

  if (node.type === "object" || node.properties) {
    const props = node.properties ?? {};
    const required = new Set(node.required ?? []);
    const keys = Object.keys(props);
    if (keys.length === 0) {
      return "Record<string, unknown>";
    }
    const lines = keys.map((k) => {
      const optional = required.has(k) ? "" : "?";
      const desc = props[k]?.description
        ? `${innerPad}/** ${String(props[k]?.description).slice(0, 200)} */\n`
        : "";
      return `${desc}${innerPad}${JSON.stringify(k)}${optional}: ${schemaToTs(props[k], indent + 1)};`;
    });
    return `{\n${lines.join("\n")}\n${pad}}`;
  }

  if (node.type === "array") {
    const inner = schemaToTs(node.items, indent);
    // Wrap unions so "(string | number)[]" not "string | number[]"
    return /[|&]/.test(inner) ? `Array<${inner}>` : `${inner}[]`;
  }

  return primitiveType(typeof node.type === "string" ? node.type : undefined);
}

/* ─── Manifest shape extraction ───────────────────────────────── */

interface ExtensionsOutputSchema {
  outputSchema?: JsonSchemaNode;
  [key: string]: unknown;
}

function extractOutputSchema(manifest: Record<string, unknown>): {
  source: "extensions" | "output.properties" | "fallback";
  schema: JsonSchemaNode | null;
} {
  // 1. Preferred: SAM 1.1 extension.
  const extensions = manifest.extensions;
  if (
    extensions &&
    typeof extensions === "object" &&
    !Array.isArray(extensions)
  ) {
    const ext = extensions as ExtensionsOutputSchema;
    if (ext.outputSchema && typeof ext.outputSchema === "object") {
      return { source: "extensions", schema: ext.outputSchema as JsonSchemaNode };
    }
  }

  // 2. Fallback: SAM 1.0 output.properties (some agents already have it).
  const output = manifest.output;
  if (
    output &&
    typeof output === "object" &&
    !Array.isArray(output) &&
    "properties" in output
  ) {
    return { source: "output.properties", schema: output as JsonSchemaNode };
  }

  return { source: "fallback", schema: null };
}

/* ─── Public API ──────────────────────────────────────────────── */

export async function runGenerateTypes(
  args: GenerateTypesArgs,
): Promise<CommandResult> {
  if (!args.path) {
    return {
      kind: "failure",
      exitCode: 3,
      message: "Usage: sovereign generate-types <path-to-manifest.json> [--out <file.ts>]",
    };
  }

  let rawText: string;
  try {
    rawText = await args.fs.readTextFile(args.path);
  } catch (err) {
    return {
      kind: "failure",
      exitCode: 3,
      message: `Cannot read file: ${args.path}`,
      details: { cause: err instanceof Error ? err.message : String(err) },
    };
  }

  let manifest: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        kind: "failure",
        exitCode: 3,
        message: "Manifest must be a JSON object.",
      };
    }
    manifest = parsed as Record<string, unknown>;
  } catch (err) {
    return {
      kind: "failure",
      exitCode: 3,
      message: `File is not valid JSON: ${args.path}`,
      details: { cause: err instanceof Error ? err.message : String(err) },
    };
  }

  const slug = typeof manifest.slug === "string" ? manifest.slug : "Agent";
  const typeName = slugToPascalCase(slug) + "Output";

  const { source, schema } = extractOutputSchema(manifest);

  const header = `// Generated by \`sovereign generate-types\` — do not edit by hand.
// Source: ${args.path}
// Agent: ${slug}
// Derivation: ${source}
`;

  const body =
    schema === null
      ? `// No output schema present. Add \`extensions.outputSchema\` to your manifest
// for type-safe output. Falling back to \`unknown\`.
export type ${typeName} = unknown;
`
      : `export interface ${typeName} ${schemaToTs(schema)}\n`;

  const tsOutput = header + "\n" + body;

  if (args.outPath && args.writeTextFile) {
    await args.writeTextFile(args.outPath, tsOutput);
    return {
      kind: "success",
      message: `Wrote ${typeName} to ${args.outPath}`,
      data: { typeName, outPath: args.outPath, source, bytes: tsOutput.length },
    };
  }

  return {
    kind: "success",
    message: tsOutput,
    data: { typeName, source, bytes: tsOutput.length },
  };
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function slugToPascalCase(slug: string): string {
  return slug
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}
