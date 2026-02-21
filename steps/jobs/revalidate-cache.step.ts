import { StepConfig, Handlers } from "motia";
import { z } from "zod";

export const config = {
  name: "RevalidateCache",
  description:
    "Invalideert Next.js ISR cache tags na elke scrape (fire-and-forget)",
  triggers: [
    {
      type: "queue",
      topic: "scrape.completed",
      input: z.object({
        platform: z.string(),
        status: z.string(),
      }),
    },
  ],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

const NEXT_REVALIDATE_URL = process.env.NEXT_REVALIDATE_URL;
const NEXT_REVALIDATE_SECRET = process.env.NEXT_REVALIDATE_SECRET;

export const handler: Handlers<typeof config> = async (
  input,
  { logger },
) => {
  if (!NEXT_REVALIDATE_URL) {
    logger.info("NEXT_REVALIDATE_URL niet geconfigureerd, cache skip");
    return;
  }

  const tags = ["jobs", "scrape-results", "scraper-configs"];

  for (const tag of tags) {
    try {
      await fetch(`${NEXT_REVALIDATE_URL}/api/revalidate?tag=${tag}`, {
        method: "POST",
        headers: {
          "x-revalidate-secret": NEXT_REVALIDATE_SECRET ?? "",
        },
      });
      logger.info(`Cache tag '${tag}' gerevalideerd`);
    } catch (err) {
      // Fire-and-forget: log maar niet blokkeren
      logger.warn(`Cache revalidatie gefaald voor '${tag}': ${String(err)}`);
    }
  }
};
