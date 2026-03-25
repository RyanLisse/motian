import { z } from "zod";

/** A2UI declarative action — a button/interaction the agent requests. */
export const a2uiActionSchema = z.object({
  id: z.string().describe("Unique action identifier"),
  label: z.string().describe("Button label text"),
  endpoint: z.string().describe("API endpoint to call"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
  body: z.record(z.unknown()).optional().describe("Optional request body"),
});

/** A2UI envelope — the core payload for agent-driven UI. */
export const a2uiEnvelopeSchema = z.object({
  type: z.literal("a2ui").describe("Discriminator for A2UI envelopes"),
  version: z.string().describe("A2UI spec version (e.g. '0.8')"),
  component: z.string().describe("Component identifier to render"),
  props: z.record(z.unknown()).describe("Props to pass to the component"),
  actions: z.array(a2uiActionSchema).optional().describe("Declarative actions"),
  metadata: z
    .object({
      source: z.string().optional().describe("Originating agent or system"),
      timestamp: z.string().optional().describe("ISO 8601 timestamp"),
    })
    .optional()
    .describe("Optional envelope metadata"),
});

// Export inferred types
export type A2UIAction = z.infer<typeof a2uiActionSchema>;
export type A2UIEnvelope = z.infer<typeof a2uiEnvelopeSchema>;

/** Type guard: check if an unknown value is a valid A2UI envelope. */
export function isA2UIEnvelope(value: unknown): value is A2UIEnvelope {
  return a2uiEnvelopeSchema.safeParse(value).success;
}
