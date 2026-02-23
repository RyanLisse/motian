import type { RawScrapedListing } from "../normalize";

const API_BASE = "https://kbenp-match-api.azurewebsites.net";
const MAX_RESULTS = 1000;

type OpdrachtoverheidCategory = {
  tender_category_obj?: {
    type?: string;
  };
};

type OpdrachtoverheidLocation = {
  city?: string;
  province?: string;
  latitude?: string;
  longitude?: string;
  postcode?: string;
  avatar?: string;
  company_address?: string;
};

type OpdrachtoverheidTender = {
  vacancies_location?: OpdrachtoverheidLocation;
  contract_type?: string;
  tender_requirements?: string | null;
  tender_competences?: string | null;
  tender_maximum_tariff?: number;
  tender_tariff?: string | number | null;
  tender_max_hours?: number;
  tender_hours_week?: number;
  tender_min_hours?: number;
  tender_other_information?: string | null;
  tender_hybrid_working?: boolean;
  tender_document?: string | null;
  tender_name?: string;
  tender_buying_organization?: string;
  tender_description_html?: string | null;
  tender_overview?: string | null;
  tender_description?: string | null;
  tender_team?: string | null;
  tender_interview?: string | null;
  web_key?: string;
  tender_id?: number | string;
  opdracht_overheid_url?: string;
  tender_start_date?: string | null;
  tender_end_date?: string | null;
  tender_date?: string | null;
  tender_first_seen?: string | null;
  tender_category?: number;
  tender_number_of_professionals?: number | string;
  tender_url?: string;
  tender_source?: string;
  tender_categories?: OpdrachtoverheidCategory[];
};

type OpdrachtoverheidApiResponse = {
  negometrix_tenders?: OpdrachtoverheidTender[];
};

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

