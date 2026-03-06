import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const devFallbackOrigin =
  process.env.NODE_ENV === "development" ? "http://localhost:3001" : null;

function getAllowlist(): string[] {
  if (allowedOrigins.length > 0) return allowedOrigins;
  if (devFallbackOrigin) return [devFallbackOrigin];
  return [];
}

export function middleware(request: NextRequest) {
  const allowlist = getAllowlist();
  if (allowlist.length === 0) return NextResponse.next();

  const origin = request.headers.get("origin");
  const allowed =
    origin && allowlist.includes(origin)
      ? origin
      : request.nextUrl.pathname.startsWith("/api")
        ? null
        : null;

  const response =
    request.method === "OPTIONS"
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next();

  if (allowed) {
    response.headers.set("Access-Control-Allow-Origin", allowed);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    response.headers.set("Vary", "Origin");
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
