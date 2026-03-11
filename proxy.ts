import { type NextRequest, NextResponse } from "next/server";
import { buildCorsHeaders, shouldRejectCorsPreflight } from "@/src/lib/api-cors";
import { shouldAllowMissingApiSecret } from "@/src/lib/runtime-config";

/** Routes that bypass bearer token authentication */
const PUBLIC_PATHS = [
  "/api/gezondheid",
  "/api/cron",
  "/api/openapi",
  "/api/chat",
  "/api/chat-sessies",
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
