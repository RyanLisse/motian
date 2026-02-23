import { config } from "dotenv";

config({ path: ".env.local" });

import { db } from "../src/db";
import { scraperConfigs } from "../src/db/schema";

async function main() {
  const configs = await db.select().from(scraperConfigs);
  console.log(JSON.stringify(configs, null, 2));
  process.exit(0);
}
main();
