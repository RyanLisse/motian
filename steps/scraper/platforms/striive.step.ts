import { StepConfig, Handlers } from "motia";
import { z } from "zod";

export const config = {
  name: "ScrapeStriive",
  description: "Scrapt Striive opdrachten via Stagehand (ingelogd)",
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
  if (input.platform !== "striive") return;

  logger.info(`Striive scrapen: ${input.url}`);

  // Dynamic import om esbuild bundling conflict met playwright-core te voorkomen
  const { Stagehand } = await import("@browserbasehq/stagehand");

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    enableCaching: true,
  });

  await stagehand.init();

  const MAX_RETRIES = 2;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      // Stap 1: Inloggen op Striive
      await stagehand.page.goto("https://login.striive.com");
      await stagehand.act({
        action: "Vul het e-mailadres in en klik op volgende",
        variables: { email: process.env.STRIIVE_USERNAME! },
      });
      await stagehand.act({
        action: "Vul het wachtwoord in en klik op inloggen",
        variables: { password: process.env.STRIIVE_PASSWORD! },
      });

      // Stap 2: Navigeer naar opdrachten
      await stagehand.page.goto(input.url);
      await stagehand.page.waitForSelector(
        '[data-testid="job-list"], .opdrachten-lijst, main',
        { timeout: 15_000 },
      );

      // Stap 3: Paginated extraction
      const MAX_PAGES = 5;
      const allListings: any[] = [];

      for (let page = 1; page <= MAX_PAGES; page++) {
        const result = await stagehand.extract({
          instruction: `Extraheer alle zichtbare opdrachten van deze Striive pagina.
            Per opdracht extraheer:
            - title: de functietitel/rol
            - company: de opdrachtgever (eindklant)
            - contractLabel: het contractlabel/broker
            - location: stad en provincie (bijv. "Utrecht - Utrecht")
            - description: de volledige omschrijving
            - rateMax: het maximale uurtarief (getal)
            - positionsAvailable: aantal posities (getal)
            - startDate: startdatum (YYYY-MM-DD)
            - endDate: einddatum (YYYY-MM-DD)
            - applicationDeadline: "reageren kan t/m" datum (YYYY-MM-DD)
            - workArrangement: thuiswerken beleid ("hybride", "op_locatie", of "remote")
            - allowsSubcontracting: doorleenconstructie toegestaan (true/false)
            - externalId: de referentiecode (bijv. "BTBDN000695")
            - clientReferenceCode: referentiecode opdrachtgever
            - externalUrl: de volledige URL naar de opdracht
            - requirements: harde eisen als [{description, isKnockout: true}]
            - wishes: wensen als [{description, evaluationCriteria}]
            - competences: competenties/soft skills
            - conditions: voorwaarden (bijv. "WKA", "G-rekening")`,
          schema: z.object({
            opdrachten: z.array(
              z.object({
                title: z.string(),
                company: z.string().optional(),
                contractLabel: z.string().optional(),
                location: z.string().optional(),
                description: z.string(),
                rateMax: z.number().optional(),
                positionsAvailable: z.number().optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                applicationDeadline: z.string().optional(),
                workArrangement: z.string().optional(),
                allowsSubcontracting: z.boolean().optional(),
                externalId: z.string(),
                clientReferenceCode: z.string().optional(),
                externalUrl: z.string(),
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
            ),
          }),
        });

        allListings.push(...(result.opdrachten ?? []));

        const hasNext = await stagehand.page
          .locator(
            'a:has-text("Volgende"), button:has-text("Volgende"), [aria-label="Volgende"]',
          )
          .isVisible()
          .catch(() => false);
        if (!hasNext) break;
        await stagehand.act({ action: "Klik op de volgende pagina knop" });
        await stagehand.page.waitForSelector(
          '[data-testid="job-list"], .opdrachten-lijst, main',
          { timeout: 10_000 },
        );
      }

      logger.info(`Striive: ${allListings.length} opdrachten gevonden`);

      const enriched = allListings.map((l: any) => ({
        ...l,
        province:
          l.province ??
          (l.location?.includes(" - ")
            ? l.location.split(" - ")[1]?.trim()
            : undefined),
      }));

      await enqueue({
        topic: "jobs.normalize",
        data: { platform: "striive", listings: enriched },
      });
      break;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        logger.error(
          `Striive scrape definitief mislukt na ${MAX_RETRIES + 1} pogingen: ${err}`,
        );
        await enqueue({
          topic: "jobs.normalize",
          data: { platform: "striive", listings: [] },
        });
      } else {
        const base = 1200 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 500);
        const delay = base + jitter;
        logger.warn(
          `Striive scrape poging ${attempt} mislukt, retry in ${delay}ms: ${err}`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  await stagehand.close();
};
