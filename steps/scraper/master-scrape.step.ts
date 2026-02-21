import { CronConfig, Handlers } from "motia";

export const config: CronConfig = {
  type: "cron",
  name: "MasterScrape",
  description: "Elke 4 uur alle actieve platformen scrapen",
  cron: "0 */4 * * *",
  emits: ["platform.scrape"],
  flows: ["recruitment-scraper"],
};

export const handler: Handlers["MasterScrape"] = async ({ emit, logger }) => {
  logger.info("Master scrape gestart");

  // Slice 1: Striive als eerste platform
  await emit({
    topic: "platform.scrape",
    data: {
      platform: "striive",
      url: "https://striive.com/nl/opdrachten",
    },
  });

  logger.info("Striive scrape opdracht geemit");
};
