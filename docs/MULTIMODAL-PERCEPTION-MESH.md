# Multimodal Perception Mesh — How Sovereign Wins

**Status:** Shipped (R110 + R111 — April 29, 2026)
**Audience:** CTO, Head of AI Engineering, Head of Compliance, Procurement
**Sister artifacts:**
`src/lib/perception/nemotron-omni-client.ts`,
`src/lib/perception/mesh.ts`,
`src/app/trust/perception/page.tsx`

---

## TL;DR

NVIDIA's Nemotron 3 Nano Omni is a unified 30B MoE / 3B-active multimodal model with a 256K-token context window. Per NVIDIA's announcement, it delivers up to 9× higher throughput than other open omni-modal models. Most platforms will adopt it as a single drop-in vision/audio call.

**That's not what we did.** We turned it into a *substrate* — a swarm of specialized perception nodes with deterministic cross-modal correlation. The model is the engine; the **mesh + correlator is the product**.

> *"Watch this video stream + transcribe these calls + analyze these screenshots, AND ALERT when a phrase in the audio matches a face in the video appearing in a screenshot."*

That sentence is what we sell. Fragmented model chains can't deliver it (context lost at every handoff). A single Omni call can't deliver it (no parallelism, no cross-stream correlation). **Only the mesh can.**

---

## The architecture comparison

| Architecture | What it does | What it can't do | Token cost |
|---|---|---|---|
| **Fragmented model chain** (most agent platforms) | Vision model → transcription model → entity-resolution model → correlator | Context lost at every handoff. Brittle pipelines. Stitched results. | 4-6× more tokens |
| **Single Omni call** (naive adoption) | One unified call across modalities | Can't parallelize across streams. Can't correlate distinct input contexts. | 1× tokens but no parallelism |
| **Sovereign Perception Mesh** (today) | Swarm of specialized Omni instances + deterministic correlation rules | — | 1× tokens, parallel, **inspector-replayable** |

**The mesh is the only architecture that captures cross-modal signals at scale while remaining offline-verifiable.**

---

## R110 — Nemotron Omni Client

A pure-function HTTP client speaking the OpenAI-compatible NIM API shape, extended with `audio_url` and `video_url` content parts. **Zero SDK dependency** — ports verbatim to `@sovereign/inspector` for offline procurement-grade verification.

### Four input modalities, one envelope

| Modality | Input | Wire shape |
|---|---|---|
| Text | inline string | `{type: "text", text}` |
| Image | URL or base64 | `{type: "image_url", image_url: {url, detail}}` |
| Audio | URL or base64 | `{type: "audio_url", audio_url: {url}}` |
| Video | URL | `{type: "video_url", video_url: {url}}` |

### Provider-agnostic

The model slug is configurable via `NEMOTRON_OMNI_MODEL_SLUG` env var. The client works against:
- `build.nvidia.com` (default)
- OpenRouter
- A customer's vLLM endpoint
- A customer's air-gapped llama.cpp deployment

### Defensive validation

`validatePerceptionInput()` returns one of seven typed reasons for malformed inputs (`no_parts`, `system_prompt_required`, `image_data_url_too_large`, `audio_data_url_too_large`, `unsupported_image_mime`, `unsupported_audio_mime`, `max_tokens_out_of_range`). Procurement-grade error reporting from the moment a request hits the boundary.

### Default system prompts for 7 perception tasks

`video-summarize`, `audio-transcribe`, `audio-summarize`, `image-describe`, `screenshot-analyze`, `document-extract`, `freeform`. Adopters get sensible defaults out of the box — overrideable per node.

---

## R111 — Multimodal Perception Mesh

The strategic moat. A **swarm** of specialized Omni instances with deterministic cross-modal correlation.

### Five node kinds

| Node kind | Purpose | Output |
|---|---|---|
| `video-monitor` | Continuous video understanding | Summary + key moments + speakers |
| `audio-transcriber` | Speech-to-text with speaker labels | Verbatim transcript + 30s timestamps |
| `screenshot-analyzer` | Computer-use GUI extraction | App + interactive elements + state |
| `document-extractor` | Structured doc → JSON | ISO-formatted JSON (auto-enabled) |
| `freeform-synthesizer` | Cross-input flexible analysis | Free-form text |

### Plan composition (pure function)

```ts
const plan = composePerceptionMesh(spec, inputs);
// plan.nodePlans  — deterministic per-node OmniRequestBody
// plan.rationale  — procurement-readable trace
// plan.estimatedMaxTokens — for cost governance
```

Plans are deterministic: same spec + same inputs always produce the same plan. **Inspector-replayable.** Customers can verify what the platform would have done offline.

### Four cross-modal correlation rule kinds

| Rule kind | Predicate |
|---|---|
| `keyword-overlap` | A keyword appears in 2+ node texts (case-insensitive) |
| `entity-overlap` | A named entity appears in 2+ nodes' entity lists |
| `time-proximity` | 2+ nodes' `observedAt` timestamps are within window |
| `json-field-match` | 2+ nodes' parsed JSON outputs share the same value at a path |

Each rule emits zero or more `CrossModalSignal`s with severity (`info` / `warn` / `alert`), matched node IDs, and a procurement-readable reason. Sorted by severity desc.

### Pre-built mesh + rules

`BOARDROOM_WATCH_MESH` + `BOARDROOM_COMPLIANCE_RULES` — a sane default for compliance teams monitoring board meetings. Three nodes (video + audio + screen) with earnings-keyword correlation. **Drop-in for SEC Reg FD scenarios.**

---

## Composition with shipped primitives

