import { clearTimeout as clearNodeTimeout, setTimeout as setNodeTimeout } from "node:timers";
import type {
  PlatformAdapter,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
  RawScrapedListing,
} from "./types";
import {
  decodeText,
  firstMatch,
  parsePositiveInteger,
  toAbsoluteUrl,
  ensureMinLength,
  stripHtml,
  sanitizeHours,
} from "./lib/utils";

const WERKZOEKEN_FETCH_TIMEOUT_MS = 20_000;
const WERKZOEKEN_SCRAPE_MAX_DURATION_MS = 240_000;
// Lower bound is intentionally small so tests (and aggressive scheduling)
// can request short deadlines; the AbortSignal then short-circuits every
// in-flight fetch instead of waiting for the per-request timeout.
const WERKZOEKEN_SCRAPE_MAX_DURATION_MIN_MS = 500;
const WERKZOEKEN_SCRAPE_MAX_DURATION_MAX_MS = 600_000;

function resolveWerkzoekenMaxDurationMs(value: unknown): number {
  const candidate =
    typeof value === "number" && Number.isFinite(value)
      ? Math.trunc(value)
      : typeof value === "string" && value.trim().length > 0
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(candidate)) return WERKZOEKEN_SCRAPE_MAX_DURATION_MS;

  return Math.min(
    Math.max(candidate, WERKZOEKEN_SCRAPE_MAX_DURATION_MIN_MS),
    WERKZOEKEN_SCRAPE_MAX_DURATION_MAX_MS,
  );
}
const DEFAULT_WERKZOEKEN_ORIGIN = "https://www.werkzoeken.nl";
const DEFAULT_REQUEST_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1",
  "Accept-Encoding": "gzip, deflate, br",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};
const RETRYABLE_FETCH_STATUSES = new Set([403, 429]);
const FETCH_RETRY_ATTEMPTS = 4;
const FETCH_RETRY_DELAY_MS = 2000;
const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

type WerkzoekenSession = {
  cookieHeader?: string;
  referer: string;
};

function combineSignals(
  perRequestTimeoutMs: number,
  external?: AbortSignal,
): AbortSignal {
  const perRequest = AbortSignal.timeout(perRequestTimeoutMs);
  if (!external) return perRequest;
  const anyFn = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal })
    .any;
  if (typeof anyFn === "function") {
    return anyFn.call(AbortSignal, [perRequest, external]);
  }
  // Fallback: manual composition for runtimes without AbortSignal.any
  const controller = new AbortController();
  const forwardAbort = (src: AbortSignal) => {
    if (src.aborted) {
      controller.abort((src as { reason?: unknown }).reason);
      return;
    }
    src.addEventListener("abort", () => controller.abort((src as { reason?: unknown }).reason), {
      once: true,
    });
  };
  forwardAbort(perRequest);
  forwardAbort(external);
  return controller.signal;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const reason = (signal as { reason?: unknown }).reason;
    throw reason instanceof Error
      ? reason
      : new Error(typeof reason === "string" ? reason : "Werkzoeken scrape afgebroken");
  }
}

function parseSalaryValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const raw = value.replace(/[^\d.,]/g, "").trim();
  if (!raw) return undefined;

  const normalized = raw.match(/^\d{1,3}(\.\d{3})+(,\d+)?$/)
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed);
}

function normalizeHours(value: string | undefined): { min?: number; max?: number } {
  if (!value) return {};
  const range = value.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    return {
      min: Number.parseInt(range[1], 10),
      max: Number.parseInt(range[2], 10),
    };
  }
  if (/fulltime/i.test(value)) {
    return { max: 40 };
  }
  const single = value.match(/(\d+)/);
  if (single) {
    const hours = Number.parseInt(single[1], 10);
    return { max: hours };
  }
  return {};
}

