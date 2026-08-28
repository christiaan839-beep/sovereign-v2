# @sovereign-matrix/mcp

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Model Context Protocol server** exposing Sovereign Matrix
compliance exporters + receipt verification as tools to Claude Code,
Cursor, Zed, Continue, and any MCP-compatible client.

Receipts in. Regulator-ready reports out. Without leaving your editor.

## Install

```bash
npm install -g @sovereign-matrix/mcp
```

Or run on-demand via `npx`:

```bash
npx -y @sovereign-matrix/mcp
```

## Wire it into Claude Code

Add to your `claude_desktop_config.json` (macOS:
`~/Library/Application Support/Claude/claude_desktop_config.json`,
Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sovereign-matrix": {
      "command": "npx",
      "args": ["-y", "@sovereign-matrix/mcp"]
    }
  }
}
```

Restart Claude. Open the tools palette — you should see 5 new tools
prefixed with `mcp__sovereign-matrix__`.

## Wire it into Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "sovereign-matrix": {
      "command": "npx",
      "args": ["-y", "@sovereign-matrix/mcp"]
    }
  }
}
```

## Tools exposed

| Tool                  | What it does                                                                           |
| --------------------- | -------------------------------------------------------------------------------------- |
| `verify_receipt`      | Structural verification of a signed VAOS receipt envelope                              |
| `build_annex_iv`      | Generate EU AI Act Annex IV technical documentation from receipts                      |
| `build_iso_42001`     | Generate ISO/IEC 42001:2023 AIMS report from receipts (clauses 4-10 + Annex A)         |
| `build_nist_ai_rmf`   | Generate NIST AI RMF 1.0 profile (GOVERN / MAP / MEASURE / MANAGE)                     |
| `build_soc2_evidence` | Generate SOC 2 Trust Service Criteria evidence binder (CC1-CC9 + A1 + PI1 + C1 + P-\*) |

## Example: ask Claude to generate an Annex IV report

```
> @sovereign-matrix Build an Annex IV report from receipts/q2-2026.json
  with this system metadata: { name: "Acme Loan AI", riskCategory:
  "high-risk", ... }

Claude calls mcp__sovereign-matrix__build_annex_iv with the receipts
array + system descriptor, gets back the auditor-ready Markdown,
writes it to ./annex-iv-q2-2026.md.
```

## Why MCP

MCP is the protocol Anthropic shipped in late 2024 that lets Claude
Code (and other clients) call external tools as first-class actions
inside a conversation. Instead of asking the model to _generate_ an
Annex IV report from memory (it will fabricate), the model _calls_
this server which runs the deterministic exporter against your real
receipts and returns the actual bytes.

This is the difference between "Claude wrote some compliance text"
and "Claude operated the compliance pipeline".

## Receipts in your repo

The tools accept VAOS receipts as JSON arrays. Typical pattern: your
repo has a `receipts/` folder with one `.json` file per audit period.
Tell Claude where the receipts live and which exporter to run.

## Peer dependencies

The MCP server is a thin glue layer over the four Sovereign Matrix
exporters. You must have them installed alongside:

```bash
npm install -g \
  @sovereign-matrix/mcp \
  @sovereign-matrix/verifiable-receipts \
  @sovereign-matrix/annex-iv \
  @sovereign-matrix/iso-42001 \
  @sovereign-matrix/compliance
```

Or rely on the `npx` form which resolves them on demand.

## Wire format

JSON-RPC 2.0 over stdio per the MCP spec
([2025-03-26](https://spec.modelcontextprotocol.io/specification/2025-03-26/)).
Zero external SDK dependency — we speak the protocol directly so the
install footprint stays small (just peer deps).

## License

Apache 2.0 © Sovereign Matrix.
