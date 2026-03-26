import { stripHtml, ensureMinLength, readString, readNumber } from "./lib/utils";
import type { PlatformBlockerKind, RawScrapedListing } from "./types";

const DEFAULT_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (compatible; MotianBot/1.0; +https://motian.ai)",
};

const MAX_DETAIL_PAGES = 10;

export const CONSENT_BODY_MARKER_STRINGS = [
  "dpg media privacy gate",
  "privacygate-confirm",
  "jouw privacy-instellingen",
] as const;

export const CONSENT_URL_MARKER_STRINGS = ["myprivacy.dpgmedia.nl", "/consent"] as const;

type AllowedListingUrl = (url: URL) => boolean;

type PublicJobBoardOptions = {
  displayName: string;
  sourceUrl: string;
  isAllowedListingUrl: AllowedListingUrl;
  initialPage?: PublicJobBoardPage;
  requestHeaders?: Record<string, string>;
};

export type PublicJobBoardPage = {
  requestedUrl: string;
  url: string;
  html: string;
  status: number;
  headers: Headers;
};

export type PublicJobBoardBlocker = {
  blockerKind: PlatformBlockerKind;
  evidence: {
    requestedUrl: string;
    finalUrl: string;
    status: number;
    matchedMarkers: string[];
    htmlSnippet: string;
  };
  message: string;
};

export async function scrapePublicJobBoard({
  displayName,
  sourceUrl,
  isAllowedListingUrl,
  initialPage,
  requestHeaders,
}: PublicJobBoardOptions): Promise<RawScrapedListing[]> {
  const allowedSourceUrl = parseAllowedUrl(sourceUrl, displayName, isAllowedListingUrl);
  const page =
    initialPage ?? (await fetchPublicJobBoardPage(allowedSourceUrl.toString(), requestHeaders));

  assertPageAccessible(page, displayName, isAllowedListingUrl);

  const directListings = mapJobPostingObjects(extractJobPostingObjects(page.html), page.url);
  if (directListings.length > 0) {
    return dedupeListings(directListings);
  }

  const detailUrls = extractDetailUrls(page.html, page.url, isAllowedListingUrl);
  if (detailUrls.length === 0) {
    throw new Error(
      `${displayName} gaf geen parseerbare vacaturedata terug. Controleer de bron-URL of werk de adapterselectors bij.`,
    );
  }

  const listings: RawScrapedListing[] = [];
  for (const detailUrl of detailUrls.slice(0, MAX_DETAIL_PAGES)) {
    const detailPage = await fetchPublicJobBoardPage(detailUrl, requestHeaders);
    assertPageAccessible(detailPage, displayName, isAllowedListingUrl);
    listings.push(...mapJobPostingObjects(extractJobPostingObjects(detailPage.html), detailPage.url));
  }

  if (listings.length === 0) {
    throw new Error(
      `${displayName} detailpagina's bevatten geen bruikbare JobPosting-data. Browser-automatisering of aangepaste parsing is nog nodig.`,
    );
  }

  return dedupeListings(listings);
}

export function parsePublicJobBoardJobPostings(
  html: string,
  fallbackUrl: string,
): RawScrapedListing[] {
  return dedupeListings(mapJobPostingObjects(extractJobPostingObjects(html), fallbackUrl));
}

export async function fetchPublicJobBoardPage(
  url: string,
  requestHeaders: Record<string, string> = {},
): Promise<PublicJobBoardPage> {
  const response = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      ...requestHeaders,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  return {
    requestedUrl: url,
    url: response.url || url,
    html: await response.text(),
    status: response.status,
    headers: response.headers,
  };
}

export function detectPublicJobBoardBlocker(
  page: PublicJobBoardPage,
  displayName: string,
): PublicJobBoardBlocker | null {
  const lowerHtml = page.html.toLowerCase();
  const lowerFinalUrl = page.url.toLowerCase();
  const lowerRequestedUrl = page.requestedUrl.toLowerCase();

  const matchedConsentMarkers = [
    ...CONSENT_BODY_MARKER_STRINGS.flatMap((marker) =>
      lowerHtml.includes(marker) ? [`body:${marker}`] : [],
    ),
    ...CONSENT_URL_MARKER_STRINGS.flatMap((marker) =>
      lowerFinalUrl.includes(marker) || lowerRequestedUrl.includes(marker)
        ? [`url:${marker}`]
        : [],
    ),
  ];

  if (matchedConsentMarkers.length > 0) {
    return createBlocker(
      "consent_required",
      page,
      matchedConsentMarkers,
      `${displayName} wordt momenteel geblokkeerd door de privacy gate. Een browser-/consent-stap is nog nodig voor productiegebruik.`,
    );
  }

  const monsterboardBlocker = detectMonsterboardBlocker(page, displayName, lowerHtml);
  if (monsterboardBlocker) {
    return monsterboardBlocker;
  }

  return null;
}

