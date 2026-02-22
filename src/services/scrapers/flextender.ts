const AJAX_URL = "https://www.flextender.nl/wp-admin/admin-ajax.php";
const DETAIL_BASE = "https://www.flextender.nl/opdracht/?aanvraagnr=";

export async function scrapeFlextender(): Promise<any[]> {
  console.log("Flextender scrapen via AJAX API");

  const MAX_RETRIES = 2;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
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
        console.warn("Flextender: lege HTML response");
        return [];
      }

      const listings = parseFlextenderHtml(html);
      console.log(`Flextender: ${listings.length} opdrachten geparsed uit listings`);

      const enriched = await enrichListings(listings);
      console.log(`Flextender: ${enriched.length} opdrachten verrijkt met detail-pagina`);

      return enriched;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        console.error(
          `Flextender scrape mislukt na ${MAX_RETRIES + 1} pogingen: ${err}`,
        );
        return [];
      } else {
        const delay = 1200 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
        console.warn(`Flextender poging ${attempt} mislukt, retry in ${delay}ms: ${err}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  return [];
}

/** Parse Flextender AJAX HTML response naar listing array */
function parseFlextenderHtml(html: string): any[] {
  const listings: any[] = [];

  const cardRegex =
    /<div\s+class="css-foundjob[^"]*"\s+data-kbslinkurl="([^"]*)"[^>]*>([\s\S]*?)(?=<div\s+class="css-foundjob|<div\s+class="flx-register-panel|$)/gi;

  let cardMatch: RegExpExecArray | null;
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const detailPath = cardMatch[1];
    const cardHtml = cardMatch[2];

    const titleMatch = cardHtml.match(/class="css-jobtitle">([^<]+)/);
    const title = titleMatch?.[1]?.trim();
    if (!title) continue;

    const companyMatch = cardHtml.match(/class="css-customer">([^<]+)/);
    const company = companyMatch?.[1]?.trim();

    const idMatch = detailPath.match(/\/(\d+)$/);
    const externalId = idMatch?.[1] ?? "";

    const fields = parseFieldPairs(cardHtml);

    const province = extractProvince(fields.Regio);
    const location = fields.Regio ?? undefined;

    listings.push({
      title,
      company,
      location,
      province,
      description: `${title} — ${company ?? "Flextender"} opdracht`,
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
  logger?: { info: (m: string) => void; warn: (m: string) => void },
): Promise<any[]> {
  const CONCURRENCY = 5;
  const results: any[] = [];

  for (let i = 0; i < listings.length; i += CONCURRENCY) {
    const batch = listings.slice(i, i + CONCURRENCY);
    const enrichedBatch = await Promise.all(
      batch.map(async (listing) => {
        try {
          const detail = await fetchDetailPage(listing.externalId);
          if (listing.hours && !detail.conditions?.some((c: string) => c.includes("Uren per week"))) {
            detail.conditions = [...(detail.conditions ?? []), `Uren per week: ${listing.hours}`];
          }
          return { ...listing, ...detail };
        } catch (err) {
          (logger?.warn ?? console.warn)(`Detail ophalen mislukt voor ${listing.externalId}: ${err}`);
          return listing;
        }
      }),
    );
    results.push(...enrichedBatch);

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

  const descMatch = html.match(
    /class="css-formattedjobdescription">([\s\S]*?)(?:<\/div>\s*<div\s+(?:style|class="css-navigation))/,
  );
  if (!descMatch) return result;

  const content = descMatch[1];

  const sections = extractSections(content);

  const findSection = (needle: string): string | undefined => {
    const key = Object.keys(sections).find((k) =>
      k.toLowerCase().includes(needle.toLowerCase()),
    );
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
    if (scaleMatch) conditions.push(`Functieschaal ${scaleMatch[1]}`);
  }

  const feeText = findSection("fee");
  if (feeText) conditions.push(`Fee: ${feeText.trim()}`);

  const werkText = findSection("werkdagen");
  if (werkText) conditions.push(`Werkdagen: ${werkText.trim()}`);

  const cvText = findSection("cv-eisen");
  if (cvText) conditions.push(`CV-eisen: ${cvText.trim()}`);

  const summaryHtml = extractBetween(
    html,
    'class="css-summarybackground">',
    'class="css-formattedjobdescription">',
  ) ?? "";
  const summaryFields = parseFieldPairs(summaryHtml);
  const skipKeys = new Set(["Start", "Regio", "Einde inschrijfdatum"]);
  for (const [key, value] of Object.entries(summaryFields)) {
    if (!value || skipKeys.has(key)) continue;
    const label = key === "Opties verlenging" ? "Verlenging" : key;
    conditions.push(`${label}: ${value}`);
  }

  if (conditions.length > 0) {
    result.conditions = conditions.map(decodeEntities);
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
  const pairRegex =
    /class="css-caption">([^<]+)<[\s\S]*?class="css-value">([^<]+)</gi;
  let pairMatch: RegExpExecArray | null;
  while ((pairMatch = pairRegex.exec(cardHtml)) !== null) {
    const key = pairMatch[1].trim();
    const value = pairMatch[2].trim();
    if (!fields[key]) fields[key] = value;
  }
  return fields;
}

/** Parse Nederlandse datum (bijv. "16 maart 2026") naar ISO string of undefined */
function parseDutchDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (s === "Z.s.m." || s.includes("uur") || s.length < 6) return undefined;

  const months: Record<string, string> = {
    januari: "01", februari: "02", maart: "03", april: "04",
    mei: "05", juni: "06", juli: "07", augustus: "08",
    september: "09", oktober: "10", november: "11", december: "12",
  };

  const match = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (match) {
    const month = months[match[2].toLowerCase()];
    if (month) {
      return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
    }
  }

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
