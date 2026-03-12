import { describe, expect, it } from "vitest";
import {
  getImplementedPlatformSlugs,
  getPlatformDefinition,
  listPlatformDefinitions,
} from "../packages/scrapers/src/platform-registry";
import { PLATFORMS } from "../src/lib/helpers";

describe("platform registry", () => {
  it("contains the legacy platforms plus the new public boards", () => {
    expect(getImplementedPlatformSlugs()).toEqual(
      expect.arrayContaining([
        "flextender",
        "opdrachtoverheid",
        "striive",
        "nationalevacaturebank",
        "werkzoeken",
      ]),
    );
  });

  it("exposes metadata for NVB and Werkzoeken onboarding", () => {
    const nvb = getPlatformDefinition("nationalevacaturebank");
    const werkzoeken = getPlatformDefinition("werkzoeken");

    expect(nvb?.adapterKind).toBe("browser_bootstrap_http_harvest");
    expect(nvb?.authMode).toBe("session");
    expect(werkzoeken?.adapterKind).toBe("http_html_list_detail");
    expect(werkzoeken?.authMode).toBe("none");
    expect(werkzoeken?.configSchema.shape.parameters).toBeDefined();
  });

  it("drives the shared platform helper list instead of a hardcoded array", () => {
    expect(PLATFORMS).toEqual(getImplementedPlatformSlugs());
    expect(listPlatformDefinitions().length).toBeGreaterThanOrEqual(PLATFORMS.length);
  });
});
