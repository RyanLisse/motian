import { describe, expect, it } from "vitest";
import {
  getImplementedPlatformSlugs,
  getPlatformAdapter,
  getPlatformDefinition,
  listPlatformDefinitions,
} from "../packages/scrapers/src/platform-registry";
import { PLATFORMS } from "../src/lib/helpers";

describe("platform registry", () => {
  it("contains the legacy platforms plus the new public boards", () => {
    expect(getImplementedPlatformSlugs()).toEqual(
      expect.arrayContaining([
        "flextender",
        "mipublic",
        "opdrachtoverheid",
        "striive",
        "nationalevacaturebank",
        "werkzoeken",
      ]),
    );
  });

  it("keeps the MiPublic adapter registered for scrape pipeline parity", () => {
    const mipublic = getPlatformAdapter("mipublic");

    expect(mipublic).toBeDefined();
  });

  it("exposes metadata for NVB and Werkzoeken onboarding", () => {
    const nvb = getPlatformDefinition("nationalevacaturebank");
    const werkzoeken = getPlatformDefinition("werkzoeken");

    expect(nvb?.adapterKind).toBe("browser_bootstrap_http_harvest");
    expect(nvb?.authMode).toBe("session");
    expect(werkzoeken?.adapterKind).toBe("http_html_list_detail");
    expect(werkzoeken?.authMode).toBe("none");
    expect(werkzoeken?.docsUrl).toBe("https://www.werkzoeken.nl/doc/");
    expect(werkzoeken?.configSchema.shape.parameters).toBeDefined();
    expect(werkzoeken?.docsUrl).toBe("https://www.werkzoeken.nl/doc/");
  });

  it("drives the shared platform helper list instead of a hardcoded array", () => {
    expect(PLATFORMS).toEqual(getImplementedPlatformSlugs());
    expect(listPlatformDefinitions().length).toBeGreaterThanOrEqual(PLATFORMS.length);
  });

  it("documents fixed-source adapters instead of pretending runtime baseUrl is used", async () => {
    const flextender = getPlatformAdapter("flextender");
    const opdrachtoverheid = getPlatformAdapter("opdrachtoverheid");

    const [flextenderValidation, opdrachtoverheidValidation] = await Promise.all([
      flextender?.validate({
        slug: "flextender",
        baseUrl: "",
        parameters: {},
        auth: {},
      }),
      opdrachtoverheid?.validate({
        slug: "opdrachtoverheid",
        baseUrl: "",
        parameters: {},
        auth: {},
      }),
    ]);

    expect(flextenderValidation?.ok).toBe(true);
    expect(flextenderValidation?.message).toContain("vaste bron-URL");
    expect(opdrachtoverheidValidation?.ok).toBe(true);
    expect(opdrachtoverheidValidation?.message).toContain("vaste API-bron");
  });
});
