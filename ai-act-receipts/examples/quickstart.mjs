/**
 * The whole library, end to end, in one file. Run it:
 *
 *   npm run build && npm run example
 *
 * No API key needed — the Anthropic message below is a literal, so
 * this is deterministic and offline. Swap it for a real
 * `client.messages.create()` result and nothing else changes.
 */

import { generateKeyPairSync, sign as edSign } from "node:crypto";
import {
  mintMessageReceipt,
  euAiActPack,
  composePacks,
  projectRecords,
  buildAnnexIv,
  toMarkdown,
} from "../dist/index.js";

// ── Your signing key. Generate once, keep the private half secret.
//    openssl genpkey -algorithm Ed25519 -out ed25519-private.pem
const { privateKey } = generateKeyPairSync("ed25519");
const sign = (canonical) =>
  "v2=" + edSign(null, Buffer.from(canonical), privateKey).toString("base64");

// ── 1. MINT — wrap a Claude call in a signed receipt.
const message = {
  id: "msg_01ABC",
  model: "claude-opus-5",
  role: "assistant",
  stop_reason: "end_turn",
  content: [
    {
      type: "text",
      text:
        "This automated decision assesses the candidate against the posted " +
        "criteria at 0.91 confidence. Any applicant may request human review.",
    },
  ],
  usage: { input_tokens: 812, output_tokens: 96 },
};

const receipt = await mintMessageReceipt(message, {
  sign,
  agentSlug: "candidate-screener",
  runId: "run_01HXX",
  rules: composePacks(euAiActPack),
});

console.log("1. MINT");
console.log("   verdict  :", receipt.overall);
console.log("   rules run:", receipt.rules.map((r) => r.ruleId).join(", "));
console.log("   signature:", receipt.signature.slice(0, 32) + "…");

// ── 2. PROJECT — bring in logs you already have. No format change.
const { records: projected, skipped } = projectRecords([
  { request_id: "req_884", created_at: "2026-08-01T09:12:00Z", status: "ok" },
  { request_id: "req_885", created_at: 1785920000, status: "denied" },
  { request_id: "req_886", created_at: "not a date", status: "ok" }, // bad row
]);

console.log("\n2. PROJECT");
console.log("   projected:", projected.length);
console.log("   skipped  :", skipped.map((s) => `#${s.index} ${s.reason}`).join("; "));

// ── 3. EXPORT — Article 11 technical documentation.
const report = buildAnnexIv({
  system: {
    name: "Acme Candidate Screener",
    identifier: "acme-cs-001",
    riskCategory: "high-risk",
    provider: "Acme Recruiting (Pty) Ltd",
    intendedPurpose: "Rank applicants against posted role criteria.",
    annexIIIUseCase: "employment, worker management and access to self-employment",
    placedOnMarketAt: "2026-03-01",
  },
  receipts: [receipt, ...projected],
  nextReportDue: "2026-11-30",
});

const markdown = toMarkdown(report);
console.log("\n3. EXPORT");
console.log("   sections :", Object.keys(report).length);
console.log("   markdown :", markdown.length, "bytes");
console.log("   operator gaps:", (markdown.match(/OPERATOR-AUTHORED/g) ?? []).length);
console.log("\n" + "─".repeat(64));
console.log(markdown.slice(0, 700) + "\n…");