export async function scrapeOpdrachtoverheid(): Promise<RawScrapedListing[]> {
  console.log("Opdrachtoverheid scrapen via API");

  const MAX_RETRIES = 2;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
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

      const data = (await res.json()) as OpdrachtoverheidApiResponse;
      const allTenders = data.negometrix_tenders ?? [];

      console.log(`Opdrachtoverheid API: ${allTenders.length} actieve opdrachten`);

      const listings: RawScrapedListing[] = allTenders.map((t) => {
        const loc = t.vacancies_location ?? {};
        const empType = (t.contract_type ?? "").toLowerCase();

        const contractType =
          empType.includes("freelance") || empType === "temporary"
            ? "freelance"
            : empType.includes("detachering") || empType.includes("loondienst")
              ? "interim"
              : undefined;

        const allowsSubcontracting =
          empType.includes("freelance") || empType === "temporary" ? true : undefined;

        const requirements = parseHtmlList(t.tender_requirements);
        const competences = parseHtmlList(t.tender_competences);

        // === Rate logic: tariff = indicative, maximum_tariff = ceiling ===
        const maxTariff =
          (t.tender_maximum_tariff ?? 0) > 0 ? Math.round(t.tender_maximum_tariff!) : undefined;
        const baseTariff =
          t.tender_tariff && parseFloat(String(t.tender_tariff)) > 0
            ? Math.round(parseFloat(String(t.tender_tariff)))
            : undefined;
        const rateMax = maxTariff ?? baseTariff;
        const rateMin = maxTariff && baseTariff && baseTariff < maxTariff ? baseTariff : undefined;

        // === Hours: tender_hours_week (100%), with optional min/max range ===
        const hoursPerWeek =
          (t.tender_max_hours ?? 0) > 0
            ? Math.round(t.tender_max_hours!)
            : (t.tender_hours_week ?? 0) > 0
              ? Math.round(t.tender_hours_week!)
              : undefined;
        const minHoursPerWeek =
          (t.tender_min_hours ?? 0) > 0 && t.tender_min_hours! < (hoursPerWeek ?? Infinity)
            ? Math.round(t.tender_min_hours!)
            : undefined;

        // === Extension from tender_other_information ===
        const otherInfo = stripHtml(t.tender_other_information);
        let extensionPossible: boolean | undefined;
        if (otherInfo) {
          const lower = otherInfo.toLowerCase();
          if (lower.includes("verleng")) {
            extensionPossible =
              !lower.includes("geen verlenging") && !lower.includes("niet verleng");
          }
        }

        // === Work arrangement from tender_hybrid_working ===
        const workArrangement = t.tender_hybrid_working === true ? ("hybride" as const) : undefined;

        // === Attachments from tender_document ===
        const attachments: Array<{ url: string; description: string }> = [];
        if (t.tender_document) {
          attachments.push({ url: t.tender_document, description: t.tender_document });
        }

        return {
          title: t.tender_name || t.tender_buying_organization,
          company: t.tender_buying_organization,
          location: loc.city
            ? `${loc.city}${loc.province ? ` - ${loc.province}` : ""}`
            : (loc.province ?? undefined),
          province: loc.province ?? undefined,
          description: ensureMinLength(
            stripHtml(t.tender_description_html) ||
              stripHtml(t.tender_overview) ||
              t.tender_description ||
              [stripHtml(t.tender_team), stripHtml(t.tender_interview), otherInfo]
                .filter(Boolean)
                .join("\n\n") ||
              t.tender_name ||
              "Geen beschrijving beschikbaar voor deze opdracht",
          ),
          externalId: t.web_key || t.tender_id?.toString() || "",
          externalUrl: t.opdracht_overheid_url || `https://www.opdrachtoverheid.nl/`,
          rateMax,
          rateMin,
          startDate: validDate(t.tender_start_date),
          endDate: validDate(t.tender_end_date),
          applicationDeadline: validDate(t.tender_date) ?? validDate(t.tender_end_date),
          postedAt: validDate(t.tender_first_seen),
          contractType,
          allowsSubcontracting,
          workArrangement,
          contractLabel: t.tender_category != null ? CATEGORY_MAP[t.tender_category] : undefined,
          positionsAvailable: parseInt(String(t.tender_number_of_professionals ?? 1), 10) || 1,
          requirements:
            requirements.length > 0
              ? requirements.map((r) => ({ description: r, isKnockout: true }))
              : [],
          competences: competences.length > 0 ? competences : [],

          // === Verrijkte Data (new columns) ===
          hoursPerWeek,
          minHoursPerWeek,
          extensionPossible,
          countryCode: "NL",
          attachments,

          // === Locatie & Organisatie ===
          latitude: loc.latitude ? parseFloat(loc.latitude) : undefined,
          longitude: loc.longitude ? parseFloat(loc.longitude) : undefined,
          postcode: loc.postcode ?? undefined,
          companyLogoUrl: loc.avatar
            ? `https://kbenp-match-api.azurewebsites.net/images/${loc.avatar}`
            : undefined,

          // === Opdracht Kenmerken ===
          sourceUrl: t.tender_url ?? undefined,
          sourcePlatform: t.tender_source ?? undefined,
          durationMonths: computeDurationMonths(t.tender_start_date, t.tender_end_date),
          categories: (t.tender_categories ?? [])
            .map((category) => category.tender_category_obj?.type)
            .filter(Boolean),
          companyAddress: loc.company_address ?? undefined,
        };
      });

      const validListings = listings.filter((listing) => (listing.externalId as string)?.length > 0);

      console.log(`Opdrachtoverheid: ${validListings.length} geldige opdrachten`);

      return validListings;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        console.error(`Opdrachtoverheid scrape mislukt na ${MAX_RETRIES + 1} pogingen: ${err}`);
        return [];
      } else {
        const delay = 1200 * 2 ** attempt + Math.floor(Math.random() * 500);
        console.warn(`Opdrachtoverheid poging ${attempt} mislukt, retry in ${delay}ms: ${err}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  return [];
}

/** Compute duration in months from start/end date strings */
function computeDurationMonths(
  start: string | null | undefined,
  end: string | null | undefined,
): number | undefined {
  if (!start || !end) return undefined;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return undefined;
  if (s.getFullYear() < 2020 || e.getFullYear() < 2020) return undefined;
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return months > 0 ? months : undefined;
}

/** Filter out API sentinel dates (pre-2020) that mean "unknown/TBD" */
function validDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const year = parseInt(raw.slice(0, 4), 10);
  if (Number.isNaN(year) || year < 2020) return undefined;
  return raw;
}

/** Zorg dat beschrijving minimaal 10 tekens is (schema eis) */
function ensureMinLength(text: string): string {
  if (text.length >= 10) return text;
  return `${text} — opdracht via Opdrachtoverheid`;
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
  let match = liRegex.exec(html);
  while (match !== null) {
    const text = stripHtml(match[1]).trim();
    if (text.length > 0) items.push(text);
    match = liRegex.exec(html);
  }
  if (items.length === 0) {
    const plain = stripHtml(html);
    if (plain.length > 0) {
      items.push(
        ...plain
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      );
    }
  }
  return items;
}
