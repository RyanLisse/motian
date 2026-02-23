import type { z } from "zod";
import type { unifiedJobSchema } from "./job";

/**
 * Raw listing shape returned by platform scrapers before Zod validation.
 * Derived from `unifiedJobSchema` input type with an index signature
 * to allow extra platform-specific fields.
 */
export type RawScrapedListing = z.input<typeof unifiedJobSchema> & Record<string, unknown>;
