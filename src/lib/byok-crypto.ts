/**
 * BYOK client-side crypto — part of ADR-0002.
 *
 * Runs in the browser. Encrypts customer API keys with a per-user DEK
 * derived via PBKDF2 from a USER-ENTERED PASSPHRASE plus their Clerk
 * user id (as salt). The server never sees the passphrase; it receives
 * only the ciphertext envelope.
 *
 * ⚠️ DESIGN NOTE — passphrase vs session-key
 *
 * An earlier draft of this module derived the DEK from Clerk's
 * `sessionSecret`. That was wrong: Clerk sessions rotate on re-login,
 * so a user who logged out and back in would get a DIFFERENT DEK and
 * be locked out of their previously-encrypted keys.
 *
 * The correct primitives are:
 *   (a) a user passphrase (current design — stable across logins,
 *       unknown to Sovereign Matrix operators)
 *   (b) a server-side wrapping key stored in KMS (future: SOC2-grade)
 *
 * We chose (a) for the first cut because it ships in one commit with
 * no KMS dependency. The trade-off is UX: users must remember a
 * passphrase OR opt out of E2E encryption (falling back to the
 * existing symmetric server-side scheme in src/lib/crypto.ts).
 *
 * Uses Web Crypto — no third-party deps. Safe for Edge runtime.
 */

const AES_GCM_IV_BYTES = 12;
const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 recommendation for PBKDF2-SHA256

export interface EncryptedEnvelope {
  /** Base64-encoded AES-GCM ciphertext (includes the 16-byte GCM tag). */
  ciphertext: string;
  /** Base64-encoded 12-byte IV. */
  iv: string;
  /** Version marker — bump when the scheme changes. */
  version: "v2";
  /** PBKDF2 iterations at encrypt time (future-proofs against param changes). */
  iterations: number;
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64dec(s: string): Uint8Array {
  const binary = atob(s);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveDek(
  passphrase: string,
  clerkUserId: string,
  iterations: number,
): Promise<CryptoKey> {
  if (passphrase.length < 12) {
    // Protect against weak passphrases at derivation time — a 4-char
    // passphrase would be trivially brute-forceable even with 210k
    // iterations.
    throw new Error("Passphrase must be at least 12 characters");
  }

  const passKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // Per-user salt means two users with the same passphrase still get
  // different DEKs. The salt is derivable from public info (Clerk user
  // id) which is fine — the attacker's work-factor is the PBKDF2
  // iterations, not salt secrecy.
  const salt = new TextEncoder().encode(`sovereign-matrix:byok-v2:${clerkUserId}`);

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a plaintext API key with a passphrase-derived DEK.
 *
 *   const envelope = await encryptByokKey({
 *     plaintext: "sk-ant-...",
 *     passphrase: userEnteredPassphrase,
 *     clerkUserId: user.id,
 *   });
 */
export async function encryptByokKey(params: {
  plaintext: string;
  passphrase: string;
  clerkUserId: string;
}): Promise<EncryptedEnvelope> {
  const { plaintext, passphrase, clerkUserId } = params;

  const dek = await deriveDek(passphrase, clerkUserId, PBKDF2_ITERATIONS);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    new TextEncoder().encode(plaintext),
  );

  return {
    ciphertext: b64(ciphertext),
    iv: b64(iv),
    version: "v2",
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Decrypt with the user's passphrase. Throws on wrong passphrase
 * (AES-GCM auth tag rejects silently-corrupted ciphertext).
 */
export async function decryptByokKey(params: {
  envelope: EncryptedEnvelope;
  passphrase: string;
  clerkUserId: string;
}): Promise<string> {
  const { envelope, passphrase, clerkUserId } = params;
  if (envelope.version !== "v2") {
    throw new Error(`Unsupported envelope version: ${envelope.version}`);
  }

  const dek = await deriveDek(passphrase, clerkUserId, envelope.iterations);
  const iv = b64dec(envelope.iv).buffer as ArrayBuffer;
  const ct = b64dec(envelope.ciphertext).buffer as ArrayBuffer;
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, dek, ct);
  return new TextDecoder().decode(plaintext);
}
