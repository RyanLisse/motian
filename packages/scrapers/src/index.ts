export { scrapeFlextender } from "./flextender";
export { monsterboardAdapter } from "./monsterboard";
export {
  mapOpdrachtoverheidTenderToListing,
  mapTenderActiveToStatus,
  scrapeOpdrachtoverheid,
} from "./opdrachtoverheid";
export {
  getImplementedPlatformDefinition,
  getPlatformAdapter,
  getPlatformDefinition,
  getImplementedPlatformSlugs,
  listPlatformCatalogEntries,
  listPlatformDefinitions,
} from "./platform-registry";
export { detectNationaleVacaturebankBlocker, nationaleVacaturebankAdapter } from "./nationalevacaturebank";
export { scrapeStriive } from "./striive";
export { werkzoekenAdapter } from "./werkzoeken";
export type {
  ImplementedPlatformDefinition,
  PlatformAdapter,
  PlatformAdapterKind,
  PlatformAuthMode,
  PlatformBlockerKind,
  PlatformCapability,
  PlatformDefinition,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
  RawScrapedListing,
} from "./types";
