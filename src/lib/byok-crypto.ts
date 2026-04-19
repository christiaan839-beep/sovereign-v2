/**
 * BYOK client-side crypto — part of ADR-0002.
 *
 * Runs in the browser. Encrypts customer API keys with a per-user DEK
 * derived via HKDF from the Clerk user id + session secret. The server
 * never sees plaintext; it receives an envelope it can unwrap only with
 * its own master key (src/lib/byok-server.ts).
 *
 * Uses Web Crypto — no third-party deps. Safe for Edge runtime.
 */

const AES_GCM_IV_BYTES = 12;

export interface EncryptedEnvelope {
  /** Base64-encoded AES-GCM ciphertext (includes the 16-byte GCM tag). */
  ciphertext: string;
  /** Base64-encoded 12-byte IV. */
  iv: string;
  /** Version marker — bump when the scheme changes. */
  version: "v1";
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

async function deriveUserDek(clerkUserId: string, sessionSecret: string): Promise<CryptoKey> {
  // Import the (userId + sessionSecret) combo as HKDF material. HKDF is
  // designed for this — deriving keys from keying material rather than
  // human-readable passwords (PBKDF2 would be wrong here).
  const material = new TextEncoder().encode(`${clerkUserId}:${sessionSecret}`);
  const baseKey = await crypto.subtle.importKey("raw", material, "HKDF", false, ["deriveKey"]);

  // Per-user salt ensures two users with the same (shared) session secret
  // still get different DEKs.
  const salt = new TextEncoder().encode(`sovereign-matrix:byok:${clerkUserId}`);

  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode("byok-dek-v1") },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable — can't be exported once derived
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a plaintext API key with the user's DEK.
 *
 *   const envelope = await encryptByokKey({
 *     plaintext: "sk-ant-...",
 *     clerkUserId: user.id,
 *     sessionSecret: await getSessionSecret(),
 *   });
 */
export async function encryptByokKey(params: {
  plaintext: string;
  clerkUserId: string;
  sessionSecret: string;
}): Promise<EncryptedEnvelope> {
  const { plaintext, clerkUserId, sessionSecret } = params;

  const dek = await deriveUserDek(clerkUserId, sessionSecret);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    new TextEncoder().encode(plaintext),
  );

  return {
    ciphertext: b64(ciphertext),
    iv: b64(iv),
    version: "v1",
  };
}

/**
 * Decrypt (client-side only — used for Settings roundtrip preview).
 * The server never calls this; it has its own unwrap path.
 */
export async function decryptByokKey(params: {
  envelope: EncryptedEnvelope;
  clerkUserId: string;
  sessionSecret: string;
}): Promise<string> {
  const { envelope, clerkUserId, sessionSecret } = params;
  if (envelope.version !== "v1") {
    throw new Error(`Unsupported envelope version: ${envelope.version}`);
  }

  const dek = await deriveUserDek(clerkUserId, sessionSecret);
  // Cast through BufferSource — Web Crypto types tightened in recent TS.
  const iv = b64dec(envelope.iv).buffer as ArrayBuffer;
  const ct = b64dec(envelope.ciphertext).buffer as ArrayBuffer;
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, dek, ct);
  return new TextDecoder().decode(plaintext);
}
