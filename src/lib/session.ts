/**
 * Edge-safe crypto helpers shared by `proxy.ts` and route-level auth.
 *
 * HARD CONSTRAINT: this module is imported by `proxy.ts`, which runs in the
 * Next.js proxy layer. It must stay free of Node-only APIs and of any database
 * import. Web Crypto / standard encodings only.
 *
 * Operator password sessions were removed (internal app — no login UI).
 * Admission is `API_SECRET` bearer only; see `src/lib/api-auth.ts`.
 */

/**
 * Length-independent, value-constant-time comparison. Length is allowed to leak
 * (it is not secret); the byte values are not.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(a), encoder.encode(b));
}
