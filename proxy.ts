import { type NextRequest, NextResponse } from "next/server";
import { buildCorsHeaders, getAllowedCorsOrigin, shouldRejectCorsPreflight } from "@/src/lib/api-cors";
import { shouldAllowMissingApiSecret } from "@/src/lib/runtime-config";

// ---------------------------------------------------------------------------
// Rate limiting for /pipeline — in-memory, IP-based, Edge Runtime compatible
// ---------------------------------------------------------------------------

const RL_WINDOW_MS = 10_000;
const RL_MAX_REQUESTS = 10;

const BOT_SIGNATURES = [
  "bot", "crawler", "spider", "scraper", "headlesschrome", "phantomjs",
  "python-requests", "go-http-client", "curl/", "wget/", "httpclient",
  "apache-httpclient", "node-fetch", "undici",
];

interface RateBucket { timestamps: number[] }
const ipBuckets = new Map<string, RateBucket>();
let lastCleanup = Date.now();

function rlCleanup(now: number) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  const cutoff = now - RL_WINDOW_MS;
  for (const [ip, bucket] of ipBuckets.entries()) {
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length === 0) ipBuckets.delete(ip);
  }
}

function isRateLimited(ip: string, now: number): boolean {
  const cutoff = now - RL_WINDOW_MS;
  let bucket = ipBuckets.get(ip);
  if (!bucket) { bucket = { timestamps: [] }; ipBuckets.set(ip, bucket); }
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
  if (bucket.timestamps.length >= RL_MAX_REQUESTS) return true;
  bucket.timestamps.push(now);
  return false;
}

function isBotUA(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return BOT_SIGNATURES.some((sig) => lower.includes(sig));
}

function rateLimitPipeline(request: NextRequest): NextResponse | null {
  if (isBotUA(request.headers.get("user-agent"))) {
    return new NextResponse("Too Many Requests", { status: 429, headers: { "Retry-After": "60" } });
  }
  const now = Date.now();
  rlCleanup(now);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || "unknown";
  if (isRateLimited(ip, now)) {
    return new NextResponse("Too Many Requests", { status: 429, headers: { "Retry-After": "10" } });
  }
  return null;
}

/** Routes that bypass bearer token authentication completely (health, cron, docs) */
const PUBLIC_PATHS = ["/api/gezondheid", "/api/cron", "/api/openapi", "/api/debug-error"];

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
  "/api/matches",
  "/api/vacatures",
  "/api/interviews",
  "/api/sollicitaties",
  "/api/berichten",
  "/api/instellingen",
  "/api/salesforce-feed",
];

const PUBLIC_GET_PATHS = ["/api/vacatures/zoeken", "/api/opdrachten/zoeken"];

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
  // Rate-limit /pipeline to block bot traffic (2+ req/s observed)
  if (request.nextUrl.pathname.startsWith("/pipeline")) {
    const blocked = rateLimitPipeline(request);
    if (blocked) return blocked;
    return NextResponse.next();
  }

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
  matcher: ["/api/:path*", "/pipeline/:path*"],
};
