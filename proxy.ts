import { type NextRequest, NextResponse } from "next/server";

/** Routes that bypass bearer token authentication */
const PUBLIC_PATHS = ["/api/gezondheid", "/api/cron"];

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const devFallbackOrigin =
  process.env.NODE_ENV === "development" ? "http://localhost:3001" : null;

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function getAllowedOrigin(request: NextRequest): string | null {
  const allowlist =
    allowedOrigins.length > 0
      ? allowedOrigins
      : devFallbackOrigin
        ? [devFallbackOrigin]
        : [];

  const origin = request.headers.get("origin");
  return origin && allowlist.includes(origin) ? origin : null;
}

function corsHeaders(request: NextRequest): HeadersInit {
  const allowedOrigin = getAllowedOrigin(request);
  return {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" } : {}),
  };
}

export function proxy(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
  }

  const { pathname } = request.nextUrl;

  // Skip auth for public routes
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders(request))) {
      response.headers.set(key, value);
    }
    return response;
  }

  // Development mode: no API_SECRET means allow everything
  const apiSecret = process.env.API_SECRET;
  if (!apiSecret) {
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders(request))) {
      response.headers.set(key, value);
    }
    return response;
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

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
