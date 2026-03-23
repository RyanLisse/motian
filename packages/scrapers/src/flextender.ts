import type { RawScrapedListing } from "./types";
import { stripHtml } from "./strip-html";
import { toAbsoluteUrl, ensureMinLength, sanitizeHours } from "./lib/utils";

const PAGE_URL = "https://www.flextender.nl/opdrachten/";
const AJAX_URL = "https://www.flextender.nl/wp-admin/admin-ajax.php";
const DETAIL_BASE = "https://www.flextender.nl/opdracht/?aanvraagnr=";

type FlextenderListing = RawScrapedListing & {
  externalId: string;
  _rawHours?: string;
};

type FlextenderDetail = Partial<RawScrapedListing> & {
  conditions?: string[];
};

const MAX_HOURS_PER_WEEK = 168;

/** Haal de widget_config token op uit de Flextender pagina HTML */
async function fetchWidgetConfig(): Promise<string | null> {
  const res = await fetch(PAGE_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Pagina laden mislukt: ${res.status}`);
  const html = await res.text();
  const match = html.match(/name="kbs_flx_widget_config"\s+value="([^"]+)"/);
  return match?.[1] ?? null;
}

export async function scrapeFlextender(): Promise<RawScrapedListing[]> {
  console.log("Flextender scrapen via AJAX API (two-step met widget_config)");

  const MAX_RETRIES = 2;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      // Stap 1: Haal widget_config token op uit de pagina
      const widgetConfig = await fetchWidgetConfig();
      if (!widgetConfig) {
        console.warn("Flextender: widget_config niet gevonden op pagina, fallback zonder config");
      }

      // Stap 2: POST als multipart/form-data met widget_config
      const formData = new FormData();
      if (widgetConfig) {
        formData.append("kbs_flx_widget_config", widgetConfig);
      }
      formData.append("action", "kbs_flx_searchjobs");
      formData.append("kbs_flx_joblsrc_freetext", "");
      formData.append("StackOverflow1370021", "Fix autosubmit bug");

      const res = await fetch(AJAX_URL, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new Error(`AJAX ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const html: string = data.resultHtml ?? "";

      if (!html) {
        throw new Error("Flextender: lege HTML response van AJAX endpoint");
      }

      const listings = parseFlextenderHtml(html);
      console.log(`Flextender: ${listings.length} opdrachten geparsed uit listings`);

      const enriched = await enrichListings(listings);
      console.log(`Flextender: ${enriched.length} opdrachten verrijkt met detail-pagina`);

      return enriched;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        throw new Error(
          `Flextender scrape mislukt na ${MAX_RETRIES + 1} pogingen: ${err instanceof Error ? err.message : String(err)}`,
        );
      } else {
        const delay = 1200 * 2 ** attempt + Math.floor(Math.random() * 500);
        console.warn(`Flextender poging ${attempt} mislukt, retry in ${delay}ms: ${err}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // Unreachable — while loop always returns or throws — but satisfies TypeScript
  throw new Error("Flextender scrape: onverwacht einde van retry-loop");
}

/** Parse Flextender AJAX HTML response naar listing array */
function parseFlextenderHtml(html: string): FlextenderListing[] {
  const listings: FlextenderListing[] = [];

  const cardRegex =
    /<div\s+class="css-foundjob[^"]*"\s+data-kbslinkurl="([^"]*)"[^>]*>([\s\S]*?)(?=<div\s+class="css-foundjob|<div\s+class="flx-register-panel|$)/gi;

  let cardMatch = cardRegex.exec(html);
  while (cardMatch !== null) {
    const detailPath = cardMatch[1];
    const cardHtml = cardMatch[2];

    const titleMatch = cardHtml.match(/class="css-jobtitle">([^<]+)/);
    const title = titleMatch?.[1]?.trim();
    if (!title) continue;

    const companyMatch = cardHtml.match(/class="css-customer">([^<]+)/);
    const company = companyMatch?.[1]?.trim();

    // Extract aanvraagnr from URL params or path
    const aanvraagMatch = detailPath.match(/aanvraagnr=(\d+)/) ?? detailPath.match(/\/(\d+)$/);
    const externalId = aanvraagMatch?.[1] || `flx-${listings.length}`;
    if (!externalId) continue;

    // Build proper external URL from original detail path
    const externalUrl = detailPath.startsWith("http")
      ? detailPath
      : `https://www.flextender.nl${detailPath.startsWith("/") ? "" : "/"}${detailPath}`;

    const fields = parseFieldPairs(cardHtml);

    const province = extractProvince(fields.Regio);
    const location = fields.Regio ?? undefined;

    // Parse "Uren per week": "36 uur" → 36, "24 tot 32 uur" → min=24, max=32 (cap op 168)
    const parsed = parseHoursPerWeek(fields["Uren per week"]);
    const hoursPerWeek = parsed.hoursPerWeek != null ? Math.min(MAX_HOURS_PER_WEEK, parsed.hoursPerWeek) : undefined;
    const minHoursPerWeek = parsed.minHoursPerWeek != null ? Math.min(MAX_HOURS_PER_WEEK, parsed.minHoursPerWeek) : undefined;
    // Extract company logo URL
    const logoMatch =
      cardHtml.match(/class="flx-client-logo"[^>]*src="([^"]+)"/i) ??
      cardHtml.match(/src="([^"]+)"[^>]*class="flx-client-logo"/i);
    const companyLogoUrl = logoMatch?.[1] ?? undefined;

    // Opleidingsniveau from listing card
    const educationLevel = fields.Opleidingsniveau ?? undefined;

    // Duration from "Duur" field: "6 maanden" → 6
    const durationMonths = parseDurationMonths(fields.Duur);

    listings.push({
      title,
      company,
      location,
      province,
      description: `${title} — ${company ?? "Flextender"} opdracht`,
      externalId,
      externalUrl,
      startDate: parseDutchDate(fields.Start),
      applicationDeadline: parseDutchDate(fields["Einde inschrijfdatum"]),
      contractType: "opdracht" as const,
      countryCode: "NL",
      hoursPerWeek,
      minHoursPerWeek,
      companyLogoUrl,
      educationLevel,
      durationMonths,
      _rawHours: fields["Uren per week"] ?? undefined, // kept for conditions fallback
    });
    cardMatch = cardRegex.exec(html);
  }

  return listings;
}

