import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Convert a Zod schema to JSON Schema format for use with visual-json.
 * This enables schema-aware features: field descriptions, enum dropdowns, validation indicators.
 */
export function zodToVisualJsonSchema(schema: ZodType, name?: string): object {
  return zodToJsonSchema(schema, name ?? "schema");
}
