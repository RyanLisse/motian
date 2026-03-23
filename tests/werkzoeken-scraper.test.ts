import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWerkzoekenListPageUrl,
  parseWerkzoekenDetailPage,
  parseWerkzoekenListingCards,
  werkzoekenAdapter,
} from "../packages/scrapers/src/werkzoeken";

const LISTING_HTML = `
  <div class="vacancy-list">
    <a
      data-position="1"
      data-page-number="1"
      data-result-count="50"
      data-age="30+ dagen geleden"
      data-business="AXS Techniek"
      data-business-type="Werving en selectie"
      data-contract-type="Loondienst (vast)"
      data-education="MBO"
      data-experience="Ervaren,Expert,Starter"
      data-hours="Fulltime"
      data-location-label="Zwijndrecht"
      data-salary-minimal="3000.00"
      data-salary-maximum="4800.00"
      data-url="https://www.werkzoeken.nl/vacature/15167751-werkvoorbereider-engineer-hvac-tot-eur4800-bruto-per-maand/"
      data-vacancyid="15167751"
      class="vacancy vac"
      href="https://www.werkzoeken.nl/vacature/15167751-werkvoorbereider-engineer-hvac-tot-eur4800-bruto-per-maand/"
      title="Werkvoorbereider/Engineer HVAC tot &euro;4.800 bruto per maand | Zwijndrecht | AXS Techniek"
    >
      <h3>Werkvoorbereider/Engineer HVAC tot &euro;4.800 bruto per maand</h3>
      <div class="location-and-company-name has-logo">
        <strong>Zwijndrecht</strong>
        <span class="bullet">&bull;</span> AXS Techniek
      </div>
      <div class="requested-wrapper">
        <div class="">Fulltime</div>
        <div class="">MBO</div>
        <div class="offer" style="background:#FFF5F5">&euro; 3.000 - &euro; 4.800 p/m</div>
      </div>
      <span class="meta">30+ dagen geleden</span>
    </a>
  </div>
`;

const DETAIL_HTML = `
  <html>
    <head>
      <meta
        name="description"
        content="Vacature Werkvoorbereider/Engineer HVAC tot &euro;4.800 bruto per maand | Zwijndrecht | AXS Techniek op Werkzoeken.nl."
      />
    </head>
    <body>
      <main>
        <h1>Werkvoorbereider/Engineer HVAC tot &euro;4.800 bruto per maand</h1>
        <div class="company-name">AXS Techniek</div>
        <div class="job-overview">
          <div>Zwijndrecht</div>
          <div>Fulltime</div>
          <div>MBO</div>
        </div>
        <section class="job-description">
          <p>Voor deze uitdagende rol als Werkvoorbereider/Engineer HVAC werk je bij een innovatieve organisatie.</p>
          <p>Je stemt engineering, planning en uitvoering op elkaar af.</p>
        </section>
      </main>
    </body>
  </html>
`;

const originalFetch = globalThis.fetch;