function parseAllowedUrl(
  value: string,
  displayName: string,
  isAllowedListingUrl: AllowedListingUrl,
): URL {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${displayName} bron-URL is ongeldig: ${value}`);
  }

  if (!isAllowedListingUrl(parsed)) {
    throw new Error(`${displayName} bron-URL valt buiten de toegestane host/path-regels.`);
  }

  return parsed;
}

function assertPageAccessible(
  page: PublicJobBoardPage,
  displayName: string,
  isAllowedListingUrl: AllowedListingUrl,
): void {
  if (page.status >= 400) {
    throw new Error(`Pagina laden mislukt (${page.status}) voor ${page.requestedUrl}`);
  }

  const finalUrl = parseAllowedUrl(page.url, displayName, isAllowedListingUrl);
  if (!isAllowedListingUrl(finalUrl)) {
    throw new Error(`${displayName} redirecte naar een niet-toegestane detailpagina.`);
  }

  const blocker = detectPublicJobBoardBlocker(page, displayName);
  if (blocker) {
    throw new Error(blocker.message);
  }
}

function detectMonsterboardBlocker(
  page: PublicJobBoardPage,
  displayName: string,
  lowerHtml: string,
): PublicJobBoardBlocker | null {
  if (!isMonsterboardUrl(page.requestedUrl) && !isMonsterboardUrl(page.url)) {
    return null;
  }

  const matchedMarkers: string[] = [];
  if (page.status === 403) matchedMarkers.push("status:403");

  for (const headerName of ["x-datadome", "x-dd-b", "x-datadome-cid"]) {
    if (page.headers.get(headerName)) {
      matchedMarkers.push(`header:${headerName}`);
    }
  }

  const setCookieHeader = page.headers.get("set-cookie")?.toLowerCase() ?? "";
  if (setCookieHeader.includes("datadome=")) {
    matchedMarkers.push("cookie:datadome");
  }

  for (const [label, marker] of [
    ["body:please enable js and disable any ad blocker", "please enable js and disable any ad blocker"],
    ["body:captcha-delivery.com", "captcha-delivery.com"],
    ["body:var dd={", "var dd={"],
    ["body:geo.captcha-delivery.com/captcha", "geo.captcha-delivery.com/captcha"],
  ] as const) {
    if (lowerHtml.includes(marker)) {
      matchedMarkers.push(label);
    }
  }

  if (matchedMarkers.length > 0) {
    return createBlocker(
      "anti_bot_challenge",
      page,
      matchedMarkers,
      `${displayName} blokkeert deze import momenteel met een DataDome anti-bot challenge. Controleer de bron-URL en gebruik browser-evidence voor verdere diagnose.`,
    );
  }

  if (isMonsterboardRedirect(page.requestedUrl, page.url, lowerHtml)) {
    return createBlocker(
      "source_url_redirect",
      page,
      ["redirect:homepage", "body:livecareer/cv-maker"],
      `${displayName} bron-URL verwijst niet meer naar een vacaturepagina en redirect naar de homepage/CV-maker landingspagina. Werk de bron-URL bij voordat je opnieuw importeert.`,
    );
  }

  return null;
}

function createBlocker(
  blockerKind: PlatformBlockerKind,
  page: PublicJobBoardPage,
  matchedMarkers: string[],
  message: string,
): PublicJobBoardBlocker {
  return {
    blockerKind,
    evidence: {
      requestedUrl: page.requestedUrl,
      finalUrl: page.url,
      status: page.status,
      matchedMarkers,
      htmlSnippet: page.html.slice(0, 500),
    },
    message,
  };
}

function isMonsterboardUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "www.monsterboard.nl";
  } catch {
    return false;
  }
}

function isMonsterboardRedirect(requestedUrl: string, finalUrl: string, lowerHtml: string): boolean {
  try {
    const requested = new URL(requestedUrl);
    const final = new URL(finalUrl);

    if (requested.hostname !== "www.monsterboard.nl" || final.hostname !== "www.monsterboard.nl") {
      return false;
    }

    const requestedPath = requested.pathname.replace(/\/+$/, "") || "/";
    const finalPath = final.pathname.replace(/\/+$/, "") || "/";

    if (requestedPath === "/" || finalPath !== "/") {
      return false;
    }

    return (
      requestedPath !== finalPath &&
      (lowerHtml.includes("livecareer") ||
        lowerHtml.includes("cv-maker") ||
        lowerHtml.includes("maak een cv") ||
        lowerHtml.includes("cv maker"))
    );
  } catch {
    return false;
  }
}

function extractJobPostingObjects(html: string): Record<string, unknown>[] {
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const jobPostings: Record<string, unknown>[] = [];

  for (const match of html.matchAll(scriptRegex)) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;

    try {
      const parsed = JSON.parse(rawJson.replace(/^<!--\s*/, "").replace(/\s*-->$/, ""));
      for (const node of collectJsonObjects(parsed)) {
        if (isJobPostingNode(node)) {
          jobPostings.push(node);
        }
      }
    } catch {
      continue;
    }
  }

  return jobPostings;
}

function collectJsonObjects(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((entry) => collectJsonObjects(entry));

  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap((entry) => collectJsonObjects(entry))];
}

function isJobPostingNode(node: Record<string, unknown>): boolean {
  const type = node["@type"];

  return Array.isArray(type)
    ? type.some((entry) => entry === "JobPosting")
    : type === "JobPosting";
}

function mapJobPostingObjects(
  jobPostings: Record<string, unknown>[],
  fallbackUrl: string,
): RawScrapedListing[] {
  return jobPostings
    .map((jobPosting) => mapJobPosting(jobPosting, fallbackUrl))
    .filter((listing): listing is RawScrapedListing => listing !== null);
}

function mapJobPosting(
  jobPosting: Record<string, unknown>,
  fallbackUrl: string,
): RawScrapedListing | null {
  const title = readString(jobPosting.title);
  if (!title) return null;

  const externalUrl = readString(jobPosting.url) ?? fallbackUrl;
  const company = readString(toRecord(jobPosting.hiringOrganization)?.name) ?? undefined;
  const address = extractAddress(jobPosting.jobLocation);
  const location = [address.city, address.region].filter(Boolean).join(" - ") || undefined;
  const salary = extractSalary(jobPosting.baseSalary);
  const workArrangement =
    readString(jobPosting.jobLocationType) === "TELECOMMUTE" ? "remote" : undefined;

  return {
    title,
    company,
    location,
    province: address.region,
    postcode: address.postalCode,
    countryCode: normalizeCountryCode(address.country),
    description: ensureMinLength(readString(jobPosting.description) ?? title, title),
    externalId: readIdentifier(jobPosting.identifier) ?? slugifyIdentifier(externalUrl),
    externalUrl,
    postedAt: readString(jobPosting.datePosted) ?? undefined,
    applicationDeadline: readString(jobPosting.validThrough) ?? undefined,
    contractType: mapEmploymentType(jobPosting.employmentType),
    workArrangement,
    rateMin: salary.rateMin,
    rateMax: salary.rateMax,
  };
}

function extractAddress(jobLocation: unknown): {
  city?: string;
  country?: string;
  postalCode?: string;
  region?: string;
} {
  const locations = Array.isArray(jobLocation) ? jobLocation : [jobLocation];

  for (const location of locations) {
    const address = toRecord(toRecord(location)?.address);
    if (address) {
      return {
        city: readString(address.addressLocality) ?? undefined,
        country: readString(address.addressCountry) ?? undefined,
        postalCode: readString(address.postalCode) ?? undefined,
        region: readString(address.addressRegion) ?? undefined,
      };
    }
  }

  return {};
}

function extractSalary(baseSalary: unknown): { rateMin?: number; rateMax?: number } {
  const salaryRecord = toRecord(baseSalary);
  const valueRecord = toRecord(salaryRecord?.value) ?? salaryRecord;
  const unitText = readString(valueRecord?.unitText ?? salaryRecord?.unitText);

  if (unitText && !/(hour|uur)/i.test(unitText)) {
    return {};
  }

  const minValue = readNumber(valueRecord?.minValue);
  const maxValue = readNumber(valueRecord?.maxValue);
  const value = readNumber(valueRecord?.value);

  return {
    rateMin: minValue ?? value,
    rateMax: maxValue ?? value,
  };
}

function extractDetailUrls(
  html: string,
  pageUrl: string,
  isAllowedListingUrl: AllowedListingUrl,
): string[] {
  const urls = new Set<string>();

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    const href = match[1];
    if (!href) continue;

    let absoluteUrl: URL;

    try {
      absoluteUrl = new URL(href, pageUrl);
    } catch {
      continue;
    }

    if (isAllowedListingUrl(absoluteUrl)) {
      urls.add(absoluteUrl.toString());
    }
  }

  return [...urls];
}

function dedupeListings(listings: RawScrapedListing[]): RawScrapedListing[] {
  return [...new Map(listings.map((listing) => [String(listing.externalId), listing])).values()];
}

function mapEmploymentType(employmentType: unknown): string | undefined {
  const normalized = [employmentType]
    .flat()
    .filter((entry): entry is string => typeof entry === "string");

  if (normalized.some((value) => /contractor|freelance/i.test(value))) return "freelance";
  if (normalized.some((value) => /temporary|contract/i.test(value))) return "interim";
  if (normalized.some((value) => /full[_ -]?time|part[_ -]?time|permanent/i.test(value))) {
    return "vast";
  }

  return undefined;
}

function slugifyIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function readIdentifier(identifier: unknown): string | null {
  if (typeof identifier === "string") return identifier;
  if (typeof identifier === "number") return String(identifier);

  const record = toRecord(identifier);
  return readString(record?.value ?? record?.name) ?? null;
}

function normalizeCountryCode(country: string | undefined): string | undefined {
  if (!country) return undefined;
  if (country.length === 2) return country.toUpperCase();
  if (country.toLowerCase() === "netherlands") return "NL";
  return country.toUpperCase();
}

/** Converts unknown value to record or null */
function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
