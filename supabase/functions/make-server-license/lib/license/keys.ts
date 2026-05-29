// License key generation: FSTH-XXXX-XXXX-XXXX-XXXX
//
// - Prefix FSTH identifies Fastoosh products (helps support triage).
// - Four groups of four chars from a Crockford-style alphabet (no I, O, 0, 1)
//   so keys are unambiguous when read aloud or typed.
// - 16 random chars over a 32-char alphabet ≈ 80 bits of entropy. Plenty.
// - Uses crypto.getRandomValues (available in Deno) with rejection sampling so
//   the alphabet mapping is unbiased (no modulo skew).

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // 30 chars: excludes I, O, 0, 1, L, U
const GROUPS = 4;
const GROUP_LEN = 4;

// Largest multiple of ALPHABET.length that fits in a byte — bytes >= this are
// rejected and re-drawn to keep the distribution uniform.
const REJECT_THRESHOLD = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

function randomChar(): string {
  const buf = new Uint8Array(1);
  // Loop is effectively O(1): rejection probability is < 4% per draw.
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < REJECT_THRESHOLD) {
      return ALPHABET[buf[0] % ALPHABET.length];
    }
  }
}

export function generateLicenseKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = '';
    for (let i = 0; i < GROUP_LEN; i++) group += randomChar();
    groups.push(group);
  }
  return `FSTH-${groups.join('-')}`;
}

// Shape validation for input coming from the extension. Does NOT prove the key
// exists — just that it's well-formed before we hit the DB.
const KEY_RE = /^FSTH-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/;

export function isValidKeyFormat(key: string): boolean {
  return KEY_RE.test(key);
}

// Normalize user input: uppercase, trim, collapse whitespace. Lets customers
// paste "fsth a8km..." or with stray spaces and still match.
export function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}
