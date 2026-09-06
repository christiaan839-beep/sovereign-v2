/**
 * Redaction of key material at the boundary where a receipt field becomes part
 * of a published document.
 *
 * SECURITY.md ranks, fourth: "Key material leaking into a receipt, an
 * exporter's output, a log line, or an error message."
 *
 * `ReceiptRecord` carries `[key: string]: unknown`, so a caller can put
 * anything in it — and the exporters copy a handful of fields (`verdictId`,
 * `agentSlug`, `pack`) verbatim into the document they emit. Those fields are
 * projected explicitly, which is why an ad-hoc `signingKeyPem` field never
 * reaches the output; but a PEM pasted into `agentSlug` does, and did.
 *
 * The exporter cannot know a caller's field is a secret. It can know what a
 * private key looks like. This redacts by SHAPE, at the last point before the
 * value is published, which is the only place that generalises across all
 * eight exporters and every field they might later decide to project.
 *
 * This is a floor, not a guarantee: it recognises the armoured formats that
 * actually appear in credentials. A secret that looks like ordinary text will
 * still pass through, and the caller remains responsible for not putting one
 * in a receipt.
 */

/** The redaction marker. Deliberately conspicuous in a published document. */
export const REDACTED = "[REDACTED: key material]";

/**
 * Patterns for material that must never reach a published document. Each is a
 * format that carries, or announces, secret key bytes.
 */
const KEY_MATERIAL: readonly RegExp[] = [
  // PEM blocks, armoured or with the newlines stripped. The header alone is
  // enough: nothing legitimate in a compliance document announces a private key.
  /-{2,}\s*BEGIN[ A-Z0-9]*PRIVATE KEY\s*-{2,}[\s\S]*?(?:-{2,}\s*END[ A-Z0-9]*PRIVATE KEY\s*-{2,}|$)/gi,
  /-{2,}\s*BEGIN[ A-Z0-9]*(?:PRIVATE KEY|ENCRYPTED PRIVATE KEY)\s*-{2,}/gi,
  // OpenSSH private keys.
  /-{2,}\s*BEGIN OPENSSH PRIVATE KEY\s*-{2,}[\s\S]*?(?:-{2,}\s*END OPENSSH PRIVATE KEY\s*-{2,}|$)/gi,
  // PGP private key blocks.
  /-{2,}\s*BEGIN PGP PRIVATE KEY BLOCK\s*-{2,}[\s\S]*?(?:-{2,}\s*END PGP PRIVATE KEY BLOCK\s*-{2,}|$)/gi,
  // JWK private components appearing inline.
  /"d"\s*:\s*"[A-Za-z0-9_-]{20,}"/g,
];

/**
 * Returns `value` with any recognised key material replaced.
 *
 * Non-strings are returned unchanged so a caller can pipe a projection through
 * without narrowing first. Redaction is idempotent: the marker contains nothing
 * that matches a pattern.
 */
export function redactKeyMaterial<T>(value: T): T {
  if (typeof value !== "string") return value;
  let out: string = value;
  for (const pattern of KEY_MATERIAL) {
    // Fresh lastIndex each call — these are module-level /g regexes.
    pattern.lastIndex = 0;
    out = out.replace(pattern, REDACTED);
  }
  return out as unknown as T;
}

/** True when `value` contains material this module would redact. */
export function containsKeyMaterial(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return redactKeyMaterial(value) !== value;
}
