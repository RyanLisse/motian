import { describe, expect, it } from "vitest";
import { zodToVisualJsonSchema } from "../src/lib/zod-json-schema";
import { parsedCVSchema } from "../src/schemas/candidate-intelligence";
import { unifiedJobSchema } from "../src/schemas/job";
import { structuredMatchOutputSchema } from "../src/schemas/matching";

describe("zodToVisualJsonSchema", () => {
  it("converts unifiedJobSchema to valid JSON Schema", () => {
    const result = zodToVisualJsonSchema(unifiedJobSchema, "unifiedJob") as Record<string, unknown>;

    expect(result).toBeDefined();
    expect(result.$ref || result.type || result.definitions).toBeDefined();

    // Extract the actual schema from the $ref wrapper
    if (result.definitions && result.$ref) {
      const refKey = (result.$ref as string).replace("#/definitions/", "");
      const schema = (result.definitions as Record<string, unknown>)[refKey] as Record<
        string,
        unknown
      >;
      expect(schema.type).toBe("object");
      expect(schema.properties).toBeDefined();

      const props = schema.properties as Record<string, unknown>;
      expect(props.title).toBeDefined();
      expect(props.externalId).toBeDefined();
      expect(props.company).toBeDefined();

      // Enum fields should produce enum arrays
      const contractType = props.contractType as Record<string, unknown>;
      expect(contractType.enum || contractType.anyOf).toBeDefined();
    }
  });

  it("converts parsedCVSchema with nested arrays", () => {
    const result = zodToVisualJsonSchema(parsedCVSchema, "parsedCV") as Record<string, unknown>;
    expect(result).toBeDefined();

    if (result.definitions && result.$ref) {
      const refKey = (result.$ref as string).replace("#/definitions/", "");
      const schema = (result.definitions as Record<string, unknown>)[refKey] as Record<
        string,
        unknown
      >;
      const props = schema.properties as Record<string, unknown>;
      expect(props.name).toBeDefined();
      expect(props.skills).toBeDefined();
      expect(props.experience).toBeDefined();
    }
  });

  it("converts structuredMatchOutputSchema", () => {
    const result = zodToVisualJsonSchema(structuredMatchOutputSchema, "matchOutput") as Record<
      string,
      unknown
    >;
    expect(result).toBeDefined();

    if (result.definitions && result.$ref) {
      const refKey = (result.$ref as string).replace("#/definitions/", "");
      const schema = (result.definitions as Record<string, unknown>)[refKey] as Record<
        string,
        unknown
      >;
      const props = schema.properties as Record<string, unknown>;
      expect(props.overallScore).toBeDefined();
      expect(props.recommendation).toBeDefined();
      expect(props.criteriaBreakdown).toBeDefined();
    }
  });
});
