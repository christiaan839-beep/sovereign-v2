# Sovereign Trust Manifest

> An open specification for **agentic-AI trust manifests**. Any vendor
> deploying AI agents to regulated buyers can publish a self-describing
> JSON document at `/.well-known/sovereign-trust` that catalogues their
> trust primitives, audit surfaces, and verification endpoints. Auditors
> and procurement teams curl-verify claims without needing the vendor's
> cooperation.

**Status:** Working Draft 1.0 (April 2026)
**License:** CC BY 4.0 (this spec text); MIT (the JSON Schema)
**Stewards:** Sovereign Matrix as primary author; intent to migrate to a
neutral multi-vendor working group once 3+ implementors are live.

---

## Why this spec exists

As of April 2026, agentic AI platforms make trust claims in marketing
copy ("audit-logged", "policy-bound", "supply-chain-verified") that an
enterprise procurement team cannot mechanically verify. The Sovereign
Trust Manifest defines a public, well-known URL where any vendor can
publish a self-describing JSON document declaring which trust primitives
they implement *and where to verify each claim*.

The manifest is to agentic AI what:

- **`/.well-known/security.txt`** (RFC 9116) is to vulnerability disclosure
- **`/.well-known/openid-configuration`** is to identity providers
- **`robots.txt`** is to web crawlers

A focal point that outsiders can probe with no prior knowledge and no
vendor cooperation.

---

## What's in this repo

```
spec/
├── README.md                              ← you are here
├── SPEC.md                                ← the normative specification
├── GOVERNANCE.md                          ← how this spec evolves
├── CONTRIBUTING.md                        ← how to propose changes
├── LICENSE                                ← CC BY 4.0 + MIT
├── CHANGELOG.md                           ← version history
├── schema/
│   └── sovereign-trust.schema.json       ← JSON Schema (Draft 2020-12)
└── examples/
    └── reference-manifest.json            ← Sovereign Matrix's live manifest
```

---

## Implementor's quick start

To declare your platform compatible with Sovereign Trust Manifest 1.0:

1. **Implement the manifest endpoint.** Serve a JSON document at
   `https://<your-host>/.well-known/sovereign-trust` matching `SPEC.md` §2.
   Validate it against `schema/sovereign-trust.schema.json`.

2. **Publish your verifier surfaces.** For each trust primitive you
   claim to implement, expose a verifier at
   `/api/v1/verify/<surface>` per `SPEC.md` §5.

3. **Provide an offline verifier.** A public npm package, container, or
   binary that reproduces verification math without contacting your
   server. (Sovereign Matrix ships `@sovereign/inspector` as a reference.)

4. **Mark your status honestly.** A capability flag of `true` MUST mean
   the primitive is firing on the live request path AND has an offline
   verifier. If either is missing, the flag MUST be `false`.

That's it. A conforming implementation runs the conformance check in
`SPEC.md` §9.

---

## Why open

This spec is published under CC BY 4.0 (text) and MIT (schema). You
can fork it, implement it, embed it in proprietary systems, or use it
as the basis for derivative specs. Attribution required for the spec
text; the schema has no attribution requirement.

The intent is to migrate stewardship to a neutral multi-vendor working
group when 3+ independent implementors are live. Sovereign Matrix's
role becomes "primary author + reference implementor" rather than
"sole authority."

See `GOVERNANCE.md` for the proposed transition path.

---

## The reference implementation

Sovereign Matrix's own production deployment is the reference:

- **Manifest:** https://sovereignmatrix.agency/.well-known/sovereign-trust
- **Schema:** https://sovereignmatrix.agency/.well-known/sovereign-trust.schema.json
- **Verifier:** https://sovereignmatrix.agency/api/v1/verify/index
- **Inspector:** `npm install -g @sovereign/inspector`
- **Repo:** https://github.com/christiaan839-beep/sovereign-v2
- **Wiring transparency:** https://sovereignmatrix.agency/trust/wiring-status

The reference implementation is *not* required to use the spec — but it
serves as a worked example of every required field, every verifier
surface, and every conformance test pattern.

---

## Citation

Until 1.0 is finalized:

```
"Sovereign Trust Manifest, Working Draft 1.0," Sovereign Matrix,
April 2026. https://sovereignmatrix.agency/docs/SOVEREIGN_TRUST_MANIFEST_SPEC.md
```

After finalization, citations should reference the version-pinned
`$schema` URL declared in the manifest itself.

---

## Antecedents

This spec stands on the shoulders of:

- IETF RFC 8615 — Well-Known URIs
- IETF RFC 9116 — security.txt
- OpenID Foundation — `.well-known/openid-configuration`
- OWASP Agent Security Initiative (ASI) Top 10
- Google Agent-to-Agent Protocol v1.0
- Anthropic Model Context Protocol (MCP)

We are not inventing the discovery pattern. We are applying it to the
trust surface of agentic AI specifically.

---

## Get involved

- File an issue: open an issue against this repo describing your
  implementation question or spec ambiguity.
- Propose a change: see `CONTRIBUTING.md`.
- Discuss the spec: open a discussion thread.

If you publish a `/.well-known/sovereign-trust` manifest at your own
host, let us know — the federation roster benefits from an active list
of implementors.
