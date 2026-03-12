import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nationaleVacaturebankAdapter } from "../packages/scrapers/src/nationalevacaturebank";

const listingHtml = `
  <html>
    <body>
      <main>
        <li>
          <a
            href="/vacature/123/senior-engineer"
            class="nvb_searchResult__card"
            data-analytics-label="vac-123"
          >
            <h2>Senior Engineer</h2>
            <strong class="nvb_companyName__card">Acme</strong>
            <span>Amsterdam</span>
            <div class="nvb_attributes__IP60d">
              <div class="nvb_attribute__row">32 - 40 uur</div>
              <div class="nvb_attribute__row">EUR 80 - 95</div>
              <div class="nvb_attribute__row">HBO</div>
            </div>
            <div class="nvb_publishedDate__row">Vandaag</div>
          </a>
        </li>
      </main>
    </body>
  </html>
`;

const detailHtml = `
  <html>
    <body>
      <div class="nvb_info__0vhLJ"><h2>Senior Engineer</h2></div>
      <div class="nvb_company__card">
        <a href="/bedrijf/acme">Acme</a>
        <a href="/locatie/amsterdam">Amsterdam</a>
      </div>
      <section>
        <span>dienstverband</span><strong>vast</strong>
        <span>opleidingsniveau</span><strong>HBO</strong>
      </section>
      <div>
        <h3 class="nvb_subHeading__section">Functieomschrijving</h3>
      </div>
      <div class="nvb_text__section">
        Bouw platformen voor recruitment teams.
      </div>
    </body>
  </html>
`;

describe("nationale vacaturebank scraper", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/vacatures/branche/ict")) {
        return new Response(listingHtml, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.includes("/vacature/123/senior-engineer")) {
        return new Response(detailHtml, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response("not found", { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("hydrates listing imports with detail-page fields during smoke import", async () => {
    const result = await nationaleVacaturebankAdapter.testImport(
      {
        slug: "nationalevacaturebank",
        baseUrl: "https://www.nationalevacaturebank.nl",
        parameters: {
          sourcePath: "/vacatures/branche/ict",
          maxPages: 1,
          detailLimit: 2,
        },
        auth: {},
      },
      { limit: 1 },
    );

    expect(result.status).toBe("success");
    expect(result.jobsFound).toBe(1);
    expect(result.listings[0]).toEqual(
      expect.objectContaining({
        title: "Senior Engineer",
        company: "Acme",
        location: "Amsterdam",
        contractType: "vast",
        educationLevel: "HBO",
        description: expect.stringContaining("Bouw platformen"),
      }),
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
