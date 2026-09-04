import * as Sentry from "@sentry/nextjs";
import { requirePrincipal, UNAUTHORIZED_MESSAGE } from "./api-auth";
import { rateLimit } from "./rate-limit";

type ApiHandler<TArgs extends unknown[]> = (...args: TArgs) => Response | Promise<Response>;

type ApiHandlerOptions = {
  errorMessage?: string;
  status?: number;
  logPrefix?: string;
  /** Rate limit config — omit to skip rate limiting */
  rateLimit?: { interval: number; limit: number };
  /**
   * Route-local principal check. Defaults to `"required"` so non-public
   * handlers fail closed on missing `API_SECRET` bearer. Truly public routes
   * (health, OpenAPI, feeds, public GET search) must pass `"public"`.
   */
  auth?: "required" | "public";
};

// Pre-built rate limiters per tier to avoid creating new instances per request
const limiters = new Map<string, ReturnType<typeof rateLimit>>();

function getLimiter(key: string, interval: number, limit: number) {
  if (!limiters.has(key)) {
    limiters.set(key, rateLimit({ interval, limit }));
  }
  return limiters.get(key) ?? rateLimit({ interval, limit });
}

/** Extract client IP from request headers (works with Vercel, Cloudflare, etc.) */
function extractIp(request: Request): string {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous"
  );
}

export function withApiHandler<TArgs extends unknown[]>(
  handler: ApiHandler<TArgs>,
  options: ApiHandlerOptions = {},
) {
  const {
    errorMessage = "Interne serverfout",
    status = 500,
    logPrefix = "API handler error",
  } = options;

  const limiterKey = logPrefix; // Use log prefix as limiter identity

  return async (...args: TArgs): Promise<Response> => {
    const authMode = options.auth ?? "required";
    if (authMode === "required") {
      const maybeRequest = args[0];
      // Fail closed: never skip the principal check when Request is absent.
      if (!(maybeRequest instanceof Request)) {
        return Response.json(
          { error: UNAUTHORIZED_MESSAGE },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
      }
      const principalOrResponse = await requirePrincipal(maybeRequest);
      if (principalOrResponse instanceof Response) {
        return principalOrResponse;
      }
    }

    // Rate limiting check (if configured)
    if (options.rateLimit) {
      const limiter = getLimiter(limiterKey, options.rateLimit.interval, options.rateLimit.limit);
      const request = args[0] as Request;
      const ip = extractIp(request);
      const { success, reset } = limiter.check(ip);
      if (!success) {
        return Response.json(
          { error: "Te veel verzoeken. Probeer het later opnieuw." },
          {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
          },
        );
      }
    }

    try {
      return await handler(...args);
    } catch (error) {
      console.error(`${logPrefix}:`, error);
      Sentry.captureException(error, { tags: { source: "api-handler" } });
      return Response.json({ error: errorMessage }, { status });
    }
  };
}
