import { StepConfig, Handlers } from "motia";
import { z } from "zod";

export const config = {
  name: "ScrapeLinkedIn",
  description: "Scrape LinkedIn job listings via Stagehand (authenticated)",
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

type Input = { platform: string; url: string };

export const handler: Handlers<typeof config> = async (
  rawInput,
  { enqueue, logger },
) => {
  const input = rawInput as Input;
  if (input.platform !== "linkedin") return;

  if (!process.env.LINKEDIN_USERNAME || !process.env.LINKEDIN_PASSWORD) {
    logger.error("LINKEDIN_USERNAME and LINKEDIN_PASSWORD must be set");
    return;
  }

  logger.info(`LinkedIn scraping: ${input.url}`);

  // Dynamic import to avoid esbuild bundling conflict with playwright-core
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

  try {
    while (attempt <= MAX_RETRIES) {
      try {
        // Step 1: Login to LinkedIn
        await stagehand.page.goto("https://www.linkedin.com/login");
        await stagehand.act({
          action: "Enter the email address and click next",
          variables: { email: process.env.LINKEDIN_USERNAME! },
        });
        await stagehand.act({
          action: "Enter the password and click sign in",
          variables: { password: process.env.LINKEDIN_PASSWORD! },
        });

        // Step 2: Navigate to job listings
        await stagehand.page.goto(input.url);
        await stagehand.page.waitForSelector(
          '.jobs-search-results-list, .scaffold-layout__list, main',
          { timeout: 15_000 },
        );

        // Step 3: Paginated extraction
        const MAX_PAGES = 3;
        const allListings: any[] = [];

        for (let page = 1; page <= MAX_PAGES; page++) {
          const result = await stagehand.extract({
            instruction: `Extract all visible job listings from this LinkedIn page.
              Per job listing extract:
              - title: the job title/role
              - company: the company name
              - location: city and province (e.g. "Amsterdam - Noord-Holland")
              - description: the full job description
              - externalId: the LinkedIn job ID (numeric ID from the URL or listing)
              - externalUrl: the full URL to the job posting`,
            schema: z.object({
              opdrachten: z.array(
                z.object({
                  title: z.string(),
                  company: z.string().optional(),
                  location: z.string().optional(),
                  description: z.string(),
                  externalId: z.string(),
                  externalUrl: z.string(),
                }),
              ),
            }),
          });

          allListings.push(...(result.opdrachten ?? []));

          const hasNext = await stagehand.page
            .locator(
              'button[aria-label="Next"], a:has-text("Next"), [aria-label="Page forward"]',
            )
            .isVisible()
            .catch(() => false);
          if (!hasNext) break;
          await stagehand.act({ action: "Click the next page button" });
          await stagehand.page.waitForSelector(
            '.jobs-search-results-list, .scaffold-layout__list, main',
            { timeout: 10_000 },
          );
        }

        logger.info(`LinkedIn: ${allListings.length} job listings found`);

        // Stap 4: Detail-pagina's bezoeken voor volledige inhoud
        const enriched: any[] = [];
        for (const listing of allListings) {
          const province =
            listing.province ??
            (listing.location?.includes(" - ")
              ? listing.location.split(" - ")[1]?.trim()
              : undefined);

          if (!listing.externalUrl) {
            enriched.push({ ...listing, province });
            continue;
          }

          try {
            await stagehand.page.goto(listing.externalUrl, {
              waitUntil: "domcontentloaded",
              timeout: 15_000,
            });

            const detail = await stagehand.extract({
              instruction: `Extract the full details from this LinkedIn job page:
                - description: the FULL job description (all text, not truncated)
                - qualifications: ALL required qualifications as a list of strings
                - responsibilities: ALL responsibilities/tasks as a list of strings
                - skills: ALL required skills as a list of strings
                - contractType: employment type ("fulltime", "parttime", "contract", "tijdelijk", "vast")
                - workArrangement: work arrangement ("hybrid", "remote", "on-site")
                - seniorityLevel: seniority level (e.g. "Mid-Senior level")
                - salary: salary information if visible`,
              schema: z.object({
                description: z.string().optional(),
                qualifications: z.array(z.string()).optional(),
                responsibilities: z.array(z.string()).optional(),
                skills: z.array(z.string()).optional(),
                contractType: z.string().optional(),
                workArrangement: z.string().optional(),
                seniorityLevel: z.string().optional(),
                salary: z.string().optional(),
              }),
            });

            enriched.push({
              ...listing,
              description: detail.description || listing.description,
              qualifications: detail.qualifications?.length ? detail.qualifications : listing.qualifications,
              responsibilities: detail.responsibilities?.length ? detail.responsibilities : listing.responsibilities,
              skills: detail.skills?.length ? detail.skills : listing.skills,
              contractType: detail.contractType || listing.contractType,
              workArrangement: detail.workArrangement ?? listing.workArrangement,
              seniorityLevel: detail.seniorityLevel ?? listing.seniorityLevel,
              salary: detail.salary ?? listing.salary,
              province,
            });

            logger.info(
              `Detail verrijkt: ${listing.externalId} (${detail.qualifications?.length ?? 0} eisen, ${detail.skills?.length ?? 0} skills)`,
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
          data: { platform: "linkedin", listings: enriched },
        });
        return;
      } catch (err) {
        attempt++;
        if (attempt > MAX_RETRIES) {
          logger.error(
            `LinkedIn scrape failed after ${MAX_RETRIES + 1} attempts: ${err}`,
          );
          await enqueue({
            topic: "jobs.normalize",
            data: { platform: "linkedin", listings: [] },
          });
          return;
        }
        const base = 1200 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 500);
        const delay = base + jitter;
        logger.warn(
          `LinkedIn scrape attempt ${attempt} failed, retry in ${delay}ms: ${err}`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  } finally {
    await stagehand.close();
  }
};
