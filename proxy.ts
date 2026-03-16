import { type NextRequest, NextResponse } from "next/server";
import { buildCorsHeaders, getAllowedCorsOrigin, shouldRejectCorsPreflight } from "@/src/lib/api-cors";
import { shouldAllowMissingApiSecret } from "@/src/lib/runtime-config";

/** Routes that bypass bearer token authentication completely (health, cron, docs) */
const PUBLIC_PATHS = ["/api/gezondheid", "/api/cron", "/api/openapi"];

/**
 * First-party browser routes: accessible without bearer token ONLY for
 * same-origin requests (no Origin header) or requests from an allowed CORS
 * origin.  External / cross-origin callers without a valid bearer token are
 * still rejected.
 * /api/events is SSE; EventSource cannot send Authorization header, so same-origin only.
 */
const FIRST_PARTY_PATHS = [
  "/api/chat",
  "/api/chat-sessies",
  "/api/cv-upload",
  "/api/cv-analyse",
  "/api/events",
  "/api/cv-file",
  "/api/kandidaten",
];

const PUBLIC_GET_PATHS = ["/api/opdrachten/zoeken"];

function matchesPublicPath(pathname: string, publicPath: string): boolean {
  return pathname === publicPath || pathname.startsWith(`${publicPath}/`);
}

function isPublicRoute(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((publicPath) => matchesPublicPath(pathname, publicPath))) {
    return true;
  }

  return (
    request.method === "GET" &&
    PUBLIC_GET_PATHS.some((publicPath) => matchesPublicPath(pathname, publicPath))
  );
}

/**
 * Returns true when the request targets a first-party browser route AND
 * originates from the same origin (no Origin header) or from a CORS-allowed
 * origin.  This prevents unauthenticated access from arbitrary external
 * callers while letting the Next.js frontend work without a bearer token.
 */
function isFirstPartyBrowserRoute(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  if (!FIRST_PARTY_PATHS.some((p) => matchesPublicPath(pathname, p))) {
    return false;
  }

  const origin = request.headers.get("origin");

  // Same-origin fetch calls from the Next.js app do not include an Origin header.
  if (!origin) {
    return true;
  }

  if (origin === request.nextUrl.origin) {
    return true;
  }

  // If the caller provides an Origin, it must be explicitly on the CORS allowlist.
  // getAllowedCorsOrigin returns the origin only when it appears in the allowlist,
  // so unknown origins (including when no allowlist is configured) are rejected.
  return getAllowedCorsOrigin(origin) !== null;
}

function corsHeaders(request: NextRequest): HeadersInit {
  return buildCorsHeaders(request.headers.get("origin"));
}

function withCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    response.headers.set(key, value);
  }

  return response;
}

export function proxy(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    if (shouldRejectCorsPreflight(origin)) {
      return NextResponse.json(
        { error: "Origin niet toegestaan" },
        { status: 403, headers: corsHeaders(request) },
      );
    }

    return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
  }

  // Skip auth for public routes
  if (isPublicRoute(request)) {
    return withCorsHeaders(NextResponse.next(), request);
  }

  // Allow first-party browser routes from same-origin or allowed CORS origins
  if (isFirstPartyBrowserRoute(request)) {
    return withCorsHeaders(NextResponse.next(), request);
  }

  // Local/test mode may omit API_SECRET, but deployed production must fail closed.
  const apiSecret = process.env.API_SECRET;
  if (!apiSecret) {
    if (!shouldAllowMissingApiSecret()) {
      return NextResponse.json(
        { error: "API authenticatie niet geconfigureerd" },
        { status: 503, headers: corsHeaders(request) },
      );
    }

    return withCorsHeaders(NextResponse.next(), request);
  }

  // Validate bearer token
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token !== apiSecret) {
    return NextResponse.json(
      { error: "Niet geautoriseerd" },
      { status: 401, headers: corsHeaders(request) },
    );
  }

  return withCorsHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: "/api/:path*",
};
