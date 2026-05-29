// Machine fingerprint validation.
//
// The CEP extension computes the fingerprint client-side, e.g.:
//   sha256(os_username + "|" + hostname + "|" + primary_mac + "|" + cpu_model)
// We only validate the SHAPE here (64-char hex). We do NOT try to verify it
// server-side — the goal is to identify the same machine across launches, not to
// be tamper-proof. A determined user can spoof it; that's acceptable for a tool
// license (the threat model is casual sharing, not nation-state piracy).

const FP_RE = /^[a-f0-9]{64}$/;

export function isValidFingerprint(fp: string): boolean {
  return typeof fp === 'string' && FP_RE.test(fp);
}

export function normalizeFingerprint(fp: string): string {
  return fp.trim().toLowerCase();
}
