import { StepConfig, Handlers } from "motia";
import { getHealth } from "../../src/services/scrapers";

export const config = {
  name: "GetGezondheid",
  description: "Platform gezondheid: status per scraper + 24-uurs failure rate",
  triggers: [{ type: "http", method: "GET", path: "/api/gezondheid" }],
  flows: ["recruitment-scraper"],
} as const satisfies StepConfig;

export const handler: Handlers<typeof config> = async (_req, { logger }) => {
  try {
    const report = await getHealth();

    return {
      status: 200,
      body: report,
    };
  } catch (err) {
    logger.error(`Fout bij gezondheidscheck: ${String(err)}`);
    return {
      status: 500,
      body: { error: "Interne serverfout" },
    };
  }
};
