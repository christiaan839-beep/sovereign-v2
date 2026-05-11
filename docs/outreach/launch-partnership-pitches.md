# Launch partnership pitches

Four targeted outreach templates — one each for AI insurance
underwriters, audit firms, standards bodies, and frontier AI labs.

Each is short on purpose. The Loom link does the heavy lifting; the
text is just enough to get the link clicked. Send from a real
human email (not a sales suffix) and use a personal LinkedIn DM
the same day as a second channel.

---

## 1. AI insurance underwriter (Munich Re / Lloyd's / Coalition / Vouch)

**To:** Head of AI Risk / AI Underwriting / Emerging Tech at one of
Munich Re Reinsurance, Lloyd's of London Innovation, Coalition,
Vouch, or Resilience. Find them via LinkedIn — title strings to
search: `"AI risk"`, `"emerging risk"`, `"AI underwriting"`,
`"tech E&O"`.

**Subject:** `AI liability premium discount — cryptographically signed receipts`

**Body:**

```
Hi [FIRST NAME],

Quick pitch. AI agent deployments are uninsurable as a class right
now because there's no audit standard. Underwriters can't price
the risk because they can't see what the model did when something
went wrong.

We built Sovereign Matrix to fix exactly that. Every AI agent run
produces a cryptographically signed receipt — input, output, model
used, safety check results, HMAC + Ed25519 verified. The format is
public domain (VAOS 1.0). The verifier is open source.

The pitch: customers who can produce VAOS-signed receipts qualify
for a tech-E&O premium discount. We license the verification API,
you write policies on a substrate you can actually price.

90s demo (no signup): [LOOM URL]
Spec: sovereignmatrix.agency/spec

Worth 30 minutes? We have one SA financial-services design partner
already using the platform and can introduce.

[YOUR NAME]
Sovereign Matrix
```

**Send order:** Munich Re first (largest AI-risk practice), Coalition
second (most forward-leaning on tech-E&O innovation), Lloyd's third.
After 30 days of no replies from any, add Beazley and Hiscox.

**Conversion target:** 1 in 8 sends responds. 1 in 4 responses
converts to a 30-min call. 1 in 10 calls converts to a signed
underwriting pilot. So 320 sends = 1 pilot. Outsized payoff if it
clicks; outreach cost is meaningful.

---

## 2. Audit / advisory firm (Mazars / Grant Thornton / RSM / BDO)

**To:** AI Practice Lead / Head of Tech Assurance / Partner for
Digital Trust at one of:

- Mazars SA (technology assurance practice)
- Grant Thornton SA (digital advisory)
- RSM (innovation team)
- BDO South Africa (cyber + AI assurance)
- Forvis Mazars Global (AI risk advisory)

LinkedIn title strings: `"AI assurance"`, `"tech assurance"`,
`"digital advisory"`, `"AI governance"`, `"AI risk lead"`.

**Subject:** `New AI-audit engagement category — partnership pitch`

**Body:**

```
Hi [FIRST NAME],

Big4 don't have AI audit capability yet. The mid-tier firms have a
window to build it before they do — and AI audit is going to be a
major SOC2 / ISO 42001 / EU AI Act adjacent practice over the next
three years.

We built the verification substrate: a public-domain format for
cryptographically signed AI agent receipts (VAOS 1.0), an
open-source verifier, a hosted issuer platform, and an evidence
bundle export that drops directly into an audit working paper.

The pitch: we license [FIRM NAME] the verification stack + train
your auditors on AI-trail review. You sell the engagement.
Recurring revenue per audit client, with us as the technology
substrate.

Live demo (no signup): [LOOM URL]
Audit-bundle example: sovereignmatrix.agency/verified
SOC2 controls map (showing 80% of CC1-CC9 already evidenced):
  sovereignmatrix.agency/[link to docs/soc2-controls.md]

30 minutes to walk through? We can demo the auditor workflow
end-to-end.

[YOUR NAME]
Sovereign Matrix
```

**Send order:** Mazars SA first (most innovation-friendly, mid-tier
SA presence). Grant Thornton SA second. Then Forvis Mazars Global
if you want to test the global angle. RSM and BDO are slower.

**Conversion target:** 1 in 5 sends responds (mid-tier firms reply
more readily than insurance). 1 in 3 responses converts to a 30-min
call. 1 in 6 calls converts to a paid scoping engagement. So 90
sends = 1 scoping deal.

---

## 3. Standards body (W3C / IETF / NIST)

**To, in order of priority:**

- W3C Web of Things Working Group + JSON-LD Working Group
- IETF httpapi@ietf.org (mailing list, not direct individual)
- NIST AI Safety Institute (`nist-aisi@nist.gov`)
- ISO/IEC JTC 1/SC 42 (Artificial Intelligence committee)

