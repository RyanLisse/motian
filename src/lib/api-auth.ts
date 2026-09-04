/**
 * Route-level authentication and authorization helpers.
 *
 * This module may later reach the database, so it must never be imported from
 * `proxy.ts`. Handlers call `requirePrincipal` before reading a body or
 * touching a service; the proxy is only a pre-filter.
 *
 * Internal app: no operator login UI. Admission is `Authorization: Bearer`
 * with `API_SECRET`. Browser UIs should call sensitive APIs via server-side
 * BFF (`/bff/*` or RSC / Server Actions) that attach the secret — never
 * via forgeable Origin / Sec-Fetch-Site headers.
 */

import { shouldAllowMissingApiSecret } from "./runtime-config";

export type CandidateAccess = "all" | { allow: string[] };

export type Principal =
  | { kind: "operator"; sub: string; candidateAccess: "all" }
  | { kind: "service"; sub: string; candidateAccess: CandidateAccess };

/** Dutch, provider-free, and identical for every authentication failure mode. */
export const UNAUTHORIZED_MESSAGE = "Niet geautoriseerd";

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolves a principal from `API_SECRET` bearer only. Returns `null` when the
 * credential is missing or invalid — callers must not distinguish modes.
 *
 * Local/dev: when `API_SECRET` is unset and `shouldAllowMissingApiSecret()`,
 * admits a synthetic service principal so route handlers stay usable without
 * a configured secret (mirrors proxy admission).
 */
export async function authenticateRequest(request: Request): Promise<Principal | null> {
  const apiSecret = process.env.API_SECRET?.trim() || null;
  const bearer = readBearerToken(request);
  if (apiSecret && bearer && timingSafeEqualStrings(bearer, apiSecret)) {
    return { kind: "service", sub: "api-secret", candidateAccess: "all" };
  }

  if (!apiSecret && shouldAllowMissingApiSecret()) {
    return { kind: "service", sub: "local-dev", candidateAccess: "all" };
  }

  return null;
}

/**
 * Returns the principal, or a ready-to-return Dutch 401 `Response`. Callers
 * branch with `instanceof Response`.
 */
export async function requirePrincipal(request: Request): Promise<Principal | Response> {
  const principal = await authenticateRequest(request);
  if (principal) return principal;

  return Response.json(
    { error: UNAUTHORIZED_MESSAGE },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * The single seam every candidate/CV route calls. In the current
 * single-operator deployment a service principal may read every candidate,
 * so this is record-binding rather than ownership — but the deny branch is
 * real, reachable code, and it is the one line that changes when multi-operator
 * or client-scoped access arrives.
 *
 * Resolving the candidate against persisted, non-soft-deleted state stays the
 * caller's responsibility (WP3), which is why this is async.
 */
export async function assertCanReadCandidate(
  principal: Principal,
  candidateId: string,
): Promise<"allow" | "deny"> {
  if (candidateId.trim().length === 0) return "deny";

  if (principal.candidateAccess === "all") return "allow";

  return principal.candidateAccess.allow.includes(candidateId) ? "allow" : "deny";
}
