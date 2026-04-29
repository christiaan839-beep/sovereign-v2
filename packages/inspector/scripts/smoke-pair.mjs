// Mint a pair of files for the CLI smoke test.
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { mintACAT, encodeACATForHeader } from "../src/acat.mjs";

function makeKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "der", type: "spki" });
  const priv = privateKey.export({ format: "der", type: "pkcs8" });
  return {
    publicKey: pub.subarray(pub.length - 32).toString("base64url"),
    privateKey: priv.subarray(priv.length - 32).toString("base64url"),
  };
}
const k = makeKey();
const token = mintACAT({
  body: {
    version: "acat-v1",
    agentId: "https://sovereignmatrix.agency/agents/smoke",
    agentManifestVersion: "v1",
    userId: "user_smoke",
    userPublicKey: k.publicKey,
    scope: { maxCents: 50000, currency: "USD", validFrom: "2026-04-01T00:00:00.000Z", validUntil: "2026-05-30T00:00:00.000Z" },
    caveats: [],
    issuedAt: "2026-04-15T10:00:00.000Z",
  },
  userPrivateKey: k.privateKey,
});
writeFileSync("/tmp/smoke-pubkey.txt", k.publicKey);
writeFileSync("/tmp/smoke-acat.b64", encodeACATForHeader(token));
console.log("wrote /tmp/smoke-pubkey.txt + /tmp/smoke-acat.b64");
