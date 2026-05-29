// Ed25519-signed license tokens (compact JWS, alg = EdDSA).
//
// The extension verifies these OFFLINE using the embedded public key, so the
// server can be down and licenses still work until the token's exp.
//
// We use WebCrypto (crypto.subtle) which both Deno (server) and Chromium (the
// CEP extension) support natively for Ed25519 — no @noble/ed25519 dependency.
// The same verify logic in this file can be ported almost verbatim into the
// extension; only the key import differs (public-only there).
//
// Key material is stored as raw 32-byte hex in env (from generate-keypair.ts).

// ── base64url helpers (JWS uses base64url, not standard base64) ───────────────
function base64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Return type is Uint8Array<ArrayBuffer> (backed by a concrete ArrayBuffer) so
// the result satisfies WebCrypto's BufferSource parameter under strict TS libs.
function base64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex length');
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── Claims ────────────────────────────────────────────────────────────────────
export interface LicenseClaims {
  iss: string;                  // issuer, e.g. 'fastoosh.com'
  sub: string;                  // license UUID
  jti: string;                  // unique token id (logged for revocation-by-jti later)
  email: string;
  product: string;              // 'fastoosh_data_automator'
  plan: string;                 // 'pro'
  type: 'lifetime' | 'subscription';
  machine: string;              // machine fingerprint this token is bound to
  machine_limit: number;
  iat: number;                  // issued-at (unix seconds)
  exp: number;                  // expiry (unix seconds)
  features: string[];
}

// ── Key import (cached per cold start) ────────────────────────────────────────
// Deno's crypto.subtle imports Ed25519 private keys as PKCS#8 and public keys as
// raw or SPKI. We have raw 32-byte hex. For the PRIVATE key we wrap the raw seed
// in a minimal PKCS#8 DER envelope; for the PUBLIC key we wrap it in SPKI DER.

// PKCS#8 prefix for Ed25519 private keys (RFC 8410). The 32-byte seed follows.
const PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
  0x04, 0x22, 0x04, 0x20,
]);
// SPKI prefix for Ed25519 public keys (RFC 8410). The 32-byte key follows.
const SPKI_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(a.length + b.length));
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

let privateKeyPromise: Promise<CryptoKey> | null = null;
let publicKeyPromise: Promise<CryptoKey> | null = null;

function getPrivateKey(): Promise<CryptoKey> {
  if (!privateKeyPromise) {
    const hex = Deno.env.get('LICENSE_SIGNING_PRIVATE_KEY');
    if (!hex) throw new Error('LICENSE_SIGNING_PRIVATE_KEY not set');
    const seed = hexToBytes(hex.trim());
    if (seed.length !== 32) throw new Error('Private key must be 32-byte hex');
    const pkcs8 = concat(PKCS8_PREFIX, seed);
    privateKeyPromise = crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);
  }
  return privateKeyPromise;
}

function getPublicKey(): Promise<CryptoKey> {
  if (!publicKeyPromise) {
    const hex = Deno.env.get('LICENSE_SIGNING_PUBLIC_KEY');
    if (!hex) throw new Error('LICENSE_SIGNING_PUBLIC_KEY not set');
    const raw = hexToBytes(hex.trim());
    if (raw.length !== 32) throw new Error('Public key must be 32-byte hex');
    const spki = concat(SPKI_PREFIX, raw);
    publicKeyPromise = crypto.subtle.importKey('spki', spki, { name: 'Ed25519' }, false, ['verify']);
  }
  return publicKeyPromise;
}

// ── Sign ────────────────────────────────────────────────────────────────────
export async function signLicenseToken(claims: LicenseClaims): Promise<string> {
  const header = { alg: 'EdDSA', typ: 'JWT' };
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await getPrivateKey();
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, enc.encode(signingInput));
  const sigB64 = base64urlEncode(new Uint8Array(sig));

  return `${signingInput}.${sigB64}`;
}

// ── Verify ────────────────────────────────────────────────────────────────────
export interface VerifyResult {
  valid: boolean;
  claims?: LicenseClaims;
  reason?: string;
}

// Verifies signature AND expiry. checkExp=false lets /refresh accept a token
// whose exp has passed but whose signature is still ours (the whole point of
// refresh is to renew an expiring/expired-but-genuine token).
export async function verifyLicenseToken(token: string, checkExp = true): Promise<VerifyResult> {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed_token' };

  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  let claims: LicenseClaims;
  try {
    claims = JSON.parse(dec.decode(base64urlDecode(payloadB64)));
  } catch {
    return { valid: false, reason: 'malformed_payload' };
  }

  let signatureOk = false;
  try {
    const key = await getPublicKey();
    signatureOk = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      base64urlDecode(sigB64),
      enc.encode(signingInput),
    );
  } catch {
    return { valid: false, reason: 'verify_error' };
  }
  if (!signatureOk) return { valid: false, reason: 'bad_signature' };

  if (checkExp) {
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp === 'number' && claims.exp < now) {
      return { valid: false, claims, reason: 'expired' };
    }
  }

  return { valid: true, claims };
}

// Diagnostics only — decodes the payload without verifying the signature.
// NEVER trust the output for access decisions.
export function decodeWithoutVerifying(token: string): LicenseClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(dec.decode(base64urlDecode(parts[1])));
  } catch {
    return null;
  }
}

// Random jti (unique token id). 16 random bytes -> hex.
export function generateJti(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// TTL policy from env. Subscriptions get short tokens (must refresh often so
// cancellations take effect quickly); lifetime gets long tokens (survives long
// offline stretches). past_due is forced short regardless of type.
export function tokenTtlSeconds(type: 'lifetime' | 'subscription', pastDue = false): number {
  if (pastDue) return Number(Deno.env.get('LICENSE_TOKEN_TTL_SUBSCRIPTION') ?? 604800);
  if (type === 'lifetime') return Number(Deno.env.get('LICENSE_TOKEN_TTL_LIFETIME') ?? 7776000);
  return Number(Deno.env.get('LICENSE_TOKEN_TTL_SUBSCRIPTION') ?? 604800);
}
