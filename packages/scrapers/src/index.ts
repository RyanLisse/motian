export {
  dynamicAdapter,
  extractBySelector,
  extractFieldValue,
  extractText,
} from "./dynamic-adapter";
export { scrapeFlextender } from "./flextender";
export { mipublicAdapter } from "./mipublic";
export { monsterboardAdapter } from "./monsterboard";
export {
  detectNationaleVacaturebankBlocker,
  nationaleVacaturebankAdapter,
} from "./nationalevacaturebank";
export {
  mapOpdrachtoverheidTenderToListing,
  mapTenderActiveToStatus,
  scrapeOpdrachtoverheid,
} from "./opdrachtoverheid";
export {
  getDynamicAdapter,
  getImplementedPlatformDefinition,
  getImplementedPlatformSlugs,
  getPlatformAdapter,
  getPlatformDefinition,
  listPlatformCatalogEntries,
  listPlatformDefinitions,
} from "./platform-registry";
export { scrapeStriive } from "./striive";
export type {
  ImplementedPlatformDefinition,
  PlatformAdapter,
  PlatformAdapterKind,
  PlatformAnalysisResult,
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
export { werkzoekenAdapter } from "./werkzoeken";
