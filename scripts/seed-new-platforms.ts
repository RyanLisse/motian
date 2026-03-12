import { listPlatformDefinitions } from "../packages/scrapers/src/platform-definitions";
import { db } from "../src/db";
import { platformCatalog, scraperConfigs } from "../src/db/schema";

const runtimeSeeds = [
  {
    platform: "opdrachtoverheid",
    isActive: true,
    cronExpression: "0 0 */4 * * *",
    parameters: { maxPages: 10 },
  },
  {
    platform: "flextender",
    isActive: true,
    cronExpression: "0 0 */4 * * *",
    parameters: { maxPages: 5 },
  },
  {
    platform: "werkzoeken",
    isActive: false,
    cronExpression: "0 0 */6 * * *",
    parameters: { sourcePath: "/vacatures-voor/techniek/", maxPages: 3, detailConcurrency: 4 },
  },
  {
    platform: "nationalevacaturebank",
    isActive: false,
    cronExpression: "0 0 */6 * * *",
    parameters: {
      sourcePath: "/vacatures/branche/ict",
      maxPages: 3,
      detailLimit: 10,
      useBrowserBootstrap: true,
    },
  },
];

async function seed() {
  const definitions = listPlatformDefinitions();

  console.log("Seeding platform catalog...");
  for (const definition of definitions) {
    await db
      .insert(platformCatalog)
      .values({
        slug: definition.slug,
        displayName: definition.displayName,
        adapterKind: definition.adapterKind,
        authMode: definition.authMode,
        attributionLabel: definition.attributionLabel,
        description: definition.description,
        capabilities: definition.capabilities,
        docsUrl: definition.docsUrl ?? null,
        defaultBaseUrl: definition.defaultBaseUrl,
        isEnabled: true,
        isSelfServe: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: platformCatalog.slug,
        set: {
          displayName: definition.displayName,
          adapterKind: definition.adapterKind,
          authMode: definition.authMode,
          attributionLabel: definition.attributionLabel,
          description: definition.description,
          capabilities: definition.capabilities,
          docsUrl: definition.docsUrl ?? null,
          defaultBaseUrl: definition.defaultBaseUrl,
          isEnabled: true,
          isSelfServe: true,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✓ catalog ${definition.slug}`);
  }

  console.log("Seeding runtime configs...");
  for (const seed of runtimeSeeds) {
    const definition = definitions.find((entry) => entry.slug === seed.platform);
    if (!definition) continue;

    await db
      .insert(scraperConfigs)
      .values({
        platform: seed.platform,
        baseUrl: definition.defaultBaseUrl,
        isActive: seed.isActive,
        parameters: seed.parameters,
        cronExpression: seed.cronExpression,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: scraperConfigs.platform,
        set: {
          baseUrl: definition.defaultBaseUrl,
          isActive: seed.isActive,
          parameters: seed.parameters,
          cronExpression: seed.cronExpression,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✓ config ${seed.platform}: ${definition.defaultBaseUrl}`);
  }
  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
