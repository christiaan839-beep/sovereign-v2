# NVIDIA — partnership brief

**Primary doors:** NVIDIA Inception (free, small-team friendly) +
NIM Connect (co-marketing + GPU credits) + NVIDIA Healthcare AI
summit speaking slot.

**Email contacts:**

- Inception: apply at `nvda.ws/inception`
- NIM Connect: `nim-partnerships@nvidia.com`
- Healthcare AI: `healthcare@nvidia.com`

**Subject:** Apache-2.0 receipt + audit layer for NIM-served
regulated AI (FDA SaMD + PCCP + 7 healthcare jurisdictions)

---

## Why this matters to NVIDIA

NVIDIA NIM is becoming the default inference layer for regulated AI
verticals — healthcare, finance, defense. Every regulated buyer
needs an answer to the "audit + receipt" question that NVIDIA
itself doesn't ship.

Sovereign Matrix is the **Apache-2.0 receipt + audit layer that
makes NIM-served calls regulator-defensible** with zero vendor
lock-in. We already route LlamaGuard + Nemotron-Ultra + Mistral
Large 2 + Qwen 2.5 Coder via NIM as our default free-inference
tier (per `src/lib/ai.ts:89`).

## What we've shipped that matters to NVIDIA's healthcare GTM

- **`fdaSaMDPack`** — FDA SaMD + AI/ML Action Plan + 21 CFR §807.87
- **`fdaPccpPack`** — FDA PCCP Final Guidance (Dec 2024) for
  continuous-learning medical AI
- **`hipaaPack`** — 45 CFR §164.514 Safe Harbor with PII detection
- **`ambientScribePack`** — HIPAA min-necessary + 21st Century Cures
  Act + AMA Augmented Intelligence (the ambient scribe market is
  $8.2B → $24B by 2030)
- **`industrialFoundationPack`** — ISA-95 + IEC 62443 for the
  Industrial Foundation Model (Omniverse-adjacent) ecosystem

Plus: every NIM call we make is wrapped in our 5-layer output
verifier (LlamaGuard + regex-PII + content policy + quality + critic).

## What we're asking for

In order of escalating ask:

1. **NVIDIA Inception acceptance** (free, ~2-week process). Gets us
   DGX Cloud credits + co-marketing eligibility.
2. **NIM Connect listing** — Sovereign Matrix as the canonical
   Apache-2.0 receipt layer for NIM-served regulated AI. PR-ready;
   we already use NIM as our default inference provider.
3. **Speaking slot at NVIDIA Healthcare AI summit 2026** — 20-min
   technical talk + demo: "Audit-grade FDA SaMD AI on NIM with
   open-source post-quantum receipts." Our FDA SaMD + PCCP packs
   are direct fit.
4. **Joint case study with one NIM healthcare customer** — e.g. a
   radiology-AI vendor using Nemotron-Ultra via NIM + Sovereign
   Matrix receipts to satisfy FDA PCCP drift-monitoring requirements.

## Proof links

- npm: `@sovereign-matrix/verifiable-receipts`
- GitHub: `christiaan839-beep/sovereign-v2` (Apache 2.0)
- Live NIM-routing demo: `https://sovereignmatrix.agency/` (every
  agent run prefers NIM inference)
- FDA SaMD pack: `packages/verifiable-receipts/src/packs.ts` lines
  ~1000-1070
- FDA PCCP pack: same file lines ~1470-1540

## Contact

Christiaan de Wet · Cape Town, South Africa
`christiaan@sovereignmatrix.agency`

Happy to do a 15-min NIM-routing + receipt-mint demo on a Zoom.
