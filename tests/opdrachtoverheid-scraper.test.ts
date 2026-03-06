import { describe, expect, it } from "vitest";
import {
  mapOpdrachtoverheidTenderToListing,
  mapTenderActiveToStatus,
} from "../src/services/scrapers/opdrachtoverheid";

describe("Opdrachtoverheid scraper mapping", () => {
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
});
