import { StepConfig, Handlers } from "motia";
import { z } from "zod";

const AJAX_URL = "https://www.flextender.nl/wp-admin/admin-ajax.php";

export const config = {
  name: "ScrapeFlextender",
  description:
    "Scrapt Flextender opdrachten via publieke AJAX API + HTML parsing (geen browser nodig)",
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

      // Stap 2: Parse HTML job cards met regex (Cheerio-achtig maar zero-dep)
      const listings = parseFlextenderHtml(html);
      logger.info(`Flextender: ${listings.length} opdrachten geparsed`);

      await enqueue({
        topic: "jobs.normalize",
        data: { platform: "flextender", listings },
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
      description: title, // Alleen titel beschikbaar vanuit listings
      externalId,
      externalUrl: `https://www.flextender.nl${detailPath}`,
      startDate: parseDutchDate(fields.Start),
      applicationDeadline: parseDutchDate(fields["Einde inschrijfdatum"]),
      contractType: "opdracht" as const,
      hours: fields["Uren per week"] ?? undefined,
    });
  }

  return listings;
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