// ── Detail-pagina verrijking ──────────────────────────────────────

/** Verrijk listings met content van hun detail-pagina's (parallel, max 5 tegelijk) */
async function enrichListings(
  listings: FlextenderListing[],
  logger?: { info: (m: string) => void; warn: (m: string) => void },
): Promise<RawScrapedListing[]> {
  const CONCURRENCY = 5;
  const results: RawScrapedListing[] = [];
  let detailFailures = 0;

  for (let i = 0; i < listings.length; i += CONCURRENCY) {
    const batch = listings.slice(i, i + CONCURRENCY);
    const enrichedBatch = await Promise.all(
      batch.map(async (listing) => {
        try {
          const detail = await fetchDetailPage(listing.externalId);
          if (
            listing._rawHours &&
            !detail.conditions?.some((condition) => condition.includes("Uren per week"))
          ) {
            detail.conditions = [
              ...(detail.conditions ?? []),
              `Uren per week: ${listing._rawHours}`,
            ];
          }
          const { _rawHours, ...listingClean } = listing;
          const merged = { ...listingClean, ...detail };
          return merged;
        } catch (err) {
          detailFailures++;
          (logger?.warn ?? console.warn)(
            `Detail ophalen mislukt voor ${listing.externalId}: ${err}`,
          );
          // Return listing without detail enrichment — still usable
          const { _rawHours, ...listingClean } = listing;
          return listingClean;
        }
      }),
    );
    results.push(...enrichedBatch);

    // Back-off between batches to avoid overwhelming Flextender
    if (i + CONCURRENCY < listings.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (detailFailures > 0) {
    const log = logger?.warn ?? console.warn;
    log(
      `Flextender: ${detailFailures}/${listings.length} detail-pagina's mislukt (${Math.round((1 - detailFailures / listings.length) * 100)}% verrijkt)`,
    );
  }

  return results;
}

/** Haal detail-pagina op en parse gestructureerde secties */
async function fetchDetailPage(aanvraagnr: string): Promise<FlextenderDetail> {
  const url = `${DETAIL_BASE}${aanvraagnr}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Detail ${res.status}: ${res.statusText}`);

  const html = await res.text();
  return parseDetailHtml(html);
}

/** Parse detail-pagina HTML naar gestructureerde velden */
function parseDetailHtml(html: string): FlextenderDetail {
  const result: FlextenderDetail = {};

  const descMatch = html.match(
    /class="css-formattedjobdescription">([\s\S]*?)(?:<\/div>\s*<div\s+(?:style|class="css-navigation))/,
  );
  if (!descMatch) return result;

  const content = descMatch[1];

  const sections = extractSections(content);

  const findSection = (needle: string): string | undefined => {
    const key = Object.keys(sections).find((k) => k.toLowerCase().includes(needle.toLowerCase()));
    return key ? sections[key] : undefined;
  };

  const descParts: string[] = [];
  for (const key of ["Opdracht", "Organisatietekst", "Opdrachtgever"]) {
    if (sections[key]) descParts.push(sections[key]);
  }
  if (descParts.length > 0) {
    result.description = decodeEntities(descParts.join("\n\n")).substring(0, 8000);
  }

  const reqText = findSection("vereisten") ?? findSection("knock-out");
  if (reqText) {
    result.requirements = parseNumberedList(reqText).map((item) => ({
      description: item,
      isKnockout: true,
    }));
  }

  const selText = findSection("selectiecriteria");
  if (selText) {
    result.wishes = parseNumberedList(selText).map((item) => ({
      description: item,
    }));
  }

  const compText = findSection("competenties");
  if (compText) {
    result.competences = parseBulletList(compText);
  }

  const conditions: string[] = [];

  const funcText = findSection("functieschaal");
  if (funcText) {
    const scaleMatch = funcText.match(/schaal\s*(\d+)/i);
    if (scaleMatch) {
      conditions.push(`Functieschaal ${scaleMatch[1]}`);
      // Map functieschaal to indicative hourly rate ranges (Dutch government scales 2026)
      const rates = functieschaalToRate(parseInt(scaleMatch[1], 10));
      if (rates) {
        if (!result.rateMin) result.rateMin = rates.min;
        if (!result.rateMax) result.rateMax = rates.max;
      }
    }
  }

  const feeText = findSection("fee");
  if (feeText) {
    conditions.push(`Fee: ${feeText.trim()}`);
    // Try to extract a rate from fee text (e.g., "€ 100,00 per uur", "maximaal 95")
    const feeRate = parseRateFromText(feeText);
    if (feeRate) {
      const curMax = typeof result.rateMax === "number" ? result.rateMax : 0;
      if (!curMax || feeRate > curMax) result.rateMax = feeRate;
      if (!result.rateMin) result.rateMin = feeRate;
    }
  }

  // Also check "Maximaal uurtarief" or "Tarief" sections
  const tariefText = findSection("tarief") ?? findSection("uurtarief");
  if (tariefText) {
    const rate = parseRateFromText(tariefText);
    if (rate) {
      const curMax = typeof result.rateMax === "number" ? result.rateMax : 0;
      if (!curMax || rate > curMax) result.rateMax = rate;
      if (!result.rateMin) result.rateMin = rate;
    }
  }

  const werkText = findSection("werkdagen");
  if (werkText) conditions.push(`Werkdagen: ${werkText.trim()}`);

  const cvText = findSection("cv-eisen");
  if (cvText) conditions.push(`CV-eisen: ${cvText.trim()}`);

  // === Extract workArrangement from Werkdagen section ===
  if (werkText) {
    const lower = werkText.toLowerCase();
    if (
      lower.includes("hybride") ||
      lower.includes("in overleg") ||
      lower.includes("onderlinge afstemming")
    ) {
      result.workArrangement = "hybride";
    } else if (lower.includes("remote") || lower.includes("thuiswerk")) {
      result.workArrangement = "remote";
    } else {
      result.workArrangement = "op_locatie";
    }
  }

  // === Extract positionsAvailable from "Benodigd aantal professionals" ===
  const profText = findSection("benodigd aantal");
  if (profText) {
    const numMatch = profText.match(/(\d+)/);
    if (numMatch) result.positionsAvailable = parseInt(numMatch[1], 10);
  }

  // === Parse summary fields for structured data + conditions ===
  const summaryHtml =
    extractBetween(
      html,
      'class="css-summarybackground">',
      'class="css-formattedjobdescription">',
    ) ?? "";
  const summaryFields = parseFieldPairs(summaryHtml);

  // extensionPossible from "Opties verlenging"
  const extensionRaw = summaryFields["Opties verlenging"];
  if (extensionRaw) {
    const lower = extensionRaw.toLowerCase();
    if (lower.includes("niet") || lower === "nee" || lower === "geen") {
      result.extensionPossible = false;
    } else {
      result.extensionPossible = true;
    }
  }

  // hoursPerWeek from summary (may override listing-level if detail has it)
  const summaryHours = parseHoursPerWeek(summaryFields["Uren per week"]);
  if (summaryHours.hoursPerWeek) {
    result.hoursPerWeek = Math.min(MAX_HOURS_PER_WEEK, summaryHours.hoursPerWeek);
    if (summaryHours.minHoursPerWeek)
      result.minHoursPerWeek = Math.min(MAX_HOURS_PER_WEEK, summaryHours.minHoursPerWeek);
  }

  // educationLevel from summary "Opleidingsniveau"
  if (summaryFields.Opleidingsniveau) {
    result.educationLevel = summaryFields.Opleidingsniveau;
  }

  // durationMonths from summary "Duur"
  if (summaryFields.Duur) {
    const dm = parseDurationMonths(summaryFields.Duur);
    if (dm) result.durationMonths = dm;
  }

  // Remaining summary fields → conditions (keep existing behavior)
  const skipKeys = new Set([
    "Start",
    "Regio",
    "Einde inschrijfdatum",
    "Uren per week",
    "Opties verlenging",
    "Opleidingsniveau",
    "Duur",
  ]);
  for (const [key, value] of Object.entries(summaryFields)) {
    if (!value || skipKeys.has(key)) continue;
    conditions.push(`${key}: ${value}`);
  }

  if (conditions.length > 0) {
    result.conditions = conditions.map(decodeEntities);
  }

  // Always set countryCode for Flextender (Dutch government platform)
  result.countryCode = "NL";

  return result;
}

/** Extract text between two markers in HTML */
function extractBetween(html: string, start: string, end: string): string | null {
  const startIdx = html.indexOf(start);
  if (startIdx === -1) return null;
  const endIdx = html.indexOf(end, startIdx + start.length);
  if (endIdx === -1) return null;
  return html.substring(startIdx + start.length, endIdx);
}

/** Splits HTML content op <strong> secties, retourneert header→body map */
function extractSections(html: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = html.split(/<(?:strong|b)>/i);

  for (let i = 1; i < parts.length; i++) {
    const closeIdx = parts[i].search(/<\/(?:strong|b)>/i);
    if (closeIdx === -1) continue;

    const header = stripHtml(parts[i].substring(0, closeIdx)).trim();
    const body = stripHtml(parts[i].substring(closeIdx)).trim();

    if (header && body && header.length < 100) {
      sections[header] = body;
    }
  }
  return sections;
}

/** Parse genummerde lijst (1. item; 2. item) naar string array */
function parseNumberedList(text: string): string[] {
  const items = text.split(/\n/).filter((l) => l.trim());
  const result: string[] = [];
  for (const line of items) {
    const cleaned = line.replace(/^\d+[.)]\s*/, "").trim();
    if (cleaned.length > 5) result.push(cleaned);
  }
  if (result.length === 0) {
    return text
      .split(/[;\n]/)
      .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
      .filter((s) => s.length > 5);
  }
  return result;
}

/** Parse bullet list (- item; - item) naar string array */
function parseBulletList(text: string): string[] {
  return text
    .split(/[;\n]/)
    .map((s) => s.replace(/^[-•–]\s*/, "").trim())
    .filter((s) => s.length > 2);
}

/** Decode common HTML entities in a string */
function decodeEntities(s: string): string {
  return s
    .replace(/&euro;/gi, "€")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&eacute;/gi, "é")
    .replace(/&euml;/gi, "ë")
    .replace(/&uuml;/gi, "ü")
    .replace(/&iuml;/gi, "ï")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#\d+;/g, (m) => String.fromCharCode(Number(m.slice(2, -1))));
}

/** Parse alle caption-value paren uit een card HTML */
function parseFieldPairs(cardHtml: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const pairRegex = /class="css-caption">([^<]+)<[\s\S]*?class="css-value">([^<]+)</gi;
  let pairMatch = pairRegex.exec(cardHtml);
  while (pairMatch !== null) {
    const key = pairMatch[1].trim();
    const value = pairMatch[2].trim();
    if (!fields[key]) fields[key] = value;
    pairMatch = pairRegex.exec(cardHtml);
  }
  return fields;
}

/** Parse Nederlandse datum (bijv. "16 maart 2026") naar Date of undefined */
function parseDutchDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (s === "Z.s.m." || s.includes("uur") || s.length < 6) return undefined;

  const months: Record<string, string> = {
    januari: "01",
    februari: "02",
    maart: "03",
    april: "04",
    mei: "05",
    juni: "06",
    juli: "07",
    augustus: "08",
    september: "09",
    oktober: "10",
    november: "11",
    december: "12",
  };

  const match = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (match) {
    const month = months[match[2].toLowerCase()];
    if (month) {
      return new Date(`${match[3]}-${month}-${match[1].padStart(2, "0")}`);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0, 10));

  return undefined;
}

