import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxy } from "./proxy";

/** Security headers applied to every response. */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Allow microphone for LiveKit voice features; deny camera and geolocation.
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(request: NextRequest): NextResponse {
  // API routes: delegate to the existing proxy for CORS + auth, then layer
  // security headers on top of whatever response it returns.
  if (request.nextUrl.pathname.startsWith("/api")) {
    const proxyResponse = proxy(request);
    return applySecurityHeaders(proxyResponse);
  }

  // All other routes: pass through with security headers.
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
