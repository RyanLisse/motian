import { StepConfig, Handlers } from "motia";
import { z } from "zod";
import Firecrawl from "@mendable/firecrawl-js";

export const config = {
  name: "ScrapeIndeed",
  description: "Scrape Indeed vacatures via Firecrawl LLM extraction",
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

const indeedJobSchema = z.object({
  vacatures: z.array(
    z.object({
      title: z.string(),
      company: z.string().optional(),
      location: z.string().optional(),
      description: z.string(),
      externalId: z.string(),
      externalUrl: z.string(),
      contractType: z.string().optional(),
      salary: z.string().optional(),
    }),
  ),
});

type Input = { platform: string; url: string };

export const handler: Handlers<typeof config> = async (
  rawInput,
  { enqueue, logger },
) => {
  const input = rawInput as Input;
  if (input.platform !== "indeed") return;

  logger.info(`Indeed scrapen: ${input.url}`);

  const firecrawl = new Firecrawl({
    apiKey: process.env.FIRECRAWL_API_KEY!,
  });

  const MAX_RETRIES = 2;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const result = await firecrawl.scrapeUrl(input.url, {
        formats: ["extract"],
        extract: {
          schema: indeedJobSchema,
          prompt: `Extraheer alle vacatures van deze Indeed pagina.
            Per vacature extraheer:
            - title: de functietitel
            - company: de werkgever/bedrijfsnaam
            - location: stad en/of provincie
            - description: de volledige vacaturetekst of samenvatting
            - externalId: de Indeed job ID uit de URL (bijv. "jk=abc123" → "abc123")
            - externalUrl: de volledige URL naar de vacature
            - contractType: type contract ("fulltime", "parttime", "tijdelijk", "vast")
            - salary: salaris indicatie indien vermeld`,
        },
      });

      if (!result.success) {
        throw new Error(`Firecrawl error: ${result.error}`);
      }

      const extracted = result.extract as z.infer<typeof indeedJobSchema>;
      const listings = extracted?.vacatures ?? [];

      logger.info(`Indeed: ${listings.length} vacatures gevonden`);

      // Map naar unified schema velden
      const enriched = listings.map((l) => ({
        title: l.title,
        company: l.company,
        location: l.location,
        description: l.description,
        externalId: l.externalId,
        externalUrl: l.externalUrl,
        contractType: mapContractType(l.contractType),
        rateMin: parseSalary(l.salary)?.min,
        rateMax: parseSalary(l.salary)?.max,
      }));

      await enqueue({
        topic: "jobs.normalize",
        data: { platform: "indeed", listings: enriched },
      });
      return;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        logger.error(
          `Indeed scrape definitief mislukt na ${MAX_RETRIES + 1} pogingen: ${err}`,
        );
        await enqueue({
          topic: "jobs.normalize",
          data: { platform: "indeed", listings: [] },
        });
        return;
      }
      const base = 1200 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 500);
      const delay = base + jitter;
      logger.warn(
        `Indeed scrape poging ${attempt} mislukt, retry in ${delay}ms: ${err}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

// Helper: map Indeed contract types naar unified enum
function mapContractType(
  type?: string,
): "freelance" | "interim" | "vast" | "opdracht" | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  if (lower.includes("vast") || lower.includes("fulltime")) return "vast";
  if (lower.includes("tijdelijk") || lower.includes("interim")) return "interim";
  if (lower.includes("freelance") || lower.includes("zzp")) return "freelance";
  if (lower.includes("opdracht") || lower.includes("project")) return "opdracht";
  return undefined;
}

// Helper: parse salaris string naar min/max
function parseSalary(
  salary?: string,
): { min?: number; max?: number } | undefined {
  if (!salary) return undefined;
  const numbers = salary.match(/[\d.,]+/g)?.map((n) =>
    parseFloat(n.replace(/\./g, "").replace(",", ".")),
  );
  if (!numbers?.length) return undefined;
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}
