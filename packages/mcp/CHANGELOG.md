# Changelog

All notable changes to `@sovereign-matrix/mcp` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. Model Context Protocol server exposing the Sovereign Matrix
compliance exporters + receipt verification as callable tools to Claude
Code, Cursor, Zed, Continue, and any MCP-compatible client.

### What this is

A thin glue layer (zero external SDK dependency) that speaks JSON-RPC 2.0
over stdio per the MCP specification 2025-03-26 and exposes every Sovereign
Matrix exporter as a Claude-callable tool. Converts "Claude wrote some
compliance text" into "Claude operated the compliance pipeline against your
real receipts."

### Tools exposed (12 total)

1. `verify_receipt` — structural verification of a signed VAOS bundle
2. `build_annex_iv` — EU AI Act Annex IV technical documentation
3. `build_iso_42001` — ISO/IEC 42001:2023 AIMS report
4. `build_nist_ai_rmf` — NIST AI RMF 1.0 profile
5. `build_soc2_evidence` — SOC 2 Trust Service Criteria binder
6. `build_gdpr_dpia` — GDPR Article 35 DPIA + Article 30 RoPA
7. `build_hipaa_security` — HIPAA Security Rule (45 CFR § 164) binder
8. `build_iso_23894` — ISO/IEC 23894:2023 AI risk management
9. `build_eu_cra` — EU Cyber Resilience Act compliance
10. `build_constitution_audit` — audit receipts against a signed AI constitution
11. `buildConstitution_create` — sign a new AI constitution

### Added

- JSON-RPC 2.0 dispatcher with `initialize`, `tools/list`, `tools/call`,
  `ping` methods.
- stdio transport (no external SDK).
- Per-tool input schemas with JSON Schema documentation strings.
- Uncaught-exception handler surfaces fatal errors on stderr so the host
  MCP client can display them.
- `bin/sovereign-matrix-mcp` entry for `npx -y @sovereign-matrix/mcp` use
  from any MCP-compatible client config.

### Peer dependencies

- `@sovereign-matrix/verifiable-receipts >= 0.3.0`
- `@sovereign-matrix/annex-iv >= 0.1.0`
- `@sovereign-matrix/iso-42001 >= 0.1.0`
- `@sovereign-matrix/iso-23894 >= 0.1.0`
- `@sovereign-matrix/nist-ai-rmf >= 0.1.0`
- `@sovereign-matrix/soc2-evidence >= 0.1.0`
- `@sovereign-matrix/gdpr-dpia >= 0.1.0`
- `@sovereign-matrix/hipaa-security >= 0.1.0`
- `@sovereign-matrix/eu-cra >= 0.1.0`
- `@sovereign-matrix/ai-constitution >= 0.1.0`

### Documentation

- README with `claude_desktop_config.json` + `.cursor/mcp.json` wiring
  snippets.
- "Example: ask Claude to generate an Annex IV report" prompt walkthrough.

### Distribution context

The MCP installation is one config-edit away for every Claude Code /
Cursor / Zed user worldwide. Largest single distribution multiplier in
the Sovereign Matrix stack.
