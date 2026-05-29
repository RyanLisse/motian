import { describe, expect, it } from "vitest";
import {
  buildStriiveModalEnv,
  resolveStriiveModalOptions,
  validateStriiveModalEnvironment,
} from "../packages/scrapers/src/striive";

describe("Striive Modal runtime hardening", () => {
  it("fails fast when Modal credentials are missing", () => {
    expect(() => validateStriiveModalEnvironment({})).toThrow(
      "Modal credentials ontbreken voor Striive",
    );
  });

  it("normalizes smoke imports to a bounded Modal run", () => {
    expect(resolveStriiveModalOptions({ limit: 3, smoke: true })).toEqual({
      limit: 3,
      maxPages: 1,
      smoke: true,
    });
  });

  it("passes bounded scrape controls into the Modal sandbox environment", () => {
    const env = buildStriiveModalEnv("user", "secret", {
      limit: 7,
      maxPages: 2,
      smoke: true,
    });

    expect(env).toMatchObject({
      STRIIVE_USERNAME: "user",
      STRIIVE_PASSWORD: "secret",
      STRIIVE_LIMIT: "7",
      STRIIVE_MAX_PAGES: "2",
      STRIIVE_SMOKE: "1",
    });
  });
});
