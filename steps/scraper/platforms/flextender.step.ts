import { StepConfig, Handlers } from "motia";
import { z } from "zod";

const AJAX_URL = "https://www.flextender.nl/wp-admin/admin-ajax.php";
const DETAIL_BASE = "https://www.flextender.nl/opdracht/?aanvraagnr=";

export const config = {
  name: "ScrapeFlextender",
  description:
    "Scrapt Flextender opdrachten via publieke AJAX API + detail-pagina verrijking (geen browser nodig)",
  triggers: [
    {
      type: "queue",
      topic: "platform.scrape",
      input: z.object({
        platform: z.string(),
        url: z.string().url(),
      }),
    },
  ],
  enqueues: [{ topic: "jobs.normalize" }],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (
  input,
  { enqueue, logger },
) => {
  if (input.platform !== "flextender") return;

  logger.info(`Flextender scrapen via AJAX API: ${input.url}`);

  const MAX_RETRIES = 2;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      // Stap 1: Haal alle opdrachten op via WordPress AJAX endpoint
      const res = await fetch(AJAX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "action=kbs_flx_searchjobs",
      });

      if (!res.ok) {
        throw new Error(`AJAX ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const html: string = data.resultHtml ?? "";

      if (!html) {
        logger.warn("Flextender: lege HTML response");
        await enqueue({
          topic: "jobs.normalize",
          data: { platform: "flextender", listings: [] },
        });
        return;
      }

      // Stap 2: Parse HTML job cards uit AJAX response
      const listings = parseFlextenderHtml(html);
      logger.info(`Flextender: ${listings.length} opdrachten geparsed uit listings`);

      // Stap 3: Verrijk elke listing met detail-pagina content
      const enriched = await enrichListings(listings, logger);
      logger.info(`Flextender: ${enriched.length} opdrachten verrijkt met detail-pagina`);

      await enqueue({
        topic: "jobs.normalize",
        data: { platform: "flextender", listings: enriched },
      });
      return;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        logger.error(
          `Flextender scrape mislukt na ${MAX_RETRIES + 1} pogingen: ${err}`,
        );
        await enqueue({
          topic: "jobs.normalize",
          data: { platform: "flextender", listings: [] },
        });
      } else {
        const delay = 1200 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
        logger.warn(`Flextender poging ${attempt} mislukt, retry in ${delay}ms: ${err}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
};

/** Parse Flextender AJAX HTML response naar listing array */
function parseFlextenderHtml(html: string): any[] {
  const listings: any[] = [];

  // Split HTML op job card boundaries: <div class="css-foundjob ...
  const cardRegex =
    /<div\s+class="css-foundjob[^"]*"\s+data-kbslinkurl="([^"]*)"[^>]*>([\s\S]*?)(?=<div\s+class="css-foundjob|<div\s+class="flx-register-panel|$)/gi;

  let cardMatch: RegExpExecArray | null;
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const detailPath = cardMatch[1];
    const cardHtml = cardMatch[2];

    // Titel
    const titleMatch = cardHtml.match(/class="css-jobtitle">([^<]+)/);
    const title = titleMatch?.[1]?.trim();
    if (!title) continue;

    // Bedrijf
    const companyMatch = cardHtml.match(/class="css-customer">([^<]+)/);
    const company = companyMatch?.[1]?.trim();

    // Aanvraagnummer uit detailPath (bijv. /nologin/jobdetails/27794)
    const idMatch = detailPath.match(/\/(\d+)$/);
    const externalId = idMatch?.[1] ?? "";

    // Parse caption-value paren
    const fields = parseFieldPairs(cardHtml);

    const province = extractProvince(fields.Regio);
    const location = fields.Regio
      ? province
        ? `${fields.Regio}`
        : fields.Regio
      : undefined;

    listings.push({
      title,
      company,
      location,
      province,
      description: title, // Placeholder, verrijkt in stap 3
      externalId,
      externalUrl: `${DETAIL_BASE}${externalId}`,
      startDate: parseDutchDate(fields.Start),
      applicationDeadline: parseDutchDate(fields["Einde inschrijfdatum"]),
      contractType: "opdracht" as const,
      hours: fields["Uren per week"] ?? undefined,
    });
  }

  return listings;
}

// ── Detail-pagina verrijking ──────────────────────────────────────

/** Verrijk listings met content van hun detail-pagina's (parallel, max 5 tegelijk) */
async function enrichListings(
  listings: any[],
  logger: { info: (m: string) => void; warn: (m: string) => void },
): Promise<any[]> {
  const CONCURRENCY = 5;
  const results: any[] = [];

  for (let i = 0; i < listings.length; i += CONCURRENCY) {
    const batch = listings.slice(i, i + CONCURRENCY);
    const enrichedBatch = await Promise.all(
      batch.map(async (listing) => {
        try {
          const detail = await fetchDetailPage(listing.externalId);
          return { ...listing, ...detail };
        } catch (err) {
          logger.warn(`Detail ophalen mislukt voor ${listing.externalId}: ${err}`);
          return listing; // Terugvallen op listing-only data
        }
      }),
    );
    results.push(...enrichedBatch);

    // Respecteer rate-limiting: korte pauze tussen batches
    if (i + CONCURRENCY < listings.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}

/** Haal detail-pagina op en parse gestructureerde secties */
async function fetchDetailPage(
  aanvraagnr: string,
): Promise<Record<string, any>> {
  const url = `${DETAIL_BASE}${aanvraagnr}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Detail ${res.status}: ${res.statusText}`);

  const html = await res.text();
  return parseDetailHtml(html);
}

/** Parse detail-pagina HTML naar gestructureerde velden */
function parseDetailHtml(html: string): Record<string, any> {
  const result: Record<string, any> = {};

  // Zoek de formatted description container
  const descMatch = html.match(
    /class="css-formattedjobdescription">([\s\S]*?)(?:<\/div>\s*<div\s+(?:style|class="css-navigation))/,
  );
  if (!descMatch) return result;

  const content = descMatch[1];

  // Splits op <strong> tags om secties te identificeren
  const sections = extractSections(content);

  // ── Beschrijving: combineer Organisatietekst + Opdracht secties ──
  const descParts: string[] = [];
  for (const key of ["Opdracht", "Organisatietekst", "Opdrachtgever"]) {
    if (sections[key]) descParts.push(sections[key]);
  }
  if (descParts.length > 0) {
    result.description = descParts.join("\n\n").substring(0, 8000);
  }

  // ── Vereisten / knock-outcriteria → requirements array ──
  const reqKey = Object.keys(sections).find((k) =>
    k.toLowerCase().includes("vereisten") || k.toLowerCase().includes("knock-out"),
  );
  if (reqKey && sections[reqKey]) {
    result.requirements = parseNumberedList(sections[reqKey]).map((item) => ({
      description: item,
      isKnockout: true,
    }));
  }

  // ── Selectiecriteria → wishes array ──
  const selKey = Object.keys(sections).find((k) =>
    k.toLowerCase().includes("selectiecriteria"),
  );
  if (selKey && sections[selKey]) {
    result.wishes = parseNumberedList(sections[selKey]).map((item) => ({
      description: item,
    }));
  }

  // ── Competenties → competences array ──
  if (sections.Competenties) {
    result.competences = parseBulletList(sections.Competenties);
  }

  // ── Functieschaal → rateMin/rateMax (schaal nummer) ──
  if (sections.Functieschaal) {
    const scaleMatch = sections.Functieschaal.match(/schaal\s*(\d+)/i);
    if (scaleMatch) {
      result.conditions = result.conditions ?? [];
      result.conditions.push(`Functieschaal ${scaleMatch[1]}`);
    }
  }

  // ── Fee Flextender → conditions ──
  const feeKey = Object.keys(sections).find((k) =>
    k.toLowerCase().includes("fee"),
  );
  if (feeKey && sections[feeKey]) {
    result.conditions = result.conditions ?? [];
    result.conditions.push(`Fee: ${sections[feeKey].trim()}`);
  }

  // ── Werkdagen → conditions ──
  if (sections.Werkdagen) {
    result.conditions = result.conditions ?? [];
    result.conditions.push(`Werkdagen: ${sections.Werkdagen.trim()}`);
  }

  // ── CV-eisen → conditions ──
  const cvKey = Object.keys(sections).find((k) =>
    k.toLowerCase().includes("cv-eisen"),
  );
  if (cvKey && sections[cvKey]) {
    result.conditions = result.conditions ?? [];
    result.conditions.push(`CV-eisen: ${sections[cvKey].trim()}`);
  }

  // ── Detail summary velden (extra metadata) ──
  const summaryFields = parseFieldPairs(
    extractBetween(html, 'class="css-summary">', "</div><!--end summary-->") ??
      extractBetween(html, 'class="css-summarybackground">', 'class="css-formattedjobdescription">') ?? "",
  );
  if (summaryFields["Opties verlenging"]) {
    result.conditions = result.conditions ?? [];
    result.conditions.push(`Verlenging: ${summaryFields["Opties verlenging"]}`);
  }

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
  // Match: <strong>Header</strong> followed by body content until next <strong>
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

/** Verwijder HTML tags en decode entities */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse genummerde lijst (1. item; 2. item) naar string array */
function parseNumberedList(text: string): string[] {
  const items = text.split(/\n/).filter((l) => l.trim());
  const result: string[] = [];
  for (const line of items) {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, "").trim();
    if (cleaned.length > 5) result.push(cleaned);
  }
  // Als geen genummerde items gevonden, split op ; of newlines
  if (result.length === 0) {
    return text
      .split(/[;\n]/)
      .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
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

/** Parse alle caption-value paren uit een card HTML */
function parseFieldPairs(cardHtml: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const pairRegex =
    /class="css-caption">([^<]+)<[\s\S]*?class="css-value">([^<]+)</gi;
  let pairMatch: RegExpExecArray | null;
  while ((pairMatch = pairRegex.exec(cardHtml)) !== null) {
    const key = pairMatch[1].trim();
    const value = pairMatch[2].trim();
    if (!fields[key]) fields[key] = value; // Eerste waarde wint (geen duplicaten)
  }
  return fields;
}

/** Parse Nederlandse datum (bijv. "16 maart 2026") naar ISO string of undefined */
function parseDutchDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  // Skip non-dates
  if (s === "Z.s.m." || s.includes("uur") || s.length < 6) return undefined;

  const months: Record<string, string> = {
    januari: "01", februari: "02", maart: "03", april: "04",
    mei: "05", juni: "06", juli: "07", augustus: "08",
    september: "09", oktober: "10", november: "11", december: "12",
  };

  // Try "DD maand YYYY" format
  const match = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (match) {
    const month = months[match[2].toLowerCase()];
    if (month) {
      return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
    }
  }

  // Try ISO-ish format (already YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

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
