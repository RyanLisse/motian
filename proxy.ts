import { type NextRequest, NextResponse } from "next/server";
import { buildCorsHeaders, shouldRejectCorsPreflight } from "@/src/lib/api-cors";

/** Routes that bypass bearer token authentication */
const PUBLIC_PATHS = ["/api/gezondheid", "/api/cron", "/api/openapi"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function corsHeaders(request: NextRequest): HeadersInit {
  return buildCorsHeaders(request.headers.get("origin"));
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
