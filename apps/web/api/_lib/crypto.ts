/**
 * AES-GCM encryption for the Google refresh token (§7, D2).
 *
 * The refresh token is the one credential that would let anyone act as the user indefinitely,
 * so it is encrypted at rest with `TOKEN_ENC_KEY` and **never** sent to the browser. The client
 * only ever holds FOQUS's own httpOnly session cookie.
 *
 * WebCrypto rather than `node:crypto` so the same code runs unchanged on either Vercel runtime.
 */

const IV_LENGTH = 12; // 96-bit nonce, the size AES-GCM is specified for

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  if (raw.byteLength !== 32) {
    throw new Error(
      'TOKEN_ENC_KEY harus 32 byte dalam base64. Buat dengan: openssl rand -base64 32',
    );
  }
  return crypto.subtle.importKey('raw', raw as unknown as ArrayBuffer, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Returns `base64(iv) + '.' + base64(ciphertext)` — a fresh IV per call, never reused. */
export async function encryptSecret(plaintext: string, base64Key: string): Promise<string> {
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(payload: string, base64Key: string): Promise<string> {
  const [ivPart, cipherPart] = payload.split('.');
  if (!ivPart || !cipherPart) throw new Error('Token terenkripsi rusak.');
  const key = await importKey(base64Key);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivPart) as unknown as ArrayBuffer },
    key,
    base64ToBytes(cipherPart) as unknown as ArrayBuffer,
  );
  return new TextDecoder().decode(plaintext);
}

/** Random URL-safe string for the OAuth `state` parameter. */
export function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
