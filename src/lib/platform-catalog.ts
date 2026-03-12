import {
  getImplementedPlatformSlugs,
  getPlatformDefinition,
  listPlatformDefinitions,
} from "@motian/scrapers/platform-definitions";

export type PlatformMetadata = ReturnType<typeof getPlatformDefinition>;

export const PLATFORM_SLUGS = getImplementedPlatformSlugs() as [string, ...string[]];

export function listPlatformMetadata() {
  return listPlatformDefinitions();
}

export function getPlatformMetadata(slug: string) {
  return getPlatformDefinition(slug);
}
