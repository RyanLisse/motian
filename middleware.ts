import { type NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Rate limiting for /pipeline — in-memory, IP-based, Edge Runtime compatible
// ---------------------------------------------------------------------------

const WINDOW_MS = 10_000; // 10-second sliding window
const MAX_REQUESTS = 10; // max requests per window per IP

// Known bot user-agent substrings (lowercase)
const BOT_SIGNATURES = [
  "bot",
  "crawler",
  "spider",
  "scraper",
  "headlesschrome",
  "phantomjs",
  "python-requests",
  "go-http-client",
  "curl/",
  "wget/",
  "httpclient",
  "apache-httpclient",
  "node-fetch",
  "undici",
];

interface RateBucket {
  timestamps: number[];
}

// Map<ip, RateBucket>  — lives in the Edge Runtime isolate
const ipBuckets = new Map<string, RateBucket>();

// Periodic cleanup so the Map doesn't grow unbounded
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - WINDOW_MS;
  for (const [ip, bucket] of Array.from(ipBuckets.entries())) {
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length === 0) ipBuckets.delete(ip);
  }
}

function isRateLimited(ip: string, now: number): boolean {
  const cutoff = now - WINDOW_MS;
  let bucket = ipBuckets.get(ip);

  if (!bucket) {
    bucket = { timestamps: [] };
    ipBuckets.set(ip, bucket);
  }

  // Prune timestamps outside the window
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    return true;
  }

  bucket.timestamps.push(now);
  return false;
}

function isBotUserAgent(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return BOT_SIGNATURES.some((sig) => lower.includes(sig));
}

// ---------------------------------------------------------------------------
// Middleware — only matched paths reach this function (see `config` below)
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit /pipeline (the matcher already filters, but be explicit)
  if (!pathname.startsWith("/pipeline")) {
    return NextResponse.next();
  }

  const ua = request.headers.get("user-agent");
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Block known bot user-agents on /pipeline
  if (isBotUserAgent(ua)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "60",
        "Content-Type": "text/plain",
      },
    });
  }

  const now = Date.now();
  cleanup(now);

  if (isRateLimited(ip, now)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "10",
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.next();
}

// Only run middleware on /pipeline paths — all other routes are unaffected
export const config = {
  matcher: ["/pipeline/:path*"],
};