/** Parse Dutch duration "6 maanden" → 6, "12 weken" → 3, "1 jaar" → 12 */
function parseDurationMonths(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().trim();

  const maandenMatch = lower.match(/(\d+)\s*maand/);
  if (maandenMatch) return parseInt(maandenMatch[1], 10);

  const wekenMatch = lower.match(/(\d+)\s*we[ek]/);
  if (wekenMatch) return Math.round(parseInt(wekenMatch[1], 10) / 4.33);

  const jaarMatch = lower.match(/(\d+)\s*jaar/);
  if (jaarMatch) return parseInt(jaarMatch[1], 10) * 12;

  return undefined;
}

/** Parse "Uren per week" field: "36 uur" → {max:36}, "24 tot 32 uur" → {min:24, max:32} */
export function parseHoursPerWeek(raw: string | undefined): {
  hoursPerWeek?: number;
  minHoursPerWeek?: number;
} {
  if (!raw) return {};
  const rangeMatch = raw.match(/(\d+)\s*tot\s*(\d+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    const sanitizedMin = sanitizeHours(min);
    const sanitizedMax = sanitizeHours(max);
    if (!sanitizedMin || !sanitizedMax || sanitizedMin > sanitizedMax) {
      return {};
    }
    return {
      minHoursPerWeek: sanitizedMin,
      hoursPerWeek: sanitizedMax,
    };
  }
  const singleMatch = raw.match(/(\d+)/);
  if (singleMatch) {
    const hours = parseInt(singleMatch[1], 10);
    const sanitizedHours = sanitizeHours(hours);
    return sanitizedHours ? { hoursPerWeek: sanitizedHours } : {};
  }
  return {};
}

/** Map Dutch government functieschaal to indicative hourly rate range (EUR, excl BTW).
 *  Based on 2025/2026 BBRA/CAO Rijk scales for interim/freelance contractors. */
function functieschaalToRate(scale: number): { min: number; max: number } | undefined {
  const scaleRates: Record<number, { min: number; max: number }> = {
    5: { min: 35, max: 50 },
    6: { min: 40, max: 60 },
    7: { min: 50, max: 70 },
    8: { min: 55, max: 80 },
    9: { min: 65, max: 90 },
    10: { min: 75, max: 105 },
    11: { min: 85, max: 120 },
    12: { min: 100, max: 135 },
    13: { min: 110, max: 150 },
    14: { min: 120, max: 165 },
    15: { min: 135, max: 185 },
    16: { min: 150, max: 200 },
  };
  return scaleRates[scale];
}

/** Extract hourly rate from free text (e.g., "€ 100,00 per uur", "maximaal 95", "max. €110") */
function parseRateFromText(text: string): number | undefined {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  // Match: €100, € 100, €100,00, EUR 100, 100 euro
  const rateMatch = lower.match(/(?:€|eur)\s*(\d+)[,.]?(\d{0,2})/);
  if (rateMatch) {
    const rate = parseInt(rateMatch[1], 10);
    if (rate > 10 && rate < 500) return rate;
  }
  // Match: "maximaal 95", "max. 110", "tarief: 80"
  const maxMatch = lower.match(/(?:max(?:imaal)?\.?\s*|tarief\s*:?\s*)(\d+)/);
  if (maxMatch) {
    const rate = parseInt(maxMatch[1], 10);
    if (rate > 10 && rate < 500) return rate;
  }
  return undefined;
}

/** Map regio/locatie naar Nederlandse provincie */
function extractProvince(location: string | undefined): string | undefined {
  if (!location) return undefined;
  const loc = location.toLowerCase();

  const provinces: Record<string, string> = {
    "noord-holland": "Noord-Holland",
    "zuid-holland": "Zuid-Holland",
    "noord-brabant": "Noord-Brabant",
    utrecht: "Utrecht",
    gelderland: "Gelderland",
    overijssel: "Overijssel",
    limburg: "Limburg",
    friesland: "Friesland",
    groningen: "Groningen",
    drenthe: "Drenthe",
    flevoland: "Flevoland",
    zeeland: "Zeeland",
  };

  for (const [key, value] of Object.entries(provinces)) {
    if (loc.includes(key)) return value;
  }
  return undefined;
}
