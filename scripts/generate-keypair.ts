/**
 * One-time Ed25519 keypair generator for the Fastoosh license server.
 *
 * Run locally:   npx tsx scripts/generate-keypair.ts
 *
 * Outputs a private key and a public key as 32-byte (64-char) hex strings.
 *   - PRIVATE key  -> Supabase secret LICENSE_SIGNING_PRIVATE_KEY (NEVER commit/expose)
 *   - PUBLIC  key  -> Supabase secret LICENSE_SIGNING_PUBLIC_KEY  AND embedded in the
 *                     CEP extension so it can verify tokens offline.
 *
 * No dependencies: uses Node's built-in node:crypto (Node 18+ supports Ed25519).
 *
 * Why raw 32-byte hex (not PEM)?
 *   The Edge Function (Deno) and the CEP extension (Chromium) both verify with
 *   WebCrypto `crypto.subtle`, which imports raw Ed25519 keys. Hex is the simplest
 *   portable representation to drop into an env var and into the extension source.
 */

import { generateKeyPairSync, KeyObject } from 'node:crypto';

function rawHexFromKey(key: KeyObject, type: 'private' | 'public'): string {
  // Export as JWK to pull out the raw key material, then hex-encode.
  // Ed25519 JWK: d = private scalar (base64url), x = public key (base64url).
  const jwk = key.export({ format: 'jwk' }) as { d?: string; x?: string };
  const b64url = type === 'private' ? jwk.d : jwk.x;
  if (!b64url) throw new Error(`Could not extract ${type} key material`);
  const buf = Buffer.from(b64url, 'base64url');
  if (buf.length !== 32) throw new Error(`Expected 32-byte ${type} key, got ${buf.length}`);
  return buf.toString('hex');
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');

const privHex = rawHexFromKey(privateKey, 'private');
const pubHex = rawHexFromKey(publicKey, 'public');

console.log('\n=== Fastoosh License Signing Keypair (Ed25519) ===\n');
console.log('LICENSE_SIGNING_PRIVATE_KEY (server secret — keep safe, never commit):');
console.log(privHex);
console.log('\nLICENSE_SIGNING_PUBLIC_KEY (server secret + embed in CEP extension):');
console.log(pubHex);
console.log('\n==================================================');
console.log('Next: set both as Supabase secrets (Phase 2), save the public key for the extension.');
console.log('Store the PRIVATE key in a password manager. If it leaks, anyone can mint valid licenses.\n');
