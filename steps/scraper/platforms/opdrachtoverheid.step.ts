import { StepConfig, Handlers } from "motia";
import { z } from "zod";

export const config = {
  name: "ScrapeOpdrachtoverheid",
  description: "Scrapt Opdrachtoverheid.nl overheidsopdrachten via Stagehand (publiek)",
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

  logger.info(`Opdrachtoverheid scrapen: ${input.url}`);

  // Hostname allowlist — SSRF preventie
  const allowedHosts = ["www.opdrachtoverheid.nl", "opdrachtoverheid.nl"];
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
        // Stap 1: Navigeer naar overzichtspagina (geen login nodig — publiek)
        await stagehand.page.goto(input.url);
        await stagehand.page.waitForSelector(
          '.search-results, .opdracht-list, main',
          { timeout: 15_000 },
        );

        // Stap 2: Paginated extraction via ?page=N parameter
        const MAX_PAGES = 10;
        const allListings: any[] = [];

        for (let page = 1; page <= MAX_PAGES; page++) {
          if (page > 1) {
            const pageUrl = new URL(input.url);
            pageUrl.searchParams.set("page", String(page));
            await stagehand.page.goto(pageUrl.toString());
            await stagehand.page.waitForSelector(
              '.search-results, .opdracht-list, main',
              { timeout: 10_000 },
            );
          }

          const result = await stagehand.extract({
            instruction: `Extraheer alle zichtbare opdrachten van deze Opdrachtoverheid overzichtspagina.
              Per opdracht extraheer:
              - title: de functietitel/rol
              - company: de opdrachtgever (overheidsorganisatie)
              - location: locatie (bijv. "Den Haag - Zuid-Holland")
              - rateMax: het maximale uurtarief als het zichtbaar is (getal)
              - hours: het aantal uren per week (getal)
              - applicationDeadline: sluitingsdatum (YYYY-MM-DD)
              - externalUrl: de volledige URL naar de opdracht detailpagina
              - externalId: het UUID uit de URL van de opdracht`,
            schema: z.object({
              opdrachten: z.array(
                z.object({
                  title: z.string(),
                  company: z.string().optional(),
                  location: z.string().optional(),
                  rateMax: z.number().optional(),
                  hours: z.number().optional(),
                  applicationDeadline: z.string().optional(),
                  externalUrl: z.string(),
                  externalId: z.string(),
                }),
              ),
            }),
          });

          allListings.push(...(result.opdrachten ?? []));

          const hasNext = await stagehand.page
            .locator(
              'a:has-text("Volgende"), a:has-text("volgende"), [rel="next"], .pagination .next a',
            )
            .isVisible()
            .catch(() => false);
          if (!hasNext) break;
        }

        logger.info(`Opdrachtoverheid: ${allListings.length} opdrachten gevonden`);

        // Stap 3: Detail-pagina's bezoeken voor volledige inhoud
        const enriched: any[] = [];
        for (const listing of allListings) {
          const province = listing.location?.includes(" - ")
            ? listing.location.split(" - ")[1]?.trim()
            : undefined;

          if (!listing.externalUrl) {
            enriched.push({ ...listing, province });
            continue;
          }

          try {
            // Valideer detail-URL hostname
            const detailHost = new URL(listing.externalUrl).hostname;
            if (!allowedHosts.includes(detailHost)) {
              logger.warn(`Detail-URL geblokkeerd: ${detailHost} niet in allowlist`);
              enriched.push({ ...listing, province });
              continue;
            }

            await stagehand.page.goto(listing.externalUrl, {
              waitUntil: "domcontentloaded",
              timeout: 15_000,
            });

            const detail = await stagehand.extract({
              instruction: `Extraheer de volledige details van deze Opdrachtoverheid opdracht-pagina:
                - description: de VOLLEDIGE tekst van de secties Organisatie, Beschrijving en Opdracht samengevoegd (alle tekst, niet afgekapt)
                - requirements: ALLE knock-outcriteria als [{description, isKnockout: true}]
                - wishes: ALLE selectiecriteria/wensen als [{description, evaluationCriteria}] (evaluationCriteria is bijv. "20 punten")
                - competences: ALLE competenties/soft skills als strings
                - conditions: ALLE voorwaarden (bijv. "WKA", "VOG", "G-rekening", screeningseis) als strings
                - startDate: startdatum van de opdracht (YYYY-MM-DD)
                - endDate: einddatum van de opdracht (YYYY-MM-DD)
                - positionsAvailable: aantal posities (getal)
                - rateMax: het maximale uurtarief (getal, exclusief BTW)
                - employmentType: de dienstverband/inhuringsvorm (bijv. "Loondienst", "Freelance", "Freelance & Loondienst")`,
              schema: z.object({
                description: z.string().optional(),
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
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                positionsAvailable: z.number().optional(),
                rateMax: z.number().optional(),
                employmentType: z.string().optional(),
              }),
            });

            // ContractType mapping op basis van dienstverband
            const empType = detail.employmentType?.toLowerCase() ?? "";
            const contractType = empType.includes("freelance")
              ? "freelance"
              : empType.includes("loondienst")
                ? "interim"
                : undefined;

            const allowsSubcontracting = empType.includes("freelance") ? true : undefined;

            enriched.push({
              ...listing,
              description: detail.description || listing.description,
              rateMax: detail.rateMax ?? listing.rateMax,
              startDate: detail.startDate ?? listing.startDate,
              endDate: detail.endDate ?? listing.endDate,
              positionsAvailable: detail.positionsAvailable ?? listing.positionsAvailable,
              contractType,
              allowsSubcontracting,
              requirements:
                detail.requirements?.length ? detail.requirements : listing.requirements,
              wishes: detail.wishes?.length ? detail.wishes : listing.wishes,
              competences:
                detail.competences?.length ? detail.competences : listing.competences,
              conditions:
                detail.conditions?.length ? detail.conditions : listing.conditions,
              province,
            });

            logger.info(
              `Detail verrijkt: ${listing.externalId} (${detail.requirements?.length ?? 0} eisen, ${detail.wishes?.length ?? 0} wensen)`,
            );
          } catch (detailErr) {
            logger.warn(
              `Detail-pagina mislukt voor ${listing.externalId}: ${detailErr}`,
            );
            enriched.push({ ...listing, province });
          }
        }

        await enqueue({
          topic: "jobs.normalize",
          data: { platform: "opdrachtoverheid", listings: enriched },
        });
        break;
      } catch (err) {
        attempt++;
        if (attempt > MAX_RETRIES) {
          logger.error(
            `Opdrachtoverheid scrape definitief mislukt na ${MAX_RETRIES + 1} pogingen: ${err}`,
          );
          await enqueue({
            topic: "jobs.normalize",
            data: { platform: "opdrachtoverheid", listings: [] },
          });
        } else {
          const base = 1200 * Math.pow(2, attempt);
          const jitter = Math.floor(Math.random() * 500);
          const delay = base + jitter;
          logger.warn(
            `Opdrachtoverheid scrape poging ${attempt} mislukt, retry in ${delay}ms: ${err}`,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
  } finally {
    await stagehand.close();
  }
};
