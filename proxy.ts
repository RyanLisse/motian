import { type NextRequest, NextResponse } from "next/server";
import { buildCorsHeaders, shouldRejectCorsPreflight } from "@/src/lib/api-cors";
import { shouldAllowMissingApiSecret } from "@/src/lib/runtime-config";
import { timingSafeEqualStrings } from "@/src/lib/session";

// ---------------------------------------------------------------------------
// Rate limiting for /pipeline — in-memory, IP-based, Edge Runtime compatible
// ---------------------------------------------------------------------------

const RL_WINDOW_MS = 10_000;
const RL_MAX_REQUESTS = 10;

const BOT_SIGNATURES = [
  "crawler",
  "spider",
  "scraper",
  "phantomjs",
  "python-requests",
  "go-http-client",
  "curl/",
  "wget/",
  "apache-httpclient",
];

interface RateBucket {
  timestamps: number[];
}
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
  if (!bucket) {
    bucket = { timestamps: [] };
    ipBuckets.set(ip, bucket);
  }
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
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  const now = Date.now();
  rlCleanup(now);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(ip, now)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": "10" },
    });
  }
  return null;
}

/** Routes that bypass authentication completely (health, cron, docs, public feeds). */
const PUBLIC_PATHS = ["/api/gezondheid", "/api/cron", "/api/openapi", "/api/feed"];

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
 * Origin / Sec-Fetch-Site isolation helper for CSRF on cookie-bound writes.
 * These headers NEVER grant admission — they only reject cross-site writes
 * when a future cookie-light path needs isolation. Bearer admission does not
 * depend on this check.
 */
export function isOriginIsolationOk(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (!origin && secFetchSite === "same-origin") {
    return true;
  }

  if (origin === request.nextUrl.origin) {
    return true;
  }

  // Fallback: Host-derived origin for Next.js 16 LAN/dev where nextUrl.origin
  // may normalize to "localhost" while the browser sends the LAN Origin.
  const host = request.headers.get("host");
  if (host && origin === `${request.nextUrl.protocol}//${host}`) {
    return true;
  }

  return false;
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

function handlePipelineRateLimit(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith("/pipeline")) return null;
  return rateLimitPipeline(request);
}

function handleCorsPreflight(request: NextRequest): NextResponse | null {
  if (request.method !== "OPTIONS") return null;

  const origin = request.headers.get("origin");
  if (shouldRejectCorsPreflight(origin)) {
    return NextResponse.json(
      { error: "Origin niet toegestaan" },
      { status: 403, headers: corsHeaders(request) },
    );
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

function hasValidBearer(request: NextRequest, apiSecret: string): boolean {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return false;
  return timingSafeEqualStrings(token, apiSecret);
}

/**
 * Proxy admission for non-public `/api` and `/pipeline`: `Authorization: Bearer`
 * with `API_SECRET` only. Origin / Sec-Fetch-Site never admit. Pages are not gated
 * (internal app — no login UI). Browser product traffic should reach sensitive APIs
 * via server-side BFF (RSC / Route Handlers / Server Actions) that attach the secret.
 */
export async function proxy(request: NextRequest) {
  const pipelineLimited = handlePipelineRateLimit(request);
  if (pipelineLimited) return pipelineLimited;

  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) return preflightResponse;

  if (isPublicRoute(request)) {
    return withCorsHeaders(NextResponse.next(), request);
  }

  const apiSecret = process.env.API_SECRET?.trim() || null;

  if (apiSecret && hasValidBearer(request, apiSecret)) {
    return withCorsHeaders(NextResponse.next(), request);
  }

  // Local/test: secret unset → keep surfaces reachable for developers.
  if (!apiSecret && shouldAllowMissingApiSecret()) {
    return withCorsHeaders(NextResponse.next(), request);
  }

  // Production with secret unset → fail closed (503).
  if (!apiSecret && !shouldAllowMissingApiSecret()) {
    return NextResponse.json(
      { error: "API authenticatie niet geconfigureerd" },
      { status: 503, headers: corsHeaders(request) },
    );
  }

  return NextResponse.json(
    { error: "Niet geautoriseerd" },
    { status: 401, headers: corsHeaders(request) },
  );
}

export const config = {
  matcher: ["/api/:path*", "/pipeline/:path*"],
};