**Subject (W3C / IETF):** `VAOS 1.0 — proposal: open spec for verifiable AI agent receipts`
**Subject (NIST):** `EO 14110 audit-trail candidate format — submission`

**Body (W3C / IETF version):**

```
Greetings [working group / list],

Submitting for consideration: VAOS 1.0 (Verifiable Agent Output
Specification) — an open, public-domain format for cryptographically
signed AI agent receipts.

Specification:
  https://sovereignmatrix.agency/spec/vaos-1.0.md
Reference implementation:
  https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/vaos-verifier
  (MIT, zero deps, Node + browser + edge runtimes)
Live verifier endpoint:
  POST https://sovereignmatrix.agency/api/verify

Motivation: AI agent platforms today have no portable, third-party-
verifiable audit-trail format. Regulators in the EU (AI Act Art. 12),
South Africa (POPIA s.71), and elsewhere increasingly require
explainability + tamper-evidence for automated decisions. Without a
standard format, every platform invents its own, every audit tool
re-implements per-vendor verification, and cross-vendor portability
is impossible.

VAOS 1.0 defines: canonical JSON projection (deterministic key
ordering), HMAC-SHA256 v1 + Ed25519 v2 signature envelopes, public
HTTP verification API, threat model, conformance test vectors, and
versioning policy.

We've open-sourced the spec under CC0 and the verifier under MIT.
We are not seeking control over the format — we're seeking to
contribute it to whichever working group is the right home.

Happy to present at a working group call, file a draft, or
respond to design-review comments.

[YOUR NAME]
[YOUR TITLE]
spec@sovereignmatrix.agency
```

**Conversion target:** Standards-body responses are slow (weeks to
months). One "we'd like to schedule a presentation" reply from any
of the four = success at this stage. Track silently; don't follow
up more than once per quarter.

---

## 4. Frontier AI lab public policy (Anthropic / OpenAI / Google / Meta)

**To:**

- Anthropic Public Policy team — find via their published policy
  papers + LinkedIn (`Anthropic` × `policy`)
- OpenAI policy team (`policy` × `OpenAI`)
- Google AI public policy
- Meta AI policy

**Subject:** `Open spec for AI agent receipts — endorsement ask`

**Body:**

```
Hi [FIRST NAME],

We've published a public-domain specification for cryptographically
signed AI agent receipts — VAOS 1.0. The intent is to give the
ecosystem a portable, third-party-verifiable audit-trail format,
satisfying the audit-log requirements in EU AI Act Art. 12 and
similar regulations.

Specification (CC0):
  https://sovereignmatrix.agency/spec/vaos-1.0.md
Reference verifier (MIT, zero deps):
  npm install @sovereign-matrix/vaos-verifier (publishing this week)
Live demo:
  https://sovereignmatrix.agency/verified

Endorsement ask: would [ANTHROPIC/OPENAI/GOOGLE/META] consider any
of the following?

  (a) A public statement that VAOS 1.0 is a reasonable candidate
      format for AI agent audit trails.
  (b) Adding VAOS-compatible receipt emission as an optional output
      mode in your agent SDK / API.
  (c) Co-authoring a v2 revision (Ed25519 → asymmetric attestation
      → hardware attestation).

We are not seeking exclusive control. The format is intentionally
unencumbered. If you see a path to making this an ecosystem-wide
norm, we'd love to coordinate.

Happy to brief on a call.

[YOUR NAME]
Sovereign Matrix
spec@sovereignmatrix.agency
```

**Send order:** Anthropic first (most public-policy-receptive),
OpenAI second, Google third, Meta last. Two-week wait between
sends — don't shotgun.

**Conversion target:** A reply from Anthropic Public Policy is worth
10× a reply from any audit firm. Pure expected value. Don't expect
fast turnaround — these teams operate on quarters, not weeks.

---

## Cross-cutting reminders

- **Never send the same person more than 2 follow-ups.** Three
  ignored emails = noise. Move on.
- **Always link the Loom + `/verified` + `/spec`.** The text is
  bait; the proof is at the URLs.
- **Personalize the first sentence.** "I see [SPECIFIC THING]"
  outperforms generic openings 5×.
- **Send Monday or Tuesday morning local time.** Friday afternoon
  sends get buried.
- **Track in a spreadsheet, not a CRM.** A CRM is overkill at
  <100 sends and adds friction.
- **Stop sending when you've talked to 5 buyers.** That's enough
  signal to know if the wedge is real. Going past 50 sends with
  zero replies is a pivot signal, not an iteration signal.
