import type { RawScrapedListing } from "./types";
import { stripHtml, ensureMinLength, validDate } from "./lib/utils";

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
  tender_active?: boolean | null;
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
          // Fetch both open and closed tenders so tender_active can be persisted.
          filters: {
            and_filters: [],
            or_filters: [],
            or_disjunction: 0,
          },
          order_by: [{ field: "tender_first_seen", direction: "desc" }],
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${res.statusText} — ${errorBody.slice(0, 500)}`);
      }

      const data = (await res.json()) as OpdrachtoverheidApiResponse;
      const allTenders = data.negometrix_tenders ?? [];

      console.log(`Opdrachtoverheid API: ${allTenders.length} opdrachten opgehaald`);

      const listings: RawScrapedListing[] = allTenders.map(mapOpdrachtoverheidTenderToListing);

      const validListings = listings.filter(
        (listing) => (listing.externalId as string)?.length > 0,
      );

      console.log(`Opdrachtoverheid: ${validListings.length} geldige opdrachten`);

      return validListings;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        throw new Error(
          `Opdrachtoverheid scrape mislukt na ${MAX_RETRIES + 1} pogingen: ${err instanceof Error ? err.message : String(err)}`,
        );
      } else {
        const delay = 1200 * 2 ** attempt + Math.floor(Math.random() * 500);
        console.warn(`Opdrachtoverheid poging ${attempt} mislukt, retry in ${delay}ms: ${err}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // Unreachable — while loop always returns or throws — but satisfies TypeScript
  throw new Error("Opdrachtoverheid scrape: onverwacht einde van retry-loop");
}

export function mapTenderActiveToStatus(
  tenderActive: boolean | null | undefined,
): "open" | "closed" {
  return tenderActive === false ? "closed" : "open";
}

export function mapOpdrachtoverheidTenderToListing(t: OpdrachtoverheidTender): RawScrapedListing {
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
  const rawMaxTariff = t.tender_maximum_tariff ?? 0;
  const maxTariff = rawMaxTariff > 0 ? Math.round(rawMaxTariff) : undefined;
  const rawBaseTariff = t.tender_tariff ? parseFloat(String(t.tender_tariff)) : 0;
  const baseTariff = rawBaseTariff > 0 ? Math.round(rawBaseTariff) : undefined;
  const rateMax = maxTariff ?? baseTariff;
  const rateMin = maxTariff && baseTariff && baseTariff < maxTariff ? baseTariff : undefined;
  const rawMaxHours = t.tender_max_hours ?? 0;
  const rawHoursWeek = t.tender_hours_week ?? 0;
  const hoursPerWeek =
    rawMaxHours > 0
      ? Math.round(rawMaxHours)
      : rawHoursWeek > 0
        ? Math.round(rawHoursWeek)
        : undefined;
  const rawMinHours = t.tender_min_hours ?? 0;
  const minHoursPerWeek =
    rawMinHours > 0 && rawMinHours < (hoursPerWeek ?? Number.POSITIVE_INFINITY)
      ? Math.round(rawMinHours)
      : undefined;

  const otherInfo = stripHtml(t.tender_other_information);
  let extensionPossible: boolean | undefined;
  if (otherInfo) {
    const lower = otherInfo.toLowerCase();
    if (lower.includes("verleng")) {
      extensionPossible = !lower.includes("geen verlenging") && !lower.includes("niet verleng");
    }
  }

  const workArrangement = t.tender_hybrid_working === true ? ("hybride" as const) : undefined;
  const attachments: Array<{ url: string; description: string }> = [];
  if (t.tender_document) {
    attachments.push({ url: t.tender_document, description: t.tender_document });
  }

  return {
    title: t.tender_name || t.tender_buying_organization,
    company: t.tender_buying_organization,
    endClient: t.tender_buying_organization,
    status: mapTenderActiveToStatus(t.tender_active),
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
      "opdracht via Opdrachtoverheid",
    ),
    externalId: t.web_key || t.tender_id?.toString() || "",
    externalUrl: t.opdracht_overheid_url || "https://www.opdrachtoverheid.nl/",
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
    hoursPerWeek,
    minHoursPerWeek,
    extensionPossible,
    countryCode: "NL",
    attachments,
    latitude: loc.latitude ? parseFloat(loc.latitude) : undefined,
    longitude: loc.longitude ? parseFloat(loc.longitude) : undefined,
    postcode: loc.postcode ?? undefined,
    companyLogoUrl: loc.avatar
      ? `https://kbenp-match-api.azurewebsites.net/images/${loc.avatar}`
      : undefined,
    sourceUrl: t.tender_url ?? undefined,
    sourcePlatform: t.tender_source ?? undefined,
    durationMonths: computeDurationMonths(t.tender_start_date, t.tender_end_date),
    categories: (t.tender_categories ?? [])
      .map((category) => category.tender_category_obj?.type)
      .filter(Boolean),
    companyAddress: loc.company_address ?? undefined,
  };
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
