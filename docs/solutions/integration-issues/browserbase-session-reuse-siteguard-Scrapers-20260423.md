---
title: Reuse one Browserbase session to pass SiteGuard across every detail-page fetch
date: 2026-04-23
category: integration-issues
module: Scrapers
problem_type: integration_issue
component: background_job
symptoms:
  - "MiPublic scrape returns status=failed with 632 'pagina wordt geblokkeerd door een anti-bot challenge' errors"
  - "Sitemap fetch works but every per-detail fetch 202's on sgcaptcha"
  - "Deprecated `wss://connect.browserbase.com?apiKey=&projectId=` endpoint returns HTTP 400"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [scrapers, browserbase, anti-bot, siteguard, mipublic, puppeteer, session-reuse]
---

# Reuse one Browserbase session to pass SiteGuard across every detail-page fetch

## Problem

MiPublic's site runs SiteGuard anti-bot (HTTP 202 + meta-refresh to `/.well-known/captcha/`). A one-shot Browserbase session per sitemap-fetch got us through the sitemap, but then 632 per-detail fetches went through direct HTTP and every one hit the captcha. Scrape recorded `status=failed`, 0 listings saved.

## Symptoms

- `status=failed`, `errors: ["MiPublic pagina wordt geblokkeerd door een anti-bot challenge: ..."]` × ~630 rows per run
- `duration=12s` (just enough to fan out 632 direct-fetch attempts)
- Scraper-dashboard red, circuit breaker trending toward tripped

## What Didn't Work

- Sending captcha-triggering URLs through Firecrawl as a second-tier fallback — Firecrawl hit the same wall and the `FIRECRAWL_API_KEY` was expired anyway.
- Retrying direct fetches with increased timeouts — SiteGuard doesn't self-resolve in a stateless HTTP call, it needs a real browser context to run the meta-refresh redirect and earn the cookie.

## Solution

Open ONE Browserbase session for the whole scrape and reuse it for every fetch:

```ts
type BrowserbaseHandle = {
  fetchText: (url: string) => Promise<string>;
  close: () => Promise<void>;
};

async function openBrowserbaseSession(): Promise<BrowserbaseHandle | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  // Browserbase deprecated the direct `wss://connect.browserbase.com?apiKey=`
  // endpoint — it now returns HTTP 400. The new flow is POST /v1/sessions
  // first, then connect to the signed `connectUrl` from the response.
  const res = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: { "X-BB-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  const { connectUrl } = (await res.json()) as { connectUrl?: string };
  if (!connectUrl) return null;

  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.connect({ browserWSEndpoint: connectUrl });
  const page = await browser.newPage();
  let siteGuardResolved = false;

  return {
    async fetchText(url: string): Promise<string> {
      if (!siteGuardResolved) {
        // First call: navigate via page.goto so SiteGuard self-resolves and
        // the cookie lands in the browser context.
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
        const deadline = Date.now() + 25_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 2_000));
          const html = await page.content();
          if (!html.toLowerCase().includes("sgcaptcha")) break;
        }
        siteGuardResolved = true;
      }
      // Subsequent calls: use an in-page fetch() so we get raw response
      // bodies (page.content() wraps XML in an HTML document).
      return await page.evaluate(async (u) => (await fetch(u)).text(), url);
    },
    async close(): Promise<void> {
      await browser.close().catch(() => {});
    },
  };
}
```

Then thread the handle through the scrape function:

```ts
async function scrapeMipublicListings(config, options) {
  const handle = await openBrowserbaseSession().catch(() => null);
  try {
    const discovered = await discoverMipublicDetailUrls(resolved, handle);
    // ... fetch every detail page via handle.fetchText(url) at concurrency 4
    return { listings, errors };
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}
```

## Why This Works

SiteGuard is cookie-based — once a real Chrome navigation has run the meta-refresh challenge, the resulting cookie unlocks every subsequent request from that same browser context. Reusing one session spreads the ~10s captcha-resolve cost across 630 fetches (≈15ms each) instead of paying it per call, and `page.evaluate(fetch)` returns raw response bodies so the downstream XML/HTML parser doesn't need to unwrap puppeteer's `page.content()` HTML wrapper.

## Prevention

- When an anti-bot challenge blocks a single request, assume cookie-based and try session-reuse before reaching for Browserbase-per-call (which is wasteful) or upgrading to Firecrawl (which is slower and costs more).
- `page.content()` wraps XML in an HTML document — if downstream needs the raw bytes, use `page.evaluate(async u => (await fetch(u)).text(), url)` instead.
- Graceful degradation matters: when `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID` are missing, fall through to the direct-fetch path so CI/tests still work without the credential.

## Related Issues

- RJC-213 (PR #219) — initial sitemap-extractor fix that discovered sitemap URLs; didn't yet handle detail pages.
- RJC-216 (PR #226) — this fix.
- `docs/solutions/integration-issues/playwright-externalized-triggerdev-AutopilotSystem-20260329.md` — a sibling pattern for externalising browser-driven work out of Trigger.dev.
