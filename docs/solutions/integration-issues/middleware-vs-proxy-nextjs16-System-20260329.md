---
module: System
date: 2026-03-29
problem_type: integration_issue
component: development_workflow
symptoms:
  - "Vercel build fails with: Both middleware file and proxy file are detected"
  - "Error: Please use proxy.ts only. Learn more: nextjs.org/docs/messages/middleware-to-proxy"
  - "Build exits immediately after detecting both files"
root_cause: config_error
resolution_type: code_fix
severity: critical
tags: [next-js-16, middleware, proxy, vercel, build-error, breaking-change]
---

# Troubleshooting: Next.js 16 Rejects middleware.ts When proxy.ts Exists

## Problem
Creating a `middleware.ts` file for rate limiting caused the Vercel build to fail immediately. Next.js 16 replaced `middleware.ts` with `proxy.ts` and forbids having both files in the project root.

## Environment
- Module: System
- Framework: Next.js 16.1.6
- Affected Component: `middleware.ts`, `proxy.ts`
- Date: 2026-03-29

## Symptoms
- Vercel deployment failed with: `Error: Both middleware file "./middleware.ts" and proxy file "./proxy.ts" are detected. Please use "./proxy.ts" only.`
- Build exited with code 1 immediately after Next.js detection (before compilation)
- Local `pnpm build` reproduced the same error
- Local `pnpm dev` may not always catch this — Turbopack dev mode can be more lenient

## What Didn't Work

**Attempted Solution 1:** Creating a separate `middleware.ts` for rate limiting
- **Why it failed:** Next.js 16 introduced `proxy.ts` as the replacement for `middleware.ts`. Having both files is a hard build error — no workaround possible.

## Solution

Deleted `middleware.ts` and merged its rate limiting logic into the existing `proxy.ts`.

```typescript
// proxy.ts — added at the top of the proxy() function
export function proxy(request: NextRequest) {
  // Rate-limit /pipeline to block bot traffic
  if (request.nextUrl.pathname.startsWith("/pipeline")) {
    const blocked = rateLimitPipeline(request);
    if (blocked) return blocked;
    return NextResponse.next();
  }

  // ... existing API auth/CORS logic unchanged
}

// Expanded matcher to include /pipeline
export const config = {
  matcher: ["/api/:path*", "/pipeline/:path*"],
};
```

The rate limiting helpers (IP tracking, bot UA detection, sliding window) were added as module-level functions in `proxy.ts` alongside the existing CORS/auth helpers.

## Why This Works

1. **Next.js 16 migration:** `proxy.ts` is the canonical replacement for `middleware.ts`. Both serve the same purpose (edge middleware), but Next.js 16 consolidated to one file.
2. **The matcher config** controls which paths trigger the proxy — adding `/pipeline/:path*` to the existing `/api/:path*` matcher routes pipeline traffic through the rate limiter without affecting other page routes.
3. **Short-circuit pattern:** The `/pipeline` check runs before any API auth logic, returning early for non-API paths.

## Prevention

- **Before creating middleware.ts:** Check if `proxy.ts` exists in the project root. If it does, the project is on Next.js 16+ and you must use `proxy.ts` only.
- **Check the Next.js version** in `package.json` — anything ≥16 uses `proxy.ts`
- **Test with `pnpm build`** before pushing, not just `pnpm dev` — Turbopack dev mode may not enforce all build constraints
- Reference: https://nextjs.org/docs/messages/middleware-to-proxy

## Related Issues

- See also: [vercel-fluid-compute-spike-Pipeline-20260329.md](../performance-issues/vercel-fluid-compute-spike-Pipeline-20260329.md) — the rate limiting that triggered this build error
