import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlatformAdapter } from "../packages/scrapers/src/platform-registry";
import {
  mapOpdrachtoverheidTenderToListing,
  mapTenderActiveToStatus,
  scrapeOpdrachtoverheid,
} from "../src/services/scrapers/opdrachtoverheid";

describe("Opdrachtoverheid scraper mapping", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("maps tender_active to persistent vacancy status", () => {
    expect(mapTenderActiveToStatus(true)).toBe("open");
    expect(mapTenderActiveToStatus(false)).toBe("closed");
    expect(mapTenderActiveToStatus(null)).toBe("open");
    expect(mapTenderActiveToStatus(undefined)).toBe("open");
  });

  it("maps tender_buying_organization to endClient and keeps company for compatibility", () => {
    const listing = mapOpdrachtoverheidTenderToListing({
      tender_active: false,
      tender_name: "Senior Java Developer",
      tender_buying_organization: "Gemeente Utrecht",
      tender_description:
        "Senior Java developer gezocht voor modernisering van gemeentelijke systemen.",
      web_key: "oo-123",
      opdracht_overheid_url: "https://www.opdrachtoverheid.nl/opdracht/oo-123",
    });

    expect(listing.company).toBe("Gemeente Utrecht");
    expect(listing.endClient).toBe("Gemeente Utrecht");
    expect(listing.status).toBe("closed");
    expect(listing.externalId).toBe("oo-123");
  });

  it("respects configured maxPages in the direct scraper", async () => {
    const responses = [
      {
        negometrix_tenders: [
          {
            tender_name: "Senior Java Developer",
            tender_buying_organization: "Gemeente Utrecht",
            tender_description: "Beschrijving",
            web_key: "oo-1",
            opdracht_overheid_url: "https://www.opdrachtoverheid.nl/opdracht/oo-1",
          },
        ],
      },
      {
        negometrix_tenders: [
          {
            tender_name: "Data Engineer",
            tender_buying_organization: "Gemeente Amsterdam",
            tender_description: "Beschrijving",
            web_key: "oo-2",
            opdracht_overheid_url: "https://www.opdrachtoverheid.nl/opdracht/oo-2",
          },
        ],
      },
    ];

    globalThis.fetch = vi.fn(async () => {
      const payload = responses.shift() ?? { negometrix_tenders: [] };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const listings = await scrapeOpdrachtoverheid({ maxPages: 1 });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(listings).toHaveLength(1);
    expect(listings[0]?.externalId).toBe("oo-1");
  });

  it("passes runtime maxPages and smoke limits through the registered adapter", async () => {
    const adapter = getPlatformAdapter("opdrachtoverheid");

    globalThis.fetch = vi.fn(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      const offset = body.offset as number;
      const limit = body.limit as number;

      const base = [
        {
          tender_name: `Tender ${offset + 1}`,
          tender_buying_organization: "Gemeente Utrecht",
          tender_description: "Beschrijving",
          web_key: `oo-${offset + 1}`,
          opdracht_overheid_url: `https://www.opdrachtoverheid.nl/opdracht/oo-${offset + 1}`,
        },
      ];

      const tenders = limit === 1000 ? base : base.slice(0, 1);

      return new Response(JSON.stringify({ negometrix_tenders: tenders }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await adapter?.scrape(
      {
        slug: "opdrachtoverheid",
        baseUrl: "https://www.opdrachtoverheid.nl/",
        parameters: { maxPages: 5 },
        auth: {},
      },
      { limit: 1, smoke: true },
    );

    expect(result?.listings).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
