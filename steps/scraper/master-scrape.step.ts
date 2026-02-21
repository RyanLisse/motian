import { StepConfig, Handlers } from "motia";

export const config = {
  name: "MasterScrape",
  description: "Elke 4 uur alle actieve platformen scrapen",
  triggers: [{ type: "cron", expression: "0 0 */4 * * *" }],
  enqueues: [{ topic: "platform.scrape" }],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (_input, { enqueue, logger }) => {
  logger.info("Master scrape gestart");

  await enqueue({
    topic: "platform.scrape",
    data: {
      platform: "striive",
      url: "https://striive.com/nl/opdrachten",
    },
  });

  logger.info("Striive scrape opdracht verstuurd");
};
