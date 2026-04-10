import { getTypesenseConfig } from "../src/lib/typesense";
import { ensureTypesenseCollections } from "../src/services/search-index/typesense-client";

async function main() {
  const config = getTypesenseConfig();
  if (!config) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason: "Typesense is niet geconfigureerd.",
        },
        null,
        2,
      ),
    );
    return;
  }

  try {
    await ensureTypesenseCollections();

    console.log(
      JSON.stringify(
        {
          bootstrapped: true,
          collections: config.collections,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.warn("[Typesense bootstrap] Postbuild bootstrap mislukt:", error);
  }
}

await main();