function resolveWerkzoekenSourceUrl(baseUrl: string, sourcePath: string): URL {
  const normalizedBaseUrl = new URL(baseUrl);
  const sourceUrl = new URL(sourcePath, normalizedBaseUrl);

  if (sourceUrl.origin !== normalizedBaseUrl.origin) {
    throw new Error("Werkzoeken sourcePath moet op dezelfde host blijven als baseUrl");
  }

  return sourceUrl;
}

function extractWerkzoekenCookieHeader(response: Response): string | undefined {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    headers.getSetCookie?.() ??
    (response.headers.get("set-cookie") ? [response.headers.get("set-cookie") as string] : []);

  const cookies = setCookies
    .map((value) => value.split(";", 1)[0]?.trim())
    .filter((value): value is string => Boolean(value));

  return cookies.length > 0 ? cookies.join("; ") : undefined;
}

async function fetchWerkzoekenResponse(
  url: string,
  options?: Partial<WerkzoekenSession> & { signal?: AbortSignal },
): Promise<Response> {
  const headers = new Headers(DEFAULT_REQUEST_HEADERS);
  headers.set("Referer", options?.referer ?? DEFAULT_WERKZOEKEN_ORIGIN);

  if (options?.cookieHeader) {
    headers.set("Cookie", options.cookieHeader);
  }

  throwIfAborted(options?.signal);

  return fetch(url, {
    headers,
    signal: combineSignals(WERKZOEKEN_FETCH_TIMEOUT_MS, options?.signal),
  });
}

async function bootstrapWerkzoekenSession(
  baseUrl: string,
  sourcePath: string,
  signal?: AbortSignal,
): Promise<WerkzoekenSession> {
  const sourceUrl = resolveWerkzoekenSourceUrl(baseUrl, sourcePath);
  const response = await fetchWerkzoekenResponse(sourceUrl.toString(), { signal });

  if (response.ok) {
    return {
      cookieHeader: extractWerkzoekenCookieHeader(response),
      referer: sourceUrl.toString(),
    };
  }

  // If bootstrap gets 403, fall back to Firecrawl — session cookies won't be available
  // but pagination will still work via Firecrawl proxy for subsequent pages
  if (RETRYABLE_FETCH_STATUSES.has(response.status) && process.env.FIRECRAWL_API_KEY) {
    return { referer: sourceUrl.toString() };
  }

  throw new Error(`Werkzoeken session bootstrap mislukt voor ${sourceUrl}: ${response.status}`);
}

export function buildWerkzoekenListPageUrl(
  baseUrl: string,
  sourcePath: string,
  page: number,
): string {
  const url = resolveWerkzoekenSourceUrl(baseUrl, sourcePath);
  if (page > 1) {
    url.searchParams.set("pnr", String(page));
  }
  return url.toString();
}

