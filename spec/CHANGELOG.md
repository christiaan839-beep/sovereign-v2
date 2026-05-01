# Sovereign Trust Manifest — Changelog

All notable changes to the Sovereign Trust Manifest specification are
documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [1.0.0] — 2026-04-30 (Working Draft)

Initial public release. The spec ships under CC BY 4.0 (text) + MIT
(schema). Reference implementation: Sovereign Matrix at
https://sovereignmatrix.agency.

### Added

- §1 Discovery URL: `/.well-known/sovereign-trust` per RFC 8615
- §2 Document shape: identity, capabilities, platformCapabilities,
  endpoints, verifierSurfaces, verifier, federation, stats
- §3 Capability vocabulary: 18 R-tagged primitives + procurement-readable
  cross-reference
- §4 Endpoint vocabulary: agentCard, verifier, verifierIndex,
  permanence, incidents, diagnose, hitlPolicy, verifyDelegation,
  publicTrace, auditHead, aibom
- §5 Verifier surfaces: 6 standard surfaces (audit-chain, agent-card,
  aibom, scope-evaluation, bridge-authorization, memory-payload)
- §6 Verification posture: load-bearing rule that the instance MUST
  NOT be a required trust anchor
- §7 Federation (informative): peer roster + crawl pattern
- §8 Versioning: semver-pinned `$schema` URL
- §9 Conformance test (informative)
- §10 Acknowledgments: RFC 8615, RFC 9116, OIDC, OWASP ASI, A2A v1.0, MCP
- JSON Schema (Draft 2020-12) for validators
- Reference implementation (Sovereign Matrix)

### Outstanding for v1.1

- Federation crawl semantics (currently informative; promote to
  normative once 2+ implementors live)
- Optional capability extensions for vendor-specific primitives
  (proposed namespace: `x-` prefix per HTTP convention)

---

## Versioning policy

- Backward-compatible additions → minor bump (1.0 → 1.1)
- Removals or breaking changes → major bump (1.x → 2.0)
- Editorial / clarification changes → patch bump (1.0.0 → 1.0.1)

The `$schema` URL declared by an implementor's manifest MUST match the
exact version their document conforms to.

---

## Migration notes

For implementors publishing their first manifest: target v1.0.0. There
is no prior version to migrate from.

For implementors of any future v1.1+ release: backward compatibility
is guaranteed within the major version. Existing v1.0.0 manifests
continue to validate against the v1.1 schema.
