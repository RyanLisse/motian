import { StepConfig, Handlers } from "motia";
import { z } from "zod";

const API_BASE = "https://kbenp-match-api.azurewebsites.net";
const MAX_RESULTS = 1000;

/** Categorie-ID → leesbare naam */
const CATEGORY_MAP: Record<number, string> = {
  11: "Beleid",
  12: "Civiele Techniek",
  13: "Communicatie",
  14: "Financieel",
  15: "ICT",
  16: "Informatiemanagement",
  18: "Juridisch",
  19: "Organisatie en Personeel",
  20: "Project- en Programmamanagement",
  21: "Overig",
  22: "Mobiliteit en Verkeer",
  23: "Ruimtelijke Ordening",
  24: "Sociaal Domein",
  25: "Vergunning en Handhaving",
  26: "Vastgoed en Grondzaken",
};

export const config = {
  name: "ScrapeOpdrachtoverheid",
  description:
    "Scrapt Opdrachtoverheid.nl overheidsopdrachten via publieke JSON API (geen browser nodig)",
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
  if (input.platform !== "opdrachtoverheid") return;

  logger.info(`Opdrachtoverheid scrapen via API: ${input.url}`);

  const MAX_RETRIES = 2;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      // Stap 1: Haal alle actieve vacatures op in één verzoek (API ondersteunt limit=1000)
      const res = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; MotianBot/1.0)",
        },
        body: JSON.stringify({
          single: false,
          limit: MAX_RESULTS,
          offset: 0,
          disjunction: 0,
          user_coordinates: {},
          filters: {
            and_filters: [
              {
                filters: [
                  {
                    field_name: "tender_active",
                    operator: "eq",
                    value: true,
                  },
                ],
              },
            ],
          },
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${res.statusText} — ${errorBody.slice(0, 500)}`);
      }

      const data = await res.json();
      const allTenders = data.negometrix_tenders ?? [];

      logger.info(`Opdrachtoverheid API: ${allTenders.length} actieve opdrachten`);

      // Stap 2: Map API response naar unified listing format
      const listings = allTenders.map((t: any) => {
        const loc = t.vacancies_location ?? {};
        const empType = (t.contract_type ?? "").toLowerCase();

        const contractType = empType.includes("freelance") || empType === "temporary"
          ? "freelance"
          : empType.includes("detachering") || empType.includes("loondienst")
            ? "interim"
            : undefined;

        const allowsSubcontracting =
          empType.includes("freelance") || empType === "temporary" ? true : undefined;

        // Parse HTML requirements/competences naar string arrays
        const requirements = parseHtmlList(t.tender_requirements);
        const competences = parseHtmlList(t.tender_competences);

        return {
          title: t.tender_name || t.tender_buying_organization,
          company: t.tender_buying_organization,
          location: loc.city
            ? `${loc.city}${loc.province ? ` - ${loc.province}` : ""}`
            : loc.province ?? undefined,
          province: loc.province ?? undefined,
          description: ensureMinLength(
            stripHtml(t.tender_description_html) ||
            t.tender_description ||
            t.tender_name ||
            "Geen beschrijving beschikbaar voor deze opdracht",
          ),
          externalId: t.web_key || t.tender_id?.toString() || "",
          externalUrl: t.opdracht_overheid_url || `https://www.opdrachtoverheid.nl/`,
          rateMax: t.tender_maximum_tariff && t.tender_maximum_tariff > 0
            ? t.tender_maximum_tariff
            : undefined,
          startDate: validDate(t.tender_start_date),
          endDate: validDate(t.tender_end_date),
          applicationDeadline: validDate(t.tender_end_date),
          contractType,
          allowsSubcontracting,
          contractLabel: CATEGORY_MAP[t.tender_category] ?? undefined,
          positionsAvailable: parseInt(String(t.tender_number_of_professionals ?? 1), 10) || 1,
          requirements: requirements.length > 0
            ? requirements.map((r) => ({ description: r, isKnockout: true }))
            : [],
          competences: competences.length > 0 ? competences : [],
        };
      });

      // Filter out listings zonder externalId
      const validListings = listings.filter(
        (l: any) => l.externalId && l.externalId.length > 0,
      );

      logger.info(
        `Opdrachtoverheid: ${validListings.length} geldige opdrachten naar normalize`,
      );

      await enqueue({
        topic: "jobs.normalize",
        data: { platform: "opdrachtoverheid", listings: validListings },
      });
      return;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        logger.error(
          `Opdrachtoverheid scrape mislukt na ${MAX_RETRIES + 1} pogingen: ${err}`,
        );
        await enqueue({
          topic: "jobs.normalize",
          data: { platform: "opdrachtoverheid", listings: [] },
        });
      } else {
        const delay = 1200 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
        logger.warn(`Opdrachtoverheid poging ${attempt} mislukt, retry in ${delay}ms: ${err}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
};

/** Filter out API sentinel dates (pre-2020) that mean "unknown/TBD" */
function validDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const year = parseInt(raw.slice(0, 4), 10);
  if (isNaN(year) || year < 2020) return undefined;
  return raw;
}

/** Zorg dat beschrijving minimaal 10 tekens is (schema eis) */
function ensureMinLength(text: string): string {
  if (text.length >= 10) return text;
  return text + " — opdracht via Opdrachtoverheid";
}

/** Strip HTML tags en return plain text */
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse HTML <li> items naar string array */
function parseHtmlList(html: string | null | undefined): string[] {
  if (!html) return [];
  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = liRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]).trim();
    if (text.length > 0) items.push(text);
  }
  // Fallback: als er geen <li> items zijn, split op newlines
  if (items.length === 0) {
    const plain = stripHtml(html);
    if (plain.length > 0) {
      items.push(...plain.split("\n").map((s) => s.trim()).filter((s) => s.length > 0));
    }
  }
  return items;
}