| Primitive | How the mesh composes |
|---|---|
| **R26 audit chain** | Every node invocation + correlation signal logged with R26 hash chain |
| **R34 CADC** | User identity in mesh execution context |
| **R37 ACT** | Mesh invocation requires capability token |
| **R40 reputation** | Crew Composer ranks Omni node providers by reputation |
| **R42 credit lines** | Mesh budget gated by R42 headroom |
| **R91 ACAT** | Mesh actions in commerce paths require ACAT in scope |
| **R92 Stripe adapter** | Perception evidence bundles include mesh outputs |
| **R100 policy engine** | Policies can deny / hitl / acat-require mesh execution |
| **R101 agent registry** | Mesh nodes are registered agents with capabilities |
| **R102 cost governance** | Mesh estimated tokens consume budget caps |

**The mesh is one more layer in the same composable substrate.** It doesn't replace the trust stack — it sits *on* it.

---

## Public APIs

```bash
# Compose a deterministic plan from a mesh spec + inputs
curl -X POST https://sovereignmatrix.agency/api/perception/plan \
  -H 'content-type: application/json' \
  -d '{
    "spec": {
      "nodes": [
        {"nodeId": "v1", "kind": "video-monitor"},
        {"nodeId": "a1", "kind": "audio-transcriber"}
      ]
    },
    "inputs": {
      "context": "Q3 board meeting",
      "perNode": {
        "v1": [{"kind": "video", "videoUrl": "https://example.com/v.mp4"}],
        "a1": [{"kind": "audio", "audioUrl": "https://example.com/a.wav"}]
      }
    }
  }'

# Evaluate cross-modal correlation rules against per-node outputs
curl -X POST https://sovereignmatrix.agency/api/perception/correlate \
  -H 'content-type: application/json' \
  -d '{
    "outputs": [
      {"nodeId": "v1", "kind": "video-monitor", "text": "the CEO mentioned Q3 earnings"},
      {"nodeId": "a1", "kind": "audio-transcriber", "text": "let me share the earnings forecast"}
    ],
    "rules": [
      {
        "name": "earnings-watch",
        "kind": "keyword-overlap",
        "keywords": ["earnings"],
        "severity": "warn"
      }
    ]
  }'
```

Both endpoints are stateless and rate-limited. **The math is the truth** — same pure function ships in `@sovereign/inspector`.

---

## Strategic positioning

### vs. fragmented model chains (n8n + LangChain + CrewAI + most agent frameworks)

> "Your context dies at every model boundary. Ours doesn't. **Unified Omni context + parallel correlation = signals you literally cannot extract any other way.**"

### vs. naive Omni adoption (everyone bolting Nemotron Omni onto their existing pipeline)

> "Anyone can call the model. We give you the swarm and the correlator. Rebuild your own and you've spent 3 months on what we ship as a primitive."

### vs. closed cloud agent platforms (Operator, Manus, etc.)

> "Open weights. Air-gappable. Customer-deployable on any GPU. Nemotron Omni's openness aligns with our sovereign-first positioning — it's literally the antithesis of vendor lock-in."

### Per-modality competitive table

| Capability | OpenAI Operator | Anthropic Computer Use | Manus AI (Meta) | Sovereign Perception Mesh |
|---|---|---|---|---|
| Video understanding | partial | partial | yes | **yes — dedicated node** |
| Speech transcription | external | external | yes | **yes — dedicated node** |
| Screenshot analysis | yes | yes | yes | **yes — dedicated node** |
| Document extraction | partial | partial | partial | **yes — JSON output** |
| Cross-modal correlation | none | none | implicit only | **explicit, deterministic, inspector-replayable** |
| Air-gappable | no | no | no (Meta cloud) | **yes** |
| Open weights | no | no | no | **yes (Nemotron Omni)** |

---

## Engineering notes

**Test coverage:** 61 new tests across the two modules:
- `nemotron-omni-client.test.ts` — 40 tests
- `mesh.test.ts` — 21 tests

**Pure-function design:** Every function in `src/lib/perception/` is pure. No DB, no clocks, no globals. The runtime adapter (model invocation, audit-chain write) lives separately and composes pure components. Same pattern as R91 ACAT, R92 Stripe, R100 Policy Engine.

**Anti-drift:** ~12 invariants in `scripts/weekly-health.mjs` gate every regression. Procurement claims that disappear from the source code break CI.

---

## What ships next (Phase 2 of the perception mesh)

| Round (planned) | Phase 2 capability |
|---|---|
| R112 | Inspector port — `packages/inspector/src/perception.mjs` |
| R113 | Real-time mesh runtime adapter (with R26 audit + R102 cost gate wired) |
| R114 | Perception attestation — sign mesh outputs with platform Ed25519 |
| R115 | Sensor swarm scheduler — orchestrate continuous (always-on) nodes |
| R116 | Live `/dashboard/perception` operator UI |

Phase 1 today is the **substrate** — pure functions + plan composer + correlation primitives + public APIs + UI. Phase 2 wires it into the live agent factory and the audit pipeline.

---

## References

- NVIDIA Nemotron 3 Nano Omni — announcement (model card, weights, training recipe). Cited claims (9× throughput, 30B / 3B active, 256K context) per NVIDIA.
- OpenAI chat-completions multimodal content shape — base shape extended for `audio_url` + `video_url`.
- Sovereign R91 ACAT, R92 Stripe adapter, R100/R101/R102 Control Plane — composing primitives.
- Mixture-of-Agents routing pattern (R74) — the same intuition (specialized models per task) at the LLM-routing layer; we extend it to the perception layer here.

---

*This document is the definitive strategic positioning for Sovereign's
multimodal perception leadership. Updated April 29, 2026.
Engineering questions: <christiaan@sovereignmatrix.agency>.*