export function parseWerkzoekenListingCards(
  html: string,
  baseUrl = DEFAULT_WERKZOEKEN_ORIGIN,
): RawScrapedListing[] {
  const listings: RawScrapedListing[] = [];
  // Match vacancy card <a> blocks. Werkzoeken renders the inner <h3> with attributes
  // (e.g. `<h3 data-vx="d">`) so the old anchor-to-h3 pattern silently returned zero
  // listings whenever those attributes appeared. Accept any attribute set on <h3>.
  const linkRegex = /<a\b([\s\S]*?)class="vacancy vac[\s\S]*?href="([^"]+)"[\s\S]*?<h3\b[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/g;

  let match = linkRegex.exec(html);
  while (match !== null) {
    const rawAttributes = match[1];
    const externalUrl = toAbsoluteUrl(match[2], baseUrl);
    const title = stripHtml(decodeText(match[3])).replace(/\s+/g, " ").trim();
    const externalId = firstMatch(/data-vacancyid="([^"]+)"/, rawAttributes);
    const company = stripHtml(decodeText(firstMatch(/data-business="([^"]+)"/, rawAttributes)));
    const location = decodeText(firstMatch(/data-location-label="([^"]+)"/, rawAttributes));
    const contractLabel = decodeText(firstMatch(/data-contract-type="([^"]+)"/, rawAttributes));
    const educationLevel = decodeText(firstMatch(/data-education="([^"]+)"/, rawAttributes));
    const hoursLabel = decodeText(firstMatch(/data-hours="([^"]+)"/, rawAttributes));
    const ageLabel = decodeText(firstMatch(/data-age="([^"]+)"/, rawAttributes));
    const { min, max } = normalizeHours(hoursLabel);

    if (externalId) {
      listings.push({
        externalId,
        externalUrl,
        title,
        company,
        location,
        contractLabel,
        educationLevel,
        rateMin: parseSalaryValue(firstMatch(/data-salary-minimal="([^"]+)"/, rawAttributes)),
        rateMax: parseSalaryValue(firstMatch(/data-salary-maximum="([^"]+)"/, rawAttributes)),
        minHoursPerWeek: sanitizeHours(min),
        hoursPerWeek: sanitizeHours(max),
        description: `${title} bij ${company}`.trim(),
        sourceUrl: externalUrl,
        sourcePlatform: "Werkzoeken.nl",
        conditions: [hoursLabel, educationLevel, contractLabel, ageLabel].filter(Boolean),
      });
    }

    match = linkRegex.exec(html);
  }

  return listings;
}

export function parseWerkzoekenDetailPage(
  html: string,
  externalUrl: string,
): Partial<RawScrapedListing> {
  const title = stripHtml(
    decodeText(firstMatch(/<h1[^>]*>([\s\S]*?)<\/h1>/, html)) ||
      decodeText(firstMatch(/<meta property="og:title" content="([^"]+)"/, html)),
  );
  const company = stripHtml(
    decodeText(
      firstMatch(/<div class="company-name">([\s\S]*?)<\/div>/, html) ??
        firstMatch(/\|\s*([^|]+)\s*op Werkzoeken\.nl/, html),
    ),
  );
  const location = stripHtml(
    decodeText(
      firstMatch(
        /<div class="job-overview">[\s\S]*?<div>([\s\S]*?)<\/div>/,
        html,
      ),
    ),
  );
  const rawDescription = stripHtml(
    decodeText(
      firstMatch(
        /<section class="job-description">([\s\S]*?)<\/section>/,
        html,
      ),
    ),
  );

  return {
    externalUrl,
    title: title?.slice(0, 500),
    company: company?.slice(0, 300),
    location,
    description: ensureMinLength(rawDescription?.slice(0, 8000), stripHtml(title) || "Werkzoeken vacature"),
  };
}

async function fetchViaBrowserbase(url: string, signal?: AbortSignal): Promise<string> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error("BROWSERBASE_API_KEY/PROJECT_ID niet geconfigureerd");
  }

  throwIfAborted(signal);

  // Browserbase deprecated the bare `wss://connect.browserbase.com?apiKey=`
  // endpoint (returns 400). Current API: POST /v1/sessions → use the
  // returned signed `connectUrl` for the puppeteer WebSocket. This was
  // already migrated in `mipublic.ts`; this branch is the parity fix.
  const sessionRes = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: { "x-bb-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
    signal: combineSignals(15_000, signal),
  });
  if (!sessionRes.ok) {
    throw new Error(`Browserbase session-create faalde: ${sessionRes.status}`);
  }
  const sessionBody = (await sessionRes.json()) as { connectUrl?: string };
  if (!sessionBody.connectUrl) {
    throw new Error("Browserbase session-create gaf geen connectUrl terug");
  }

  // Dynamic import to avoid bundling puppeteer-core when not used
  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.connect({
    browserWSEndpoint: sessionBody.connectUrl,
  });

  const onAbort = () => {
    // Close the remote browser as soon as the hard deadline fires so the
    // puppeteer promises reject and the scrape unwinds promptly.
    browser.close().catch(() => {});
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    throwIfAborted(signal);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });

    // Werkzoeken uses Cloudflare protection ("Just a moment...").
    // Wait for the challenge to resolve by polling for vacancy content.
    const maxWaitMs = 20_000;
    const pollIntervalMs = 2_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const title = await page.title();
      if (!title.includes("Just a moment") && !title.includes("Checking")) {
        // Cloudflare challenge resolved — wait briefly for DOM to hydrate
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // Werkzoeken uses CookieYes consent banner — dismiss it so content loads fully
    await page
      .evaluate(() => {
        const btn = document.querySelector<HTMLButtonElement>(".cky-btn-accept");
        if (btn) btn.click();
      })
      .catch(() => {});
    // Brief settle after consent dismiss
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    return await page.content();
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await browser.close().catch(() => {});
  }
}