describe("Werkzoeken scraper", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("builds repeatable pagination URLs from the seeded techniek path", () => {
    expect(
      buildWerkzoekenListPageUrl("https://www.werkzoeken.nl", "/vacatures-voor/techniek/", 1),
    ).toBe("https://www.werkzoeken.nl/vacatures-voor/techniek/");
    expect(
      buildWerkzoekenListPageUrl("https://www.werkzoeken.nl", "/vacatures-voor/techniek/", 3),
    ).toBe("https://www.werkzoeken.nl/vacatures-voor/techniek/?pnr=3");
  });

  it("parses listing cards from SSR markup", () => {
    const listings = parseWerkzoekenListingCards(LISTING_HTML);

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      externalId: "15167751",
      externalUrl:
        "https://www.werkzoeken.nl/vacature/15167751-werkvoorbereider-engineer-hvac-tot-eur4800-bruto-per-maand/",
      title: "Werkvoorbereider/Engineer HVAC tot €4.800 bruto per maand",
      company: "AXS Techniek",
      location: "Zwijndrecht",
      rateMin: 3000,
      rateMax: 4800,
    });
  });

  it("parses Dutch salary thousands separators as whole euros", () => {
    const listings = parseWerkzoekenListingCards(
      LISTING_HTML.replace('data-salary-minimal="3000.00"', 'data-salary-minimal="3.500"'),
    );

    expect(listings[0]?.rateMin).toBe(3500);
  });

  it("keeps source paths scoped to the configured host", () => {
    expect(() =>
      buildWerkzoekenListPageUrl(
        "https://staging.werkzoeken.test",
        "https://evil.example/vacatures",
        1,
      ),
    ).toThrow(/zelfde host/i);
  });

  it("resolves relative vacancy links against the configured base url", () => {
    const listings = parseWerkzoekenListingCards(
      LISTING_HTML.replace(
        'href="https://www.werkzoeken.nl/vacature/15167751-werkvoorbereider-engineer-hvac-tot-eur4800-bruto-per-maand/"',
        'href="/vacature/15167751-werkvoorbereider-engineer-hvac-tot-eur4800-bruto-per-maand/"',
      ),
      "https://staging.werkzoeken.test",
    );

    expect(listings[0]?.externalUrl).toBe(
      "https://staging.werkzoeken.test/vacature/15167751-werkvoorbereider-engineer-hvac-tot-eur4800-bruto-per-maand/",
    );
  });

  it("merges detail-page content into the normalized listing shape", () => {
    const detail = parseWerkzoekenDetailPage(
      DETAIL_HTML,
      "https://www.werkzoeken.nl/vacature/15167751-werkvoorbereider-engineer-hvac-tot-eur4800-bruto-per-maand/",
    );

    expect(detail.title).toBe("Werkvoorbereider/Engineer HVAC tot €4.800 bruto per maand");
    expect(detail.company).toBe("AXS Techniek");
    expect(detail.location).toBe("Zwijndrecht");
    expect(detail.description).toContain("innovatieve organisatie");
  });

  it("treats an empty second page as the end of pagination instead of a scraper error", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("?pnr=2")) {
        return new Response("<html><body>Geen extra resultaten</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.includes("/vacature/15167751-werkvoorbereider-engineer-hvac")) {
        return new Response(DETAIL_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response(LISTING_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    const result = await werkzoekenAdapter.scrape(
      {
        slug: "werkzoeken",
        baseUrl: "https://www.werkzoeken.nl",
        parameters: {
          sourcePath: "/vacatures-voor/techniek/",
          maxPages: 2,
          pnrStep: 1,
          detailConcurrency: 1,
        },
        auth: {},
      },
      { limit: 5 },
    );

    expect(result.blockerKind).toBeUndefined();
    expect(result.errors).toBeUndefined();
    expect(result.listings).toHaveLength(1);
  });

  it("jumps pages correctly with variable pnrStep values (e.g., pnrStep: 2)", async () => {
    const adapter = werkzoekenAdapter;
    let callCount = 0;
    const requestedUrls: string[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      requestedUrls.push(urlStr);
      callCount++;

      // Return a unique listing for each call to allow pagination to continue
      if (callCount <= 2) {
        const id = callCount === 1 ? "1" : "2";
        const mockHtml = `
          <div class="vacancy-list">
            <a data-vacancyid="${id}" class="vacancy vac" href="/vacature/${id}">
              <h3>Job ${id}</h3>
            </a>
          </div>
        `;
        return new Response(`<html><body>${mockHtml}</body></html>`, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response(
        '<html><body><div class="no-results">Geen resultaten</div></body></html>',
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        },
      );
    }) as typeof fetch;

    const config = {
      slug: "werkzoeken",
      baseUrl: "https://www.werkzoeken.nl",
      parameters: {
        sourcePath: "/vacatures-voor/techniek/",
        maxPages: 10,
        pnrStep: 2, // Should jump 2, 4, 6...
      },
      auth: {},
    };

    await adapter.scrape(config);

    // Should have requested:
    // 1. Initial (pnr=2)
    // 2. pnr=4 (2 + 2)
    // 3. pnr=6 (4 + 2) - this returns empty
    expect(requestedUrls).toContain("https://www.werkzoeken.nl/vacatures-voor/techniek/?pnr=2");
    expect(requestedUrls).toContain("https://www.werkzoeken.nl/vacatures-voor/techniek/?pnr=4");
    expect(requestedUrls).toContain("https://www.werkzoeken.nl/vacatures-voor/techniek/?pnr=6");
    expect(callCount).toBe(5); // 3 listing pages + 2 detail pages
  });

  it("falls back to sane pagination and concurrency defaults when config numbers are invalid", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/vacature/")) {
        return new Response(DETAIL_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response(LISTING_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    const result = await werkzoekenAdapter.scrape(
      {
        slug: "werkzoeken",
        baseUrl: "https://www.werkzoeken.nl",
        parameters: {
          sourcePath: "/vacatures-voor/techniek/",
          maxPages: "geen-getal",
          pnrStep: 1,
          detailConcurrency: "ook-geen-getal",
        },
        auth: {},
      },
      { limit: 2 },
    );

    expect(result.errors).toBeUndefined();
    expect(result.listings).toHaveLength(1);
  });

  it("deduplicates cumulative pnr responses across pages", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/vacature/")) {
        return new Response(DETAIL_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      callCount++;

      if (callCount === 1) {
        return new Response(LISTING_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      if (callCount === 2) {
        const listingB = LISTING_HTML.replace(/15167751/g, "99999999").replace(
          "Werkvoorbereider/Engineer",
          "Monteur Elektrotechniek",
        );
        return new Response(LISTING_HTML + listingB, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response("<html><body>Geen extra resultaten</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    const result = await werkzoekenAdapter.scrape({
      slug: "werkzoeken",
      baseUrl: "https://www.werkzoeken.nl",
      parameters: {
        sourcePath: "/vacatures-voor/techniek/",
        maxPages: 5,
        pnrStep: 1,
        detailConcurrency: 1,
        skipDetailEnrichment: true,
      },
      auth: {},
    });

    expect(result.listings).toHaveLength(2);
    expect(result.blockerKind).toBeUndefined();
    expect(result.errors).toBeUndefined();
  });
});
