import { StepConfig, Handlers } from "motia";
import { z } from "zod";

export const config = {
  name: "ScrapeFlextender",
  description: "Scrapt Flextender opdrachten via Stagehand (publiek)",
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

  logger.info(`Flextender scrapen: ${input.url}`);

  // Hostname allowlist — SSRF preventie
  const allowedHosts = ["www.flextender.nl", "flextender.nl"];
  const inputHost = new URL(input.url).hostname;
  if (!allowedHosts.includes(inputHost)) {
    logger.error(`Geblokkeerd: host ${inputHost} niet in allowlist`);
    return;
  }

  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    throw new Error("BROWSERBASE_API_KEY en BROWSERBASE_PROJECT_ID zijn vereist");
  }

  // Dynamic import om esbuild bundling conflict met playwright-core te voorkomen
  const { Stagehand } = await import("@browserbasehq/stagehand");

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    enableCaching: true,
  });

  await stagehand.init();

  const MAX_RETRIES = 2;
  let attempt = 0;

  try {
    while (attempt <= MAX_RETRIES) {
      try {
        // Stap 1: Navigeer naar Flextender opdrachten (geen login nodig)
        await stagehand.page.goto(input.url);
        await stagehand.page.waitForSelector(
          'table, .opdrachten, .search-results, main',
          { timeout: 15_000 },
        );

        // Stap 2: Paginated extraction (client-side JS paginatie)
        const MAX_PAGES = 5;
        const allListings: any[] = [];

        for (let page = 1; page <= MAX_PAGES; page++) {
          const result = await stagehand.extract({
            instruction: `Extraheer alle zichtbare opdrachten van deze Flextender overzichtspagina.
              Per opdracht extraheer:
              - title: de functietitel/rol
              - company: de organisatie (opdrachtgever)
              - location: de regio/locatie
              - externalId: het aanvraagnummer (bijv. "2026-12345")
              - hours: uren per week als tekst (bijv. "36 uur")
              - startDate: de startdatum (YYYY-MM-DD)
              - applicationDeadline: einde inschrijfdatum (YYYY-MM-DD)`,
            schema: z.object({
              opdrachten: z.array(
                z.object({
                  title: z.string(),
                  company: z.string().optional(),
                  location: z.string().optional(),
                  externalId: z.string(),
                  hours: z.string().optional(),
                  startDate: z.string().optional(),
                  applicationDeadline: z.string().optional(),
                }),
              ),
            }),
          });

          allListings.push(...(result.opdrachten ?? []));

          // Client-side paginatie: controleer of "Volgende" knop zichtbaar is
          const hasNext = await stagehand.page
            .locator(
              'a:has-text("Volgende"), button:has-text("Volgende"), [aria-label="Volgende"], .pagination .next:not(.disabled)',
            )
            .isVisible()
            .catch(() => false);
          if (!hasNext) break;
          await stagehand.act({ action: "Klik op de Volgende knop om naar de volgende pagina te gaan" });
          await stagehand.page.waitForSelector(
            'table, .opdrachten, .search-results, main',
            { timeout: 10_000 },
          );
        }

        logger.info(`Flextender: ${allListings.length} opdrachten gevonden`);

        // Stap 3: Detail-pagina's bezoeken voor volledige inhoud
        const enriched: any[] = [];
        for (const listing of allListings) {
          const externalUrl = `https://www.flextender.nl/opdracht?aanvraagnr=${listing.externalId}`;

          // Provincie afleiden uit regio-veld
          const province = extractProvince(listing.location);

          try {
            await stagehand.page.goto(externalUrl, {
              waitUntil: "domcontentloaded",
              timeout: 15_000,
            });

            const detail = await stagehand.extract({
              instruction: `Extraheer de volledige details van deze Flextender opdracht-pagina:
                - description: de VOLLEDIGE omschrijving (Functieomschrijving + Functie-inhoud gecombineerd, alle tekst, niet afgekapt)
                - rateMax: het maximale uurtarief (getal, exclusief BTW) indien zichtbaar
                - startDate: startdatum (YYYY-MM-DD)
                - endDate: einddatum (YYYY-MM-DD), afgeleid uit duur/looptijd indien nodig
                - positionsAvailable: benodigd aantal professionals (getal)
                - requirements: ALLE knock-outcriteria / harde eisen als [{description, isKnockout: true}]
                - wishes: ALLE gunningscriteria / wensen als [{description, evaluationCriteria}] — neem het puntenaantal mee (bijv. "20 punten")
                - competences: ALLE competenties als strings
                - conditions: ALLE voorwaarden als strings (bijv. "VOG vereist", "Waadi-registratie", "Inhuurfeevergoeding")`,
              schema: z.object({
                description: z.string().optional(),
                rateMax: z.number().optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                positionsAvailable: z.number().optional(),
                requirements: z
                  .array(
                    z.object({
                      description: z.string(),
                      isKnockout: z.boolean().default(true),
                    }),
                  )
                  .optional(),
                wishes: z
                  .array(
                    z.object({
                      description: z.string(),
                      evaluationCriteria: z.string().optional(),
                    }),
                  )
                  .optional(),
                competences: z.array(z.string()).optional(),
                conditions: z.array(z.string()).optional(),
              }),
            });

            enriched.push({
              title: listing.title,
              company: listing.company,
              location: listing.location,
              province,
              description: detail.description || listing.title,
              externalId: listing.externalId,
              externalUrl,
              rateMax: detail.rateMax,
              startDate: detail.startDate ?? listing.startDate,
              endDate: detail.endDate,
              applicationDeadline: listing.applicationDeadline,
              contractType: "opdracht",
              positionsAvailable: detail.positionsAvailable,
              hours: listing.hours,
              requirements:
                detail.requirements?.length ? detail.requirements : undefined,
              wishes: detail.wishes?.length ? detail.wishes : undefined,
              competences:
                detail.competences?.length ? detail.competences : undefined,
              conditions:
                detail.conditions?.length ? detail.conditions : undefined,
            });

            logger.info(
              `Detail verrijkt: ${listing.externalId} (${detail.requirements?.length ?? 0} eisen, ${detail.wishes?.length ?? 0} wensen)`,
            );
          } catch (detailErr) {
            logger.warn(
              `Detail-pagina mislukt voor ${listing.externalId}: ${detailErr}`,
            );
            enriched.push({
              title: listing.title,
              company: listing.company,
              location: listing.location,
              province,
              description: listing.title,
              externalId: listing.externalId,
              externalUrl,
              startDate: listing.startDate,
              applicationDeadline: listing.applicationDeadline,
              contractType: "opdracht",
              hours: listing.hours,
            });
          }
        }

        await enqueue({
          topic: "jobs.normalize",
          data: { platform: "flextender", listings: enriched },
        });
        break;
      } catch (err) {
        attempt++;
        if (attempt > MAX_RETRIES) {
          logger.error(
            `Flextender scrape definitief mislukt na ${MAX_RETRIES + 1} pogingen: ${err}`,
          );
          await enqueue({
            topic: "jobs.normalize",
            data: { platform: "flextender", listings: [] },
          });
        } else {
          const base = 1200 * Math.pow(2, attempt);
          const jitter = Math.floor(Math.random() * 500);
          const delay = base + jitter;
          logger.warn(
            `Flextender scrape poging ${attempt} mislukt, retry in ${delay}ms: ${err}`,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
  } finally {
    await stagehand.close();
  }
};

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