async function fetchViaFirecrawl(url: string, signal?: AbortSignal): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY niet geconfigureerd — kan niet terugvallen op Firecrawl");
  }

  throwIfAborted(signal);

  const response = await fetch(FIRECRAWL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["html"], waitFor: 2000 }),
    signal: combineSignals(30_000, signal),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl fallback mislukt voor ${url}: ${response.status}`);
  }

  const body = (await response.json()) as { success?: boolean; data?: { html?: string } };
  if (!body.success || !body.data?.html) {
    throw new Error(`Firecrawl retourneerde geen HTML voor ${url}`);
  }

  return body.data.html;
}

async function fetchHtml(
  url: string,
  session?: Partial<WerkzoekenSession>,
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal);

  // If Firecrawl is available, try direct fetch once then fallback immediately
  // (avoids wasting 8s on retries that will fail on cloud IPs)
  const maxAttempts = process.env.FIRECRAWL_API_KEY ? 1 : FETCH_RETRY_ATTEMPTS;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfAborted(signal);
    const response = await fetchWerkzoekenResponse(url, { ...session, signal });

    if (response.ok) {
      return response.text();
    }

    lastStatus = response.status;
    const shouldRetry =
      RETRYABLE_FETCH_STATUSES.has(response.status) && attempt < maxAttempts;
    if (!shouldRetry) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, FETCH_RETRY_DELAY_MS * attempt));
  }

  throwIfAborted(signal);

  // Fallback chain: Browserbase (real Chrome, residential IP) → Firecrawl (JS rendering proxy)
  if (RETRYABLE_FETCH_STATUSES.has(lastStatus)) {
    if (process.env.BROWSERBASE_API_KEY) {
      return fetchViaBrowserbase(url, signal);
    }
    if (process.env.FIRECRAWL_API_KEY) {
      return fetchViaFirecrawl(url, signal);
    }
  }

  throw new Error(`Werkzoeken fetch mislukt voor ${url}: ${lastStatus}`);
}

async function enrichWerkzoekenListings(
  listings: RawScrapedListing[],
  detailConcurrency: number,
  session?: Partial<WerkzoekenSession>,
  limit?: number,
  signal?: AbortSignal,
): Promise<RawScrapedListing[]> {
  const bounded = listings.slice(0, limit ?? listings.length);
  const results: RawScrapedListing[] = [];

  for (let index = 0; index < bounded.length; index += detailConcurrency) {
    throwIfAborted(signal);
    const batch = bounded.slice(index, index + detailConcurrency);
    const enriched = await Promise.all(
      batch.map(async (listing) => {
        const externalUrl = String(listing.externalUrl ?? "");
        try {
          const detailHtml = await fetchHtml(externalUrl, session, signal);
          return {
            ...listing,
            ...parseWerkzoekenDetailPage(detailHtml, externalUrl),
          };
        } catch {
          return listing;
        }
      }),
    );
    results.push(...enriched);
  }

  return results;
}

async function scrapeWerkzoekenInternal(
  config: PlatformRuntimeConfig,
  options?: { limit?: number; smoke?: boolean; signal?: AbortSignal },
): Promise<PlatformScrapeResult> {
  const sourcePath = String(config.parameters.sourcePath ?? "/vacatures-voor/techniek/");
  const maxPages = parsePositiveInteger(config.parameters.maxPages, 3);
  const pnrStep = parsePositiveInteger(config.parameters.pnrStep, 10);
  const detailConcurrency = parsePositiveInteger(config.parameters.detailConcurrency, 4);
  const skipDetail = Boolean(config.parameters.skipDetailEnrichment);
  const signal = options?.signal;
  throwIfAborted(signal);
  const session = await bootstrapWerkzoekenSession(config.baseUrl, sourcePath, signal);

  // pnr= returns cumulative results (pnr=10 -> 500 results).
  // We use sliding window (fetch pnr=10, 20, 30...) to minimize redundant bandwidth.
  const seenIds = new Set<string>();
  const listings: RawScrapedListing[] = [];
  const pages = Array.from(
    { length: Math.max(Math.ceil(maxPages / pnrStep), 1) },
    (_, index) => pnrStep + index * pnrStep,
  );
  const pageUrls = pages.map((page) => ({
    page,
    url: buildWerkzoekenListPageUrl(config.baseUrl, sourcePath, page),
  }));
  const settledPages = await Promise.allSettled(
    pageUrls.map(async ({ page, url }) => ({
      page,
      url,
      html: await fetchHtml(url, session, signal),
    })),
  );
  throwIfAborted(signal);

  const directPages = settledPages.map((result, index) => ({
    page: pageUrls[index].page,
    url: pageUrls[index].url,
    result,
  }));
  const allDirectFetchesFailed = directPages.every((page) => page.result.status === "rejected");

  const pushNewListings = (parsed: RawScrapedListing[]) => {
    const newListings = parsed.filter((listing) => {
      const id = String(listing.externalId ?? "");
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
    listings.push(...newListings);
    return newListings.length;
  };

  if (allDirectFetchesFailed && process.env.BROWSERBASE_API_KEY) {
    session.cookieHeader = undefined;

    for (const { page, url } of pageUrls) {
      throwIfAborted(signal);
      try {
        const browserbaseHtml = await fetchViaBrowserbase(url, signal);
        const parsed = parseWerkzoekenListingCards(browserbaseHtml, config.baseUrl);
        const added = pushNewListings(parsed);

        if (added === 0) {
          if (page > pnrStep) {
            break;
          }

          return {
            listings,
            errors: ["Geen Werkzoeken vacaturekaarten gevonden op de resultatenpagina"],
            blockerKind: "unexpected_markup",
            evidence: {
              pageUrl: url,
            },
          };
        }

        if (options?.smoke || (options?.limit && listings.length >= options.limit)) {
          break;
        }
      } catch {
        if (page > pnrStep) {
          break;
        }

        return {
          listings,
          errors: ["Geen Werkzoeken vacaturekaarten gevonden op de resultatenpagina"],
          blockerKind: "unexpected_markup",
          evidence: {
            pageUrl: url,
          },
        };
      }
    }
  } else {
    for (const { page, url, result } of directPages) {
      if (result.status === "rejected") {
        continue;
      }

      const parsed = parseWerkzoekenListingCards(result.value.html, config.baseUrl);
      let added = pushNewListings(parsed);

      // Intermittent failure mode (RJC-219): the direct fetch returns 200 but
      // the markup has degraded (stripped data-* attributes or no vacancy
      // anchors at all). The page usually renders fine seconds later — so
      // before surfacing `unexpected_markup`, retry the same URL once via
      // Browserbase (real Chrome) when configured. If Browserbase also
      // returns zero cards, fall through to the existing error path.
      if (added === 0 && page === pnrStep && process.env.BROWSERBASE_API_KEY) {
        try {
          throwIfAborted(signal);
          const browserbaseHtml = await fetchViaBrowserbase(url, signal);
          const reparsed = parseWerkzoekenListingCards(browserbaseHtml, config.baseUrl);
          added = pushNewListings(reparsed);
        } catch {
          // Swallow — we fall through to the unexpected_markup branch below.
        }
      }

      if (added === 0) {
        if (page > pnrStep) {
          break;
        }

        return {
          listings,
          errors: ["Geen Werkzoeken vacaturekaarten gevonden op de resultatenpagina"],
          blockerKind: "unexpected_markup",
          evidence: {
            pageUrl: url,
          },
        };
      }

      if (options?.smoke || (options?.limit && listings.length >= options.limit)) {
        break;
      }
    }
  }

  if (listings.length === 0) {
    return {
      listings,
      errors: ["Geen Werkzoeken vacaturekaarten gevonden op de resultatenpagina"],
      blockerKind: "unexpected_markup",
      evidence: {
        pageUrl: pageUrls[0]?.url,
      },
    };
  }

  // Skip detail enrichment for bulk scrapes (listing cards already have title, company, salary, etc.)
  if (skipDetail) {
    return {
      listings,
      evidence: {
        sourcePath,
        fetchedListings: listings.length,
        detailEnrichment: "skipped",
      },
    };
  }

  const enriched = await enrichWerkzoekenListings(
    listings,
    detailConcurrency,
    session,
    options?.limit ?? (options?.smoke ? 3 : undefined),
    signal,
  );

  return {
    listings: enriched,
    evidence: {
      sourcePath,
      fetchedListings: enriched.length,
    },
  };
}

export const werkzoekenAdapter: PlatformAdapter = {
  async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
    const sourcePath = String(config.parameters.sourcePath ?? "/vacatures-voor/techniek/");
    const url = buildWerkzoekenListPageUrl(config.baseUrl, sourcePath, 1);
    const session = await bootstrapWerkzoekenSession(config.baseUrl, sourcePath);
    const html = await fetchHtml(url, session);
    const listings = parseWerkzoekenListingCards(html, config.baseUrl);

    if (listings.length === 0) {
      return {
        ok: false,
        status: "failed",
        blockerKind: "unexpected_markup",
        message: "Geen Werkzoeken vacaturekaarten gevonden op de opgegeven resultatenpagina.",
        evidence: {
          pageUrl: url,
        },
      };
    }

    return {
      ok: true,
      status: "validated",
      message: `Werkzoeken validatie succesvol: ${listings.length} vacaturekaarten gevonden.`,
      evidence: {
        pageUrl: url,
        detectedListings: listings.length,
      },
    };
  },

  async scrape(
    config: PlatformRuntimeConfig,
    options?: { limit?: number; smoke?: boolean },
  ): Promise<PlatformScrapeResult> {
    const maxDurationMs = resolveWerkzoekenMaxDurationMs(config.parameters.maxDurationMs);
    const controller = new AbortController();
    const deadlineError = new Error(
      `Werkzoeken scrape overschreed deadline van ${maxDurationMs}ms`,
    );
    let timeoutHandle: ReturnType<typeof setNodeTimeout> | undefined;
    const timeoutPromise = new Promise<PlatformScrapeResult>((_, reject) => {
      timeoutHandle = setNodeTimeout(() => {
        // Abort all in-flight fetches so the inner scrape actually stops
        // instead of leaking past the deadline (see RJC-212).
        controller.abort(deadlineError);
        reject(deadlineError);
      }, maxDurationMs);
    });
    try {
      return await Promise.race([
        scrapeWerkzoekenInternal(config, { ...options, signal: controller.signal }),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutHandle) clearNodeTimeout(timeoutHandle);
      if (!controller.signal.aborted) {
        controller.abort(new Error("Werkzoeken scrape afgerond"));
      }
    }
  },

  async testImport(
    config: PlatformRuntimeConfig,
    options?: { limit?: number },
  ): Promise<PlatformTestImportResult> {
    const result = await scrapeWerkzoekenInternal(config, {
      limit: options?.limit ?? 3,
      smoke: true,
    });

    return {
      status:
        result.errors && result.errors.length > 0 && result.listings.length === 0
          ? "failed"
          : result.errors && result.errors.length > 0
            ? "partial"
            : "success",
      jobsFound: result.listings.length,
      listings: result.listings,
      errors: result.errors,
      blockerKind: result.blockerKind,
      evidence: result.evidence,
    };
  },
};
