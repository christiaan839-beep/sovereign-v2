# ai-act-receipts

Signed receipts around your Claude calls, and the EU AI Act Annex IV technical documentation that comes out the other end.

Also an MCP server, so you can do it from inside Claude Code.

Zero runtime dependencies. Node 18+. Apache-2.0.

```bash
npm install ai-act-receipts
```

---

## What it does, in one run

```js
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import {
  mintMessageReceipt, euAiActPack, composePacks,
  projectRecords, buildAnnexIv, toMarkdown,
} from "ai-act-receipts";

const { privateKey } = generateKeyPairSync("ed25519");
const sign = (c) => "v2=" + edSign(null, Buffer.from(c), privateKey).toString("base64");

// 1. MINT — wrap a Claude call in a signed receipt.
const receipt = await mintMessageReceipt(await client.messages.create({ … }), {
  sign,
  agentSlug: "candidate-screener",
  runId: "run_01HXX",
  rules: composePacks(euAiActPack),
});

// 2. PROJECT — bring in logs you already have. No format change.
const { records, skipped } = projectRecords(rowsFromYourDatabase);

// 3. EXPORT — Article 11 technical documentation.
const report = buildAnnexIv({
  system: {
    name: "Acme Candidate Screener",
    identifier: "acme-cs-001",
    riskCategory: "high-risk",
    provider: "Acme Recruiting (Pty) Ltd",
    intendedPurpose: "Rank applicants against posted role criteria.",
    placedOnMarketAt: "2026-03-01",
  },
  receipts: [receipt, ...records],
});

console.log(toMarkdown(report));
```

`examples/quickstart.mjs` is the above with a literal message instead of an API
call, so it runs offline with no key:

```console
$ npm run build && npm run example

1. MINT
   verdict  : pass
   rules run: eu-ai-act-art13-ai-disclosure, eu-ai-act-art14-human-oversight-handoff, eu-ai-act-art15-accuracy-attestation
   signature: v2=MMVIaOgiDUiQlyvKV807/A6HWmDrN…

2. PROJECT
   projected: 2
   skipped  : #2 timestamp "not a date" is not a date

3. EXPORT
   sections : 13
   markdown : 3831 bytes
   operator gaps: 6
```

---

## Start with step 3

You do not have to adopt anything to get value out of this. `ReceiptRecord`
needs exactly three fields — an id, a timestamp, and an outcome — and everything
else you carry is preserved untouched. So the fastest way to find out whether
this is useful is to point `projectRecords()` at last quarter's logs and read
the document it produces.

Only if that document looks worth filing does step 1 become worth the code change.

`projectRecords()` auto-detects the usual field names (`request_id`, `trace_id`,
`created_at`, `timestamp`, `status`, `outcome`, …), infers epoch seconds vs.
milliseconds vs. microseconds from magnitude, and normalises the outcome
vocabularies real logs use (`ok`, `denied`, `2xx`, `failed`). Give it an explicit
mapping when the guess is wrong:

```js
projectRecords(rows, {
  id: "meta.request_id",              // dotted paths work
  issuedAt: "created_at",
  verdict: (row) => row.blocked ? "block" : "pass",   // or a function
  agentSlug: "model",
  carry: ["tenant", "cost_usd"],      // extra fields to keep
});
```

**Rows it cannot project are reported, never dropped.** You get back
`{ records, skipped, scanned }`, where every `skipped` entry carries the row
index and the reason. Evidence you quietly discarded is worse than evidence you
never had. Pass `onInvalid: "throw"` to make it fatal instead.

---

## MCP server

```json
{
  "mcpServers": {
    "ai-act-receipts": {
      "command": "npx",
      "args": ["-y", "ai-act-receipts"]
    }
  }
}
```

Three tools, which compose in this order:

| Tool | In | Out |
|---|---|---|
| `project_records` | any array of log rows | records + a report of what was skipped and why |
| `verify_receipt` | a signed attestation + Ed25519 public key | `ok`, or the specific reason it failed |
| `build_annex_iv` | records + system description | Annex IV, Markdown or JSON |

Then, in Claude Code:

> Read `logs/august.json`, project it, and build me the Annex IV document for
> the candidate screener.

The server speaks JSON-RPC 2.0 over stdio directly — no SDK dependency, 423
lines you can read in one sitting. It makes no network calls and touches no
paths you did not pass it.

---

## What this is not

**It does not make anyone compliant.** It produces documentation. Filing that
documentation, and the far larger question of whether your system satisfies
Articles 9–15, remains yours.

**It does not decide whether your system is high-risk.** You tell it that.
Annex III classification is a legal judgement about your deployment context, and
a library that guessed would be worse than useless.

**Four of the nine Annex IV sections are machine-derivable. Five are not.**
§3 (monitoring), §4 (performance metrics), §6 (lifecycle changes) and §9
(post-market monitoring) come from your records. §1, §2, §5, §7 and §8 are
organisational narrative, and the exporter emits an explicit
`**OPERATOR-AUTHORED**` stub carrying the clause each must satisfy — rather than
generating plausible-looking filler. A document with honest gaps is filable. One
with invented content is a liability.

**Attested and projected records are not equal evidence, and the document says
so.** A minted receipt carries a signature over a canonical projection that a
third party can re-derive against your public key. A record projected from your
logs asserts only what your logging pipeline asserted. Every report carries an
`evidentiaryBasis` split and, when any record is unsigned, a caveat naming the
count in the document itself.

**The Guardian rules are heuristics over text, not a compliance check.** The
`euAiActPack` catches three mechanically-detectable failure modes: a high-risk
output that never discloses it came from an AI (Art. 13/50), one with no route
to a human (Art. 14), one with no accuracy claim (Art. 15). A `pass` means those
three checks found nothing — not that the output is lawful.

**Verify the enforcement timeline yourself before you plan around it.** The AI
Act's obligations phase in on dates that have been subject to amendment
proposals. Do not take a date from this README; check the current text.

---

## API

| | |
|---|---|
| `mintMessageReceipt(message, opts)` | Anthropic message → signed `GuardianAttestation` |
| `withReceipt(promise, opts)` | same, wrapping an in-flight `messages.create()` |
| `runGuardian(rules, ctx, sign)` | the general form, for non-Anthropic callers |
| `verifyGuardianAttestation(att, verify)` | re-derive, re-hash, re-check the signature |
| `projectRecords(rows, opts?)` | arbitrary logs → `{ records, skipped, scanned }` |
| `isAttested(record)` | does this record carry a verifiable signature |
| `buildAnnexIv(opts)` | records → `AnnexIvReport` |
| `toMarkdown(report)` / `toJSON(report)` | serialise it |
| `euAiActPack`, `composePacks(...packs)` | the rule pack, and how to combine packs |

Signing is a callback you supply — `crypto.sign`, a KMS, an HSM, whatever. This
package never sees your private key and has no opinion about where it lives.

---

## Provenance

The Guardian runner, the Anthropic wrapper and the Annex IV exporter were
extracted from the [Sovereign Matrix](https://github.com/christiaan839-beep/sovereign-v2)
platform, where they ship under Apache-2.0 with the test suites carried over
here. The projection layer, the evidentiary split, and the MCP server's protocol
handling are new in this package.

Apache-2.0.
